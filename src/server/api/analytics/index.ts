/**
 * Analytics handlers.
 *
 * UK GDPR compliance:
 * - IP addresses are one-way hashed (SHA-256 + per-process salt) before storage.
 *   Raw IPs are never persisted — they are personal data under UK GDPR Art 4(1).
 * - user_agent is NOT stored — it can be used to fingerprint individuals.
 * - Only aggregate counts and date-bucketed data are returned to the frontend.
 * - Days parameter is capped at 365 to prevent unbounded queries.
 */
import { createHash, randomBytes } from 'node:crypto';
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { getEffectiveUserAccess } from '../../lib/entitlement.js';

// Per-process salt — not persisted; resets on restart.
// This means the same IP produces a different hash after a restart,
// which is intentional: it prevents long-term cross-session tracking.
const IP_SALT = randomBytes(16).toString('hex');

function hashIp(ip: string): string {
  return createHash('sha256').update(IP_SALT + ip).digest('hex').slice(0, 32);
}

// POST /api/analytics/view/:username
// Accepts both personal usernames and business biz_slugs.
// The frontend sends whichever identifier it has; we probe both columns.
export async function recordView(req: Request, res: Response) {
  try {
    const { username } = req.params;

    // Try personal profile first (username), then business profile (biz_slug).
    // Both are stored in the same profiles table; profile_type distinguishes them.
    let profile = db.prepare(
      "SELECT id FROM profiles WHERE username = ? AND is_published = 1 AND profile_type = 'personal'"
    ).get(username) as { id: number } | undefined;

    if (!profile) {
      profile = db.prepare(
        "SELECT id FROM profiles WHERE biz_slug = ? AND is_published = 1 AND profile_type = 'business'"
      ).get(username) as { id: number } | undefined;
    }

    if (!profile) {
      // Return 200 silently — the profile may exist but be unpublished; no need to expose that
      res.json({ success: true });
      return;
    }

    const rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const ipHash = hashIp(rawIp);

    // Write to ip_hash_v2 (the GDPR-compliant column added in migration).
    // ip_hash (legacy) is left null on new rows; user_agent is never written.
    db.prepare(
      'INSERT INTO page_views (profile_id, ip_hash_v2) VALUES (?, ?)'
    ).run(profile.id, ipHash);

    res.json({ success: true });
  } catch (err) {
    console.error('[analytics] recordView error:', err);
    res.status(500).json({ success: false, error: 'Failed to record view' });
  }
}

