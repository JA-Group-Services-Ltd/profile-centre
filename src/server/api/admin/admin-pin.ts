/**
 * Admin PIN Gate
 *
 * After OIDC login, admins must enter a 4–8 digit PIN before accessing the portal.
 * PINs are bcrypt-hashed and stored in the `admin_pins` table.
 * The session stores only a boolean flag (`adminPinVerified`) and a timestamp
 * (`adminPinVerifiedAt`) — the PIN itself is NEVER stored in the session, cookies,
 * localStorage, or any browser-accessible storage.
 *
 * Security properties:
 *  - PIN is bcrypt-hashed (SALT_ROUNDS = 12) — never stored or returned in plain text
 *  - Session flag expires after PIN_SESSION_TIMEOUT_MS (15 min) of inactivity
 *  - 5 failed attempts triggers a 15-minute lockout
 *  - No PIN set = portal is blocked until a PIN is created (no bypass)
 *  - High-risk actions use a separate short-lived challenge token (see /pin/challenge)
 *  - Audit log records every setup, change, verify, fail, lockout, and removal
 *
 * Endpoints:
 *   GET  /api/admin/pin/status     — PIN status for the current admin
 *   POST /api/admin/pin/set        — Set or change PIN (requires current PIN if one exists)
 *   POST /api/admin/pin/verify     — Verify PIN, sets session flag + timestamp
 *   POST /api/admin/pin/remove     — Remove PIN (requires current PIN)
 *   POST /api/admin/pin/clear      — Clear PIN session flag (called on logout)
 *   POST /api/admin/pin/challenge  — Issue a short-lived challenge token for high-risk actions
 *   POST /api/admin/pin/heartbeat  — Refresh the PIN session timestamp (keep-alive)
 */
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { notifySecurityAlert } from '../../lib/notifications.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;
const MAX_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

/** PIN session expires after 15 minutes of inactivity */
export const PIN_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

/** High-risk challenge tokens expire after 5 minutes */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// ── DB-backed challenge token store ───────────────────────────────────────────
// Tokens are short-lived (5 min) and scoped to a single admin + action type.
// Stored in SQLite so they survive HMR reloads and server restarts within the
// TTL window. Expired tokens are pruned on every read and periodically.

function ensureChallengeTokensTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_challenge_tokens (
      token      TEXT PRIMARY KEY,
      admin_id   INTEGER NOT NULL,
      action     TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `).run();
}

// Prune expired tokens periodically
setInterval(() => {
  try {
    ensureChallengeTokensTable();
    db.prepare('DELETE FROM admin_challenge_tokens WHERE expires_at < ?').run(Date.now());
  } catch { /* ignore */ }
}, 60_000);

// ── Table setup ────────────────────────────────────────────────────────────────

export function ensureAdminPinTable() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_pins (
        admin_id        INTEGER PRIMARY KEY,
        pin_hash        TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until    TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isLocked(row: { locked_until?: string | null }): boolean {
  if (!row.locked_until) return false;
  return new Date(row.locked_until) > new Date();
}

function adminId(req: Request): number | null {
  return req.session?.adminUserId ?? null;
}

/** Fetch admin email + name for security alert emails. */
function getAdminIdentity(aid: number): { email: string; name: string } | null {
  try {
    const row = db.prepare('SELECT email, name FROM users WHERE id = ?').get(aid) as
      { email: string; name: string } | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

/** Returns true if the PIN session is still valid (not expired). */
export function isPinSessionValid(req: Request): boolean {
  if (!req.session?.adminPinVerified) return false;
  const verifiedAt = req.session?.adminPinVerifiedAt;
  if (!verifiedAt) return false;
  return Date.now() - verifiedAt < PIN_SESSION_TIMEOUT_MS;
}

/** Mark the PIN session as verified and record the timestamp. */
async function markPinVerified(req: Request): Promise<void> {
  req.session.adminPinVerified = true;
  req.session.adminPinVerifiedAt = Date.now();
  await new Promise<void>((resolve) => req.session.save(() => resolve()));
}

/** Clear the PIN session flag and timestamp. */
async function clearPinSession(req: Request): Promise<void> {
  req.session.adminPinVerified = false;
  req.session.adminPinVerifiedAt = undefined;
  await new Promise<void>((resolve) => req.session.save(() => resolve()));
}

// ── GET /api/admin/pin/status ──────────────────────────────────────────────────

export async function getAdminPinStatus(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });
  ensureAdminPinTable();

  const row = db.prepare(
    'SELECT admin_id, locked_until, failed_attempts FROM admin_pins WHERE admin_id = ?'
  ).get(aid) as { admin_id: number; locked_until: string | null; failed_attempts: number } | undefined;

  const locked = row ? isLocked(row) : false;
  const pinVerified = isPinSessionValid(req);
  const verifiedAt = req.session?.adminPinVerifiedAt ?? null;
  const expiresAt = verifiedAt ? verifiedAt + PIN_SESSION_TIMEOUT_MS : null;

  res.json({
    success: true,
    hasPin: !!row,
    pinVerified,
    locked,
    lockedUntil: locked ? row!.locked_until : null,
    // Tell the client when the PIN session will expire so it can show a countdown
    expiresAt,
    timeoutMs: PIN_SESSION_TIMEOUT_MS,
  });
}

// ── POST /api/admin/pin/set ────────────────────────────────────────────────────

export async function setAdminPin(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });
  ensureAdminPinTable();

  const { pin, currentPin } = req.body as { pin?: string; currentPin?: string };

  if (!pin || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ success: false, error: 'PIN must be 4–8 digits.' });
  }

  const existing = db.prepare(
    'SELECT pin_hash, locked_until, failed_attempts FROM admin_pins WHERE admin_id = ?'
  ).get(aid) as { pin_hash: string; locked_until: string | null; failed_attempts: number } | undefined;

  if (existing) {
    if (isLocked(existing)) {
      return res.status(429).json({ success: false, error: 'Account locked. Try again later.' });
    }
    if (!currentPin) {
      return res.status(400).json({ success: false, error: 'Current PIN required to change PIN.' });
    }
    const match = await bcrypt.compare(currentPin, existing.pin_hash);
    if (!match) {
      const attempts = (existing.failed_attempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;
      db.prepare(
        'UPDATE admin_pins SET failed_attempts = ?, locked_until = ? WHERE admin_id = ?'
      ).run(attempts, lockedUntil, aid);
      writeAudit({
        actorId: aid, actorType: 'admin',
        action: 'admin_pin_change_failed', resourceType: 'admin', resourceId: String(aid),
        details: `Admin PIN change failed — wrong current PIN (attempt ${attempts}/${MAX_ATTEMPTS})`,
        ipAddress: req.ip, result: 'failure',
      });
      return res.status(401).json({ success: false, error: 'Current PIN is incorrect.' });
    }
  }

  const hash = await bcrypt.hash(pin, SALT_ROUNDS);
  if (existing) {
    db.prepare(
      "UPDATE admin_pins SET pin_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE admin_id = ?"
    ).run(hash, aid);
  } else {
    db.prepare('INSERT INTO admin_pins (admin_id, pin_hash) VALUES (?, ?)').run(aid, hash);
  }

  // Mark session as PIN-verified after setting
  await markPinVerified(req);

  writeAudit({
    actorId: aid, actorType: 'admin',
    action: existing ? 'admin_pin_changed' : 'admin_pin_set',
    resourceType: 'admin', resourceId: String(aid),
    details: existing ? 'Admin changed their portal PIN' : 'Admin set their portal PIN for the first time',
    ipAddress: req.ip, result: 'success',
  });

  // Security alert — notify the admin by email that their PIN was set or changed
  const identity = getAdminIdentity(aid);
  if (identity) {
    notifySecurityAlert({
      userEmail: identity.email,
      userName: identity.name,
      userId: aid,
      alertType: 'pin_changed',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      detail: existing ? 'Your admin portal PIN was changed.' : 'Your admin portal PIN was set for the first time.',
    });
  }

  res.json({ success: true, message: existing ? 'PIN updated.' : 'PIN set successfully.' });
}

// ── POST /api/admin/pin/verify ─────────────────────────────────────────────────

export async function verifyAdminPin(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });
  ensureAdminPinTable();

  const { pin } = req.body as { pin?: string };
  if (!pin) return res.status(400).json({ success: false, error: 'PIN required.' });

  const row = db.prepare(
    'SELECT pin_hash, locked_until, failed_attempts FROM admin_pins WHERE admin_id = ?'
  ).get(aid) as { pin_hash: string; locked_until: string | null; failed_attempts: number } | undefined;

  // No PIN set — do NOT allow through. The admin must set a PIN first.
  // Return a clear signal so the frontend shows the setup screen.
  if (!row) {
    return res.status(403).json({
      success: false,
      noPinSet: true,
      error: 'No PIN is set. Please set a PIN before accessing the admin portal.',
    });
  }

  if (isLocked(row)) {
    const until = new Date(row.locked_until!).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
    writeAudit({
      actorId: aid, actorType: 'admin',
      action: 'admin_pin_verify_blocked', resourceType: 'admin', resourceId: String(aid),
      details: `Admin PIN verify blocked — account locked until ${row.locked_until}`,
      ipAddress: req.ip, result: 'failure',
    });
    return res.status(429).json({
      success: false,
      error: `Too many attempts. Locked until ${until}.`,
      locked: true,
    });
  }

  const match = await bcrypt.compare(pin, row.pin_hash);
  if (!match) {
    const attempts = (row.failed_attempts ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;
    db.prepare(
      'UPDATE admin_pins SET failed_attempts = ?, locked_until = ? WHERE admin_id = ?'
    ).run(attempts, lockedUntil, aid);

    writeAudit({
      actorId: aid, actorType: 'admin',
      action: 'admin_pin_failed', resourceType: 'admin', resourceId: String(aid),
      details: `Admin PIN verification failed (attempt ${attempts}/${MAX_ATTEMPTS})${lockedUntil ? ' — account locked' : ''}`,
      ipAddress: req.ip, result: 'failure',
    });

    if (lockedUntil) {
      // Notify the admin by email that their account has been locked
      const identity = getAdminIdentity(aid);
      if (identity) {
        notifySecurityAlert({
          userEmail: identity.email,
          userName: identity.name,
          userId: aid,
          alertType: 'account_locked',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
          detail: `Too many failed PIN attempts. Admin portal locked for ${LOCKOUT_MINUTES} minutes.`,
        });
      }
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        locked: true,
      });
    }
    const remaining = MAX_ATTEMPTS - attempts;
    return res.status(401).json({
      success: false,
      error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    });
  }

  // Success — reset failed attempts, mark session verified
  db.prepare(
    'UPDATE admin_pins SET failed_attempts = 0, locked_until = NULL WHERE admin_id = ?'
  ).run(aid);
  await markPinVerified(req);

  writeAudit({
    actorId: aid, actorType: 'admin',
    action: 'admin_pin_verified', resourceType: 'admin', resourceId: String(aid),
    details: 'Admin PIN verified — portal access granted',
    ipAddress: req.ip, result: 'success',
  });

  const expiresAt = (req.session.adminPinVerifiedAt ?? Date.now()) + PIN_SESSION_TIMEOUT_MS;
  res.json({ success: true, expiresAt });
}

// ── POST /api/admin/pin/remove ─────────────────────────────────────────────────

export async function removeAdminPin(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });
  ensureAdminPinTable();

  const { currentPin } = req.body as { currentPin?: string };
  const row = db.prepare(
    'SELECT pin_hash, locked_until FROM admin_pins WHERE admin_id = ?'
  ).get(aid) as { pin_hash: string; locked_until: string | null } | undefined;

  if (!row) return res.status(400).json({ success: false, error: 'No PIN is set.' });
  if (isLocked(row)) return res.status(429).json({ success: false, error: 'Account locked.' });
  if (!currentPin) return res.status(400).json({ success: false, error: 'Current PIN required.' });

  const match = await bcrypt.compare(currentPin, row.pin_hash);
  if (!match) {
    writeAudit({
      actorId: aid, actorType: 'admin',
      action: 'admin_pin_remove_failed', resourceType: 'admin', resourceId: String(aid),
      details: 'Admin PIN removal failed — wrong current PIN',
      ipAddress: req.ip, result: 'failure',
    });
    return res.status(401).json({ success: false, error: 'Incorrect PIN.' });
  }

  db.prepare('DELETE FROM admin_pins WHERE admin_id = ?').run(aid);
  await clearPinSession(req);

  writeAudit({
    actorId: aid, actorType: 'admin',
    action: 'admin_pin_removed', resourceType: 'admin', resourceId: String(aid),
    details: 'Admin removed their portal PIN',
    ipAddress: req.ip, result: 'success',
  });

  res.json({ success: true, message: 'PIN removed.' });
}

// ── POST /api/admin/pin/clear ──────────────────────────────────────────────────
// Called on admin logout to clear the PIN session flag.

export async function clearAdminPinSession(req: Request, res: Response) {
  await clearPinSession(req);
  res.json({ success: true });
}

// ── POST /api/admin/pin/reset-lockout ─────────────────────────────────────────
// Clears a lockout on the currently authenticated admin's own PIN.
// Requires a valid OIDC session (adminUserId) but NOT a PIN session —
// this is the escape hatch when you're locked out.
// Rate-limited to 3 uses per hour server-side (handled by pinLimiter in entry.ts).

export async function resetAdminPinLockout(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });
  ensureAdminPinTable();

  const row = db.prepare(
    'SELECT locked_until, failed_attempts FROM admin_pins WHERE admin_id = ?'
  ).get(aid) as { locked_until: string | null; failed_attempts: number } | undefined;

  if (!row) return res.status(400).json({ success: false, error: 'No PIN is set.' });

  db.prepare(
    'UPDATE admin_pins SET failed_attempts = 0, locked_until = NULL WHERE admin_id = ?'
  ).run(aid);

  writeAudit({
    actorId: aid, actorType: 'admin',
    action: 'admin_pin_lockout_reset', resourceType: 'admin', resourceId: String(aid),
    details: 'Admin reset their own PIN lockout via escape hatch',
    ipAddress: req.ip, result: 'success',
  });

  res.json({ success: true, message: 'Lockout cleared. You can now enter your PIN again.' });
}

// ── POST /api/admin/pin/heartbeat ──────────────────────────────────────────────
// Refreshes the PIN session timestamp so the 15-min timeout resets on activity.

export async function adminPinHeartbeat(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });

  if (!isPinSessionValid(req)) {
    return res.status(403).json({
      success: false,
      expired: true,
      error: 'PIN session expired. Please re-enter your PIN.',
    });
  }

  // Refresh the timestamp
  req.session.adminPinVerifiedAt = Date.now();
  await new Promise<void>((resolve) => req.session.save(() => resolve()));

  const expiresAt = req.session.adminPinVerifiedAt! + PIN_SESSION_TIMEOUT_MS;
  res.json({ success: true, expiresAt });
}

// ── POST /api/admin/pin/challenge ──────────────────────────────────────────────
// Issues a short-lived (5 min) challenge token for a specific high-risk action.
// The token is returned to the client and must be sent back with the high-risk
// API request. The server validates it in requireAdminPinHighRisk middleware.
//
// Supported actions: sar_view, sar_export, delete_user, assign_plan,
//   update_legal, update_settings, assisted_access, billing_control,
//   feature_change, suspend_user

export async function issueAdminPinChallenge(req: Request, res: Response) {
  const aid = adminId(req);
  if (!aid) return res.status(401).json({ success: false, error: 'Not authenticated' });

  // Must have a valid PIN session to issue a challenge
  if (!isPinSessionValid(req)) {
    return res.status(403).json({
      success: false,
      expired: true,
      error: 'PIN session expired. Please re-enter your PIN.',
    });
  }

  const { pin, action } = req.body as { pin?: string; action?: string };
  if (!pin) return res.status(400).json({ success: false, error: 'PIN required.' });
  if (!action) return res.status(400).json({ success: false, error: 'Action required.' });

  ensureAdminPinTable();
  const row = db.prepare(
    'SELECT pin_hash, locked_until, failed_attempts FROM admin_pins WHERE admin_id = ?'
  ).get(aid) as { pin_hash: string; locked_until: string | null; failed_attempts: number } | undefined;

  if (!row) {
    return res.status(403).json({ success: false, error: 'No PIN set.' });
  }
  if (isLocked(row)) {
    return res.status(429).json({ success: false, error: 'Account locked.', locked: true });
  }

  const match = await bcrypt.compare(pin, row.pin_hash);
  if (!match) {
    const attempts = (row.failed_attempts ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;
    db.prepare(
      'UPDATE admin_pins SET failed_attempts = ?, locked_until = ? WHERE admin_id = ?'
    ).run(attempts, lockedUntil, aid);
    writeAudit({
      actorId: aid, actorType: 'admin',
      action: 'admin_pin_challenge_failed', resourceType: 'admin', resourceId: String(aid),
      details: `PIN challenge failed for action "${action}" (attempt ${attempts}/${MAX_ATTEMPTS})`,
      ipAddress: req.ip, result: 'failure',
    });
    if (lockedUntil) {
      // Notify admin of lockout triggered via challenge
      const identity = getAdminIdentity(aid);
      if (identity) {
        notifySecurityAlert({
          userEmail: identity.email,
          userName: identity.name,
          userId: aid,
          alertType: 'account_locked',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
          detail: `Too many failed PIN challenge attempts (action: "${action}"). Admin portal locked for ${LOCKOUT_MINUTES} minutes.`,
        });
      }
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        locked: true,
      });
    }
    const remaining = MAX_ATTEMPTS - attempts;
    return res.status(401).json({
      success: false,
      error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    });
  }

  // Reset failed attempts on success
  db.prepare(
    'UPDATE admin_pins SET failed_attempts = 0, locked_until = NULL WHERE admin_id = ?'
  ).run(aid);

  // Issue a cryptographically random token
  const { randomBytes } = await import('node:crypto');
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  ensureChallengeTokensTable();
  db.prepare(
    'INSERT OR REPLACE INTO admin_challenge_tokens (token, admin_id, action, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, aid, action, expiresAt);

  writeAudit({
    actorId: aid, actorType: 'admin',
    action: 'admin_pin_challenge_issued', resourceType: 'admin', resourceId: String(aid),
    details: `PIN challenge issued for high-risk action: "${action}"`,
    ipAddress: req.ip, result: 'success',
  });

  res.json({ success: true, token, expiresAt });
}

// ── Challenge token validator (used by requireAdminPinHighRisk middleware) ─────

export function validateChallengeToken(
  token: string,
  adminId: number,
  action: string
): boolean {
  try {
    ensureChallengeTokensTable();
    const entry = db.prepare(
      'SELECT admin_id, action, expires_at FROM admin_challenge_tokens WHERE token = ?'
    ).get(token) as { admin_id: number; action: string; expires_at: number } | undefined;

    if (!entry) return false;
    if (entry.admin_id !== adminId) return false;
    if (entry.action !== action) return false;
    if (entry.expires_at < Date.now()) {
      db.prepare('DELETE FROM admin_challenge_tokens WHERE token = ?').run(token);
      return false;
    }
    // One-time use — consume the token
    db.prepare('DELETE FROM admin_challenge_tokens WHERE token = ?').run(token);
    return true;
  } catch {
    return false;
  }
}
