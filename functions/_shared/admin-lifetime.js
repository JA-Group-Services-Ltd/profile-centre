import { consumeAdminPinChallenge } from "./admin-pin-challenge.js";
import { HttpError } from "./http.js";
import { auditPlan, cleanText, freePlan, planRecord, positiveInteger, userRecord } from "./admin-plan-utils.js";

const REASON_CATEGORIES = new Set([
  "founder_goodwill",
  "manual_compensation",
  "service_issue_resolution",
  "internal_test_account",
  "approved_organisation_support",
  "special_business_agreement",
  "migration_old_arrangement",
  "staff_admin_approved_exception",
]);

async function snapshot(database, userId) {
  return database.prepare(`SELECT u.id,u.email,u.name,u.role,u.plan_id,u.lifetime_access,u.lifetime_plan_id,
      u.lifetime_granted_at,u.lifetime_granted_by,u.lifetime_reason_category,
      u.lifetime_internal_note,u.lifetime_review_date,u.lifetime_customer_note,
      u.lifetime_can_be_withdrawn,u.account_status,p.name AS plan_name,p.slug AS plan_slug
    FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id=?1 LIMIT 1`)
    .bind(userId).first();
}

export async function grantLifetime(context, admin, userId, body) {
  await consumeAdminPinChallenge(context.request, context.env.DB, admin, "billing_control");
  const user = await userRecord(context.env.DB, userId);
  if (Number(user.lifetime_access) === 1) {
    throw new HttpError(409, "Lifetime access is already active for this customer.", "lifetime_already_active");
  }

  const planId = positiveInteger(body.plan_id, "plan_id");
  const plan = await planRecord(context.env.DB, planId);
  if (plan.slug === "free") {
    throw new HttpError(400, "Lifetime access must use a non-Free plan.", "lifetime_plan_invalid");
  }

  let reasonCategory = cleanText(body.reason_category, 80);
  if (!REASON_CATEGORIES.has(reasonCategory)) reasonCategory = "staff_admin_approved_exception";
  let internalNote = cleanText(body.internal_note || body.reason, 2000);
  if (internalNote.length < 5) internalNote = "Granted through Admin Centre User & CRM.";
  const customerNote = cleanText(body.customer_note, 500) || null;
  const reviewDate = cleanText(body.review_date, 40) || null;
  const canBeWithdrawn = body.can_be_withdrawn === 0 || body.can_be_withdrawn === false ? 0 : 1;
  const now = new Date().toISOString();

  await context.env.DB.batch([
    context.env.DB.prepare(`UPDATE users SET
      plan_id=?1,lifetime_access=1,lifetime_plan_id=?1,lifetime_granted_at=?2,
      lifetime_granted_by=?3,lifetime_reason_category=?4,lifetime_internal_note=?5,
      lifetime_review_date=?6,lifetime_customer_note=?7,lifetime_can_be_withdrawn=?8,
      account_status='lifetime',plan_selected_at=?2,plan_selection_deadline=NULL,updated_at=?2
      WHERE id=?9`).bind(
      planId, now, admin.name || admin.email || "Admin", reasonCategory, internalNote,
      reviewDate, customerNote, canBeWithdrawn, userId,
    ),
    context.env.DB.prepare(`INSERT INTO lifetime_access_log
      (user_id,action,reason_category,internal_note,customer_note,granted_by,review_date,
       can_be_withdrawn,actor_id,actor_name,created_at)
      VALUES (?1,'granted',?2,?3,?4,?5,?6,?7,?8,?9,?10)`)
      .bind(userId, reasonCategory, internalNote, customerNote, admin.name || "Admin",
        reviewDate, canBeWithdrawn, admin.id, admin.name || "Admin", now),
  ]);

  const existing = await context.env.DB.prepare(`SELECT id FROM subscriptions
    WHERE user_id=?1 AND status='lifetime' ORDER BY started_at DESC,id DESC LIMIT 1`)
    .bind(userId).first();
  if (existing?.id) {
    await context.env.DB.prepare(`UPDATE subscriptions SET plan_id=?1,status='lifetime',billing_interval='lifetime',
      stripe_subscription_id=NULL,stripe_customer_id=NULL,current_period_start=NULL,current_period_end=NULL,
      expires_at=NULL,cancelled_at=NULL,cancel_at_period_end=0 WHERE id=?2`)
      .bind(planId, existing.id).run();
  } else {
    await context.env.DB.prepare(`INSERT INTO subscriptions
      (user_id,plan_id,status,billing_interval,started_at,created_at)
      VALUES (?1,?2,'lifetime','lifetime',?3,?3)`).bind(userId, planId, now).run();
  }

  await auditPlan(context.env.DB, context.request, admin, "lifetime_access_granted", userId, {
    planId,
    planName: plan.name,
    reasonCategory,
    canBeWithdrawn: Boolean(canBeWithdrawn),
  });
  return { success: true, data: await snapshot(context.env.DB, userId) };
}

