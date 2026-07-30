/**
 * GET /api/profiles/search
 *
 * Public profile directory search.
 * Returns profiles that are:
 *   - published (is_published = 1)
 *   - opted into the directory (search_directory_enabled = 1)
 *   - not suspended (is_suspended IS NULL OR is_suspended = 0)
 *   - not hidden by admin (is_hidden IS NULL OR is_hidden = 0)
 *   - account is active (users.account_status = 'active')
 *
 * Query params:
 *   q        — search term (name, job title, company, bio, username)
 *   type     — 'personal' | 'business' | '' (all)
 *   page     — 1-based page number (default 1)
 *   limit    — results per page (default 20, max 50)
 */

import { type Request, type Response } from 'express';
import db from '../../db.js';

interface ProfileRow {
  id: number;
  username: string;
  biz_slug: string | null;
  profile_type: string;
  display_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  business_name: string | null;
  business_tagline: string | null;
  business_category: string | null;
  location_city: string | null;
  is_verified: number;
  personal_type: string | null;
}

export async function searchPublicProfiles(req: Request, res: Response) {
  try {
    const q = ((req.query.q as string) ?? '').trim();
    const type = (req.query.type as string) ?? '';
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10)));
    const offset = (page - 1) * limit;

    // Build WHERE clauses
    const conditions: string[] = [
      'p.is_published = 1',
      'p.search_directory_enabled = 1',
      '(p.is_suspended IS NULL OR p.is_suspended = 0)',
      '(p.is_hidden IS NULL OR p.is_hidden = 0)',
      "u.account_status = 'active'",
    ];
    const params: (string | number)[] = [];

    if (type === 'personal' || type === 'business') {
      conditions.push('p.profile_type = ?');
      params.push(type);
    }

    if (q) {
      conditions.push(`(
        p.display_name LIKE ? OR
        p.username LIKE ? OR
        p.job_title LIKE ? OR
        p.company LIKE ? OR
        p.bio LIKE ? OR
        p.business_name LIKE ? OR
        p.business_tagline LIKE ? OR
        p.business_category LIKE ? OR
        p.location_city LIKE ? OR
        p.biz_slug LIKE ?
      )`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like, like, like, like);
    }

    const where = conditions.join(' AND ');

    // Count total
    const countRow = db.prepare(
      `SELECT COUNT(*) as total
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE ${where}`
    ).get(...params) as { total: number };

    const total = countRow?.total ?? 0;

    // Fetch page
    const rows = db.prepare(
      `SELECT
         p.id, p.username, p.biz_slug, p.profile_type,
         p.display_name, p.job_title, p.company, p.bio,
         p.avatar_url, p.cover_url,
         p.business_name, p.business_tagline, p.business_category,
         p.location_city, p.is_verified, p.personal_type
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE ${where}
       ORDER BY p.is_verified DESC, p.updated_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as ProfileRow[];

    const profiles = rows.map(p => ({
      id: p.id,
      profileType: p.profile_type,
      username: p.username,
      slug: p.profile_type === 'business' ? p.biz_slug : p.username,
      url: p.profile_type === 'business'
        ? `/profile/${p.biz_slug}`
        : `/profile/${p.username}`,
      displayName: p.display_name ?? p.business_name ?? p.username,
      jobTitle: p.job_title ?? null,
      company: p.company ?? null,
      bio: p.bio ? p.bio.slice(0, 160) : null,
      avatarUrl: p.avatar_url ?? null,
      coverUrl: p.cover_url ?? null,
      businessName: p.business_name ?? null,
      businessTagline: p.business_tagline ?? null,
      businessCategory: p.business_category ?? null,
      locationCity: p.location_city ?? null,
      isVerified: p.is_verified === 1,
      personalType: p.personal_type ?? null,
    }));

    res.json({
      success: true,
      data: profiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + rows.length < total,
      },
      query: q || null,
      type: type || null,
    });
  } catch (err) {
    console.error('[profiles/search] error:', err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
}
