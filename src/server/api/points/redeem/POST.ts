/**
 * POST /api/points/redeem
 * Body: { perkKey: string }
 *
 * Redeems a perk for the authenticated user.
 * - Validates the perk key against the DB store catalogue
 * - Checks the user has sufficient balance
 * - Prevents double-redemption of non-repeatable perks
 * - Inserts a redemption record with timestamp
 * - Returns the new balance
 *
 * Points have NO monetary value. Perks are platform features only.
 * No financial promotion or inducement to spend money.
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.js';
import db from '../../../db.js';
import { setupPointsTables } from '../../../lib/points-db-setup.js';

interface AchievementRow { earned: number; points: number }
interface StoreItem { id: number; key: string; cost: number; repeatable: number; is_active: number }

export default async function handler(req: AuthRequest, res: Response) {
  try {
    setupPointsTables();
    const userId = req.user!.id;
    const { perkKey } = req.body as { perkKey?: string };

    if (!perkKey || typeof perkKey !== 'string') {
      return res.status(400).json({ success: false, error: 'perkKey is required' });
    }

    // Validate against DB catalogue
    const perk = db.prepare(
      `SELECT id, key, cost, repeatable, is_active FROM points_store_items WHERE key = ?`
    ).get(perkKey) as StoreItem | undefined;

    if (!perk) return res.status(400).json({ success: false, error: 'Unknown perk' });
    if (!perk.is_active) return res.status(400).json({ success: false, error: 'This perk is no longer available.' });

    // Check for existing redemption (non-repeatable perks)
    if (!perk.repeatable) {
      const existing = db.prepare(
        `SELECT id FROM points_redemptions WHERE user_id = ? AND perk_key = ? LIMIT 1`
      ).get(userId, perkKey);
      if (existing) {
        return res.status(409).json({ success: false, error: 'You have already redeemed this perk.' });
      }
    }

    // Calculate current balance from user_achievements
    let totalEarned = 0;
    try {
      const achievements = db.prepare(
        `SELECT earned, points FROM user_achievements WHERE user_id = ?`
      ).all(userId) as AchievementRow[];
      totalEarned = achievements.filter(a => a.earned).reduce((s, a) => s + (a.points ?? 0), 0);
    } catch { /* table may not exist yet */ }

    const redemptions = db.prepare(
      `SELECT cost FROM points_redemptions WHERE user_id = ?`
    ).all(userId) as { cost: number }[];
    const totalSpent = redemptions.reduce((s, r) => s + r.cost, 0);
    const balance = Math.max(0, totalEarned - totalSpent);

    if (balance < perk.cost) {
      return res.status(402).json({
        success: false,
        error: `Not enough points. You need ${perk.cost} but have ${balance}.`,
      });
    }

    // Record redemption
    db.prepare(
      `INSERT INTO points_redemptions (user_id, perk_key, cost) VALUES (?, ?, ?)`
    ).run(userId, perkKey, perk.cost);

    const newBalance = balance - perk.cost;
    res.json({ success: true, perkKey, newBalance });
  } catch (err) {
    console.error('[POST /api/points/redeem]', err);
    res.status(500).json({ success: false, error: 'Redemption failed' });
  }
}
