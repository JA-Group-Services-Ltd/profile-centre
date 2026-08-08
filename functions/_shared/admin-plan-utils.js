import { HttpError, readJson } from "./http.js";
import { writeAudit } from "./audit.js";

export function positiveInteger(value, label = "ID") {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new HttpError(400, `${label} must be a positive integer.`, "validation_error");
  }
  return parsed;
}

export function cleanText(value, max = 1000) {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max)
    : "";
}

export async function optionalJson(request) {
  if (!request.body || !request.headers.get("content-type")) return {};
  return readJson(request, 32_768);
}

export async function userRecord(database, userId) {
  const user = await database.prepare(`SELECT u.*,p.name AS plan_name,p.slug AS plan_slug
    FROM users u LEFT JOIN plans p ON p.id=u.plan_id WHERE u.id=?1 LIMIT 1`)
    .bind(userId).first();
  if (!user) throw new HttpError(404, "User not found.", "user_not_found");
  return user;
}

export async function planRecord(database, planId) {
  const plan = await database.prepare(`SELECT id,name,slug,is_active,is_public,has_lifetime
    FROM plans WHERE id=?1 LIMIT 1`).bind(planId).first();
  if (!plan) throw new HttpError(404, "Plan not found.", "plan_not_found");
  if (Number(plan.is_active) !== 1) throw new HttpError(409, "This plan is not active.", "plan_inactive");
  return plan;
}

export async function freePlan(database) {
  const plan = await database.prepare("SELECT id,name,slug FROM plans WHERE slug='free' AND is_active=1 LIMIT 1").first();
  if (!plan) throw new HttpError(500, "The Free plan is not configured.", "free_plan_missing");
  return plan;
}

export async function assertNoLifetime(database, userId) {
  const user = await userRecord(database, userId);
  if (Number(user.lifetime_access) === 1) {
    throw new HttpError(409, "Withdraw lifetime access before changing this customer's normal plan.", "lifetime_access_active");
  }
  return user;
}

export async function auditPlan(database, request, admin, action, userId, details = {}) {
  await writeAudit(database, request, admin, action, "user_plan", JSON.stringify({ userId, ...details }));
}
