import { type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { getEffectiveUserAccess } from '../../lib/entitlement.js';

export default async function handler(req: AuthRequest, res: Response) {
  const user = await Promise.resolve(db.prepare(`
    SELECT
      u.id, u.email, u.name, u.role,
      u.plan_id,
      u.lifetime_access,
      u.created_at,
      COALESCE(u.is_paused, 0)   AS is_paused,
      u.pause_reason,
      p.name        AS plan_name,
      p.slug        AS plan_slug,
      p.has_messaging,
      p.max_seats,
      COALESCE(p.max_org_profiles, 0) AS max_org_profiles,
      s.status      AS subscription_status,
      s.billing_interval,
      s.current_period_end
    FROM users u
    LEFT JOIN plans p ON u.plan_id = p.id
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status NOT IN ('incomplete_expired')
    WHERE u.id = ?
    ORDER BY s.started_at DESC
    LIMIT 1
  `).get(req.user!.id)) as {
    id: number; email: string; name: string; role: string; plan_id: number;
    lifetime_access: number; created_at: string;
    is_paused: number; pause_reason: string | null;
    plan_name: string | null; plan_slug: string | null;
    has_messaging: number | null; max_seats: number | null;
    max_org_profiles: number;
    subscription_status: string | null; billing_interval: string | null;
    current_period_end: string | null;
  } | undefined;

  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }

  // Compute live entitlement — this is the single source of truth
  const access = getEffectiveUserAccess(req.user!.id);

  // Email Signature Beta Access — admin-granted only, never from plan
  const betaRow = db.prepare(
    'SELECT enabled FROM email_signature_beta WHERE user_id = ?'
  ).get(req.user!.id) as { enabled: number } | undefined;
  const hasEmailSignatureBeta = !!(betaRow?.enabled);

  res.json({
    success: true,
    data: {
      user: {
        ...user,
        // Expose computed entitlement fields directly on the user object
        // so the frontend can use them without re-deriving plan logic
        hasBusinessAccess: access.hasBusinessAccess,
        hasUltimateBusinessAccess: access.hasUltimateBusinessAccess,
        hasProfessionalAccess: access.hasProfessionalAccess,
        hasBusinessProfileAccess: access.hasBusinessProfileAccess,
        hasStarterAccess: access.hasStarterAccess,
        hasFreeAccess: access.hasFreeAccess,
        hasNoActivePlan: access.hasNoActivePlan,
        hasLifetimeAccess: access.hasLifetimeAccess,
        isDowngraded: access.isDowngraded,
        isSeatUser: access.isSeatUser,
        seatWorkspaces: access.seatWorkspaces,
        trialActive: access.trialActive,
        trialEndsAt: access.trialEndsAt,
        trialExpired: access.trialExpired,
        // Plan selection period (post-trial, 7-day window to pick a plan)
        inPlanSelectionPeriod: access.inPlanSelectionPeriod,
        planSelectionDeadline: access.planSelectionDeadline,
        isNoPlan: access.isNoPlan,
        // Payment grace period
        inPaymentGracePeriod: access.inPaymentGracePeriod,
        paymentGraceUntil: access.paymentGraceUntil,
        paymentOverdue: access.paymentOverdue,
        // Beta features — admin-granted only
        hasEmailSignatureBeta,
        // max_org_profiles — direct from plan DB row; use this for org slot limits, not flag chains
        max_org_profiles: user.max_org_profiles ?? 0,
        // Assisted access session — set when an admin is impersonating this user
        // Only expose the flag and request ID — never expose the admin's internal ID or name
        isAssistedSession: req.user!.isAssistedSession ?? false,
        assistedRequestId: req.user!.assistedRequestId ?? null,
      },
    },
  });
}