export async function revokeLifetime(context, admin, userId, body) {
  await consumeAdminPinChallenge(context.request, context.env.DB, admin, "billing_control");
  const user = await userRecord(context.env.DB, userId);
  if (Number(user.lifetime_access) !== 1) {
    throw new HttpError(409, "Lifetime access is not active for this customer.", "lifetime_not_active");
  }
  if (Number(user.lifetime_can_be_withdrawn) === 0) {
    throw new HttpError(409, "This lifetime grant is marked as non-withdrawable.", "lifetime_not_withdrawable");
  }

  const requestedFallback = cleanText(body.fallback_plan_slug, 80) || "free";
  let fallback = await context.env.DB.prepare(`SELECT id,name,slug,is_active FROM plans WHERE slug=?1 LIMIT 1`)
    .bind(requestedFallback).first();
  if (!fallback || Number(fallback.is_active) !== 1) fallback = await freePlan(context.env.DB);

  const reason = cleanText(body.withdrawal_reason || body.reason, 500) || "admin_correction";
  const internalNote = cleanText(body.internal_note, 2000) || null;
  const notifyUser = body.notify_user === 1 || body.notify_user === true ? 1 : 0;
  const now = new Date().toISOString();
  const accountStatus = fallback.slug === "free" ? "free" : "paid_active";

  await context.env.DB.batch([
    context.env.DB.prepare(`UPDATE users SET plan_id=?1,lifetime_access=0,lifetime_plan_id=NULL,
      account_status=?2,plan_selected_at=?3,plan_selection_deadline=NULL,updated_at=?3 WHERE id=?4`)
      .bind(fallback.id, accountStatus, now, userId),
    context.env.DB.prepare(`UPDATE subscriptions SET status='cancelled',cancelled_at=?1
      WHERE user_id=?2 AND status='lifetime'`).bind(now, userId),
    context.env.DB.prepare(`INSERT INTO lifetime_access_log
      (user_id,action,withdrawal_reason,internal_note,fallback_plan_slug,notify_user,
       actor_id,actor_name,created_at)
      VALUES (?1,'withdrawn',?2,?3,?4,?5,?6,?7,?8)`)
      .bind(userId, reason, internalNote, fallback.slug, notifyUser, admin.id, admin.name || "Admin", now),
  ]);

  await auditPlan(context.env.DB, context.request, admin, "lifetime_access_withdrawn", userId, {
    reason,
    fallbackPlan: fallback.slug,
    notifyUser: Boolean(notifyUser),
  });
  return { success: true, data: await snapshot(context.env.DB, userId) };
}

export async function getLifetimeLog(database, userId) {
  await userRecord(database, userId);
  const rows = await database.prepare(`SELECT * FROM lifetime_access_log
    WHERE user_id=?1 ORDER BY created_at DESC,id DESC`).bind(userId).all();
  return { success: true, data: rows.results || [] };
}
