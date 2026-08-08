import { consumeAdminPinChallenge } from "./admin-pin-challenge.js";
import { HttpError } from "./http.js";
import { assertNoLifetime, auditPlan, cleanText, freePlan, planRecord, positiveInteger, userRecord } from "./admin-plan-utils.js";

const ACCOUNT_STATUSES = new Set([
  "active",
  "trial_active",
  "trial_ended",
  "plan_selection",
  "no_plan",
  "free",
  "paid_active",
  "lifetime",
  "suspended",
]);

export async function assignPlan(context, admin, userId, body) {
  await consumeAdminPinChallenge(context.request, context.env.DB, admin, "assign_plan");
  const user = await assertNoLifetime(context.env.DB, userId);
  const plan = await planRecord(context.env.DB, positiveInteger(body.plan_id, "plan_id"));
  const status = plan.slug === "free" ? "free" : "paid_active";
  const now = new Date().toISOString();
  await context.env.DB.prepare(`UPDATE users SET plan_id=?1,account_status=?2,
    plan_selected_at=?3,plan_selection_deadline=NULL,updated_at=?3 WHERE id=?4`)
    .bind(plan.id, status, now, userId).run();
  await auditPlan(context.env.DB, context.request, admin, "admin_assigned_plan", userId, {
    previousPlan: user.plan_name || null,
    planId: plan.id,
    planName: plan.name,
    reason: cleanText(body.reason, 1000) || null,
    centralPaymentsUnaffected: true,
  });
  return { success: true, planId: plan.id, planName: plan.name, accountStatus: status };
}

export async function moveToFree(context, admin, userId, body) {
  const user = await assertNoLifetime(context.env.DB, userId);
  const plan = await freePlan(context.env.DB);
  const now = new Date().toISOString();
  await context.env.DB.prepare(`UPDATE users SET plan_id=?1,account_status='free',
    plan_selection_deadline=NULL,plan_selected_at=?2,updated_at=?2 WHERE id=?3`)
    .bind(plan.id, now, userId).run();
  await auditPlan(context.env.DB, context.request, admin, "admin_moved_to_free", userId, {
    previousPlan: user.plan_name || null,
    reason: cleanText(body.reason, 1000) || null,
    centralPaymentsUnaffected: true,
  });
  return { success: true, planId: plan.id, planName: plan.name };
}

export async function moveToNoPlan(context, admin, userId, body, action = "admin_moved_to_no_plan") {
  const user = await assertNoLifetime(context.env.DB, userId);
  const now = new Date().toISOString();
  await context.env.DB.prepare(`UPDATE users SET plan_id=NULL,account_status='no_plan',
    plan_selection_deadline=NULL,updated_at=?1 WHERE id=?2`).bind(now, userId).run();
  await auditPlan(context.env.DB, context.request, admin, action, userId, {
    previousPlan: user.plan_name || null,
    reason: cleanText(body.reason, 1000) || null,
    centralPaymentsUnaffected: true,
  });
  return { success: true };
}

export async function extendTrial(context, admin, userId, body) {
  const user = await assertNoLifetime(context.env.DB, userId);
  if (!user.trial_started_at) throw new HttpError(400, "This customer has not started a trial.", "trial_not_started");
  const days = Math.min(365, Math.max(1, Number.parseInt(String(body.days ?? 7), 10) || 7));
  const originalEnd = new Date(Date.parse(user.trial_started_at) + 30 * 86400000);
  const extendFrom = Date.now() > originalEnd.getTime() ? new Date() : originalEnd;
  const newEnd = new Date(extendFrom.getTime() + days * 86400000);
  const newStartedAt = new Date(newEnd.getTime() - 30 * 86400000).toISOString();
  await context.env.DB.prepare(`UPDATE users SET trial_started_at=?1,plan_selection_deadline=NULL,
    account_status='trial_active',updated_at=CURRENT_TIMESTAMP WHERE id=?2`)
    .bind(newStartedAt, userId).run();
  await auditPlan(context.env.DB, context.request, admin, "admin_trial_extended", userId, {
    days,
    newTrialEnd: newEnd.toISOString(),
    reason: cleanText(body.reason, 1000) || null,
  });
  return { success: true, newTrialEnd: newEnd.toISOString() };
}

export async function endTrial(context, admin, userId, body) {
  const user = await assertNoLifetime(context.env.DB, userId);
  if (!user.trial_started_at) throw new HttpError(400, "This customer has not started a trial.", "trial_not_started");
  const expiredStart = new Date(Date.now() - 31 * 86400000).toISOString();
  const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
  await context.env.DB.prepare(`UPDATE users SET trial_started_at=?1,plan_selection_deadline=?2,
    account_status='plan_selection',updated_at=CURRENT_TIMESTAMP WHERE id=?3`)
    .bind(expiredStart, deadline, userId).run();
  await auditPlan(context.env.DB, context.request, admin, "admin_trial_ended", userId, {
    planSelectionDeadline: deadline,
    reason: cleanText(body.reason, 1000) || null,
  });
  return { success: true, planSelectionDeadline: deadline };
}

export async function setAccountStatus(context, admin, userId, body) {
  const status = cleanText(body.status, 40);
  if (!ACCOUNT_STATUSES.has(status)) {
    throw new HttpError(400, `Invalid account status: ${status || "empty"}.`, "account_status_invalid");
  }
  const user = await userRecord(context.env.DB, userId);
  if (status === "lifetime" && Number(user.lifetime_access) !== 1) {
    throw new HttpError(409, "Grant lifetime access before setting lifetime status.", "lifetime_access_required");
  }
  await context.env.DB.prepare("UPDATE users SET account_status=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2")
    .bind(status, userId).run();
  await auditPlan(context.env.DB, context.request, admin, "admin_set_account_status", userId, {
    previousStatus: user.account_status || null,
    status,
    reason: cleanText(body.reason, 1000) || null,
  });
  return { success: true, status };
}

export async function listSubscriptions(database) {
  const result = await database.prepare(`SELECT s.*,u.email,u.name,u.lifetime_access,
      p.name AS plan_name,p.slug AS plan_slug,p.price_monthly
    FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id
    ORDER BY s.started_at DESC,s.id DESC`).all();
  return { success: true, data: result.results || [] };
}

export async function togglePlanPublic(context, admin, planId, body) {
  const plan = await context.env.DB.prepare("SELECT id,name,is_public FROM plans WHERE id=?1 LIMIT 1")
    .bind(planId).first();
  if (!plan) throw new HttpError(404, "Plan not found.", "plan_not_found");
  const next = body.is_public === undefined ? (Number(plan.is_public) === 1 ? 0 : 1) : (body.is_public ? 1 : 0);
  const updated = await context.env.DB.prepare("UPDATE plans SET is_public=?1 WHERE id=?2 RETURNING *")
    .bind(next, planId).first();
  await auditPlan(context.env.DB, context.request, admin, "plan_visibility_updated", planId, {
    planName: plan.name,
    isPublic: Boolean(next),
  });
  return { success: true, data: updated };
}
