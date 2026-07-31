/**
 * Profile Centre — Microsoft Entra OIDC authentication
 *
 * Two completely separate flows:
 *   Customer → JA Group Services ID / Entra External ID (CIAM)
 *   Admin    → JA Group Services normal workforce tenant
 *
 * OIDC state (state + codeVerifier) is stored in the DATABASE, not cookies.
 * Cookies cannot be used because login may be initiated on one domain
 * (e.g. preview URL) while the callback arrives on another (custom domain).
 * DB-backed state survives cross-domain redirects, HMR reloads, and
 * session-store swaps without any domain-matching issues.
 *
 * All redirect URIs: https://japrofilestudio.jagroupservices.co.uk
 */
import { type Request, type Response } from 'express';
import * as openidClient from 'openid-client';
import { getSecret } from '#airo/secrets';
import db from '../../db.js';
import { trackReferralSignup } from '../referral/index.js';
import { awardPoints, getOrCreateReferralCode } from '../../lib/points.js';
import { writeAudit } from '../../lib/audit.js';
import { assignUserNumber } from '../../lib/user-number.js';

// ─── DB-backed OIDC state store ──────────────────────────────────────────────
// State is keyed by the `state` parameter sent to Microsoft.
// Expires after 15 minutes — more than enough for any login flow.
// Pruned on every read and periodically via setInterval.

const OIDC_STATE_TTL_MS = 15 * 60 * 1000;

function ensureOidcStateTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS oidc_state (
      state        TEXT PRIMARY KEY,
      flow         TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      expires_at   INTEGER NOT NULL,
      redirect_to  TEXT
    )
  `);
  // Idempotent: add redirect_to column if it doesn't exist yet (migration)
  try { db.exec('ALTER TABLE oidc_state ADD COLUMN redirect_to TEXT'); } catch { /* already exists */ }
  // Idempotent: add callback_uri column to store the dynamic redirect_uri per login attempt
  try { db.exec('ALTER TABLE oidc_state ADD COLUMN callback_uri TEXT'); } catch { /* already exists */ }
  // Idempotent: add consumed_at column for grace-period double-callback handling
  try { db.exec('ALTER TABLE oidc_state ADD COLUMN consumed_at INTEGER'); } catch { /* already exists */ }
}

try { ensureOidcStateTable(); } catch { /* already exists */ }

// Prune expired state rows every 5 minutes
// Also prune consumed rows whose grace period has passed (consumed_at + 60s)
setInterval(() => {
  try {
    db.prepare('DELETE FROM oidc_state WHERE expires_at < ?').run(Date.now());
    db.prepare('DELETE FROM oidc_state WHERE consumed_at IS NOT NULL AND consumed_at < ?').run(Date.now() - 60 * 1000);
  } catch { /* ignore */ }
}, 5 * 60 * 1000);

function saveOidcState(state: string, flow: 'customer' | 'admin', codeVerifier: string, redirectTo?: string, callbackUri?: string): void {
  ensureOidcStateTable();
  db.prepare(
    'INSERT OR REPLACE INTO oidc_state (state, flow, code_verifier, expires_at, redirect_to, callback_uri) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(state, flow, codeVerifier, Date.now() + OIDC_STATE_TTL_MS, redirectTo ?? null, callbackUri ?? null);
}

function getOidcState(state: string, flow: 'customer' | 'admin'): { codeVerifier: string; redirectTo: string | null; callbackUri: string | null } | null {
  try {
    ensureOidcStateTable();
    // Prune expired rows first
    db.prepare('DELETE FROM oidc_state WHERE expires_at < ?').run(Date.now());
    const row = db.prepare(
      'SELECT code_verifier, redirect_to, callback_uri, consumed_at FROM oidc_state WHERE state = ? AND flow = ?'
    ).get(state, flow) as { code_verifier: string; redirect_to: string | null; callback_uri: string | null; consumed_at: number | null } | undefined;
    if (!row) return null;

    const now = Date.now();

    if (row.consumed_at !== null) {
      // State was already consumed. Allow a 60-second grace window to handle
      // Microsoft CIAM's double-callback behaviour (it fires the redirect URI twice
      // with the same state — the second hit must return the same result, not an error).
      const gracePeriodMs = 60 * 1000;
      if (now - row.consumed_at < gracePeriodMs) {
        // Within grace period — return the cached result without re-consuming
        return { codeVerifier: row.code_verifier, redirectTo: row.redirect_to ?? null, callbackUri: row.callback_uri ?? null };
      }
      // Outside grace period — treat as expired/missing
      db.prepare('DELETE FROM oidc_state WHERE state = ?').run(state);
      return null;
    }

    // First consumption — mark as consumed (don't delete yet, keep for grace window)
    db.prepare('UPDATE oidc_state SET consumed_at = ? WHERE state = ?').run(now, state);
    return { codeVerifier: row.code_verifier, redirectTo: row.redirect_to ?? null, callbackUri: row.callback_uri ?? null };
  } catch {
    return null;
  }
}

// Legacy cookie helpers — kept as no-ops so call sites compile without changes.
// The cookie is no longer set or read; state is in the DB via saveOidcState/getOidcState.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setOidcCookie(_res: Response, _name: string, _data: Record<string, string>): void { /* no-op */ }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getOidcCookie(_req: Request, _name: string): Record<string, string> | null { return null; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function clearOidcCookie(_res: Response, _name: string): void { /* no-op */ }

// ─── Constants ──────────────────────────────────────────────────────────────

const APP_BASE_URL = 'https://japrofilestudio.jagroupservices.co.uk';

/**
 * Derive the base URL from the incoming request so that the OIDC redirect_uri
 * always matches the origin the user is actually on (preview URL or custom domain).
 * Falls back to the hardcoded APP_BASE_URL if the request host cannot be determined.
 *
 * This is critical: if the user logs in on the preview domain but the redirect_uri
 * points to the custom domain, the session cookie is set on the wrong origin and
 * /api/auth/me returns 401 → the user is bounced back to /login immediately.
 */
function getRequestBaseUrl(req: Request): string {
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return APP_BASE_URL;
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol || 'https';
  return `${proto}://${host}`;
}

