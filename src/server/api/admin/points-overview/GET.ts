/**
 * GET /api/admin/points-overview
 * Admin-only. Returns all users' points balances, earned achievements,
 * and redeemed perks for the admin Points & Rewards overview page.
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.js';
import db from '../../../db.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  plan_name: string;
  plan_slug: string;
}

interface AchievementSumRow {
  user_id: number;
  earned_count: number;
  total_achievements: number;
  total_earned_pts: number;
}

interface RedemptionSumRow {
  user_id: number;
  total_spent: number;
  perk_keys: string; // comma-separated
}

interface RecentAchievementRow {
  user_id: number;
  achievement_key: string;
  achievement_name: string;
  points: number;
  earned_at: string;
}

export default async function handler(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // All users with plan info
    const users = db.prepare(`
      SELECT u.id, u.name, u.email,
             COALESCE(p.name, 'Free') AS plan_name,
             COALESCE(p.slug, 'free') AS plan_slug
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.role != 'admin'
      ORDER BY u.name ASC
    `).all() as UserRow[];

    // Achievement totals per user
    const achievementSums = db.prepare(`
      SELECT
        user_id,
        COUNT(*) AS total_achievements,
        SUM(CASE WHEN earned = 1 THEN 1 ELSE 0 END) AS earned_count,
        SUM(CASE WHEN earned = 1 THEN COALESCE(points, 0) ELSE 0 END) AS total_earned_pts
      FROM user_achievements
      GROUP BY user_id
    `).all() as AchievementSumRow[];

    const achievementMap = new Map(achievementSums.map(a => [a.user_id, a]));

    // Redemption totals per user (table may not exist yet)
    let redemptionMap = new Map<number, RedemptionSumRow>();
    try {
      const redemptionSums = db.prepare(`
        SELECT
          user_id,
          SUM(cost) AS total_spent,
          GROUP_CONCAT(perk_key, ',') AS perk_keys
        FROM points_redemptions
        GROUP BY user_id
      `).all() as RedemptionSumRow[];
      redemptionMap = new Map(redemptionSums.map(r => [r.user_id, r]));
    } catch {
      // Table doesn't exist yet — no redemptions
    }

    // Recent achievements across all users (last 50)
    const recentAchievements = db.prepare(`
      SELECT
        ua.user_id,
        ua.achievement_key,
        COALESCE(a.name, ua.achievement_key) AS achievement_name,
        COALESCE(ua.points, a.points, 0) AS points,
        ua.earned_at
      FROM user_achievements ua
      LEFT JOIN achievements a ON ua.achievement_key = a.key
      WHERE ua.earned = 1 AND ua.earned_at IS NOT NULL
      ORDER BY ua.earned_at DESC
      LIMIT 50
    `).all() as RecentAchievementRow[];

    // Build per-user summary
    const userSummaries = users.map(u => {
      const ach = achievementMap.get(u.id);
      const red = redemptionMap.get(u.id);
      const totalEarned = ach?.total_earned_pts ?? 0;
      const totalSpent = red?.total_spent ?? 0;
      const balance = Math.max(0, totalEarned - totalSpent);
      const redeemedPerks = red?.perk_keys ? red.perk_keys.split(',').filter(Boolean) : [];

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        planName: u.plan_name,
        planSlug: u.plan_slug,
        balance,
        totalEarned,
        totalSpent,
        earnedCount: ach?.earned_count ?? 0,
        totalAchievements: ach?.total_achievements ?? 0,
        redeemedPerks,
      };
    });

    // Platform totals
    const totalPointsInCirculation = userSummaries.reduce((s, u) => s + u.balance, 0);
    const totalPointsEverEarned = userSummaries.reduce((s, u) => s + u.totalEarned, 0);
    const totalRedemptions = userSummaries.reduce((s, u) => s + u.redeemedPerks.length, 0);
    const usersWithPoints = userSummaries.filter(u => u.balance > 0).length;

    res.json({
      success: true,
      data: {
        users: userSummaries,
        recentAchievements,
        totals: {
          totalPointsInCirculation,
          totalPointsEverEarned,
          totalRedemptions,
          usersWithPoints,
          totalUsers: users.length,
        },
      },
    });
  } catch (err) {
    console.error('[GET /api/admin/points-overview]', err);
    res.status(500).json({ success: false, error: 'Failed to load points overview' });
  }
}
