/**
 * Account Security PIN API
 *
 * Allows users to set a PIN that is required before sensitive actions.
 * PINs are hashed with bcryptjs — never stored in plain text.
 * Rate-limited and locked after repeated failures.
 */

import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../../db.js';

function auditLog(action: string, details: string, userId?: number) {
  try {
    db.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, details, created_at) VALUES ('user', ?, ?, ?, datetime('now'))`).run(userId ?? null, action, details);
  } catch { /* audit table may differ */ }
}

const SALT_ROUNDS = 10;
const MAX_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

// ── DB setup ────────────────────────────────────────────────────────────────

export function ensureAccountPinTable() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS account_pins (
        user_id INTEGER PRIMARY KEY,
        pin_hash TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isLocked(row: { locked_until?: string | null }): boolean {
  if (!row.locked_until) return false;
  return new Date(row.locked_until) > new Date();
}

// ── Handlers ────────────────────────────────────────────────────────────────

// GET /api/security/pin/status
export async function getPinStatus(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  try {
    ensureAccountPinTable();
    const row = db.prepare('SELECT user_id, failed_attempts, locked_until FROM account_pins WHERE user_id = ?').get(userId) as any;
    const locked = row ? isLocked(row) : false;
    const lockedUntil = locked && row?.locked_until
      ? new Date(row.locked_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : null;
    res.json({ success: true, hasPin: !!row, isLocked: locked, lockedUntil });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/security/pin  — set or change PIN
export async function setPin(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { currentPin, newPin } = req.body;

  if (!newPin || typeof newPin !== 'string' || !/^\d{4,8}$/.test(newPin)) {
    return res.status(400).json({ success: false, error: 'PIN must be 4–8 digits.' });
  }

  try {
    ensureAccountPinTable();
    const existing = db.prepare('SELECT * FROM account_pins WHERE user_id = ?').get(userId) as any;

    if (existing) {
      // Changing PIN — verify current PIN first
      if (!currentPin) return res.status(400).json({ success: false, error: 'Current PIN is required to change it.' });
      if (isLocked(existing)) {
        return res.status(429).json({ success: false, error: `Too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes.` });
      }
      const match = await bcrypt.compare(String(currentPin), existing.pin_hash);
      if (!match) {
        const attempts = (existing.failed_attempts || 0) + 1;
        const lockedUntil = attempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null;
        db.prepare('UPDATE account_pins SET failed_attempts = ?, locked_until = ? WHERE user_id = ?').run(attempts, lockedUntil, userId);
        auditLog('pin_change_failed', `User ${userId} failed PIN change attempt`, userId);
        return res.status(400).json({ success: false, error: 'Current PIN is incorrect.' });
      }
    }

    const hash = await bcrypt.hash(newPin, SALT_ROUNDS);
    db.prepare(`
      INSERT INTO account_pins (user_id, pin_hash, failed_attempts, locked_until, updated_at)
      VALUES (?, ?, 0, NULL, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = NULL, updated_at = excluded.updated_at
    `).run(userId, hash);

    auditLog('pin_set', `User ${userId} set/changed account PIN`, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// DELETE /api/security/pin  — remove PIN
export async function removePin(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { currentPin } = req.body;

  if (!currentPin) return res.status(400).json({ success: false, error: 'Current PIN is required.' });

  try {
    ensureAccountPinTable();
    const existing = db.prepare('SELECT * FROM account_pins WHERE user_id = ?').get(userId) as any;
    if (!existing) return res.status(400).json({ success: false, error: 'No PIN is set.' });
    if (isLocked(existing)) return res.status(429).json({ success: false, error: 'Account locked. Try again later.' });

    const match = await bcrypt.compare(String(currentPin), existing.pin_hash);
    if (!match) {
      const attempts = (existing.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;
      db.prepare('UPDATE account_pins SET failed_attempts = ?, locked_until = ? WHERE user_id = ?').run(attempts, lockedUntil, userId);
      auditLog('pin_remove_failed', `User ${userId} failed PIN removal`, userId);
      return res.status(400).json({ success: false, error: 'PIN is incorrect.' });
    }

    db.prepare('DELETE FROM account_pins WHERE user_id = ?').run(userId);
    auditLog('pin_removed', `User ${userId} removed account PIN`, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// GET /api/security/pin/session-status  — check if account PIN is already verified in this session
export async function getPinSessionStatus(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const PIN_SESSION_MS = 15 * 60 * 1000;
  const verifiedAt = (req as any).session?.accountPinVerifiedAt;
  const sessionValid = verifiedAt && (Date.now() - verifiedAt) < PIN_SESSION_MS;
  res.json({ success: true, sessionValid: !!sessionValid });
}

// POST /api/security/pin/verify  — verify PIN before sensitive action
export async function verifyPin(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { pin } = req.body;

  if (!pin) return res.status(400).json({ success: false, error: 'PIN is required.' });

  try {
    ensureAccountPinTable();
    const existing = db.prepare('SELECT * FROM account_pins WHERE user_id = ?').get(userId) as any;
    if (!existing) return res.json({ success: true, noPin: true }); // No PIN set — allow through

    if (isLocked(existing)) {
      const until = new Date(existing.locked_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return res.status(429).json({ success: false, error: `Too many PIN attempts. Please wait until ${until} before trying again.` });
    }

    const match = await bcrypt.compare(String(pin), existing.pin_hash);
    if (!match) {
      const attempts = (existing.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;
      db.prepare('UPDATE account_pins SET failed_attempts = ?, locked_until = ? WHERE user_id = ?').run(attempts, lockedUntil, userId);
      auditLog('pin_verify_failed', `User ${userId} failed PIN verification`, userId);
      if (lockedUntil) {
        const unlockTime = new Date(lockedUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return res.status(429).json({ success: false, error: `Too many PIN attempts. Your PIN is locked until ${unlockTime}. You can clear the lockout from Security Settings.`, locked: true });
      }
      const remaining = MAX_ATTEMPTS - attempts;
      return res.status(400).json({ success: false, error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, attemptsLeft: remaining });
    }

    // Reset failed attempts on success
    db.prepare('UPDATE account_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?').run(userId);
    auditLog('pin_verified', `User ${userId} verified PIN`, userId);
    // Cache verification in session for 15 minutes — avoids re-prompting on every action
    (req as any).session.accountPinVerifiedAt = Date.now();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/security/pin/self-unlock  — user clears their own PIN lockout (requires re-authentication via session)
export async function selfUnlockPin(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  try {
    ensureAccountPinTable();
    db.prepare('UPDATE account_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?').run(userId);
    auditLog('pin_self_unlocked', `User ${userId} cleared their own PIN lockout`, userId);
    res.json({ success: true, message: 'PIN lockout cleared. You can try again now.' });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/security/pin/unlock  — admin unlocks a user's PIN lockout
export async function adminUnlockUserPin(req: Request, res: Response) {
  const adminRole = (req as any).session?.role;
  if (adminRole !== 'admin') return res.status(403).json({ success: false, error: 'Admin only.' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required.' });
  try {
    ensureAccountPinTable();
    db.prepare('UPDATE account_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?').run(userId);
    auditLog('pin_unlocked_by_admin', `Admin unlocked PIN for user ${userId}`);
    res.json({ success: true, message: 'PIN lockout cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
