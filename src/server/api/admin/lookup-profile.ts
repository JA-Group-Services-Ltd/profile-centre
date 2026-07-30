/**
 * GET /api/admin/profiles/lookup?username=<username>
 * Resolves a profile by username.
 * Returns minimal safe data for the authority report subject field.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';

export function lookupProfileByUsername(req: Request, res: Response) {
  try {
    const username = String(req.query.username ?? '').trim().toLowerCase();
    if (!username) return res.status(400).json({ success: false, error: 'username query param required' });

    const profile = db.prepare(`
      SELECT id, username, display_name, profile_type, is_published
      FROM profiles
      WHERE LOWER(username) = ?
      LIMIT 1
    `).get(username) as {
      id: number; username: string; display_name: string | null;
      profile_type: string; is_published: number;
    } | undefined;

    if (!profile) {
      return res.status(404).json({ success: false, error: 'No profile found with that username.' });
    }

    res.json({ success: true, profile });
  } catch (e) {
    console.error('[lookupProfileByUsername]', e);
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
}
