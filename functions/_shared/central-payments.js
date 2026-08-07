import { HttpError } from "./http.js";
import { requestHeadOffice } from "./head-office.js";

const BRAND = "SOUSA_MURRAY_PROFILES";

const PROFILE_PLAN_MAP = Object.freeze({
  starter: Object.freeze({ productCode: "PROFILES_STARTER", priceCode: "PROFILES_STARTER_MONTHLY" }),
  professional: Object.freeze({ productCode: "PROFILES_PROFESSIONAL", priceCode: "PROFILES_PROFESSIONAL_MONTHLY" }),
  organisation: Object.freeze({ productCode: "PROFILES_ORGANISATION", priceCode: "PROFILES_ORGANISATION_MONTHLY" }),
  organization: Object.freeze({ productCode: "PROFILES_ORGANISATION", priceCode: "PROFILES_ORGANISATION_MONTHLY" }),
  business: Object.freeze({ productCode: "PROFILES_ORGANISATION", priceCode: "PROFILES_ORGANISATION_MONTHLY" }),
  ultimate_organisation: Object.freeze({ productCode: "PROFILES_ULTIMATE_ORGANISATION", priceCode: "PROFILES_ULTIMATE_ORGANISATION_MONTHLY" }),
  ultimate_organization: Object.freeze({ productCode: "PROFILES_ULTIMATE_ORGANISATION", priceCode: "PROFILES_ULTIMATE_ORGANISATION_MONTHLY" }),
});

const PRICE_TO_PLAN_SLUGS = Object.freeze({
  PROFILES_STARTER_MONTHLY: ["starter"],
  PROFILES_PROFESSIONAL_MONTHLY: ["professional"],
  PROFILES_ORGANISATION_MONTHLY: ["organisation", "organization", "business"],
  PROFILES_ULTIMATE_ORGANISATION_MONTHLY: ["ultimate_organisation", "ultimate_organization"],
});

function ucn(user) {
  const value = String(user?.customer_number || "").replace(/\s/g, "");
  if (!/^\d{10}$/.test(value)) throw new HttpError(409, "Head Office UCN linkage is required.", "ucn_required");
  return value;
}

async function userRecord(env, userId) {
  const user = await env.DB.prepare(`SELECT id,email,name,customer_number,stripe_customer_id,plan_id
    FROM users WHERE id=?1 LIMIT 1`).bind(userId).first();
  if (!user) throw new HttpError(404, "User not found.", "user_not_found");
  ucn(user);
  return user;
}

