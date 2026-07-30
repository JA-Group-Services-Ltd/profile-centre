/**
 * Assisted Access API
 *
 * Allows admins to request temporary, consent-based access to a customer account.
 * Flow:
 *   1. Admin POSTs /api/admin/assisted-access/request  → creates pending request
 *   2. Customer GETs /api/assisted-access/pending      → sees pending request
 *   3. Customer POSTs /api/assisted-access/:id/approve or /reject
 *   4. Admin GETs /api/admin/assisted-access/:id/status → polls for approval
 *   5. Admin POSTs /api/admin/assisted-access/:id/enter → enters session (sets cookie)
 *   6. Admin GETs /api/admin/assisted-access/session   → checks active session
 *   7. Admin POSTs /api/admin/assisted-access/exit     → ends session
 *   8. Customer POSTs /api/assisted-access/:id/revoke  → revokes active session
 *
 * All actions are audit-logged.
 * Dangerous actions are blocked during assisted sessions (enforced client-side + server-side).
 */
import { type Request, type Response } from 'express';
import db, { rawSqliteDb } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import crypto from 'crypto';
import { getSecret } from '#airo/secrets';

// ── Token helpers ─────────────────────────────────────────────────────────────
// Launch tokens are HMAC-signed so the raw secret never sits in the DB.
// Format of the URL token:  <requestId>.<issuedAt>.<nonce>.<hmac>
// The DB stores only the HMAC digest — if the DB is read, no usable token exists.

function getLaunchSecret(): string {
  const s = getSecret('SESSION_SECRET') as string | undefined;
  if (!s) throw new Error('SESSION_SECRET is not set — cannot sign launch tokens');
  // Derive a separate sub-key so launch tokens can't be confused with session secrets
  return crypto.createHmac('sha256', s).update('assisted-access-launch-v1').digest('hex');
}

function signLaunchToken(requestId: string | number, nonce: string, issuedAt: number): string {
  const payload = `${requestId}.${issuedAt}.${nonce}`;
  const sig = crypto.createHmac('sha256', getLaunchSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyLaunchToken(token: string, storedHmac: string): boolean {
  // token format: <requestId>.<issuedAt>.<nonce>.<hmac>
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [requestId, issuedAt, nonce, hmac] = parts;
  const payload = `${requestId}.${issuedAt}.${nonce}`;
  const expected = crypto.createHmac('sha256', getLaunchSecret()).update(payload).digest('hex');
  // Constant-time comparison — prevents timing attacks
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf   = Buffer.from(hmac,     'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return false;
  // Also verify the stored DB digest matches (double-check one-time use)
  const storedBuf  = Buffer.from(storedHmac, 'hex');
  const computedBuf = Buffer.from(expected,  'hex');
  if (storedBuf.length !== computedBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, computedBuf);
}

// ── Schema bootstrap ──────────────────────────────────────────────────────

export function ensureAssistedAccessTable() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS assisted_access_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        admin_name TEXT,
        admin_email TEXT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        access_areas TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        session_token TEXT,
        session_expires_at TEXT,
        approved_at TEXT,
        rejected_at TEXT,
        revoked_at TEXT,
        exited_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }

  // Add session_started_at column if missing (migration)
  try { db.prepare('ALTER TABLE assisted_access_requests ADD COLUMN session_started_at TEXT').run(); } catch { /* already exists */ }

  // Add launch_token + launch_token_expires_at columns for one-time URL launch
  try { db.prepare('ALTER TABLE assisted_access_requests ADD COLUMN launch_token TEXT').run(); } catch { /* already exists */ }
  try { db.prepare('ALTER TABLE assisted_access_requests ADD COLUMN launch_token_expires_at TEXT').run(); } catch { /* already exists */ }
}

// ── Admin: generate a one-time launch URL ────────────────────────────────────
// Returns a short-lived URL the admin opens in a NEW TAB.
// That tab's GET handler sets a fresh session as the target user without
// touching the admin's existing session in their current tab.

export async function generateLaunchUrl(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const admin = (req as any).user;
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ? AND admin_id = ?').get(id, admin.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
    if (row.status !== 'active') return res.status(400).json({ success: false, error: 'Session is not active — enter the session first' });

    // Check session expiry
    if (row.session_expires_at) {
      const expires = new Date(row.session_expires_at as string).getTime();
      if (Date.now() > expires) {
        return res.status(400).json({ success: false, error: 'Session has expired — please re-enter the session' });
      }
    }

    // Generate a HMAC-signed one-time launch token (valid for 2 minutes).
    // The URL carries the full signed token; the DB stores only the HMAC digest.
    // If the DB is ever read, the stored digest cannot be used as a URL token.
    const nonce      = crypto.randomBytes(24).toString('hex');
    const issuedAt   = Date.now();
    const launchToken = signLaunchToken(id, nonce, issuedAt);
    const launchHmac  = launchToken.split('.')[3]; // store only the sig digest
    const launchExpiry = new Date(issuedAt + 2 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE assisted_access_requests
      SET launch_token = ?, launch_token_expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(launchHmac, launchExpiry, id);

    res.json({
      success: true,
      launchUrl: `/api/assisted-access/launch?token=${encodeURIComponent(launchToken)}&request=${id}`,
      expiresAt: launchExpiry,
    });
  } catch (err) {
    console.error('[assisted-access] generateLaunchUrl error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate launch URL' });
  }
}

