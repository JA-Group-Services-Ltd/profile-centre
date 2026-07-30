/**
 * Admin Trial Management API
 *
 * POST /api/admin/users/:userId/trial/extend      — extend trial by N days
 * POST /api/admin/users/:userId/trial/end         — end trial immediately
 * POST /api/admin/users/:userId/move-to-no-plan   — move user to No Plan
 * POST /api/admin/users/:userId/move-to-free      — assign Free plan
 * POST /api/admin/users/:userId/assign-plan       — assign any plan by ID
 * POST /api/admin/users/:userId/remove-plan       — remove plan (set to No Plan)
 * PATCH /api/admin/users/:userId/account-status   — set account_status directly
 */
import type { Request, Response } from 'express';
import db from '../../db.js';

type AdminReq = Request & { admin?: { id: number; name: string } };

function getUser(userId: number) {
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.trial_started_at, u.plan_id, u.lifetime_access,
           u.plan_selection_deadline, u.account_status,
           p.slug AS plan_slug, p.name AS plan_name
    FROM users u
    LEFT JOIN plans p ON p.id = u.plan_id
    WHERE u.id = ?
  `).get(userId) as {
    id: number; name: string; email: string;
    trial_started_at: string | null; plan_id: number | null;
    lifetime_access: number; plan_selection_deadline: string | null;
    account_status: string | null;
    plan_slug: string | null; plan_name: string | null;
  } | undefined;
}

function audit(adminReq: AdminReq, userId: number, action: string, details: object) {
  try {
    db.prepare(`
      INSERT INTO audit_log (actor_type, actor_id, actor_name, action, resource_type, details, result, user_id)
      VALUES ('admin', ?, ?, ?, 'trial', ?, 'success', ?)
    `).run(adminReq.admin?.id ?? null, adminReq.admin?.name ?? 'admin', action, JSON.stringify(details), userId);
  } catch { /* non-fatal */ }
}

// ── Extend trial ──────────────────────────────────────────────────────────
export async function extendTrial(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { days = 7, reason } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (!user.trial_started_at) return res.status(400).json({ success: false, error: 'User has not started a trial' });

  const TRIAL_DAYS = 30;
  const originalEnd = new Date(new Date(user.trial_started_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  // Extend from the later of: now or original end
  const extendFrom = new Date() > originalEnd ? new Date() : originalEnd;
  const newEnd = new Date(extendFrom.getTime() + Number(days) * 24 * 60 * 60 * 1000);

  // We extend by adjusting trial_started_at so that (started_at + 30 days) = newEnd
  const newStartedAt = new Date(newEnd.getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const newDeadline = new Date(newEnd.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE users SET trial_started_at = ?, plan_selection_deadline = NULL, account_status = 'trial_active'
    WHERE id = ?
  `).run(newStartedAt, userId);

  audit(req, userId, 'admin_trial_extended', {
    days, reason: reason ?? null,
    newTrialEnd: newEnd.toISOString(),
    previousEnd: originalEnd.toISOString(),
  });

  res.json({ success: true, newTrialEnd: newEnd.toISOString(), newDeadline });
}

// ── End trial immediately ─────────────────────────────────────────────────
export async function endTrial(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { reason } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (!user.trial_started_at) return res.status(400).json({ success: false, error: 'User has not started a trial' });

  // Set trial_started_at to 31 days ago so it's expired
  const expiredStart = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE users SET trial_started_at = ?, plan_selection_deadline = ?, account_status = 'plan_selection'
    WHERE id = ?
  `).run(expiredStart, deadline, userId);

  audit(req, userId, 'admin_trial_ended', { reason: reason ?? null, planSelectionDeadline: deadline });
  res.json({ success: true, planSelectionDeadline: deadline });
}

// ── Move to No Plan ───────────────────────────────────────────────────────
export async function moveToNoPlan(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { reason } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const prevStatus = user.account_status;
  const prevPlan = user.plan_name;

  db.prepare(`
    UPDATE users SET plan_id = NULL, account_status = 'no_plan', plan_selection_deadline = NULL
    WHERE id = ?
  `).run(userId);

  // Cancel any active subscriptions
  db.prepare(`
    UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status NOT IN ('cancelled','incomplete_expired')
  `).run(userId);

  audit(req, userId, 'admin_moved_to_no_plan', { reason: reason ?? null, previousStatus: prevStatus, previousPlan: prevPlan });
  res.json({ success: true });
}

// ── Move to Free ──────────────────────────────────────────────────────────
export async function moveToFree(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { reason } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const freePlan = db.prepare(`SELECT id, name FROM plans WHERE slug = 'free' LIMIT 1`).get() as { id: number; name: string } | undefined;
  if (!freePlan) return res.status(500).json({ success: false, error: 'Free plan not found in database' });

  const prevStatus = user.account_status;
  const prevPlan = user.plan_name;

  db.prepare(`
    UPDATE users SET plan_id = ?, account_status = 'free', plan_selection_deadline = NULL, plan_selected_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(freePlan.id, userId);

  // Cancel any active subscriptions
  db.prepare(`
    UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status NOT IN ('cancelled','incomplete_expired')
  `).run(userId);

  audit(req, userId, 'admin_moved_to_free', { reason: reason ?? null, previousStatus: prevStatus, previousPlan: prevPlan, freePlanId: freePlan.id });
  res.json({ success: true, planId: freePlan.id, planName: freePlan.name });
}

// ── Assign any plan ───────────────────────────────────────────────────────
export async function assignPlan(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { plan_id, reason } = req.body;
  if (!plan_id) return res.status(400).json({ success: false, error: 'plan_id is required' });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const plan = db.prepare(`SELECT id, name, slug FROM plans WHERE id = ?`).get(plan_id) as { id: number; name: string; slug: string } | undefined;
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

  const prevPlan = user.plan_name;
  const newStatus = plan.slug === 'free' ? 'free' : 'paid_active';

  db.prepare(`
    UPDATE users SET plan_id = ?, account_status = ?, plan_selected_at = CURRENT_TIMESTAMP, plan_selection_deadline = NULL
    WHERE id = ?
  `).run(plan_id, newStatus, userId);

  audit(req, userId, 'admin_assigned_plan', { planId: plan_id, planName: plan.name, reason: reason ?? null, previousPlan: prevPlan });
  res.json({ success: true, planId: plan_id, planName: plan.name });
}

// ── Remove plan ───────────────────────────────────────────────────────────
export async function removePlan(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { reason } = req.body;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const prevPlan = user.plan_name;
  db.prepare(`UPDATE users SET plan_id = NULL, account_status = 'no_plan' WHERE id = ?`).run(userId);
  db.prepare(`UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status NOT IN ('cancelled','incomplete_expired')`).run(userId);

  audit(req, userId, 'admin_removed_plan', { reason: reason ?? null, previousPlan: prevPlan });
  res.json({ success: true });
}

// ── Set account status directly ───────────────────────────────────────────
export async function setAccountStatus(req: AdminReq, res: Response) {
  const userId = Number(req.params.userId);
  const { status, reason } = req.body;
  const validStatuses = ['active', 'trial_active', 'trial_ended', 'plan_selection', 'no_plan', 'free', 'paid_active', 'lifetime', 'suspended'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }
  const user = getUser(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const prevStatus = user.account_status;
  db.prepare(`UPDATE users SET account_status = ? WHERE id = ?`).run(status, userId);

  audit(req, userId, 'admin_set_account_status', { status, reason: reason ?? null, previousStatus: prevStatus });
  res.json({ success: true });
}