// GET /api/analytics/:profileId
export function getAnalytics(req: AuthRequest, res: Response) {
  try {
    const { profileId } = req.params;

    // ── Plan gate: analytics requires Professional or above ───────────────────
    const access = getEffectiveUserAccess(req.user!.id);
    if (!access.hasAnalytics) {
      res.status(403).json({
        success: false,
        error: 'Advanced analytics are not included in your current plan. Upgrade to Professional or above to access analytics.',
        code: 'FEATURE_NOT_AVAILABLE',
      });
      return;
    }

    // Cap days at 365 to prevent unbounded table scans
    const rawDays = parseInt((req.query.days as string) || '30', 10);
    const daysNum = Math.min(Math.max(isNaN(rawDays) ? 30 : rawDays, 1), 365);
    const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();

    // Comparison period: same length immediately before the current window
    const prevSince = new Date(Date.now() - daysNum * 2 * 24 * 60 * 60 * 1000).toISOString();

    // better-sqlite3 is synchronous — no await
    const profile = db.prepare(
      'SELECT id FROM profiles WHERE id = ? AND user_id = ?'
    ).get(profileId, req.user!.id);
    if (!profile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    // ── Current period ──────────────────────────────────────────────────────
    const tvRow = db.prepare('SELECT COUNT(*) as c FROM page_views WHERE profile_id = ?').get(profileId) as { c: number } | undefined;
    const totalViews = tvRow?.c ?? 0;

    const rvRow = db.prepare('SELECT COUNT(*) as c FROM page_views WHERE profile_id = ? AND viewed_at >= ?').get(profileId, since) as { c: number } | undefined;
    const recentViews = rvRow?.c ?? 0;

    const tcRow = db.prepare('SELECT COUNT(*) as c FROM link_clicks WHERE profile_id = ?').get(profileId) as { c: number } | undefined;
    const totalClicks = tcRow?.c ?? 0;

    const rcRow = db.prepare('SELECT COUNT(*) as c FROM link_clicks WHERE profile_id = ? AND clicked_at >= ?').get(profileId, since) as { c: number } | undefined;
    const recentClicks = rcRow?.c ?? 0;

    // ── Previous period (for % change comparison) ───────────────────────────
    const prevViewsRow = db.prepare(
      'SELECT COUNT(*) as c FROM page_views WHERE profile_id = ? AND viewed_at >= ? AND viewed_at < ?'
    ).get(profileId, prevSince, since) as { c: number } | undefined;
    const prevViews = prevViewsRow?.c ?? 0;

    const prevClicksRow = db.prepare(
      'SELECT COUNT(*) as c FROM link_clicks WHERE profile_id = ? AND clicked_at >= ? AND clicked_at < ?'
    ).get(profileId, prevSince, since) as { c: number } | undefined;
    const prevClicks = prevClicksRow?.c ?? 0;

    // ── Views by day ─────────────────────────────────────────────────────────
    const viewsByDay = db.prepare(`
      SELECT DATE(viewed_at) as date, COUNT(*) as count
      FROM page_views
      WHERE profile_id = ? AND viewed_at >= ?
      GROUP BY DATE(viewed_at)
      ORDER BY date ASC
    `).all(profileId, since) as { date: string; count: number }[];

    // ── Clicks by day ────────────────────────────────────────────────────────
    const clicksByDay = db.prepare(`
      SELECT DATE(clicked_at) as date, COUNT(*) as count
      FROM link_clicks
      WHERE profile_id = ? AND clicked_at >= ?
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `).all(profileId, since) as { date: string; count: number }[];

    // ── Weekday distribution (0=Sun … 6=Sat) ────────────────────────────────
    const weekdayViews = db.prepare(`
      SELECT CAST(strftime('%w', viewed_at) AS INTEGER) as dow, COUNT(*) as count
      FROM page_views
      WHERE profile_id = ? AND viewed_at >= ?
      GROUP BY dow
      ORDER BY dow ASC
    `).all(profileId, since) as { dow: number; count: number }[];

    // ── Unique visitors (distinct ip hashes) ────────────────────────────────
    const uvRow = db.prepare(
      'SELECT COUNT(DISTINCT ip_hash_v2) as c FROM page_views WHERE profile_id = ? AND viewed_at >= ?'
    ).get(profileId, since) as { c: number } | undefined;
    const uniqueVisitors = uvRow?.c ?? 0;

    const prevUvRow = db.prepare(
      'SELECT COUNT(DISTINCT ip_hash_v2) as c FROM page_views WHERE profile_id = ? AND viewed_at >= ? AND viewed_at < ?'
    ).get(profileId, prevSince, since) as { c: number } | undefined;
    const prevUniqueVisitors = prevUvRow?.c ?? 0;

    // ── Top links ────────────────────────────────────────────────────────────
    const topLinks = db.prepare(`
      SELECT pl.label, pl.url, pl.platform, COUNT(lc.id) as clicks
      FROM profile_links pl
      LEFT JOIN link_clicks lc ON pl.id = lc.link_id AND lc.clicked_at >= ?
      WHERE pl.profile_id = ?
      GROUP BY pl.id
      ORDER BY clicks DESC
      LIMIT 10
    `).all(since, profileId);

    // ── CTR ──────────────────────────────────────────────────────────────────
    const ctr = recentViews > 0 ? Math.round((recentClicks / recentViews) * 100 * 10) / 10 : 0;
    const prevCtr = prevViews > 0 ? Math.round((prevClicks / prevViews) * 100 * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        totalViews, recentViews, totalClicks, recentClicks,
        prevViews, prevClicks,
        uniqueVisitors, prevUniqueVisitors,
        ctr, prevCtr,
        viewsByDay, clicksByDay,
        weekdayViews,
        topLinks,
      },
    });
  } catch (err) {
    console.error('[analytics] getAnalytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
}
