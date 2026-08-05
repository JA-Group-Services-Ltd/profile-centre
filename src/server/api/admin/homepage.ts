/**
 * Admin homepage content API.
 * GET  /api/admin/homepage-content  — fetch current content
 * PUT  /api/admin/homepage-content  — save content
 * GET  /api/homepage-content        — public read (used by homepage)
 */
import type { Request, Response } from 'express';
import db from '../../db.js';

const SETTING_KEY = 'homepage_content';

export interface HomepageContent {
  hero_badge: string;
  hero_title_line1: string;
  hero_title_highlight: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  stats_users: string;
  stats_profiles: string;
  stats_countries: string;
  stats_uptime: string;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link: string;
  announcement_link_label: string;
}

const DEFAULTS: HomepageContent = {
  hero_badge:              'Personal & Business Digital Profiles',
  hero_title_line1:        'Your professional profile,',
  hero_title_highlight:    'ready to share anywhere',
  hero_subtitle:           'Sousa Murray Profiles gives you a personal or business digital profile page with your contact details, links, QR code and everything people need to find and connect with you — all in one place.',
  hero_cta_primary:        'Create Your Profile',
  hero_cta_secondary:      'See how it works',
  stats_users:             '',
  stats_profiles:          '',
  stats_countries:         '',
  stats_uptime:            '',
  announcement_enabled:    false,
  announcement_text:       '',
  announcement_link:       '',
  announcement_link_label: 'Learn more',
};

function loadContent(): HomepageContent {
  try {
    const row = db.prepare(`SELECT value FROM admin_settings WHERE key = ?`).get(SETTING_KEY) as { value: string } | undefined;
    if (row?.value) {
      return { ...DEFAULTS, ...JSON.parse(row.value) };
    }
  } catch { /* use defaults */ }
  return { ...DEFAULTS };
}

export async function getHomepageContent(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: loadContent() });
  } catch (err) {
    console.error('[homepage] getHomepageContent error:', err);
    res.status(500).json({ success: false, error: 'Failed to load homepage content' });
  }
}

export async function updateHomepageContent(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Partial<HomepageContent>;
    const current = loadContent();
    const merged: HomepageContent = {
      ...current,
      ...body,
      // Sanitise string fields
      hero_badge:              String(body.hero_badge              ?? current.hero_badge).slice(0, 200),
      hero_title_line1:        String(body.hero_title_line1        ?? current.hero_title_line1).slice(0, 200),
      hero_title_highlight:    String(body.hero_title_highlight    ?? current.hero_title_highlight).slice(0, 200),
      hero_subtitle:           String(body.hero_subtitle           ?? current.hero_subtitle).slice(0, 1000),
      hero_cta_primary:        String(body.hero_cta_primary        ?? current.hero_cta_primary).slice(0, 100),
      hero_cta_secondary:      String(body.hero_cta_secondary      ?? current.hero_cta_secondary).slice(0, 100),
      stats_users:             String(body.stats_users             ?? current.stats_users).slice(0, 50),
      stats_profiles:          String(body.stats_profiles          ?? current.stats_profiles).slice(0, 50),
      stats_countries:         String(body.stats_countries         ?? current.stats_countries).slice(0, 50),
      stats_uptime:            String(body.stats_uptime            ?? current.stats_uptime).slice(0, 50),
      announcement_enabled:    Boolean(body.announcement_enabled   ?? current.announcement_enabled),
      announcement_text:       String(body.announcement_text       ?? current.announcement_text).slice(0, 500),
      announcement_link:       String(body.announcement_link       ?? current.announcement_link).slice(0, 500),
      announcement_link_label: String(body.announcement_link_label ?? current.announcement_link_label).slice(0, 100),
    };

    db.prepare(`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(SETTING_KEY, JSON.stringify(merged));

    // Audit
    try {
      db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES ('admin', 'homepage.content.update', 'Homepage content updated')`).run();
    } catch { /* non-fatal */ }

    res.json({ success: true, data: merged });
  } catch (err) {
    console.error('[homepage] updateHomepageContent error:', err);
    res.status(500).json({ success: false, error: 'Failed to save homepage content' });
  }
}