// Customer — JA Group Services ID / Entra External ID (CIAM)
// Tenant ID, Client ID, and metadata URL are loaded from secrets so no credentials
// are hard-coded in source. Secrets: OIDC_TENANT_ID, OIDC_CLIENT_ID, OIDC_METADATA_URL.
// Use tenant-specific authority — /common is NOT supported by CIAM tenants
const _customerTenantId  = (getSecret('OIDC_TENANT_ID')    as string | undefined) || '';
const _customerClientId  = (getSecret('OIDC_CLIENT_ID')    as string | undefined) || '';
const _customerMetaUrl   = (getSecret('OIDC_METADATA_URL') as string | undefined)
  || (_customerTenantId ? `https://jagroupservicesid.ciamlogin.com/${_customerTenantId}/v2.0/.well-known/openid-configuration` : '');

const CUSTOMER = {
  tenantId:    _customerTenantId,
  clientId:    _customerClientId,
  metadataUrl: _customerMetaUrl,
  // redirectUri is now built dynamically per-request — see getRequestBaseUrl()
  redirectUri: `${APP_BASE_URL}/auth/callback`,
  scope:       'openid profile email',
};

// Admin — JA Group Services normal workforce tenant
// Secrets: ADMIN_OIDC_TENANT_ID, ADMIN_OIDC_CLIENT_ID, ADMIN_OIDC_METADATA_URL.
const _adminTenantId  = (getSecret('ADMIN_OIDC_TENANT_ID')    as string | undefined) || '';
const _adminClientId  = (getSecret('ADMIN_OIDC_CLIENT_ID')    as string | undefined) || '';
const _adminMetaUrl   = (getSecret('ADMIN_OIDC_METADATA_URL') as string | undefined)
  || (_adminTenantId ? `https://login.microsoftonline.com/${_adminTenantId}/v2.0/.well-known/openid-configuration` : '');

const ADMIN = {
  tenantId:    _adminTenantId,
  clientId:    _adminClientId,
  metadataUrl: _adminMetaUrl,
  // redirectUri is now built dynamically per-request — see getRequestBaseUrl()
  redirectUri: `${APP_BASE_URL}/admin/auth/callback`,
  scope:       'openid profile email',
  requiredRole: 'Administrator',
};

// ─── OIDC discovery cache (separate per flow, retries on failure) ────────────

let _customerCfg: openidClient.Configuration | null = null;
let _adminCfg:    openidClient.Configuration | null = null;

async function getCustomerCfg(): Promise<openidClient.Configuration> {
  if (_customerCfg) return _customerCfg;

  // The CIAM app registration platform is "Web" (confidential client).
  // Web-platform registrations require a client_secret on every token exchange.
  // PKCE is still used in addition to the secret for extra security.
  // Secret is stored as OIDC_CLIENT_SECRET in app secrets.
  const clientSecret = (getSecret('OIDC_CLIENT_SECRET') as string | undefined) || '';

  console.log('[auth:customer] Running OIDC discovery (tenant: jagroupservicesid / 3c0074dd)', {
    metadataUrl: CUSTOMER.metadataUrl,
    clientId: CUSTOMER.clientId.slice(0, 8) + '…',
    redirectUri: CUSTOMER.redirectUri,
    hasSecret: !!clientSecret,
  });

  if (!clientSecret) {
    console.error('[auth:customer] OIDC_CLIENT_SECRET is not set — token exchange will fail (AADSTS7000218). Add the secret from Azure portal → App registrations → Certificates & secrets.');
  }

  // Pass client_secret as third argument — required for "Web" platform (confidential client).
  // openid-client will include it in the token exchange POST body automatically.
  _customerCfg = await openidClient.discovery(
    new URL(CUSTOMER.metadataUrl),
    CUSTOMER.clientId,
    clientSecret || undefined,
  );

  console.log('[auth:customer] OIDC discovery OK');
  return _customerCfg;
}

