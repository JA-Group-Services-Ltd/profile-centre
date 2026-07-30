/**
 * GET /api/points
 * Returns the user's current points balance, total earned, total spent,
 * redeemed perks with timestamps, and the live store catalogue from DB.
 *
 * Points are derived from the user_achievements table (populated by /api/rewards).
 * Spent points are tracked in points_redemptions.
 *
 * UK Regulatory compliance:
 * - Points have NO monetary value and cannot be exchanged for cash.
 * - Perks are platform features only.
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { setupPointsTables } from '../../lib/points-db-setup.js';

interface AchievementRow { earned: number; points: number }
interface RedemptionRow  { perk_key: string; cost: number; redeemed_at: string }
interface StoreItem {
  id: number; key: string; title: string; description: string;
  cost: number; category: string; icon: string; color: string;
  is_active: number; repeatable: number; sort_order: number;
}

export default async function handler(req: AuthRequest, res: Response) {
  try {
    setupPointsTables();
    const userId = req.user!.id;

    // Sum points from persisted user_achievements
    let totalEarned = 0;
    try {
      const achievements = db.prepare(
        `SELECT earned, points FROM user_achievements WHERE user_id = ?`
      ).all(userId) as AchievementRow[];
      totalEarned = achievements.filter(a => a.earned).reduce((s, a) => s + (a.points ?? 0), 0);
    } catch {
      // Table may not exist yet if user hasn't visited /api/rewards — fall back to 0
    }

    // Get redemptions with timestamps
    const redemptions = db.prepare(
      `SELECT perk_key, cost, redeemed_at FROM points_redemptions WHERE user_id = ? ORDER BY redeemed_at DESC`
    ).all(userId) as RedemptionRow[];

    const totalSpent = redemptions.reduce((s, r) => s + r.cost, 0);
    const balance = Math.max(0, totalEarned - totalSpent);

    // Build redeemed map: perk_key → most recent redeemed_at
    const redeemedMap: Record<string, string> = {};
    for (const r of redemptions) {
      if (!redeemedMap[r.perk_key]) redeemedMap[r.perk_key] = r.redeemed_at;
    }
    const redeemedPerks = Object.keys(redeemedMap);

    // Achievement counts for earn guide progress
    let earnedCount = 0;
    let totalAchievements = 0;
    try {
      const achCounts = db.prepare(
        `SELECT COUNT(*) as total, SUM(CASE WHEN earned=1 THEN 1 ELSE 0 END) as earned FROM user_achievements WHERE user_id = ?`
      ).get(userId) as { total: number; earned: number } | undefined;
      earnedCount = achCounts?.earned ?? 0;
      totalAchievements = achCounts?.total ?? 0;
    } catch { /* ignore */ }

    // Profile completion score
    const profileRow = db.prepare(
      `SELECT completion_score FROM profiles WHERE user_id = ? AND (profile_type IS NULL OR profile_type = 'personal') LIMIT 1`
    ).get(userId) as { completion_score?: number } | undefined;
    const completionScore = profileRow?.completion_score ?? 0;

    // Plan info
    const userRow = db.prepare(
      `SELECT p.slug, p.price_monthly FROM users u LEFT JOIN plans p ON u.plan_id = p.id WHERE u.id = ?`
    ).get(userId) as { slug?: string; price_monthly?: number } | undefined;
    const planSlug = userRow?.slug ?? 'free';
    const isPaid = (userRow?.price_monthly ?? 0) > 0 || planSlug === 'lifetime';

    // Live store catalogue from DB (active items only for users)
    const storeItems = db.prepare(
      `SELECT * FROM points_store_items WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
    ).all() as StoreItem[];

    res.json({
      success: true,
      data: {
        balance,
        totalEarned,
        totalSpent,
        earnedCount,
        totalAchievements,
        completionScore,
        planSlug,
        isPaid,
        redeemedPerks,
        redeemedMap,       // key → redeemed_at timestamp
        storeItems,        // live catalogue from DB
      },
    });
  } catch (err) {
    console.error('[GET /api/points]', err);
    res.status(500).json({ success: false, error: 'Failed to load points' });
  }
}
