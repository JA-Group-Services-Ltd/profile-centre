import { HttpError, json, redirect } from "./http.js";
import { enforceCustomerAccess, sendOperationalEvent, synchroniseCustomer } from "./head-office.js";

export const SESSION_COOKIE = "ja_profile_studio_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OIDC_STATE_TTL_MS = 15 * 60 * 1000;

function parseCookies(request) {
  const result = {};
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    result[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return result;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function safeReturnPath(value, fallback) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function sessionCookie(value, maxAge = Math.floor(SESSION_TTL_MS / 1000)) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}

export async function getSession(request, database) {
  const sid = parseCookies(request)[SESSION_COOKIE];
  if (!sid) return null;
  const now = Date.now();
  const row = await database
    .prepare("SELECT data FROM sessions WHERE sid = ?1 AND expires_at > ?2 LIMIT 1")
    .bind(sid, now)
    .first();
  if (!row?.data) return null;

  try {
    return { sid, data: JSON.parse(row.data) };
  } catch {
    return null;
  }
}

export async function createSession(database, data) {
  const sid = randomToken(32);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await database
    .prepare("INSERT INTO sessions (sid, data, expires_at) VALUES (?1, ?2, ?3)")
    .bind(sid, JSON.stringify(data), expiresAt)
    .run();
  return { sid, cookie: sessionCookie(sid) };
}

export async function saveSession(database, session) {
  await database.prepare("UPDATE sessions SET data = ?1 WHERE sid = ?2")
    .bind(JSON.stringify(session.data), session.sid)
    .run();
}

export async function destroySession(request, database) {
  const sid = parseCookies(request)[SESSION_COOKIE];
  if (sid) {
    await database.prepare("DELETE FROM sessions WHERE sid = ?1").bind(sid).run();
  }
  return sessionCookie("", 0);
}

export async function requireUser(request, database, env = null) {
  const session = await getSession(request, database);
  const userId = Number(session?.data?.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    throw new HttpError(401, "Authentication required", "authentication_required");
  }
  const user = await database.prepare(`
    SELECT id, email, name, role, plan_id, account_status, is_paused, is_blocked,
           customer_number, head_office_customer_id, created_at,
           head_office_access_decision, head_office_access_decided_at
    FROM users WHERE id = ?1 LIMIT 1
  `).bind(userId).first();
  if (!user) throw new HttpError(401, "User not found", "authentication_required");
  if (Number(user.is_blocked) === 1) throw new HttpError(403, "Account is blocked", "account_blocked");
  if (env) await enforceCustomerAccess(env, user);
  return { session, user };
}

export async function requireAdmin(request, database) {
  const session = await getSession(request, database);
  const adminUserId = Number(session?.data?.adminUserId);
  if (!Number.isInteger(adminUserId) || adminUserId < 1) {
    throw new HttpError(401, "Authentication required", "authentication_required");
  }
  const user = await database.prepare(`
    SELECT id, email, name, role, plan_id, account_status, is_paused, is_blocked
    FROM users WHERE id = ?1 LIMIT 1
  `).bind(adminUserId).first();
  if (!user) throw new HttpError(401, "User not found", "authentication_required");
  if (user.role !== "admin") throw new HttpError(403, "Admin access required", "admin_required");
  if (Number(user.is_blocked) === 1) throw new HttpError(403, "Account is blocked", "account_blocked");
  return { session, user };
}

function oidcConfig(env, flow, origin) {
  const admin = flow === "admin";
  const tenantId = admin ? env.ADMIN_OIDC_TENANT_ID : env.OIDC_TENANT_ID;
  const clientId = admin ? env.ADMIN_OIDC_CLIENT_ID : env.OIDC_CLIENT_ID;
  const clientSecret = admin ? env.ADMIN_OIDC_CLIENT_SECRET : env.OIDC_CLIENT_SECRET;
  const metadataUrl = admin
    ? env.ADMIN_OIDC_METADATA_URL || (tenantId
      ? `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
      : "")
    : env.OIDC_METADATA_URL || (tenantId
      ? `https://jagroupservicesid.ciamlogin.com/${tenantId}/v2.0/.well-known/openid-configuration`
      : "");
  const callbackPath = admin ? "/admin/auth/callback" : "/auth/callback";

  if (!tenantId || !clientId || !clientSecret || !metadataUrl) {
    throw new HttpError(503, "Microsoft Entra authentication is not configured.", "oidc_not_configured");
  }
  return {
    admin,
    tenantId,
    clientId,
    clientSecret,
    metadataUrl,
    redirectUri: `${origin}${callbackPath}`,
    requiredRole: env.ADMIN_OIDC_REQUIRED_ROLE || "Administrator",
  };
}

async function discovery(config) {
  const response = await fetch(config.metadataUrl, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new HttpError(502, "Microsoft identity discovery failed.", "oidc_discovery_failed");
  return response.json();
}

export async function beginOidc(request, env, flow) {
  const url = new URL(request.url);
  const config = oidcConfig(env, flow, url.origin);
  const metadata = await discovery(config);
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const challenge = await sha256Base64Url(verifier);
  const fallback = flow === "admin" ? "/admin" : "/dashboard";
  const returnTo = safeReturnPath(url.searchParams.get("returnTo"), fallback);
  const stateData = JSON.stringify({ returnTo, nonce });

  await env.DB.batch([
    env.DB.prepare("DELETE FROM oidc_state WHERE expires_at < ?1").bind(Date.now()),
    env.DB.prepare(`
      INSERT INTO oidc_state
        (state, flow, code_verifier, expires_at, redirect_to, callback_uri, consumed_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)
    `).bind(state, flow, verifier, Date.now() + OIDC_STATE_TTL_MS, stateData, config.redirectUri),
  ]);

  const authorize = new URL(metadata.authorization_endpoint);
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return redirect(authorize.toString());
}

async function verifyIdToken(idToken, metadata, config, expectedNonce) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Invalid identity token.", "invalid_id_token");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== "RS256" || !header.kid) {
    throw new HttpError(401, "Unsupported identity token.", "invalid_id_token");
  }

  const jwksResponse = await fetch(metadata.jwks_uri, { headers: { accept: "application/json" } });
  if (!jwksResponse.ok) throw new HttpError(502, "Microsoft signing keys are unavailable.", "oidc_jwks_failed");
  const jwks = await jwksResponse.json();
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) throw new HttpError(401, "Identity signing key was not found.", "invalid_id_token");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);
  const audienceValid = claims.aud === config.clientId
    || (Array.isArray(claims.aud) && claims.aud.includes(config.clientId));
  const issuerValid = claims.iss === metadata.issuer;
  if (!validSignature || !audienceValid || !issuerValid || claims.exp <= now || claims.nonce !== expectedNonce) {
    throw new HttpError(401, "Identity token validation failed.", "invalid_id_token");
  }
  return claims;
}