async function getAdminCfg(): Promise<openidClient.Configuration> {
  if (_adminCfg) return _adminCfg;

  const secret = getSecret('ADMIN_OIDC_CLIENT_SECRET') as string | undefined;
  if (!secret) {
    console.error('[auth:admin] ADMIN_OIDC_CLIENT_SECRET secret is not set');
    throw new Error('ADMIN_OIDC_CLIENT_SECRET missing');
  }

  console.log('[auth:admin] Running OIDC discovery', {
    metadataUrl: ADMIN.metadataUrl,
    clientId: ADMIN.clientId.slice(0, 8) + '…',
    redirectUri: ADMIN.redirectUri,
  });

  _adminCfg = await openidClient.discovery(
    new URL(ADMIN.metadataUrl),
    ADMIN.clientId,
    secret,
  );

  console.log('[auth:admin] OIDC discovery OK — token_endpoint_auth_methods_supported:',
    (_adminCfg as any).serverMetadata?.token_endpoint_auth_methods_supported
  );
  return _adminCfg;
}

// Clear cache so next request retries discovery
function resetCustomerCfg() { _customerCfg = null; }
function resetAdminCfg()    { _adminCfg    = null; }

// ─── DB helpers (async — Azure shim returns Promises) ────────────────────────

type UserRow = { id: number; email: string; name: string; role: string; plan_id: number; entra_oid?: string | null };

async function getOrCreateUser(email: string, name: string, role: 'user' | 'admin'): Promise<UserRow> {
  // For customer flow (role='user'), look for an existing customer record first.
  // If the email exists only as admin, create a separate customer record so the
  // same email can have both an admin account and a customer account independently.
  const lowerEmail = email.toLowerCase();

  if (role === 'user') {
    // Try to find an existing customer (role='user') record for this email
    const existingCustomer = await (await db.prepare(
      "SELECT id, email, name, role, plan_id, entra_oid FROM users WHERE email = ? AND role = 'user'"
    ).get(lowerEmail) as Promise<UserRow | undefined> | UserRow | undefined);

    if (existingCustomer) {
      if (name && name !== existingCustomer.name) {
        await (await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, existingCustomer.id) as Promise<unknown> | unknown);
        existingCustomer.name = name;
      }
      return existingCustomer;
    }

    // No customer record — create one (even if an admin record exists for this email).
    // Auto-assign the Free plan immediately so new users never land on the
    // "select a plan" screen — they go straight to the dashboard on first login.
    const freePlanRow = db.prepare("SELECT id FROM plans WHERE slug = 'free' LIMIT 1").get() as { id: number } | undefined;
    const freePlanId = freePlanRow?.id ?? 1;

    const insertResult = await (db.prepare(
      "INSERT OR IGNORE INTO users (email, name, role, plan_id, account_status) VALUES (?, ?, 'user', ?, 'free')"
    ).run(lowerEmail, name, freePlanId) as Promise<{ changes: number; lastInsertRowid: number }> | { changes: number; lastInsertRowid: number });

    // If INSERT OR IGNORE skipped (changes=0) it means the email already exists
    // with a different role under the old UNIQUE(email) constraint. In that case
    // we cannot create a separate customer row — fall back to the existing record.
    if (Number(insertResult.changes) === 0) {
      const fallback = await (db.prepare(
        'SELECT id, email, name, role, plan_id FROM users WHERE email = ?'
      ).get(lowerEmail) as Promise<UserRow | undefined> | UserRow | undefined);
      if (fallback) {
        console.warn('[auth:customer] Email already exists with role=' + fallback.role + ' — reusing existing record for customer login');
        return fallback;
      }
      throw new Error(`Cannot create customer account for ${lowerEmail} — email conflict`);
    }

    const newUserId = Number(insertResult.lastInsertRowid);

    try {
      awardPoints(newUserId, 'signup', 'Welcome bonus for creating an account');
      getOrCreateReferralCode(newUserId);
    } catch { /* non-fatal */ }

    return { id: newUserId, email: lowerEmail, name, role: 'user', plan_id: freePlanId };
  }

  // Admin flow — look up by email regardless of role
  const existing = await (await db.prepare(
    'SELECT id, email, name, role, plan_id, entra_oid FROM users WHERE email = ?'
  ).get(lowerEmail) as Promise<UserRow | undefined> | UserRow | undefined);

  if (existing) {
    if (name && name !== existing.name) {
      await (await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, existing.id) as Promise<unknown> | unknown);
      existing.name = name;
    }
    return existing;
  }

  const freePlan = await (await db.prepare('SELECT id FROM plans WHERE slug = ?').get('free') as Promise<{ id: number } | undefined> | { id: number } | undefined);
  const planId = freePlan?.id ?? 1;
  const result = await (db.prepare(
    'INSERT INTO users (email, name, role, plan_id) VALUES (?, ?, ?, ?)'
  ).run(lowerEmail, name, role, planId) as Promise<{ changes: number; lastInsertRowid: number }> | { changes: number; lastInsertRowid: number });

  const newUserId = Number(result.lastInsertRowid);

  try {
    assignUserNumber(newUserId);
  } catch (err) {
    console.error('[user-number] Failed to assign user number on OIDC registration:', err);
  }

  try {
    awardPoints(newUserId, 'signup', 'Welcome bonus for creating an account');
    getOrCreateReferralCode(newUserId);
  } catch { /* non-fatal */ }

  return { id: newUserId, email: lowerEmail, name, role, plan_id: planId };
}