// ── Public: redeem launch token → set session → redirect to dashboard ────────
// This is a GET route hit by the NEW TAB the admin opens.
// No admin auth required — the launch token IS the credential.
// One-time use: token is cleared immediately after redemption.

export async function redeemLaunchToken(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const { token, request: requestId } = req.query as { token: string; request: string };

    if (!token || !requestId) {
      return res.status(400).send('Invalid launch link — missing token or request ID.');
    }

    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ?').get(requestId) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).send('Assisted access request not found.');

    // Verify HMAC signature — constant-time, DB stores only the digest
    const storedHmac = row.launch_token as string | null;
    if (!storedHmac || !verifyLaunchToken(token, storedHmac)) {
      return res.status(403).send('Invalid or already-used launch token.');
    }

    if (row.status !== 'active') return res.status(400).send('This assisted access session is no longer active.');

    // Check launch token expiry (2-minute window)
    if (row.launch_token_expires_at) {
      const expires = new Date(row.launch_token_expires_at as string).getTime();
      if (Date.now() > expires) {
        return res.status(400).send('This launch link has expired. Please generate a new one from the admin panel.');
      }
    }

    // Check session expiry
    if (row.session_expires_at) {
      const expires = new Date(row.session_expires_at as string).getTime();
      if (Date.now() > expires) {
        db.prepare(`UPDATE assisted_access_requests SET status = 'exited', exited_at = datetime('now'), session_token = NULL, launch_token = NULL, updated_at = datetime('now') WHERE id = ?`).run(requestId);
        return res.status(400).send('The assisted access session has expired.');
      }
    }

    // Look up the target user
    const targetUser = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(row.user_id as number) as
      { id: number; email: string; name: string; role: string } | undefined;
    if (!targetUser) return res.status(404).send('Target user not found.');

    // Consume the launch token immediately (one-time use)
    db.prepare(`
      UPDATE assisted_access_requests
      SET launch_token = NULL, launch_token_expires_at = NULL,
          session_started_at = COALESCE(session_started_at, datetime('now')),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(requestId);

    // ── Write a NEW assisted session record directly to the store ─────────────
    // We do NOT call session.regenerate() — that would overwrite the shared
    // ja_profile_studio_session cookie and kick the admin out of their own tab.
    // Instead we create a brand-new session record in the DB, set a SEPARATE
    // ja_assisted_session cookie (4-hour TTL), and leave req.session untouched.
    const assistedSid = crypto.randomBytes(32).toString('hex');
    const assistedTtl = 4 * 60 * 60 * 1000; // 4 hours
    const assistedExpiresAt = Date.now() + assistedTtl;
    const assistedData = JSON.stringify({
      userId: targetUser.id,
      assistedAccessRequestId: Number(requestId),
      assistedAccessAdminId: row.admin_id,
      assistedAccessAdminName: row.admin_name ?? null,
      assistedAccessToken: row.session_token,
      cookie: { maxAge: assistedTtl, httpOnly: true, path: '/' },
    });
    rawSqliteDb.prepare(`
      INSERT INTO sessions (sid, data, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
    `).run(assistedSid, assistedData, assistedExpiresAt);

    // Set the separate assisted-session cookie — this is the ONLY cookie we touch.
    // The admin's ja_profile_studio_session cookie is completely unaffected.
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('ja_assisted_session', assistedSid, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: assistedTtl,
      path: '/',
    });

    writeAudit({
      actorId: row.admin_id as number, actorName: row.admin_name as string, actorEmail: row.admin_email as string,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'assisted_access_impersonation_started', resourceType: 'user', resourceId: String(row.user_id),
      resourceLabel: targetUser.email,
      details: `Admin ${row.admin_name} (${row.admin_email}) launched impersonation session for user ${targetUser.id} (${targetUser.email}) via one-time URL. Request #${requestId}.`,
      ipAddress: req.ip, result: 'success',
    });

    // Redirect to dashboard in this new tab
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[assisted-access] redeemLaunchToken error:', err);
    res.status(500).send('Failed to start assisted access session. Please try again.');
  }
}