export async function resolveUser(database, claims, admin, requiredRole) {
  const oid = String(claims.oid ?? claims.sub ?? "");
  const email = String(claims.email ?? claims.preferred_username ?? "").trim().toLowerCase();
  const name = String(claims.name ?? email.split("@")[0] ?? "Profile Centre user").trim();
  if (!oid) throw new HttpError(401, "Microsoft identity did not include an object ID.", "missing_identity");
  if (admin && !(Array.isArray(claims.roles) && claims.roles.includes(requiredRole))) {
    throw new HttpError(403, "Microsoft account does not have the required administrator role.", "admin_role_required");
  }

  const oidColumn = admin ? "admin_entra_oid" : "entra_oid";
  let user = await database.prepare(`
    SELECT id, email, name, role, plan_id, created_at, account_status,
           customer_number, head_office_customer_id FROM users
    WHERE ${oidColumn} = ?1 ${admin ? "AND role = 'admin'" : ""} LIMIT 1
  `).bind(oid).first();
  if (!user && email) {
    user = await database.prepare(`
      SELECT id, email, name, role, plan_id, created_at, account_status,
             customer_number, head_office_customer_id FROM users
      WHERE lower(email) = ?1 ${admin ? "AND role = 'admin'" : ""} LIMIT 1
    `).bind(email).first();
  }
  if (!user) {
    throw new HttpError(
      403,
      "This Microsoft identity is not linked to a migrated Profile Centre account.",
      "identity_not_linked",
    );
  }
  await database.prepare(`
    UPDATE users
    SET ${oidColumn} = ?1, name = ?2, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?3
  `).bind(oid, name || user.name, user.id).run();
  return { ...user, [oidColumn]: oid, name: name || user.name };
}