// Look up user by OID (for CIAM users whose email may change between logins)
// Prefers customer (role='user') records — admin records are only returned if no customer record exists
async function getUserByOid(oid: string): Promise<UserRow | undefined> {
  try {
    // Try customer record first
    const customer = await (await db.prepare(
      "SELECT id, email, name, role, plan_id, entra_oid FROM users WHERE entra_oid = ? AND role = 'user'"
    ).get(oid) as Promise<UserRow | undefined> | UserRow | undefined);
    if (customer) return customer;
    // Fall back to any record (e.g. admin OID lookup)
    return await (await db.prepare(
      'SELECT id, email, name, role, plan_id, entra_oid FROM users WHERE entra_oid = ?'
    ).get(oid) as Promise<UserRow | undefined> | UserRow | undefined);
  } catch {
    return undefined;
  }
}

// Upsert user by OID for the CUSTOMER flow — always resolves/creates a role='user' record.
// If the OID is already stamped on a customer record, update it.
// If the OID is only on an admin record (same person, different role), create a fresh customer record.
async function upsertUserByOid(oid: string, email: string, name: string): Promise<UserRow> {
  // Prefer customer record — same logic as getUserByOid but we act on the result differently
  const existing = await getUserByOid(oid);
  // If we found an admin-only record, ignore it and fall through to getOrCreateUser
  // which will find/create the customer record for this email.
  if (existing && existing.role !== 'admin') {
    const updates: string[] = [];
    const params: (string | number)[] = [];
    if (email && email !== existing.email) { updates.push('email = ?'); params.push(email.toLowerCase()); }
    if (name  && name  !== existing.name)  { updates.push('name = ?');  params.push(name); }
    if (updates.length) {
      params.push(existing.id);
      await (db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params) as Promise<unknown> | unknown);
      if (email) existing.email = email.toLowerCase();
      if (name)  existing.name  = name;
    }
    return existing;
  }
  // New user — create and immediately stamp the OID
  const user = await getOrCreateUser(email, name, 'user');
  try { await (await db.prepare('UPDATE users SET entra_oid = ? WHERE id = ?').run(oid, user.id) as Promise<unknown> | unknown); } catch { /* ignore */ }
  return user;
}

// ─── Session save helper ─────────────────────────────────────────────────────

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ─── Customer: /auth/login ───────────────────────────────────────────────────

export async function customerLoginStart(req: Request, res: Response) {
  console.log('[auth:customer] /auth/login hit');

  // ── Already authenticated guard ───────────────────────────────────────────
  // If a valid customer session already exists, do NOT start a new OIDC flow.
  // Redirect to /login so the account-choice screen handles it (continue,
  // switch account, or log out). This prevents two accounts being active at
  // the same time in the same browser session.
  if (req.session?.userId) {
    console.log('[auth:customer] Already authenticated (userId=%d) — redirecting to /login', req.session.userId);
    return res.redirect('/login');
  }

  try {
    const cfg = await getCustomerCfg();

    const codeVerifier  = openidClient.randomPKCECodeVerifier();
    const codeChallenge = await openidClient.calculatePKCECodeChallenge(codeVerifier);
    const state         = openidClient.randomState();

    // Build the redirect_uri from the actual request origin so the callback
    // always lands on the same domain the user is browsing (preview or live).
    const dynamicRedirectUri = `${getRequestBaseUrl(req)}/auth/callback`;

    // Store OIDC state in the database — NOT cookies.
    // Cookies cannot survive a cross-domain redirect (login on preview domain,
    // callback on custom domain). DB state is domain-agnostic.
    // Also store the post-login redirect URL (e.g. /invite/:token) so we can
    // send the user back there after authentication — no sessionStorage needed.
    const redirectTo = typeof req.query.redirect === 'string'
      ? req.query.redirect.trim()
      : undefined;
    // Only allow relative paths to prevent open-redirect attacks
    const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : undefined;
    saveOidcState(state, 'customer', codeVerifier, safeRedirect, dynamicRedirectUri);

    // Persist referral code from ?ref= in the session (non-critical)
    const refCode = typeof req.query.ref === 'string' ? req.query.ref.trim().toUpperCase() : undefined;
    if (refCode && /^[A-F0-9]{8}$/.test(refCode)) {
      req.session.pendingReferralCode = refCode;
      await saveSession(req);
    }

    const authUrl = openidClient.buildAuthorizationUrl(cfg, {
      redirect_uri:          dynamicRedirectUri,
      scope:                 CUSTOMER.scope,
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login',
    });

    console.log('[auth:customer] PKCE state saved to DB, redirecting to Entra External ID');
    res.redirect(authUrl.href);
  } catch (err) {
    resetCustomerCfg();
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auth:customer] Login start failed:', msg);
    res.redirect('/login?error=oidc_init_failed');
  }
}

