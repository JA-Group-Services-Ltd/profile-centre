import { type Request, type Response } from 'express';
import db from '../../db.js';

export async function getThemes(_req: Request, res: Response) {
  try {
    const themes = await db.prepare(`
      SELECT id, name, slug, description, primary_color, accent_color, background_color, text_color,
        is_free, category, font_heading, font_body, card_style, gradient, border_radius, button_style, layout, sort_order
      FROM themes WHERE is_active = 1 ORDER BY is_free DESC, sort_order ASC, id ASC
    `).all();
    res.json({ success: true, data: themes });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch themes' });
  }
}

/**
 * GET /api/themes/allowed
 * Returns the IDs of themes the authenticated user is allowed to apply,
 * based on their plan's max_themes and has_custom_themes flags.
 *
 * Free plan (max_themes=1): only the first is_free theme (Default Blue, id=1).
 * Paid plan with has_custom_themes=1: all themes.
 * Paid plan without has_custom_themes: all is_free themes.
 */
export async function getAllowedThemes(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const user = await db.prepare('SELECT plan_id FROM users WHERE id = ?').get(userId) as { plan_id: number } | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const plan = user.plan_id
      ? await db.prepare('SELECT has_custom_themes, max_themes FROM plans WHERE id = ?').get(user.plan_id) as { has_custom_themes: number; max_themes: number | null } | undefined
      : undefined;

    const hasCustomThemes = plan?.has_custom_themes === 1;
    // max_themes: 1 = free (1 theme only), -1 = unlimited, null = treat as unlimited
    const maxThemes = plan?.max_themes ?? -1;

    let allowedIds: number[];

    if (hasCustomThemes) {
      // Paid plan with custom themes: full access to all themes
      const all = await db.prepare('SELECT id FROM themes WHERE is_active = 1').all() as { id: number }[];
      allowedIds = all.map(t => t.id);
    } else if (maxThemes === 1) {
      // Free plan: only the first is_free theme (Default Blue)
      const freeTheme = await db.prepare(
        'SELECT id FROM themes WHERE is_free = 1 AND is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 1'
      ).get() as { id: number } | undefined;
      allowedIds = freeTheme ? [freeTheme.id] : [1];
    } else {
      // Paid plan without custom themes flag: all is_free themes
      const freeThemes = await db.prepare('SELECT id FROM themes WHERE is_free = 1 AND is_active = 1').all() as { id: number }[];
      allowedIds = freeThemes.map(t => t.id);
    }

    res.json({ success: true, data: { allowed_ids: allowedIds, has_custom_themes: hasCustomThemes, max_themes: maxThemes } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch allowed themes' });
  }
}