// ── Admin: end impersonation (exit) ──────────────────────────────────────────
// Deletes the ja_assisted_session record and clears the cookie.
// The admin's primary ja_profile_studio_session is never touched.

export async function endAssistedImpersonation(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    // Read from the assisted session (not the primary session)
    const assistedSession = (req as any).assistedSession;
    const requestId = assistedSession?.assistedAccessRequestId;
    const adminUserId = assistedSession?.assistedAccessAdminId;

    if (requestId) {
      const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ?').get(requestId) as Record<string, unknown> | undefined;
      if (row && row.status === 'active') {
        db.prepare(`UPDATE assisted_access_requests SET status = 'exited', exited_at = datetime('now'), session_token = NULL, updated_at = datetime('now') WHERE id = ?`).run(requestId);

        writeAudit({
          actorId: adminUserId, actorName: null, actorEmail: null,
          actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
          action: 'assisted_access_impersonation_ended', resourceType: 'user', resourceId: String(row.user_id),
          details: `Admin ended impersonation session for user ${row.user_id}. Request #${requestId}.`,
          ipAddress: req.ip, result: 'success',
        });
      }
    }

    // Delete the assisted session record from the store
    const assistedSid = (req as any).cookies?.ja_assisted_session;
    if (assistedSid) {
      try { rawSqliteDb.prepare('DELETE FROM sessions WHERE sid = ?').run(assistedSid); } catch { /* non-fatal */ }
    }

    // Clear the assisted-session cookie — primary session is untouched
    res.clearCookie('ja_assisted_session', { path: '/' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to end impersonation session' });
  }
}

// ── API: get current assisted session info (for banner) ──────────────────────

export async function getAssistedSessionInfo(req: Request, res: Response) {
  try {
    // Read from the assisted session (separate cookie, not the primary session)
    const assistedSession = (req as any).assistedSession;
    const requestId = assistedSession?.assistedAccessRequestId;
    if (!requestId) {
      return res.json({ success: true, data: null });
    }

    const row = db.prepare(`
      SELECT r.*, u.email as user_email, u.name as user_name
      FROM assisted_access_requests r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(requestId) as Record<string, unknown> | undefined;

    if (!row || row.status === 'exited' || row.status === 'revoked') {
      // Session ended externally — clear the assisted session cookie
      const assistedSid = (req as any).cookies?.ja_assisted_session;
      if (assistedSid) {
        try { rawSqliteDb.prepare('DELETE FROM sessions WHERE sid = ?').run(assistedSid); } catch { /* non-fatal */ }
      }
      res.clearCookie('ja_assisted_session', { path: '/' });
      return res.json({ success: true, data: null });
    }

    // Check expiry
    if (row.session_expires_at) {
      const expires = new Date(row.session_expires_at as string).getTime();
      if (Date.now() > expires) {
        const assistedSid = (req as any).cookies?.ja_assisted_session;
        if (assistedSid) {
          try { rawSqliteDb.prepare('DELETE FROM sessions WHERE sid = ?').run(assistedSid); } catch { /* non-fatal */ }
        }
        res.clearCookie('ja_assisted_session', { path: '/' });
        return res.json({ success: true, data: null });
      }
    }

    res.json({
      success: true,
      data: {
        requestId: row.id,
        adminName: assistedSession.assistedAccessAdminName ?? row.admin_name,
        targetUserName: row.user_name,
        targetUserEmail: row.user_email,
        targetUserId: row.user_id,
        expiresAt: row.session_expires_at,
        accessAreas: row.access_areas,
        status: row.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get session info' });
  }
}

// ── Admin: create request ─────────────────────────────────────────────────

// ── Admin: look up user by email (for the request form) ──────────────────────

export async function lookupUserForAssistedAccess(req: Request, res: Response) {
  try {
    const { email, q } = req.query as { email?: string; q?: string };

    // Legacy: email= param (exact email match)
    if (email) {
      const user = db.prepare(
        "SELECT id, email, name, user_number FROM users WHERE LOWER(email) = LOWER(?) AND role = 'user' LIMIT 1"
      ).get(email.trim()) as { id: number; email: string; name: string; user_number: string | null } | undefined;
      if (!user) return res.status(404).json({ success: false, error: 'No account found with that email address' });
      return res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, user_number: user.user_number } });
    }

    // New: q= param — smart lookup by email / user number / name / numeric ID
    if (q) {
      const trimmed = q.trim();
      let user: { id: number; email: string; name: string; user_number: string | null } | undefined;

      // Exact email
      if (trimmed.includes('@')) {
        user = db.prepare(
          "SELECT id, email, name, user_number FROM users WHERE LOWER(email) = LOWER(?) AND role = 'user' LIMIT 1"
        ).get(trimmed) as typeof user;
      }
      // 12-digit user number (with or without spaces)
      else if (/^\d[\d\s]{10,}\d$/.test(trimmed)) {
        const digits = trimmed.replace(/\s+/g, '');
        if (digits.length === 12) {
          user = db.prepare(
            "SELECT id, email, name, user_number FROM users WHERE user_number = ? AND role = 'user' LIMIT 1"
          ).get(digits) as typeof user;
        }
      }
      // Numeric ID
      else if (/^\d+$/.test(trimmed) && trimmed.length < 10) {
        user = db.prepare(
          "SELECT id, email, name, user_number FROM users WHERE id = ? AND role = 'user' LIMIT 1"
        ).get(parseInt(trimmed, 10)) as typeof user;
      }
      // Name search (partial, case-insensitive)
      else if (trimmed.length >= 2) {
        user = db.prepare(
          "SELECT id, email, name, user_number FROM users WHERE LOWER(name) LIKE ? AND role = 'user' ORDER BY name LIMIT 1"
        ).get(`%${trimmed.toLowerCase()}%`) as typeof user;
      }

      if (!user) return res.status(404).json({ success: false, error: 'No account found — try email, user number, name, or ID' });
      return res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, user_number: user.user_number } });
    }

    return res.status(400).json({ success: false, error: 'Provide a search query (q=)' });
  } catch {
    return res.status(500).json({ success: false, error: 'Lookup failed' });
  }
}

export async function createAssistedAccessRequest(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const admin = (req as any).user;
    const { user_id, user_email, reason, access_areas } = req.body as {
      user_id?: number;
      user_email?: string;
      reason: string;
      access_areas: string[];
    };

    if (!reason?.trim() || !access_areas?.length) {
      return res.status(400).json({ success: false, error: 'reason and access_areas are required' });
    }

    // Resolve user — accept either user_id (number) or user_email (string)
    let user: { id: number; email: string; name: string } | undefined;
    if (user_id) {
      user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(user_id) as typeof user;
    } else if (user_email) {
      user = db.prepare('SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?)').get(user_email.trim()) as typeof user;
    }

    if (!user) {
      return res.status(404).json({ success: false, error: user_id ? 'User not found' : 'No account found with that email address' });
    }

    const resolvedUserId = user.id;

    // Cancel any existing pending request for this admin+user pair
    db.prepare(`UPDATE assisted_access_requests SET status = 'cancelled', updated_at = datetime('now') WHERE admin_id = ? AND user_id = ? AND status = 'pending'`).run(admin.id, resolvedUserId);

    const result = db.prepare(`
      INSERT INTO assisted_access_requests (admin_id, admin_name, admin_email, user_id, reason, access_areas, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(admin.id, admin.name ?? null, admin.email ?? null, resolvedUserId, reason.trim(), JSON.stringify(access_areas));

    writeAudit({
      actorId: admin.id, actorName: admin.name, actorEmail: admin.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'assisted_access_requested', resourceType: 'user', resourceId: String(resolvedUserId),
      resourceLabel: user.email,
      details: `Admin requested assisted access to user ${resolvedUserId} (${user.email}). Reason: ${reason}. Areas: ${access_areas.join(', ')}`,
      ipAddress: req.ip, result: 'success',
    });

    res.json({ success: true, requestId: result.lastInsertRowid, resolvedUser: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create assisted access request' });
  }
}

// ── Admin: get request status ─────────────────────────────────────────────

export async function getAssistedAccessStatus(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const admin = (req as any).user;
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ? AND admin_id = ?').get(id, admin.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
}

// ── Admin: enter assisted session ─────────────────────────────────────────

export async function enterAssistedSession(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const admin = (req as any).user;
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
    if (row.status !== 'approved') return res.status(400).json({ success: false, error: 'Request not approved' });
    if (row.admin_id !== admin.id) return res.status(403).json({ success: false, error: 'Not your request' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    db.prepare(`UPDATE assisted_access_requests SET session_token = ?, session_expires_at = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`).run(token, expires, id);

    writeAudit({
      actorId: admin.id, actorName: admin.name, actorEmail: admin.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'assisted_access_entered', resourceType: 'user', resourceId: String(row.user_id),
      details: `Admin entered assisted session for user ${row.user_id}. Request #${id}. Token expires ${expires}.`,
      ipAddress: req.ip, result: 'success',
    });

    res.json({ success: true, sessionToken: token, expiresAt: expires, userId: row.user_id, accessAreas: row.access_areas });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to enter session' });
  }
}

// ── Admin: exit session ───────────────────────────────────────────────────

export async function exitAssistedSession(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const admin = (req as any).user;
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ? AND admin_id = ?').get(id, admin.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found or not yours' });

    db.prepare(`UPDATE assisted_access_requests SET status = 'exited', exited_at = datetime('now'), session_token = NULL, updated_at = datetime('now') WHERE id = ?`).run(id);

    writeAudit({
      actorId: admin.id, actorName: admin.name, actorEmail: admin.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'assisted_access_exited', resourceType: 'user', resourceId: String(row.user_id),
      details: `Admin exited assisted session for user ${row.user_id}. Request #${id}.`,
      ipAddress: req.ip, result: 'success',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to exit session' });
  }
}

// ── Admin: list requests — own requests only ──────────────────────────────

export async function listAssistedAccessRequests(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const admin = (req as any).user;
    const rows = db.prepare(`
      SELECT r.*, u.email as user_email, u.name as user_name
      FROM assisted_access_requests r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.admin_id = ?
      ORDER BY r.created_at DESC
      LIMIT 200
    `).all(admin.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list requests' });
  }
}

// ── Customer: get pending requests ───────────────────────────────────────

export async function getCustomerPendingRequests(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const user = (req as any).user;
    const rows = db.prepare(`
      SELECT * FROM assisted_access_requests
      WHERE user_id = ? AND status IN ('pending', 'approved', 'active')
      ORDER BY created_at DESC
    `).all(user.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get requests' });
  }
}

// ── Customer: approve request ─────────────────────────────────────────────

export async function approveAssistedAccessRequest(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const user = (req as any).user;
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ? AND user_id = ?').get(id, user.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
    if (row.status !== 'pending') return res.status(400).json({ success: false, error: 'Request is not pending' });

    db.prepare(`UPDATE assisted_access_requests SET status = 'approved', approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);

    writeAudit({
      actorId: user.id, actorName: user.name, actorEmail: user.email,
      actorType: 'user',
      action: 'assisted_access_approved', resourceType: 'assisted_access_request', resourceId: String(id),
      details: `User ${user.id} approved assisted access request #${id} from admin ${row.admin_name} (${row.admin_email}).`,
      ipAddress: req.ip, result: 'success',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
}

// ── Customer: reject request ──────────────────────────────────────────────

export async function rejectAssistedAccessRequest(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const user = (req as any).user;
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ? AND user_id = ?').get(id, user.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });

    db.prepare(`UPDATE assisted_access_requests SET status = 'rejected', rejected_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);

    writeAudit({
      actorId: user.id, actorName: user.name, actorEmail: user.email,
      actorType: 'user',
      action: 'assisted_access_rejected', resourceType: 'assisted_access_request', resourceId: String(id),
      details: `User ${user.id} rejected assisted access request #${id}.`,
      ipAddress: req.ip, result: 'success',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
}

// ── Customer: revoke active session ──────────────────────────────────────

export async function revokeAssistedAccessSession(req: Request, res: Response) {
  try {
    ensureAssistedAccessTable();
    const user = (req as any).user;
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM assisted_access_requests WHERE id = ? AND user_id = ?').get(id, user.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });

    db.prepare(`UPDATE assisted_access_requests SET status = 'revoked', revoked_at = datetime('now'), session_token = NULL, updated_at = datetime('now') WHERE id = ?`).run(id);

    writeAudit({
      actorId: user.id, actorName: user.name, actorEmail: user.email,
      actorType: 'user',
      action: 'assisted_access_revoked', resourceType: 'assisted_access_request', resourceId: String(id),
      details: `User ${user.id} revoked assisted access session #${id}.`,
      ipAddress: req.ip, result: 'success',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
}