export async function completeOidc(request, env, flow) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return redirect(`${flow === "admin" ? "/admin/login" : "/login"}?error=access_denied`);
  }
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) throw new HttpError(400, "OIDC callback is missing state or code.", "invalid_callback");

  const stateRow = await env.DB.prepare(`
    SELECT state, code_verifier, expires_at, redirect_to, callback_uri, consumed_at
    FROM oidc_state WHERE state = ?1 AND flow = ?2 LIMIT 1
  `).bind(state, flow).first();
  if (!stateRow || Number(stateRow.expires_at) <= Date.now() || stateRow.consumed_at != null) {
    throw new HttpError(400, "OIDC state is missing, expired or already used.", "invalid_oidc_state");
  }
  await env.DB.prepare("UPDATE oidc_state SET consumed_at = ?1 WHERE state = ?2")
    .bind(Date.now(), state)
    .run();

  let stateData;
  try {
    stateData = JSON.parse(stateRow.redirect_to);
  } catch {
    throw new HttpError(400, "OIDC state is invalid.", "invalid_oidc_state");
  }
  const config = oidcConfig(env, flow, url.origin);
  const metadata = await discovery(config);
  const tokenBody = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: String(stateRow.callback_uri || config.redirectUri),
    code_verifier: String(stateRow.code_verifier),
  });
  const tokenResponse = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: tokenBody,
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.id_token) {
    throw new HttpError(401, "Microsoft token exchange failed.", "token_exchange_failed");
  }
  const claims = await verifyIdToken(tokens.id_token, metadata, config, stateData.nonce);
  const user = await resolveUser(env.DB, claims, config.admin, config.requiredRole);
  if (!config.admin) await synchroniseCustomer(env, user, claims, config.tenantId, { recordSignIn: false });
  const sessionReference = config.admin ? null : crypto.randomUUID();
  const sessionStartedAt = new Date().toISOString();
  const session = await createSession(
    env.DB,
    config.admin
      ? { adminUserId: user.id, flow: "admin" }
      : { userId: user.id, flow: "customer", sessionReference },
  );
  if (!config.admin) {
    const linkedUser = await env.DB.prepare(`SELECT id,customer_number,head_office_customer_id
      FROM users WHERE id=?1`).bind(user.id).first();
    await sendOperationalEvent(env,linkedUser || user,"auth.sign_in_succeeded",{
      outcome:"success",category:"security_event",targetType:"session",targetReference:sessionReference,
      occurredAt:sessionStartedAt,description:"Customer signed in successfully",
      session:{id:sessionReference,status:"active",startedAt:sessionStartedAt,lastSeenAt:sessionStartedAt,
        metadata:{source:"profile_centre_oidc"}}
    });
  }
  await env.DB.prepare("DELETE FROM oidc_state WHERE state = ?1").bind(state).run();
  return redirect(safeReturnPath(stateData.returnTo, config.admin ? "/admin" : "/dashboard"), 302, {
    "set-cookie": session.cookie,
  });
}

export async function logout(request, env, flow) {
  const clearCookie = await destroySession(request, env.DB);
  const url = new URL(request.url);
  const tenantId = flow === "admin" ? env.ADMIN_OIDC_TENANT_ID : env.OIDC_TENANT_ID;
  const target = flow === "admin" ? "/admin/logged-out" : "/logged-out";
  if (!tenantId) return redirect(target, 302, { "set-cookie": clearCookie });
  const authority = flow === "admin"
    ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`
    : `https://jagroupservicesid.ciamlogin.com/${tenantId}/oauth2/v2.0/logout`;
  const endSession = new URL(authority);
  endSession.searchParams.set("post_logout_redirect_uri", `${url.origin}${target}`);
  return redirect(endSession.toString(), 302, { "set-cookie": clearCookie });
}

export function authErrorResponse(error, requestId, loginPath) {
  if (error instanceof HttpError && error.code === "oidc_not_configured") {
    return json(
      { success: false, error: error.message, code: error.code, requestId },
      error.status,
    );
  }
  return redirect(`${loginPath}?error=${encodeURIComponent(error.code ?? "authentication_failed")}`);
}