async function headOfficeJson(env, path, method = "GET", body) {
  return requestHeadOffice(env, path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function initialiseCentralPaymentCustomer(env, userId) {
  const user = await userRecord(env, userId);
  const status = await headOfficeJson(env, `/api/v1/payments/status?customerNumber=${encodeURIComponent(ucn(user))}`).catch(error => {
    if (error?.headOfficeStatus === 404) return { subscriptions: [], transactions: [], checkoutRequests: [] };
    throw error;
  });
  const customerId = status?.subscriptions?.[0]?.stripe_customer_id || status?.checkoutRequests?.[0]?.stripe_customer_id || null;
  if (customerId && customerId !== user.stripe_customer_id) {
    await env.DB.prepare("UPDATE users SET stripe_customer_id=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2")
      .bind(customerId, user.id).run();
  }
  return { success: true, linked: Boolean(customerId), central: true };
}

export async function createCentralCheckout(env, userId, input, origin) {
  const user = await userRecord(env, userId);
  const interval = ["monthly", "yearly", "lifetime"].includes(input?.interval) ? input.interval : "monthly";
  if (interval !== "monthly") {
    throw new HttpError(400, "This billing interval has not yet been approved in the Central Payments catalogue.", "central_price_not_configured");
  }
  const planId = Number(input?.plan_id);
  const plan = await env.DB.prepare("SELECT id,name,slug FROM plans WHERE id=?1 AND is_active=1 LIMIT 1").bind(planId).first();
  if (!plan) throw new HttpError(404, "Plan not found.", "plan_not_found");
  const mapping = PROFILE_PLAN_MAP[String(plan.slug || "").trim().toLowerCase()];
  if (!mapping) throw new HttpError(400, "This plan is not configured in Central Payments.", "central_plan_not_configured");

  const payload = await headOfficeJson(env, "/api/v1/payments/checkout", "POST", {
    brand: BRAND,
    customerNumber: ucn(user),
    productCode: mapping.productCode,
    priceCode: mapping.priceCode,
    orderReference: `PROFILES-${user.id}-${plan.id}-${crypto.randomUUID()}`,
    serviceReference: `plan:${plan.slug}:monthly`,
    successUrl: `${origin}/dashboard/billing?checkout=success&central_payment=1`,
    cancelUrl: `${origin}/dashboard/billing?checkout=cancelled`,
  });
  if (!payload?.checkout?.url) throw new HttpError(502, "Head Office did not return a Central Payments checkout URL.", "central_checkout_url_missing");
  return { success: true, url: payload.checkout.url, central: true, reference: payload.checkout.reference };
}

export async function createCentralBillingPortal(env, userId, origin) {
  const user = await userRecord(env, userId);
  const payload = await headOfficeJson(env, "/api/v1/payments/portal", "POST", {
    brand: BRAND,
    customerNumber: ucn(user),
    returnUrl: `${origin}/dashboard/billing`,
  });
  if (!payload?.portal?.url) throw new HttpError(502, "Head Office did not return the Central Payments billing portal URL.", "central_portal_url_missing");
  return { success: true, url: payload.portal.url, central: true };
}

export async function cancelCentralSubscription(env, userId) {
  const user = await userRecord(env, userId);
  const payload = await headOfficeJson(env, "/api/v1/payments/subscription", "POST", {
    action: "cancel_at_period_end",
    customerNumber: ucn(user),
  });
  await syncCentralSubscription(env, userId).catch(() => null);
  return { success: true, cancel_at_period_end: true, central: true, subscription: payload?.subscription || null };
}

function rank(status) {
  const order = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused", "canceled", "cancelled"];
  const index = order.indexOf(String(status || "").toLowerCase());
  return index === -1 ? 999 : index;
}

async function planIdForPrice(env, priceCode) {
  const slugs = PRICE_TO_PLAN_SLUGS[String(priceCode || "").toUpperCase()] || [];
  for (const slug of slugs) {
    const plan = await env.DB.prepare("SELECT id FROM plans WHERE lower(slug)=lower(?1) LIMIT 1").bind(slug).first();
    if (plan?.id) return Number(plan.id);
  }
  return null;
}

export async function syncCentralSubscription(env, userId) {
  const user = await userRecord(env, userId);
  const status = await headOfficeJson(env, `/api/v1/payments/status?customerNumber=${encodeURIComponent(ucn(user))}`);
  const current = [...(status?.subscriptions || [])].sort((a, b) => rank(a.status) - rank(b.status))[0] || null;
  if (!current) return { success: true, subscription: null, central: true };

  const subscriptionStatus = String(current.status || "").toLowerCase();
  const activePlanId = await planIdForPrice(env, current.price_code);
  const freePlan = await env.DB.prepare("SELECT id FROM plans WHERE slug='free' LIMIT 1").first();
  const effectivePlanId = ["canceled", "cancelled"].includes(subscriptionStatus) ? Number(freePlan?.id || user.plan_id) : (activePlanId || Number(user.plan_id));
  const stripeCustomerId = current.stripe_customer_id || null;

  await env.DB.prepare(`INSERT INTO subscriptions
    (user_id,plan_id,status,billing_interval,stripe_subscription_id,stripe_customer_id,current_period_start,current_period_end,cancelled_at,cancel_at_period_end)
    VALUES (?1,?2,?3,'monthly',?4,?5,?6,?7,?8,?9)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET plan_id=excluded.plan_id,status=excluded.status,
      billing_interval=excluded.billing_interval,stripe_customer_id=excluded.stripe_customer_id,
      current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      cancelled_at=excluded.cancelled_at,cancel_at_period_end=excluded.cancel_at_period_end`)
    .bind(
      user.id,
      effectivePlanId,
      subscriptionStatus || "unknown",
      current.stripe_subscription_id,
      stripeCustomerId,
      current.current_period_start || null,
      current.current_period_end || null,
      current.cancelled_at || null,
      current.cancel_at_period_end ? 1 : 0,
    ).run();
  await env.DB.prepare("UPDATE users SET plan_id=?1,stripe_customer_id=COALESCE(?2,stripe_customer_id),updated_at=CURRENT_TIMESTAMP WHERE id=?3")
    .bind(effectivePlanId, stripeCustomerId, user.id).run();
  return { success: true, subscription: current, planId: effectivePlanId, central: true };
}
