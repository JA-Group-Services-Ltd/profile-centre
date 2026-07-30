/**
 * POST /api/trial/claim
 * Claims the 1-month free trial for the authenticated user.
 * - Returns 409 if already claimed (trial_started_at already set)
 * - Returns 409 if user already has a paid plan or lifetime access
 * - Sets trial_started_at to NOW (once only, never overwritten)
 */
import { type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

export default async function handler(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  // req.body may be undefined if the client sent no Content-Type header
  const { planSlug } = (req.body ?? {}) as { planSlug?: string };

  const user = db.prepare(`
    SELECT id, trial_started_at, lifetime_access, plan_id
    FROM users WHERE id = ?
  `).get(userId) as {
    id: number;
    trial_started_at: string | null;
    lifetime_access: number;
    plan_id: number | null;
  } | undefined;

  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }

  // Already claimed
  if (user.trial_started_at) {
    return res.status(409).json({
      success: false,
      error: 'already_claimed',
      message: 'You have already used your free trial.',
      trialStartedAt: user.trial_started_at,
    });
  }

  // Has lifetime access — no need for trial
  if (user.lifetime_access) {
    return res.status(409).json({
      success: false,
      error: 'has_lifetime',
      message: 'Your account already has lifetime access.',
    });
  }

  // Check for active paid subscription
  const activeSub = db.prepare(`
    SELECT id FROM subscriptions
    WHERE user_id = ? AND status NOT IN ('cancelled', 'incomplete_expired', 'incomplete')
    LIMIT 1
  `).get(userId);

  if (activeSub) {
    return res.status(409).json({
      success: false,
      error: 'has_active_plan',
      message: 'You already have an active paid plan.',
    });
  }

  // Claim the trial — optionally assign the chosen plan
  const now = new Date().toISOString();
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Look up the requested plan (must be a paid plan — not free, not lifetime)
  let assignedPlanId: number | null = null;
  if (planSlug && planSlug !== 'free') {
    const plan = db.prepare(
      `SELECT id FROM plans WHERE slug = ? AND price_monthly > 0 AND (has_lifetime IS NULL OR has_lifetime = 0) LIMIT 1`
    ).get(planSlug) as { id: number } | undefined;
    if (plan) assignedPlanId = plan.id;
  }

  if (assignedPlanId) {
    db.prepare(`UPDATE users SET trial_started_at = ?, plan_id = ?, account_status = 'trial_active' WHERE id = ?`)
      .run(now, assignedPlanId, userId);
  } else {
    db.prepare(`UPDATE users SET trial_started_at = ? WHERE id = ?`).run(now, userId);
  }

  writeAudit({ actorId: userId, action: 'trial_claimed', details: JSON.stringify({ trialStartedAt: now, trialEndsAt, planSlug: planSlug ?? null }) });

  return res.json({
    success: true,
    trialStartedAt: now,
    trialEndsAt,
    planId: assignedPlanId,
  });
}