// ─── Customer: /auth/callback ────────────────────────────────────────────────

export async function customerLoginCallback(req: Request, res: Response) {
  console.log('[auth:customer] /auth/callback hit — code present:', !!req.query.code);
  try {
    const cfg = await getCustomerCfg();

    // Always use the stored callbackUri from login-start so the URL passed to
    // authorizationCodeGrant exactly matches what was sent to Microsoft.
    // Deriving from req.protocol is unreliable behind a proxy (returns 'http').
    const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
    const oidcData = stateParam ? getOidcState(stateParam, 'customer') : null;
    console.log('[auth:customer] OIDC DB state found:', !!oidcData, '| state param:', stateParam?.slice(0, 8) + '...');

    const callbackBase = oidcData?.callbackUri
      ? oidcData.callbackUri.replace(/\/auth\/callback$/, '')
      : getRequestBaseUrl(req);
    const callbackUrl = new URL(req.url, callbackBase);
    console.log('[auth:customer] callbackUrl:', callbackUrl.href);
    console.log('[auth:customer] protocol:', req.protocol, '| x-forwarded-proto:', req.get('x-forwarded-proto'), '| host:', req.get('host'), '| x-forwarded-host:', req.get('x-forwarded-host'));

    if (req.query.error) {
      console.error('[auth:customer] Microsoft returned OAuth error:', req.query.error, req.query.error_description);
      return res.redirect(`/login?error=${req.query.error}`);
    }

    if (!oidcData?.codeVerifier) {
      console.error('[auth:customer] OIDC state missing from DB — state param:', stateParam?.slice(0, 8));
      return res.redirect('/login?error=oidc_state_missing');
    }

    console.log('[auth:customer] using callbackUrl for token exchange:', callbackUrl.href);

    const tokens = await openidClient.authorizationCodeGrant(cfg, callbackUrl, {
      pkceCodeVerifier: oidcData.codeVerifier,
      expectedState:    stateParam,
    });

    console.log('[auth:customer] Token exchange succeeded');

    const claims = tokens.claims();
    // Log only the claim key names — never log claim values (may contain PII)
    console.log('[auth:customer] Token claims keys:', Object.keys(claims ?? {}));

    // Try userinfo endpoint first — CIAM often puts email there but not in the ID token
    let userinfoEmail = '';
    let userinfoName  = '';
    try {
      const userinfo = await openidClient.fetchUserInfo(cfg, tokens.access_token!, claims?.sub as string);
      // Log only key names — never log userinfo values (contains PII)
      console.log('[auth:customer] Userinfo keys:', Object.keys(userinfo ?? {}));
      userinfoEmail = (userinfo?.email as string) || '';
      userinfoName  = (userinfo?.name  as string)
                   || `${userinfo?.given_name ?? ''} ${userinfo?.family_name ?? ''}`.trim()
                   || '';
    } catch (uiErr) {
      console.warn('[auth:customer] Userinfo fetch failed (non-fatal):', uiErr instanceof Error ? uiErr.message : String(uiErr));
    }

    const oid   = (claims?.oid               as string) || '';
    const email = userinfoEmail
               || (claims?.email             as string)
               || (claims?.preferred_username as string)
               || (oid ? `${oid}@japrofilestudio.local` : '');
    const name  = userinfoName
               || (claims?.name              as string)
               || `${claims?.given_name ?? ''} ${claims?.family_name ?? ''}`.trim()
               || email.split('@')[0];

    if (!email) {
      console.warn('[auth:customer] Cannot derive identity — claims keys:', Object.keys(claims ?? {}));
      return res.redirect('/login?error=no_email');
    }

    // Log only user ID and OID — never log email or name to server logs (PII)
    console.log('[auth:customer] Identity resolved — oid:', oid || '(none)');

    // Check if a customer (role='user') record already exists for this identity.
    // We check for a user-role record specifically — an admin-only record does NOT
    // count as an existing customer account (same email can have both roles).
    const existingCustomerRecord = oid
      ? await (db.prepare("SELECT id FROM users WHERE entra_oid = ? AND role = 'user'").get(oid) as { id: number } | undefined)
      : await (db.prepare("SELECT id FROM users WHERE email = ? AND role = 'user'").get(email.toLowerCase()) as { id: number } | undefined);

    // Also check by email in case OID wasn't stamped on a previous login
    const existingByEmail = !existingCustomerRecord
      ? await (db.prepare("SELECT id FROM users WHERE email = ? AND role = 'user'").get(email.toLowerCase()) as { id: number } | undefined)
      : null;

    const isNewUser = !existingCustomerRecord && !existingByEmail;

    // Always resolve/create a customer (role='user') record via the CIAM flow.
    // A person can be both a customer and an admin — the two sessions are completely
    // separate. Customer CIAM login always produces a customer session regardless of
    // whether the same email also has an admin record in the workforce tenant.
    const user = oid ? await upsertUserByOid(oid, email, name) : await getOrCreateUser(email, name, 'user');

    // Always stamp entra_oid on the user record so future logins can match by OID
    // (not just email). Without this, returning users whose OID wasn't stored on
    // first login are treated as new users every time → wrongly sent to /dashboard/billing.
    if (oid && !user.entra_oid) {
      try {
        await (db.prepare('UPDATE users SET entra_oid = ? WHERE id = ?').run(oid, user.id) as Promise<unknown> | unknown);
        (user as any).entra_oid = oid;
      } catch { /* non-fatal */ }
    }

    // Update last_login_at on every login
    try {
      await (db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id) as Promise<unknown> | unknown);
    } catch { /* non-fatal */ }

    // ── Auto-assign Free plan to existing users with no plan ──────────────────
    // Users created before auto-assignment was added may have plan_id = NULL and
    // account_status = 'plan_selection' or 'no_plan'. Silently move them to Free
    // so they never see the "select a plan" screen.
    if (!user.plan_id) {
      try {
        const freePlanRow = db.prepare("SELECT id FROM plans WHERE slug = 'free' LIMIT 1").get() as { id: number } | undefined;
        const freePlanId = freePlanRow?.id ?? 1;
        db.prepare("UPDATE users SET plan_id = ?, account_status = 'free' WHERE id = ? AND (plan_id IS NULL OR plan_id = 0)").run(freePlanId, user.id);
        user.plan_id = freePlanId;
        console.log('[auth:customer] Auto-assigned Free plan to user', user.id);
      } catch { /* non-fatal */ }
    }

    // ── Concurrent-session guard ──────────────────────────────────────────────
    // If a DIFFERENT user is already logged in on this session, reject the login
    // attempt. The user must log out first. This prevents one browser tab from
    // silently overwriting another user's session (e.g. two accounts in the same
    // browser without logging out).
    const existingUserId = req.session?.userId;
    if (existingUserId && existingUserId !== user.id) {
      console.warn('[auth:customer] Concurrent-session blocked — session already belongs to user', existingUserId, '— attempted login as user', user.id);
      writeAudit({ actorId: user.id, actorName: name, actorEmail: email, actorType: 'user', tenant: 'customer_ciam', authProvider: 'microsoft_entra_external_id', action: 'login', resourceType: 'auth', details: `Concurrent-session blocked — session already owned by user ${existingUserId}`, ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null, result: 'error' });
      return res.redirect('/login?error=already_signed_in');
    }

    const pendingReferral = req.session.pendingReferralCode;

    // ── Session fixation prevention ───────────────────────────────────────────
    // Regenerate the session ID before writing any auth data. This invalidates
    // the old session record in the store and creates a fresh one, so a session
    // ID that was observed before login cannot be reused after login.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (isNewUser && pendingReferral) {
      trackReferralSignup(user.id, pendingReferral);
    }

    req.session.userId   = user.id;
    req.session.userRole = user.role;
    req.session.customerIdToken = tokens.id_token ?? undefined;

    await saveSession(req);

    try {
      writeAudit({ actorId: user.id, actorName: name, actorEmail: email, actorType: 'user', tenant: 'customer_ciam', authProvider: 'microsoft_entra_external_id', action: isNewUser ? 'register' : 'login', resourceType: 'auth', details: isNewUser ? 'New user registration via OIDC (Entra External ID)' : 'User login via OIDC (Entra External ID)', ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null, result: 'success' });
    } catch { /* non-fatal */ }

    if (isNewUser) {
      try {
        const { notifyNewSignup, notifyWelcome } = await import('../../lib/notifications.js');
        notifyNewSignup({ userName: name, userEmail: email, userId: user.id, isReferral: false, referralCode: undefined });
        notifyWelcome({ userName: name, userEmail: email });
      } catch { /* non-fatal */ }
      // Seat invites are NOT auto-accepted. New users must visit /invite/:token to explicitly accept.
    } else {
      // Returning user — fire a login security alert (essential, always sent)
      try {
        const { notifySecurityAlert } = await import('../../lib/notifications.js');
        notifySecurityAlert({
          userEmail: email,
          userName: name,
          userId: user.id,
          alertType: 'new_login',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }
    }

    console.log('[auth:customer] Session created — redirecting');
    // Everyone is auto-assigned Free on signup so there's no plan-selection step.
    // New users go to overview; returning users go to overview.
    // If a post-login redirect was stored in OIDC state (e.g. /invite/:token), use it.
    const postLoginRedirect = oidcData.redirectTo ?? '/dashboard/overview';
    res.redirect(postLoginRedirect);
  } catch (err) {
    resetCustomerCfg();
    clearOidcCookie(res, 'oidc_customer');
    if (err instanceof Error) {
      console.error('[auth:customer] Callback failed:', err.message);
      const cause = (err as any).cause;
      if (cause) console.error('[auth:customer] Error cause:', JSON.stringify(cause, null, 2));
    } else {
      console.error('[auth:customer] Callback failed (non-Error):', String(err));
    }
    res.redirect('/login?error=oidc_callback_failed');
  }
}

