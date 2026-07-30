/**
 * GET  /api/me/appearance  — returns the user's saved appearance preference
 * POST /api/me/appearance  — saves the user's appearance preference
 *
 * appearance_preference: 'light' | 'dark' | 'system'
 */
import type { Request, Response } from 'express';
import db from '../../db';

const VALID = ['light', 'dark', 'system'] as const;
type Pref = typeof VALID[number];

export async function getAppearance(req: Request, res: Response) {
  try {
    const userId = (req.session as Record<string, unknown>).userId as number | undefined;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const row = db.prepare('SELECT appearance_preference FROM users WHERE id = ?').get(userId) as
      { appearance_preference: string | null } | undefined;

    const preference: Pref = (VALID as readonly string[]).includes(row?.appearance_preference ?? '')
      ? (row!.appearance_preference as Pref)
      : 'dark';

    return res.json({ success: true, preference });
  } catch (err) {
    console.error('[appearance] GET error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

export async function saveAppearance(req: Request, res: Response) {
  try {
    const userId = (req.session as Record<string, unknown>).userId as number | undefined;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { preference } = req.body as { preference?: string };
    if (!preference || !(VALID as readonly string[]).includes(preference)) {
      return res.status(400).json({ success: false, error: `preference must be one of: ${VALID.join(', ')}` });
    }

    db.prepare('UPDATE users SET appearance_preference = ? WHERE id = ?').run(preference, userId);

    return res.json({ success: true, preference });
  } catch (err) {
    console.error('[appearance] POST error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
