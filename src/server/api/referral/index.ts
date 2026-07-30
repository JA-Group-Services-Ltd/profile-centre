/**
 * Referral & Points API
 *
 * Points awarded:
 *   - 50 pts when a referred user signs up (referral_events.event_type = 'signup')
 *   - 200 pts when a referred user upgrades to a paid plan (event_type = 'upgrade')
 *
 * Points are stored in points_ledger (append-only).
 * Balance = SUM(delta) for the user.
 *
 * Referral codes are 8-char uppercase alphanumeric, unique per user.
 */
import { type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { randomBytes } from 'node:crypto';

const POINTS_SIGNUP  = 50;
const POINTS_UPGRADE = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  return randomBytes(4).toString('hex').toUpperCase(); // 8 chars
}

async function getOrCreateCode(userId: number): Promise<string> {
  const existing = await db.prepare('SELECT code FROM referral_codes WHERE user_id = ?').get(userId) as
    { code: string } | undefined;
  if (existing) return existing.code;

  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 20) throw new Error('Could not generate unique referral code');
  } while (await db.prepare('SELECT id FROM referral_codes WHERE code = ?').get(code));

  await db.prepare('INSERT INTO referral_codes (user_id, code) VALUES (?, ?)').run(userId, code);
  return code;
}

async function getPointsBalance(userId: number): Promise<number> {
  const row = await db.prepare('SELECT COALESCE(SUM(delta), 0) as total FROM points_ledger WHERE user_id = ?')
    .get(userId) as { total: number } | null;
  return row?.total ?? 0;
}

// ── GET /api/referral/me ─────────────────────────────────────────────────────
// Returns the user's referral code, points balance, and referral history.
export async function getReferralMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const code = await getOrCreateCode(userId);
    const balance = await getPointsBalance(userId);

    const events = await db.prepare(`
      SELECT re.id, re.event_type, re.points_awarded, re.created_at,
             u.name as referred_name
      FROM referral_events re
      JOIN users u ON re.referred_user_id = u.id
      WHERE re.referrer_user_id = ?
      ORDER BY re.created_at DESC
      LIMIT 50
    `).all(userId) as Array<{
      id: number;
      event_type: string;
      points_awarded: number;
      created_at: string;
      referred_name: string;
    }>;

    const ledger = await db.prepare(`
      SELECT delta, reason, created_at
      FROM points_ledger
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(userId) as Array<{ delta: number; reason: string; created_at: string }>;

    res.json({
      success: true,
      data: {
        code,
        balance,
        total_referrals: events.length,
        events,
        ledger,
      },
    });
  } catch (err) {
    console.error('[referral] getReferralMe error:', err);
    res.status(500).json({ success: false, error: 'Failed to load referral data' });
  }
}

// ── POST /api/referral/track-signup ─────────────────────────────────────────
// Called internally (from OIDC callback) when a new user signs up with a ref code.
// Not exposed publicly — called from oidc.ts after user creation.
export async function trackReferralSignup(referredUserId: number, code: string): Promise<void> {
  try {
    // Validate code
    const referralCode = await db.prepare('SELECT user_id FROM referral_codes WHERE code = ?').get(code) as
      { user_id: number } | undefined;
    if (!referralCode) return;

    const referrerId = referralCode.user_id;
    if (referrerId === referredUserId) return; // can't refer yourself

    // Prevent duplicate signup events for the same referred user
    const existing = await db.prepare(
      `SELECT id FROM referral_events WHERE referred_user_id = ? AND event_type = 'signup'`
    ).get(referredUserId);
    if (existing) return;

    // Record the event
    const event = db.prepare(`
      INSERT INTO referral_events (referrer_user_id, referred_user_id, code, event_type, points_awarded)
      VALUES (?, ?, ?, 'signup', ?)
    `).run(referrerId, referredUserId, code, POINTS_SIGNUP);

    // Award points to referrer
    db.prepare(`
      INSERT INTO points_ledger (user_id, delta, reason, ref_id)
      VALUES (?, ?, 'Referral signup bonus', ?)
    `).run(referrerId, POINTS_SIGNUP, event.lastInsertRowid);

    // Store the code on the referred user record
    await db.prepare('UPDATE users SET referred_by_code = ? WHERE id = ?').run(code, referredUserId);

    console.log(`[referral] Signup tracked: referrer=${referrerId} referred=${referredUserId} +${POINTS_SIGNUP}pts`);
  } catch (err) {
    console.error('[referral] trackReferralSignup error:', err);
  }
}

// ── POST /api/referral/track-upgrade ────────────────────────────────────────
// Called internally when a referred user upgrades to a paid plan.
export async function trackReferralUpgrade(referredUserId: number): Promise<void> {
  try {
    const user = await db.prepare('SELECT referred_by_code FROM users WHERE id = ?').get(referredUserId) as
      { referred_by_code: string | null } | undefined;
    if (!user?.referred_by_code) return;

    const referralCode = await db.prepare('SELECT user_id FROM referral_codes WHERE code = ?').get(user.referred_by_code) as
      { user_id: number } | undefined;
    if (!referralCode) return;

    const referrerId = referralCode.user_id;

    // Only award once per referred user
    const existing = await db.prepare(
      `SELECT id FROM referral_events WHERE referred_user_id = ? AND event_type = 'upgrade'`
    ).get(referredUserId);
    if (existing) return;

    const event = db.prepare(`
      INSERT INTO referral_events (referrer_user_id, referred_user_id, code, event_type, points_awarded)
      VALUES (?, ?, ?, 'upgrade', ?)
    `).run(referrerId, referredUserId, user.referred_by_code, POINTS_UPGRADE);

    db.prepare(`
      INSERT INTO points_ledger (user_id, delta, reason, ref_id)
      VALUES (?, ?, 'Referral upgrade bonus', ?)
    `).run(referrerId, POINTS_UPGRADE, event.lastInsertRowid);

    console.log(`[referral] Upgrade tracked: referrer=${referrerId} referred=${referredUserId} +${POINTS_UPGRADE}pts`);
  } catch (err) {
    console.error('[referral] trackReferralUpgrade error:', err);
  }
}

// ── GET /api/admin/referrals ─────────────────────────────────────────────────
// Admin view of all referral events.
export async function getAdminReferrals(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const events = await db.prepare(`
      SELECT re.id, re.event_type, re.points_awarded, re.created_at, re.code,
             r.name as referrer_name, r.email as referrer_email,
             u.name as referred_name, u.email as referred_email
      FROM referral_events re
      JOIN users r ON re.referrer_user_id = r.id
      JOIN users u ON re.referred_user_id = u.id
      ORDER BY re.created_at DESC
      LIMIT 200
    `).all();

    const topReferrers = db.prepare(`
      SELECT r.id, r.name, r.email,
             COUNT(re.id) as total_referrals,
             COALESCE(SUM(re.points_awarded), 0) as total_points
      FROM users r
      JOIN referral_events re ON re.referrer_user_id = r.id
      GROUP BY r.id
      ORDER BY total_referrals DESC
      LIMIT 20
    `).all();

    res.json({ success: true, data: { events, topReferrers } });
  } catch (err) {
    console.error('[referral] getAdminReferrals error:', err);
    res.status(500).json({ success: false, error: 'Failed to load referral data' });
  }
}