// ─── Customer: /auth/logout ──────────────────────────────────────────────────

export async function customerLogout(req: Request, res: Response) {
  console.log('[auth:customer] /auth/logout hit');

  // Grab the id_token_hint before we destroy the session (needed for Entra logout)
  const idTokenHint = req.session.customerIdToken ?? null;

  req.session.destroy((err) => {
    if (err) console.error('[auth:customer] session destroy error', err);
    res.clearCookie('ja_profile_studio_session', { path: '/' });

    // Build Entra External ID end_session URL so Microsoft clears its SSO cookie too.
    // post_logout_redirect_uri MUST be registered in the Azure app registration.
    // If ?switch=1 was passed to /auth/logout, forward it to /logged-out so the
    // page knows to auto-redirect to /auth/login — no localStorage needed.
    const switchAccount = (req.query.switch === '1');
    const postLogoutUri = switchAccount
      ? `${APP_BASE_URL}/logged-out?switch=1`
      : `${APP_BASE_URL}/logged-out`;
    const endSessionBase = `https://jagroupservicesid.ciamlogin.com/${CUSTOMER.tenantId}/oauth2/v2.0/logout`;
    const params = new URLSearchParams({ post_logout_redirect_uri: postLogoutUri });
    if (idTokenHint) params.set('id_token_hint', idTokenHint);

    const logoutUrl = `${endSessionBase}?${params.toString()}`;
    console.log('[auth:customer] Redirecting to Entra end_session:', logoutUrl);
    res.redirect(logoutUrl);
  });
}

