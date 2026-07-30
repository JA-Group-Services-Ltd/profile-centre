/**
 * Business Seats API
 *
 * Rules:
 * - No emails are ever sent. Invites are silent.
 * - Seat counter counts only ACTIVE seats (not pending invites).
 * - Pending invites reserve a slot against the plan limit to prevent over-inviting.
 * - Existing users are added as "pending" — they must explicitly accept.
 * - New users: invite stays pending; auto-accepted on first login via oidc.ts.
 * - Members can leave a seat themselves (DELETE /api/business/seats/me/leave).
 */
import { type Response } from 'express';
import { randomBytes } from 'node:crypto';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { isValidEmail } from '../../../lib/validate-email.js';


// ─── helpers ──────────────────────────────────────────────────────────────

function ownsBusinessProfile(userId: number, profileId: string): boolean {
  const p = db.prepare(
    "SELECT id FROM profiles WHERE id = ? AND user_id = ? AND profile_type = 'business'"
  ).get(profileId, userId);
  return !!p;
}

/** Get the seat limit for a business profile from the owner's plan. */
function getPlanSeatLimit(profileId: string): number {
  const row = db.prepare(`
    SELECT pl.max_seats
    FROM profiles pr
    JOIN users u ON u.id = pr.user_id
    JOIN plans pl ON pl.id = u.plan_id
    WHERE pr.id = ?
  `).get(profileId) as { max_seats: number } | undefined;
  // Return the plan's actual seat limit; fall back to 1 only if no plan found
  return row?.max_seats ?? 1;
}

// ─── GET /api/business/:profileId/seats ───────────────────────────────────

