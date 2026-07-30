/**
 * Admin — Profile Moderation
 *
 * POST /api/admin/profiles/:profileId/suspend  — suspend a profile (hides from public)
 * POST /api/admin/profiles/:profileId/unsuspend — lift suspension
 * POST /api/admin/profiles/:profileId/hide     — hide profile without full suspension
 * POST /api/admin/profiles/:profileId/unhide   — restore visibility
 *
 * All actions are audit-logged.
 * All endpoints are admin-only (requireAdminApi applied in entry.ts).
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { notifyProfileStatus } from '../../lib/notifications.js';

function getAdminIdentity(req: Request) {
  const adminReq = req as import('../../middleware/auth.js').AuthRequest;
  return {
    id:    adminReq.user?.id ?? 0,
    name:  adminReq.user?.name ?? 'Unknown Admin',
    email: (adminReq.user as Record<string, unknown>)?.email as string ?? '',
  };
}

export async function suspendProfile(req: Request, res: Response) {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (isNaN(profileId)) return res.status(400).json({ success: false, error: 'Invalid profile ID' });

  const { reason = '' } = req.body as { reason?: string };
  const admin = getAdminIdentity(req);

  const profile = db.prepare('SELECT id, username, biz_slug, profile_type, user_id FROM profiles WHERE id = ?').get(profileId) as
    { id: number; username: string | null; biz_slug: string | null; profile_type: string; user_id: number } | undefined;
  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

  db.prepare(`
    UPDATE profiles
    SET is_suspended = 1, suspended_at = datetime('now'), suspended_by = ?, suspension_reason = ?,
        is_published = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(admin.email || admin.name, reason.trim() || null, profileId);

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'profile_suspended',
    resourceType: 'profile', resourceId: String(profileId),
    resourceLabel: profile.username ?? profile.biz_slug ?? String(profileId),
    details: `Profile ${profileId} (${profile.profile_type}) suspended by ${admin.name} <${admin.email}>. Reason: ${reason || 'none given'}`,
    ipAddress: req.ip, result: 'success',
  });

  // Notify profile owner
  try {
    const owner = db.prepare('SELECT email, name, id FROM users WHERE id = ?').get(profile.user_id) as
      { email: string; name: string; id: number } | undefined;
    if (owner) {
      notifyProfileStatus({
        userEmail: owner.email, userName: owner.name, userId: owner.id,
        profileName: profile.username ?? profile.biz_slug ?? `Profile #${profileId}`,
        status: 'suspended', reason: reason || undefined,
      });
    }
  } catch { /* non-fatal */ }

  return res.json({ success: true, suspended: true });
}

export async function unsuspendProfile(req: Request, res: Response) {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (isNaN(profileId)) return res.status(400).json({ success: false, error: 'Invalid profile ID' });

  const admin = getAdminIdentity(req);

  const profile = db.prepare('SELECT id, username, biz_slug, profile_type, user_id FROM profiles WHERE id = ?').get(profileId) as
    { id: number; username: string | null; biz_slug: string | null; profile_type: string; user_id: number } | undefined;
  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

  db.prepare(`
    UPDATE profiles
    SET is_suspended = 0, suspended_at = NULL, suspended_by = NULL, suspension_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(profileId);

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'profile_unsuspended',
    resourceType: 'profile', resourceId: String(profileId),
    resourceLabel: profile.username ?? profile.biz_slug ?? String(profileId),
    details: `Profile ${profileId} (${profile.profile_type}) suspension lifted by ${admin.name} <${admin.email}>`,
    ipAddress: req.ip, result: 'success',
  });

  // Notify profile owner
  try {
    const owner = db.prepare('SELECT email, name, id FROM users WHERE id = ?').get(profile.user_id) as
      { email: string; name: string; id: number } | undefined;
    if (owner) {
      notifyProfileStatus({
        userEmail: owner.email, userName: owner.name, userId: owner.id,
        profileName: profile.username ?? profile.biz_slug ?? `Profile #${profileId}`,
        status: 'restored',
      });
    }
  } catch { /* non-fatal */ }

  return res.json({ success: true, suspended: false });
}

export async function hideProfile(req: Request, res: Response) {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (isNaN(profileId)) return res.status(400).json({ success: false, error: 'Invalid profile ID' });

  const admin = getAdminIdentity(req);

  const profile = db.prepare('SELECT id, username, biz_slug, profile_type FROM profiles WHERE id = ?').get(profileId) as
    { id: number; username: string | null; biz_slug: string | null; profile_type: string } | undefined;
  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

  db.prepare(`
    UPDATE profiles
    SET is_hidden = 1, hidden_at = datetime('now'), hidden_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(admin.email || admin.name, profileId);

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'profile_hidden',
    resourceType: 'profile', resourceId: String(profileId),
    resourceLabel: profile.username ?? profile.biz_slug ?? String(profileId),
    details: `Profile ${profileId} (${profile.profile_type}) hidden from public by ${admin.name} <${admin.email}>`,
    ipAddress: req.ip, result: 'success',
  });

  return res.json({ success: true, hidden: true });
}

export async function unhideProfile(req: Request, res: Response) {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (isNaN(profileId)) return res.status(400).json({ success: false, error: 'Invalid profile ID' });

  const admin = getAdminIdentity(req);

  const profile = db.prepare('SELECT id, username, biz_slug, profile_type FROM profiles WHERE id = ?').get(profileId) as
    { id: number; username: string | null; biz_slug: string | null; profile_type: string } | undefined;
  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

  db.prepare(`
    UPDATE profiles
    SET is_hidden = 0, hidden_at = NULL, hidden_by = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(profileId);

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'profile_unhidden',
    resourceType: 'profile', resourceId: String(profileId),
    resourceLabel: profile.username ?? profile.biz_slug ?? String(profileId),
    details: `Profile ${profileId} (${profile.profile_type}) restored to public visibility by ${admin.name} <${admin.email}>`,
    ipAddress: req.ip, result: 'success',
  });

  return res.json({ success: true, hidden: false });
}