// ─── Admin: /admin/login ─────────────────────────────────────────────────────

export async function adminLoginStart(req: Request, res: Response) {
  console.log('[auth:admin] /admin/login hit');

  // ── Already authenticated guard ───────────────────────────────────────────
  // If an admin session already exists, redirect to /admin rather than
  // starting a new OIDC flow. Prevents concurrent admin sessions.
  if (req.session?.adminUserId) {
    console.log('[auth:admin] Already authenticated (adminUserId=%d) — redirecting to /admin', req.session.adminUserId);
    return res.redirect('/admin');
  }

  try {
    const cfg = await getAdminCfg();

    const codeVerifier  = openidClient.randomPKCECodeVerifier();
    const codeChallenge = await openidClient.calculatePKCECodeChallenge(codeVerifier);
    const state         = openidClient.randomState();

    const dynamicAdminRedirectUri = `${getRequestBaseUrl(req)}/admin/auth/callback`;

    // Store in DB — not cookies (cookies don't cross domains)
    saveOidcState(state, 'admin', codeVerifier, undefined, dynamicAdminRedirectUri);

    const authUrl = openidClient.buildAuthorizationUrl(cfg, {
      redirect_uri:          dynamicAdminRedirectUri,
      scope:                 ADMIN.scope,
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });

    console.log('[auth:admin] PKCE state saved to DB, redirecting to JA Group Services tenant');
    res.redirect(authUrl.href);
  } catch (err) {
    resetAdminCfg();
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auth:admin] Login start failed:', msg);
    res.redirect('/admin/login?error=oidc_init_failed');
  }
}

// ─── Admin: /admin/auth/callback ─────────────────────────────────────────────