export async function getSeats(req: AuthRequest, res: Response) {
  const profileId = String(req.params.profileId);
  if (!ownsBusinessProfile(req.user!.id, profileId)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const seats = db.prepare(`
    SELECT bs.id, bs.email, bs.name, bs.role, bs.status, bs.created_at,
           u.name AS user_name,
           CASE WHEN u.entra_oid IS NOT NULL AND u.entra_oid != '' THEN 1 ELSE 0 END AS entra_linked
    FROM business_seats bs
    LEFT JOIN users u ON u.id = bs.user_id
    WHERE bs.profile_id = ?
    ORDER BY bs.created_at ASC
  `).all(profileId);

  const invites = db.prepare(`
    SELECT id, email, name, role, status, created_at, expires_at
    FROM business_seat_invites
    WHERE profile_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).all(profileId);

  const maxSeats = getPlanSeatLimit(profileId);

  // Active seats only for the "used" count
  const activeSeats = (seats as Array<{ status: string }>).filter(s => s.status === 'active');

  return res.json({
    success: true,
    data: { seats, invites, max_seats: maxSeats, active_count: activeSeats.length },
  });
}

// ─── POST /api/business/:profileId/seats/invite ───────────────────────────

export async function inviteSeat(req: AuthRequest, res: Response) {
  const profileId = String(req.params.profileId);
  const { email, name, role = 'viewer' } = req.body as { email: string; name?: string; role?: string };

  if (!ownsBusinessProfile(req.user!.id, profileId)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Valid email is required' });
  }
  const validRoles = ['admin', 'manager', 'editor', 'viewer', 'billing_manager'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  // ── Plan gate: seats feature must be enabled ───────────────────────────────
  const planRow = db.prepare(`
    SELECT pl.has_seats, pl.max_seats
    FROM profiles pr
    JOIN users u ON u.id = pr.user_id
    LEFT JOIN plans pl ON pl.id = u.plan_id
    WHERE pr.id = ?
  `).get(profileId) as { has_seats: number | null; max_seats: number | null } | undefined;

  if (!planRow?.has_seats) {
    return res.status(403).json({
      success: false,
      error: 'Team seats are not included in your current plan. Upgrade to Organisation or above to invite team members.',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }

  // Seat limit from the owner's plan — active seats + pending invites count together
  const maxSeats = planRow.max_seats ?? 0;
  const activeCountRow = db.prepare("SELECT COUNT(*) as c FROM business_seats WHERE profile_id = ? AND status = 'active'").get(profileId) as { c: number } | undefined;
  const activeCount = activeCountRow?.c ?? 0;
  const pendingCountRow = db.prepare("SELECT COUNT(*) as c FROM business_seat_invites WHERE profile_id = ? AND status = 'pending'").get(profileId) as { c: number } | undefined;
  const pendingCount = pendingCountRow?.c ?? 0;

  if (activeCount + pendingCount >= maxSeats) {
    return res.status(403).json({ success: false, error: `Seat limit reached (${maxSeats} seats). Upgrade your plan to add more.` });
  }

  // Check if already an active seat member
  const existingSeat = db.prepare("SELECT id FROM business_seats WHERE profile_id = ? AND email = ? AND status = 'active'").get(profileId, email.toLowerCase());
  if (existingSeat) return res.status(409).json({ success: false, error: 'This person is already an active seat member' });

  // Check if already has a pending invite
  const existingInvite = db.prepare("SELECT id FROM business_seat_invites WHERE profile_id = ? AND email = ? AND status = 'pending'").get(profileId, email.toLowerCase());
  if (existingInvite) return res.status(409).json({ success: false, error: 'A pending invite already exists for this email' });

  // Always create a pending invite — existing users must accept explicitly too
  const token = randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO business_seat_invites (profile_id, invited_by, email, name, role, token) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(profileId, req.user!.id, email.toLowerCase(), name || '', role, token);

  return res.status(201).json({ success: true, message: 'Invite created', type: 'invite', token });
}

// ─── GET /api/business/seats/me ───────────────────────────────────────────
// Returns all active business seats for the currently logged-in user

export async function getMySeats(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const seats = db.prepare(`
    SELECT bs.id, bs.profile_id, bs.email, bs.name, bs.role, bs.status, bs.created_at,
           p.business_name, p.biz_slug
    FROM business_seats bs
    JOIN profiles p ON p.id = bs.profile_id
    WHERE bs.user_id = ? AND bs.status = 'active'
    ORDER BY bs.created_at DESC
  `).all(userId);
  return res.json({ success: true, data: seats });
}

// ─── GET /api/business/invites/me ─────────────────────────────────────────
// Returns all pending invites for the currently logged-in user's email

export async function getMyInvites(req: AuthRequest, res: Response) {
  const email = req.user!.email.toLowerCase();
  const invites = db.prepare(`
    SELECT bsi.id, bsi.token, bsi.role, bsi.created_at, bsi.expires_at,
           p.business_name, p.biz_slug, p.id AS profile_id,
           u.name AS invited_by_name
    FROM business_seat_invites bsi
    JOIN profiles p ON p.id = bsi.profile_id
    JOIN users u ON u.id = bsi.invited_by
    WHERE bsi.email = ? AND bsi.status = 'pending'
    ORDER BY bsi.created_at DESC
  `).all(email) as Array<{
    id: number; token: string; role: string; created_at: string; expires_at: string;
    business_name: string; biz_slug: string; profile_id: number; invited_by_name: string;
  }>;

  return res.json({ success: true, data: invites });
}

// ─── GET /api/business/invites/:token ─────────────────────────────────────
// Public endpoint — returns invite details for the accept page (no auth required).
// Does NOT expose sensitive data; just enough to render the invite card.

export async function getInviteByToken(req: AuthRequest, res: Response) {
  const { token } = req.params;

  const invite = db.prepare(`
    SELECT bsi.id, bsi.token, bsi.email, bsi.role, bsi.status, bsi.created_at, bsi.expires_at,
           p.id AS profile_id, p.business_name, p.biz_slug,
           u.name AS invited_by_name
    FROM business_seat_invites bsi
    JOIN profiles p ON p.id = bsi.profile_id
    JOIN users u ON u.id = bsi.invited_by
    WHERE bsi.token = ?
  `).get(token) as {
    id: number; token: string; email: string; role: string; status: string;
    created_at: string; expires_at: string;
    profile_id: number; business_name: string; biz_slug: string;
    invited_by_name: string;
  } | undefined;

  if (!invite) {
    return res.status(404).json({ success: false, error: 'Invite not found' });
  }

  // Check expiry
  const expired = invite.expires_at && new Date(invite.expires_at) < new Date();

  return res.json({
    success: true,
    data: {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expired: !!expired,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
      profile_id: invite.profile_id,
      business_name: invite.business_name,
      biz_slug: invite.biz_slug,
      invited_by_name: invite.invited_by_name,
    },
  });
}

// ─── POST /api/business/invites/:token/accept ─────────────────────────────

export async function acceptInvite(req: AuthRequest, res: Response) {
  const { token } = req.params;
  const email = req.user!.email.toLowerCase();

  const invite = db.prepare(
    "SELECT * FROM business_seat_invites WHERE token = ? AND email = ? AND status = 'pending'"
  ).get(token, email) as {
    id: number; profile_id: number; role: string; name: string;
  } | undefined;

  if (!invite) {
    return res.status(404).json({ success: false, error: 'Invite not found, already used, or does not belong to your account' });
  }

  // Check seat limit hasn't been exceeded since invite was created
  const maxSeats = getPlanSeatLimit(String(invite.profile_id));
  const activeCountRow = db.prepare("SELECT COUNT(*) as c FROM business_seats WHERE profile_id = ? AND status = 'active'").get(invite.profile_id) as { c: number } | undefined;
  if ((activeCountRow?.c ?? 0) >= maxSeats) {
    return res.status(403).json({ success: false, error: 'This business has reached its seat limit. Contact the business owner.' });
  }

  db.prepare(
    'INSERT INTO business_seats (profile_id, user_id, email, name, role, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(invite.profile_id, req.user!.id, email, invite.name || req.user!.name, invite.role, 'active');

  db.prepare(
    "UPDATE business_seat_invites SET status = 'accepted' WHERE id = ?"
  ).run(invite.id);

  return res.json({ success: true, message: 'Invite accepted' });
}

// ─── POST /api/business/invites/:token/decline ────────────────────────────

export async function declineInvite(req: AuthRequest, res: Response) {
  const { token } = req.params;
  const email = req.user!.email.toLowerCase();

  const invite = db.prepare(
    "SELECT id FROM business_seat_invites WHERE token = ? AND email = ? AND status = 'pending'"
  ).get(token, email);

  if (!invite) {
    return res.status(404).json({ success: false, error: 'Invite not found or already actioned' });
  }

  db.prepare(
    "UPDATE business_seat_invites SET status = 'declined' WHERE token = ? AND email = ?"
  ).run(token, email);

  return res.json({ success: true, message: 'Invite declined' });
}

// ─── DELETE /api/business/seats/me/leave ──────────────────────────────────
// Allows a seat member to leave a business profile voluntarily

export async function leaveSeat(req: AuthRequest, res: Response) {
  const { profileId } = req.body as { profileId: number };
  if (!profileId) return res.status(400).json({ success: false, error: 'profileId is required' });

  const seat = db.prepare(
    "SELECT id FROM business_seats WHERE profile_id = ? AND user_id = ? AND status = 'active'"
  ).get(profileId, req.user!.id);

  if (!seat) return res.status(404).json({ success: false, error: 'You are not a member of this business profile' });

  db.prepare('DELETE FROM business_seats WHERE profile_id = ? AND user_id = ?').run(profileId, req.user!.id);

  return res.json({ success: true, message: 'You have left this business profile' });
}

// ─── DELETE /api/business/:profileId/seats/:seatId ────────────────────────

export async function removeSeat(req: AuthRequest, res: Response) {
  const profileId = String(req.params.profileId);
  const seatId = String(req.params.seatId);
  if (!ownsBusinessProfile(req.user!.id, profileId)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  db.prepare('DELETE FROM business_seats WHERE id = ? AND profile_id = ?').run(seatId, profileId);
  return res.json({ success: true });
}

// ─── DELETE /api/business/:profileId/invites/:inviteId ───────────────────

export async function cancelInvite(req: AuthRequest, res: Response) {
  const profileId = String(req.params.profileId);
  const inviteId = String(req.params.inviteId);
  if (!ownsBusinessProfile(req.user!.id, profileId)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  db.prepare("UPDATE business_seat_invites SET status = 'cancelled' WHERE id = ? AND profile_id = ?").run(inviteId, profileId);
  return res.json({ success: true });
}

// ─── PATCH /api/business/:profileId/seats/:seatId ────────────────────────

const VALID_ROLES = ['owner', 'admin', 'manager', 'editor', 'viewer', 'billing_manager'];

export async function updateSeatRole(req: AuthRequest, res: Response) {
  const profileId = String(req.params.profileId);
  const seatId = String(req.params.seatId);
  const { role } = req.body as { role: string };
  if (!ownsBusinessProfile(req.user!.id, profileId)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  // Prevent demoting the owner's own seat record
  const seat = db.prepare('SELECT user_id FROM business_seats WHERE id = ? AND profile_id = ?').get(seatId, profileId) as { user_id: number } | undefined;
  if (seat?.user_id === req.user!.id && role !== 'owner') {
    return res.status(400).json({ success: false, error: 'You cannot change your own owner role' });
  }
  db.prepare('UPDATE business_seats SET role = ? WHERE id = ? AND profile_id = ?').run(role, seatId, profileId);
  return res.json({ success: true });
}
