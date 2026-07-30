/**
 * POST /api/admin/profiles/:id/verify   — mark a profile as verified
 * DELETE /api/admin/profiles/:id/verify — remove verification
 *
 * Stores: is_verified=1, verified_at=now, verified_by=admin name
 * Sends: branded verification status email to the profile owner
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { notifyVerificationStatus } from '../../lib/notifications.js';

export async function verifyProfile(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const adminName = req.user?.name ?? 'Admin';
    const { reason } = req.body as { reason?: string };

    const profile = db.prepare(
      `SELECT p.id, p.display_name, p.username, u.email, u.name AS user_name, u.id AS user_id
         FROM profiles p JOIN users u ON u.id = p.user_id
        WHERE p.id = ?`
    ).get(id) as { id: number; display_name: string; username: string; email: string; user_name: string; user_id: number } | undefined;

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    db.prepare(
      `UPDATE profiles
         SET is_verified = 1,
             verified_at = CURRENT_TIMESTAMP,
             verified_by = ?
       WHERE id = ?`
    ).run(adminName, id);

    // Notify the profile owner
    notifyVerificationStatus({
      userEmail: profile.email,
      userName: profile.user_name,
      userId: profile.user_id,
      profileName: profile.display_name || profile.username,
      status: 'approved',
      reason,
    });

    console.log(`[admin:verify] Profile ${id} (${profile.display_name}) verified by ${adminName}`);
    return res.json({ success: true, verified: true });
  } catch (err) {
    console.error('[admin:verify] Error:', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function unverifyProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    const profile = db.prepare(
      `SELECT p.id, p.display_name, p.username, u.email, u.name AS user_name, u.id AS user_id
         FROM profiles p JOIN users u ON u.id = p.user_id
        WHERE p.id = ?`
    ).get(id) as { id: number; display_name: string; username: string; email: string; user_name: string; user_id: number } | undefined;

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    db.prepare(
      `UPDATE profiles
         SET is_verified = 0,
             verified_at = NULL,
             verified_by = NULL
       WHERE id = ?`
    ).run(id);

    // Notify the profile owner
    notifyVerificationStatus({
      userEmail: profile.email,
      userName: profile.user_name,
      userId: profile.user_id,
      profileName: profile.display_name || profile.username,
      status: 'revoked',
      reason,
    });

    return res.json({ success: true, verified: false });
  } catch (err) {
    console.error('[admin:unverify] Error:', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}