export async function adminLoginCallback(req: Request, res: Response) {
  console.log('[auth:admin] /admin/auth/callback hit — code present:', !!req.query.code);
  try {
    const cfg = await getAdminCfg();

    // Read OIDC state first so we can use the stored callbackUri for URL construction
    const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
    const oidcData = stateParam ? getOidcState(stateParam, 'admin') : null;
    console.log('[auth:admin] OIDC DB state found:', !!oidcData, '| state param:', stateParam?.slice(0, 8) + '...');

    const callbackBase = oidcData?.callbackUri
      ? oidcData.callbackUri.replace(/\/admin\/auth\/callback$/, '')
      : getRequestBaseUrl(req);
    const callbackUrl = new URL(req.url, callbackBase);
    console.log('[auth:admin] callbackUrl:', callbackUrl.href);
    console.log('[auth:admin] protocol:', req.protocol, '| x-forwarded-proto:', req.get('x-forwarded-proto'), '| host:', req.get('host'), '| x-forwarded-host:', req.get('x-forwarded-host'));

    if (req.query.error) {
      console.error('[auth:admin] Microsoft returned OAuth error:', req.query.error, req.query.error_description);
      return res.redirect(`/admin/login?error=${req.query.error}`);
    }

    if (!oidcData?.codeVerifier) {
      console.error('[auth:admin] OIDC state missing from DB — state param:', stateParam?.slice(0, 8));
      return res.redirect('/admin/login?error=oidc_state_missing');
    }

    const tokens = await openidClient.authorizationCodeGrant(cfg, callbackUrl, {
      pkceCodeVerifier: oidcData.codeVerifier,
      expectedState:    stateParam,
    });

    console.log('[auth:admin] Token exchange succeeded');

    const claims = tokens.claims();
    console.log('[auth:admin] Token claims keys:', Object.keys(claims ?? {}));

    const email  = (claims?.email as string) || (claims?.preferred_username as string) || '';
    const name   = (claims?.name  as string) || email.split('@')[0];
    const oid    = (claims?.oid   as string) || '';

    if (!email && !oid) {
      console.warn('[auth:admin] No email or oid in token claims');
      return res.redirect('/admin/login?error=no_email');
    }

    const roles = (claims?.roles as string[]) || [];
    console.log('[auth:admin] Roles in token:', roles);
    const hasAdminRole = roles.includes(ADMIN.requiredRole);

    if (!hasAdminRole) {
      console.warn('[auth:admin] User', email, 'lacks Administrator role — roles:', roles);
      writeAudit({ actorId: undefined, actorName: name || undefined, actorEmail: email || undefined, actorType: 'user', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce', action: 'login', resourceType: 'auth', details: `Admin login blocked — missing Administrator role. Roles in token: [${roles.join(', ')}]`, ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null, result: 'blocked' });
      return res.redirect('/admin/login?error=access_denied');
    }

    // Always resolve to a role='admin' record — never reuse a customer record.
    // Look for an existing admin record for this email first; create one if absent.
    const lowerEmail = (email || `oid-${oid}`).toLowerCase();
    let adminRecord = db.prepare(
      "SELECT id, email, name, role, plan_id FROM users WHERE email = ? AND role = 'admin'"
    ).get(lowerEmail) as { id: number; email: string; name: string; role: string; plan_id: number } | undefined;
    if (!adminRecord) {
      const ins = db.prepare(
        "INSERT INTO users (email, name, role, plan_id) VALUES (?, ?, 'admin', NULL)"
      ).run(lowerEmail, name);
      adminRecord = { id: Number(ins.lastInsertRowid), email: lowerEmail, name, role: 'admin', plan_id: null as unknown as number };
      // Assign user number to new admin record (non-fatal)
      try { assignUserNumber(adminRecord.id); } catch { /* non-fatal */ }
    } else if (name && name !== adminRecord.name) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, adminRecord.id);
      adminRecord.name = name;
    }
    // Stamp the OID on the admin record so future logins resolve correctly
    try { db.prepare('UPDATE users SET entra_oid = ? WHERE id = ?').run(oid || null, adminRecord.id); } catch { /* non-fatal */ }
    const user = adminRecord;

    // ── Concurrent-session guard (admin) ─────────────────────────────────────
    // If a different admin is already logged in on this session, block the login.
    const existingAdminId = req.session?.adminUserId;
    if (existingAdminId && existingAdminId !== user.id) {
      console.warn('[auth:admin] Concurrent-session blocked — session already belongs to admin', existingAdminId, '— attempted login as admin', user.id);
      writeAudit({ actorId: user.id, actorName: name, actorEmail: email, actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce', action: 'login', resourceType: 'auth', details: `Concurrent-session blocked — session already owned by admin ${existingAdminId}`, ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null, result: 'error' });
      return res.redirect('/admin/login?error=already_signed_in');
    }

    // ── Session regeneration (session fixation prevention) ───────────────────
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.adminUserId   = user.id;
    req.session.adminUserRole = 'admin';
    req.session.adminIdToken  = tokens.id_token ?? undefined;

    await saveSession(req);

    writeAudit({ actorId: user.id, actorName: name, actorEmail: email, actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce', action: 'login', resourceType: 'auth', details: 'Admin login via Microsoft Entra workforce tenant', ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null, result: 'success' });

    console.log('[auth:admin] Admin session created for user', user.id, '— redirecting to /admin');
    res.redirect('/admin');
  } catch (err: any) {
    resetAdminCfg();
    clearOidcCookie(res, 'oidc_admin');
    console.error('[auth:admin] Callback failed:', err?.message ?? String(err));
    if (err?.cause) console.error('[auth:admin] Cause:', JSON.stringify(err.cause));
    writeAudit({ actorType: 'system', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce', action: 'login', resourceType: 'auth', details: `Admin OIDC callback error: ${err?.message ?? String(err)}`, ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? null, result: 'error' });
    res.redirect('/admin/login?error=oidc_callback_failed');
  }
}

// ─── Admin: /admin/logout ────────────────────────────────────────────────────

export async function adminLogout(req: Request, res: Response) {
  console.log('[auth:admin] /admin/logout hit');

  // Grab the id_token_hint before we destroy the session
  const idTokenHint = req.session.adminIdToken ?? null;

  req.session.destroy((err) => {
    if (err) console.error('[auth:admin] session destroy error', err);
    res.clearCookie('ja_profile_studio_session', { path: '/' });

    // Build Microsoft workforce tenant end_session URL so Microsoft clears its SSO cookie.
    // post_logout_redirect_uri MUST be registered in the Azure app registration.
    const postLogoutUri = `${APP_BASE_URL}/admin/logged-out`;
    const endSessionBase = `https://login.microsoftonline.com/${ADMIN.tenantId}/oauth2/v2.0/logout`;
    const params = new URLSearchParams({ post_logout_redirect_uri: postLogoutUri });
    if (idTokenHint) params.set('id_token_hint', idTokenHint);

    const logoutUrl = `${endSessionBase}?${params.toString()}`;
    console.log('[auth:admin] Redirecting to Microsoft end_session:', logoutUrl);
    res.redirect(logoutUrl);
  });
}
