/**
 * POST /api/profiles/:id/request-verification
 *
 * Allows a profile owner to request verification from the admin team.
 * Sets verification_requested_at and an optional note on the profile.
 * Admins can then review and verify/reject from the admin profiles page.
 */
import type { Response } from 'express';
import db from '../../db.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { notifyAdminVerificationRequest } from '../../lib/notifications.js';

export async function requestVerification(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { note } = req.body as { note?: string };

    // Ensure the profile belongs to this user
    const profile = db.prepare(
      'SELECT id, user_id, is_verified, verification_requested_at, username, display_name FROM profiles WHERE id = ?'
    ).get(id) as {
      id: number;
      user_id: number;
      is_verified: number;
      verification_requested_at: string | null;
      username: string;
      display_name: string | null;
    } | undefined;

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    if (profile.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorised' });
    }
    if (profile.is_verified) {
      return res.status(400).json({ success: false, error: 'Profile is already verified' });
    }

    db.prepare(
      `UPDATE profiles
         SET verification_requested_at = CURRENT_TIMESTAMP,
             verification_request_note = ?
       WHERE id = ?`
    ).run(note?.trim().slice(0, 500) ?? null, id);

    // Notify admin of the new verification request
    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId) as
      { name: string; email: string } | undefined;
    if (user) {
      notifyAdminVerificationRequest({
        userName: user.name,
        userEmail: user.email,
        userId,
        profileName: profile.display_name || profile.username,
        note: note?.trim().slice(0, 500),
      });
    }

    console.log(`[profiles:request-verification] Profile ${id} verification requested by user ${userId}`);
    return res.json({ success: true, requested: true });
  } catch (err) {
    console.error('[profiles:request-verification] Error:', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}
