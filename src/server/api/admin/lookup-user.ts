/**
 * GET /api/admin/users/lookup?ref=<email or user_number>
 * Resolves a user by email address OR Profile Centre user number.
 * Returns minimal safe data for the authority report subject field.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';

export function lookupUserByRef(req: Request, res: Response) {
  try {
    const ref = String(req.query.ref ?? '').trim();
    if (!ref) return res.status(400).json({ success: false, error: 'ref query param required' });

    // Try email first, then user_number (case-insensitive)
    const user = db.prepare(`
      SELECT id, name, email, user_number, role, plan_id, account_status
      FROM users
      WHERE LOWER(email) = LOWER(?) OR LOWER(user_number) = LOWER(?)
      LIMIT 1
    `).get(ref, ref) as {
      id: number; name: string; email: string;
      user_number: string | null; role: string;
      plan_id: number | null; account_status: string | null;
    } | undefined;

    if (!user) {
      return res.status(404).json({ success: false, error: 'No user found with that email or user number.' });
    }

    res.json({ success: true, user });
  } catch (e) {
    console.error('[lookupUserByRef]', e);
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
}
