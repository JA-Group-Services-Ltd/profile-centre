/**
 * Support PIN API
 *
 * GET  /api/security/support-pin
 *   Returns the current 6-digit support PIN for the authenticated user.
 *   Generates a new one if none exists or the current one has expired.
 *   PIN rotates every 30 minutes. NEVER stored in localStorage — server only.
 *
 * POST /api/security/support-pin/rotate
 *   Force-rotates the PIN immediately (user-initiated).
 *
 * POST /api/security/support-pin/set
 *   Set a custom PIN. Requires { pin, confirmPin }.
 *   If pin !== confirmPin → returns { mismatch: true } and sends a verification
 *   email with a one-time code. The client must then call /verify-email with
 *   { code, pin } to confirm and save the PIN.
 *
 * POST /api/security/support-pin/verify-email
 *   { code, pin } — verifies the emailed code and saves the custom PIN.
 */
import { type Response } from 'express';
import { randomInt } from 'node:crypto';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';

const PIN_LIFETIME_MINUTES = 30;

// In-memory store for email verification codes (keyed by userId)
// In production this would be in the DB, but for simplicity we use a Map
// that survives the process lifetime (sufficient for a 10-minute window).
const emailVerifyCodes = new Map<number, { code: string; pin: string; expiresAt: number }>();

function generatePin(): string {
  // Cryptographically random 6-digit PIN (100000–999999)
  return String(randomInt(100000, 1000000));
}

function generateCode(): string {
  // 6-digit email verification code
  return String(randomInt(100000, 1000000));
}

/** Format a Date as SQLite-compatible datetime string: "YYYY-MM-DD HH:MM:SS" */
function toSqliteDate(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
}

function getOrCreatePin(userId: number): { pin: string; expiresAt: string; issuedAt: string } {
  const now = new Date();
  const nowStr = toSqliteDate(now);

  // Check for a valid existing PIN
  const existing = db.prepare(
    'SELECT pin, issued_at, expires_at FROM support_pins WHERE user_id = ? AND expires_at > ?'
  ).get(userId, nowStr) as { pin: string; issued_at: string; expires_at: string } | undefined;

  if (existing) {
    return { pin: existing.pin, expiresAt: existing.expires_at, issuedAt: existing.issued_at };
  }

  // Generate a new PIN
  const pin = generatePin();
  const issuedAt = nowStr;
  const expiresAt = toSqliteDate(new Date(now.getTime() + PIN_LIFETIME_MINUTES * 60 * 1000));

  db.prepare(`
    INSERT INTO support_pins (user_id, pin, issued_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      pin = excluded.pin,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at
  `).run(userId, pin, issuedAt, expiresAt);

  return { pin, expiresAt, issuedAt };
}

function saveCustomPin(userId: number, pin: string) {
  const now = new Date();
  const issuedAt = toSqliteDate(now);
  const expiresAt = toSqliteDate(new Date(now.getTime() + PIN_LIFETIME_MINUTES * 60 * 1000));
  db.prepare(`
    INSERT INTO support_pins (user_id, pin, issued_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      pin = excluded.pin,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at
  `).run(userId, pin, issuedAt, expiresAt);
  return { pin, expiresAt, issuedAt };
}

export async function getSupportPin(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { pin, expiresAt, issuedAt } = getOrCreatePin(userId);

    // Calculate seconds remaining
    const secondsRemaining = Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );

    return res.json({
      success: true,
      pin,
      expiresAt,
      issuedAt,
      secondsRemaining,
      lifetimeMinutes: PIN_LIFETIME_MINUTES,
    });
  } catch (err) {
    console.error('[support-pin] get error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get support PIN' });
  }
}

export async function rotateSupportPin(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    // Force-delete existing PIN so getOrCreatePin generates a fresh one
    db.prepare('DELETE FROM support_pins WHERE user_id = ?').run(userId);

    const { pin, expiresAt, issuedAt } = getOrCreatePin(userId);
    const secondsRemaining = Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );

    return res.json({
      success: true,
      pin,
      expiresAt,
      issuedAt,
      secondsRemaining,
      lifetimeMinutes: PIN_LIFETIME_MINUTES,
    });
  } catch (err) {
    console.error('[support-pin] rotate error:', err);
    return res.status(500).json({ success: false, error: 'Failed to rotate support PIN' });
  }
}

/** POST /api/security/support-pin/set — set a custom PIN with confirmation */
export async function setCustomPin(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const { pin, confirmPin } = req.body as { pin?: string; confirmPin?: string };

    if (!pin || !confirmPin) {
      return res.status(400).json({ success: false, error: 'Both PIN and confirmation are required.' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'PIN must be exactly 6 digits.' });
    }

    // PINs match — save immediately
    if (pin === confirmPin) {
      const { expiresAt, issuedAt } = saveCustomPin(userId, pin);
      const secondsRemaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      return res.json({ success: true, pin, expiresAt, issuedAt, secondsRemaining, lifetimeMinutes: PIN_LIFETIME_MINUTES });
    }

    // PINs don't match — send email verification code
    const code = generateCode();
    emailVerifyCodes.set(userId, { code, pin, expiresAt: Date.now() + 10 * 60 * 1000 });

    // Send branded email with the verification code
    try {
      const { sendEmail } = await import('../../lib/send-email.js');
      const { pinVerificationEmail, EMAIL_REPLY_TO } = await import('../../lib/email-templates.js');
      const { subject, html, text } = pinVerificationEmail({ code });
      await sendEmail({ fromName: 'JA Profile Studio', to: userEmail, subject, html, text, replyTo: EMAIL_REPLY_TO });
    } catch (emailErr) {
      console.warn('[support-pin] email send failed:', emailErr);
      // Still return mismatch — client will show the code entry form
    }

    return res.json({ success: false, mismatch: true, message: 'PINs did not match. A verification code has been sent to your email address.' });
  } catch (err) {
    console.error('[support-pin] set error:', err);
    return res.status(500).json({ success: false, error: 'Failed to set PIN.' });
  }
}

/** POST /api/security/support-pin/verify-email — confirm email code and save PIN */
export async function verifyEmailAndSetPin(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { code } = req.body as { code?: string };

    if (!code) return res.status(400).json({ success: false, error: 'Verification code is required.' });

    const entry = emailVerifyCodes.get(userId);
    if (!entry) return res.status(400).json({ success: false, error: 'No pending verification. Please start again.' });
    if (Date.now() > entry.expiresAt) {
      emailVerifyCodes.delete(userId);
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please start again.' });
    }
    if (entry.code !== code.trim()) {
      return res.status(400).json({ success: false, error: 'Incorrect verification code. Please try again.' });
    }

    // Code correct — save the PIN
    emailVerifyCodes.delete(userId);
    const { pin, expiresAt, issuedAt } = saveCustomPin(userId, entry.pin);
    const secondsRemaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

    return res.json({ success: true, pin, expiresAt, issuedAt, secondsRemaining, lifetimeMinutes: PIN_LIFETIME_MINUTES });
  } catch (err) {
    console.error('[support-pin] verify-email error:', err);
    return res.status(500).json({ success: false, error: 'Verification failed.' });
  }
}
