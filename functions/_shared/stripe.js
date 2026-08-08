import { HttpError } from "./http.js";

const HEAD_OFFICE_DEFAULT = "https://customerops.jagroupservices.co.uk";
const CENTRAL_BRAND = "SOUSA_MURRAY_PROFILES";
const encoder = new TextEncoder();

const PLAN_CODES = Object.freeze({
  starter: Object.freeze({ productCode: "PROFILES_STARTER", priceCode: "PROFILES_STARTER_MONTHLY" }),
  professional: Object.freeze({ productCode: "PROFILES_PROFESSIONAL", priceCode: "PROFILES_PROFESSIONAL_MONTHLY" }),
  business: Object.freeze({ productCode: "PROFILES_ORGANISATION", priceCode: "PROFILES_ORGANISATION_MONTHLY" }),
  organisation: Object.freeze({ productCode: "PROFILES_ORGANISATION", priceCode: "PROFILES_ORGANISATION_MONTHLY" }),
  organization: Object.freeze({ productCode: "PROFILES_ORGANISATION", priceCode: "PROFILES_ORGANISATION_MONTHLY" }),
  ultimate_plus: Object.freeze({ productCode: "PROFILES_ULTIMATE_ORGANISATION", priceCode: "PROFILES_ULTIMATE_ORGANISATION_MONTHLY" }),
  ultimate_organisation: Object.freeze({ productCode: "PROFILES_ULTIMATE_ORGANISATION", priceCode: "PROFILES_ULTIMATE_ORGANISATION_MONTHLY" }),
  ultimate_organization: Object.freeze({ productCode: "PROFILES_ULTIMATE_ORGANISATION", priceCode: "PROFILES_ULTIMATE_ORGANISATION_MONTHLY" }),
});

const PRICE_TO_PLAN = Object.freeze({
  PROFILES_STARTER_MONTHLY: ["starter"],
  PROFILES_PROFESSIONAL_MONTHLY: ["professional"],
  PROFILES_ORGANISATION_MONTHLY: ["business", "organisation", "organization"],
  PROFILES_ULTIMATE_ORGANISATION_MONTHLY: ["ultimate_plus", "ultimate_organisation", "ultimate_organization"],
});

function legacyWebhookConfigured(env) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET);
}

function centralConnector(env) {
  // Central Payments has its own scoped Head Office credential. Prefer that
  // dedicated secret so an older customer/security platform key can never be
  // selected merely because it is also valid for Head Office APIs.
  const token = String(env.CENTRAL_PAYMENTS_API_KEY || env.CUSTOMEROPS_API_KEY || env.HEAD_OFFICE_PLATFORM_KEY || "").trim();
  const base = String(env.CUSTOMEROPS_BASE_URL || env.HEAD_OFFICE_API_BASE_URL || HEAD_OFFICE_DEFAULT)
    .trim().replace(/\/+$/, "");
  return { token, base };
}

async function centralRequest(env, path, init = {}) {
  const { token, base } = centralConnector(env);
  if (!token) throw new HttpError(503, "Head Office Central Payments is not connected.", "central_payments_not_connected");
  const target = new URL(path, `${base}/`);
  if (target.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(target.hostname)) {
    throw new HttpError(503, "Head Office Central Payments must use HTTPS.", "central_payments_insecure_endpoint");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(target.toString(), {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload?.error?.code || payload?.code || "central_payments_request_failed";
      const message = payload?.error?.message || payload?.message || "Head Office Central Payments could not complete the billing request.";
      throw new HttpError(response.status >= 500 ? 503 : response.status, message, code);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function validUcn(value) {
  return /^\d{10}$/.test(String(value || "").replace(/\s/g, ""));
}

function normalisePlanKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function centralCodesForPlan(plan) {
  const bySlug = PLAN_CODES[normalisePlanKey(plan?.slug)];
  if (bySlug) return bySlug;
  const name = normalisePlanKey(plan?.name);
  if (name.includes("ultimate") && (name.includes("organisation") || name.includes("organization"))) {
    return PLAN_CODES.ultimate_organisation;
  }
  if (name.includes("organisation") || name.includes("organization") || name.includes("business")) {
    return PLAN_CODES.business;
  }
  if (name.includes("professional")) return PLAN_CODES.professional;
  if (name.includes("starter")) return PLAN_CODES.starter;
  return null;
}

async function billingUser(env, userId) {
  const user = await env.DB.prepare(`SELECT id,email,name,customer_number,stripe_customer_id,plan_id FROM users WHERE id=?1`)
    .bind(userId).first();
  if (!user) throw new HttpError(404, "Customer account not found.", "customer_not_found");
  if (!validUcn(user.customer_number)) throw new HttpError(409, "Head Office UCN linkage is required.", "ucn_required");
  return user;
}

export async function verifyStripeAccount(env) {
  const account = await centralRequest(env, "/api/v1/payments/account-info");
  const stripeAccountId = String(account?.stripeAccountId || "").trim();
  if (!stripeAccountId.startsWith("acct_")) {
    throw new HttpError(503, "Head Office did not return a valid Central Payments Stripe account.", "central_stripe_account_invalid");
  }
  return {
    id: stripeAccountId,
    livemode: account?.liveMode === true,
    mode: account?.mode || null,
    displayName: account?.displayName || null,
  };
}

function subscriptionRank(status) {
  const order = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused", "cancelled", "canceled"];
  const index = order.indexOf(String(status || "").toLowerCase());
  return index < 0 ? 999 : index;
}

function localSubscriptionStatus(value) {
  const status = String(value || "").toLowerCase();
  return status === "canceled" ? "cancelled" : status || "incomplete";
}

async function planForCentralPrice(env, priceCode) {
  const aliases = PRICE_TO_PLAN[String(priceCode || "").toUpperCase()] || [];
  if (!aliases.length) return null;
  const rows = await env.DB.prepare("SELECT id,slug,name FROM plans WHERE is_active=1").all();
  return (rows.results || []).find((plan) => {
    const slug = normalisePlanKey(plan.slug);
    const name = normalisePlanKey(plan.name);
    if (aliases.includes(slug)) return true;
    if (priceCode === "PROFILES_ULTIMATE_ORGANISATION_MONTHLY") return name.includes("ultimate");
    if (priceCode === "PROFILES_ORGANISATION_MONTHLY") return name.includes("business") || name.includes("organisation") || name.includes("organization");
    return false;
  }) || null;
}

export async function synchroniseCentralProfileBilling(env, userId) {
  const user = await env.DB.prepare("SELECT id,customer_number FROM users WHERE id=?1").bind(userId).first();
  if (!user || !validUcn(user.customer_number)) return { skipped: true, reason: "ucn_required" };

  const payload = await centralRequest(env, `/api/v1/payments/status?customerNumber=${encodeURIComponent(user.customer_number)}`);
  const subscriptions = Array.isArray(payload?.subscriptions) ? payload.subscriptions : [];
  const profilesSubscriptions = subscriptions
    .filter((item) => PRICE_TO_PLAN[String(item?.price_code || "").toUpperCase()])
    .sort((a, b) => subscriptionRank(a.status) - subscriptionRank(b.status));
  const current = profilesSubscriptions[0] || null;
  if (!current?.stripe_subscription_id) return { synced: false, reason: "no_central_subscription" };

  const plan = await planForCentralPrice(env, String(current.price_code || "").toUpperCase());
  if (!plan) throw new HttpError(503, "The Central Payments subscription cannot be mapped to a Sousa Murray Profiles plan.", "central_plan_mapping_missing");

  const status = localSubscriptionStatus(current.status);
  const cancelled = ["cancelled", "canceled"].includes(String(current.status || "").toLowerCase());
  let localPlanId = plan.id;
  if (cancelled) {
    const free = await env.DB.prepare("SELECT id FROM plans WHERE slug='free' LIMIT 1").first();
    if (free?.id) localPlanId = free.id;
  }

  await env.DB.prepare(`INSERT INTO subscriptions
    (user_id,plan_id,status,billing_interval,stripe_subscription_id,stripe_customer_id,current_period_start,current_period_end,cancelled_at,cancel_at_period_end)
    VALUES (?1,?2,?3,'monthly',?4,?5,?6,?7,?8,?9)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET plan_id=excluded.plan_id,status=excluded.status,
      billing_interval='monthly',stripe_customer_id=excluded.stripe_customer_id,
      current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      cancelled_at=excluded.cancelled_at,cancel_at_period_end=excluded.cancel_at_period_end`)
    .bind(
      user.id,
      localPlanId,
      status,
      current.stripe_subscription_id,
      current.stripe_customer_id || null,
      current.current_period_start || null,
      current.current_period_end || null,
      current.cancelled_at || null,
      current.cancel_at_period_end ? 1 : 0,
    ).run();

  await env.DB.prepare(`UPDATE users SET plan_id=?1,stripe_customer_id=COALESCE(?2,stripe_customer_id),updated_at=CURRENT_TIMESTAMP WHERE id=?3`)
    .bind(localPlanId, current.stripe_customer_id || null, user.id).run();
  return { synced: true, status, planId: localPlanId, stripeSubscriptionId: current.stripe_subscription_id };
}

export async function initialiseStripeCustomer(env, userId) {
  await verifyStripeAccount(env);
  const user = await billingUser(env, userId);
  await synchroniseCentralProfileBilling(env, user.id).catch(() => undefined);
  return { success: true, linked: true, centralPayments: true };
}

export async function createStripeCheckout(env, userId, input, origin) {
  await verifyStripeAccount(env);
  const interval = String(input?.interval || "monthly").toLowerCase();
  if (interval !== "monthly") {
    throw new HttpError(400, "Sousa Murray Profiles currently offers Central Payments checkout monthly only.", "billing_interval_not_supported");
  }
  const planId = Number(input?.plan_id);
  if (!Number.isInteger(planId) || planId < 1) throw new HttpError(400, "Plan not found.", "plan_not_found");
  const plan = await env.DB.prepare(`SELECT id,name,slug,price_monthly FROM plans WHERE id=?1 AND is_active=1`).bind(planId).first();
  if (!plan) throw new HttpError(404, "Plan not found.", "plan_not_found");
  const codes = centralCodesForPlan(plan);
  if (!codes) throw new HttpError(400, "This plan is not configured for Central Payments.", "central_plan_not_configured");
  const user = await billingUser(env, userId);
  const canonicalOrigin = new URL(origin).origin;
  const checkout = await centralRequest(env, "/api/v1/payments/checkout", {
    method: "POST",
    body: JSON.stringify({
      brand: CENTRAL_BRAND,
      customerNumber: user.customer_number,
      productCode: codes.productCode,
      priceCode: codes.priceCode,
      orderReference: `PROFILES-${plan.id}-${crypto.randomUUID()}`,
      serviceReference: `profiles:${user.id}:${plan.slug}:monthly`,
      successUrl: `${canonicalOrigin}/dashboard/billing?checkout=success`,
      cancelUrl: `${canonicalOrigin}/dashboard/billing?checkout=cancelled`,
    }),
  });
  if (!checkout?.checkout?.url) throw new HttpError(503, "Head Office did not return a Central Payments Checkout URL.", "central_checkout_invalid");
  return {
    success: true,
    url: checkout.checkout.url,
    central_payment_reference: checkout.checkout.reference || null,
    session_id: checkout.checkout.sessionId || null,
  };
}

export async function createBillingPortal(env, userId, origin) {
  await verifyStripeAccount(env);
  const user = await billingUser(env, userId);
  const canonicalOrigin = new URL(origin).origin;
  const payload = await centralRequest(env, "/api/v1/payments/portal", {
    method: "POST",
    body: JSON.stringify({
      brand: CENTRAL_BRAND,
      customerNumber: user.customer_number,
      returnUrl: `${canonicalOrigin}/dashboard/billing`,
    }),
  });
  if (!payload?.portal?.url) throw new HttpError(503, "Head Office did not return a Central Payments billing portal URL.", "central_portal_invalid");
  return { success: true, url: payload.portal.url };
}

export async function cancelStripeSubscription(env, userId) {
  await verifyStripeAccount(env);
  const user = await billingUser(env, userId);
  const payload = await centralRequest(env, "/api/v1/payments/subscription", {
    method: "POST",
    body: JSON.stringify({
      customerNumber: user.customer_number,
      action: "cancel_at_period_end",
    }),
  });
  const subscription = payload?.subscription;
  if (!subscription?.id) throw new HttpError(503, "Head Office did not return the Central Payments subscription.", "central_subscription_invalid");
  await env.DB.prepare(`UPDATE subscriptions SET cancel_at_period_end=1,status=?1,current_period_end=COALESCE(?2,current_period_end)
    WHERE user_id=?3 AND stripe_subscription_id=?4`)
    .bind(subscription.status || "active", subscription.currentPeriodEnd || null, user.id, subscription.id).run();
  return { success: true, cancel_at_period_end: true };
}

function parseSignature(header) {
  const result = { timestamp: null, signatures: [] };
  for (const item of String(header || "").split(",")) {
    const [key, value] = item.trim().split("=", 2);
    if (key === "t" && /^\d+$/.test(value || "")) result.timestamp = Number(value);
    if (key === "v1" && /^[a-f0-9]{64}$/i.test(value || "")) result.signatures.push(value.toLowerCase());
  }
  return result;
}

function hex(bytes) { return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function verifyWebhookSignature(rawBody, header, secret, now = Date.now()) {
  const parsed = parseSignature(header);
  if (!parsed.timestamp || !parsed.signatures.length || Math.abs(now / 1000 - parsed.timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${parsed.timestamp}.${rawBody}`)));
  return parsed.signatures.some(signature => constantTimeEqual(signature, expected));
}

function iso(seconds) { return seconds ? new Date(Number(seconds) * 1000).toISOString() : null; }
async function linkedUser(env, object) {
  const userId = Number(object?.metadata?.profile_centre_user_id || object?.subscription_details?.metadata?.profile_centre_user_id);
  const customerId = typeof object?.customer === "string" ? object.customer : object?.id?.startsWith("cus_") ? object.id : null;
  const ucn = object?.metadata?.head_office_ucn || object?.subscription_details?.metadata?.head_office_ucn || null;
  let user = Number.isInteger(userId) ? await env.DB.prepare("SELECT id,customer_number FROM users WHERE id=?1").bind(userId).first() : null;
  if (!user && customerId) user = await env.DB.prepare("SELECT id,customer_number FROM users WHERE stripe_customer_id=?1").bind(customerId).first();
  if (!user || (ucn && user.customer_number !== ucn)) throw new Error("stripe_customer_link_mismatch");
  if (customerId) await env.DB.prepare("UPDATE users SET stripe_customer_id=?1 WHERE id=?2").bind(customerId,user.id).run();
  return user;
}

async function applySubscription(env, object, deleted = false) {
  const user = await linkedUser(env, object);
  const item = object.items?.data?.[0];
  const priceId = item?.price?.id;
  const plan = priceId ? await env.DB.prepare(`SELECT id FROM plans WHERE stripe_price_monthly=?1 OR stripe_price_yearly=?1 OR stripe_price_lifetime=?1`).bind(priceId).first() : null;
  if (!plan && !deleted) throw new Error("stripe_price_not_mapped");
  const freePlan = deleted ? await env.DB.prepare("SELECT id FROM plans WHERE slug='free' LIMIT 1").first() : null;
  const planId = deleted ? freePlan?.id : plan.id;
  await env.DB.prepare(`INSERT INTO subscriptions
    (user_id,plan_id,status,billing_interval,stripe_subscription_id,stripe_customer_id,current_period_start,current_period_end,cancelled_at,cancel_at_period_end)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET plan_id=excluded.plan_id,status=excluded.status,
    billing_interval=excluded.billing_interval,stripe_customer_id=excluded.stripe_customer_id,
    current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
    cancelled_at=excluded.cancelled_at,cancel_at_period_end=excluded.cancel_at_period_end`)
    .bind(user.id,planId,deleted?"cancelled":object.status,item?.price?.recurring?.interval||"monthly",object.id,
      typeof object.customer === "string"?object.customer:null,iso(object.current_period_start),iso(object.current_period_end),
      deleted?new Date().toISOString():iso(object.canceled_at),object.cancel_at_period_end?1:0).run();
  await env.DB.prepare("UPDATE users SET plan_id=?1 WHERE id=?2").bind(planId,user.id).run();
}

async function processEvent(env, event) {
  const object = event.data?.object || {};
  if (["customer.subscription.created","customer.subscription.updated"].includes(event.type)) await applySubscription(env, object);
  else if (event.type === "customer.subscription.deleted") await applySubscription(env, object, true);
  else if (["checkout.session.completed","customer.created","customer.updated"].includes(event.type)) await linkedUser(env, object);
  else if (["invoice.paid","invoice.payment_succeeded"].includes(event.type)) {
    const user = await linkedUser(env, object); await env.DB.prepare("UPDATE subscriptions SET status='active' WHERE user_id=?1").bind(user.id).run();
  } else if (event.type === "invoice.payment_failed") {
    const user = await linkedUser(env, object); await env.DB.prepare("UPDATE subscriptions SET status='past_due' WHERE user_id=?1").bind(user.id).run();
  }
}

// Kept temporarily for legacy Profile Centre Stripe subscriptions created before
// the move to Head Office Central Payments. New checkouts never use this route.
export async function handleStripeWebhook(request, env) {
  if (!legacyWebhookConfigured(env)) throw new HttpError(503, "Legacy Stripe webhook is not configured.", "stripe_not_configured");
  const rawBody = await request.text();
  if (!await verifyWebhookSignature(rawBody, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET)) {
    throw new HttpError(400, "Invalid Stripe signature.", "stripe_signature_invalid");
  }
  const event = JSON.parse(rawBody);
  if (!event?.id || !event?.type || event.object !== "event") throw new HttpError(400, "Invalid Stripe event.", "stripe_event_invalid");
  const inserted = await env.DB.prepare(`INSERT INTO stripe_webhook_events
    (event_id,event_type,livemode,object_id,processing_status)
    VALUES (?1,?2,?3,?4,'processing') ON CONFLICT(event_id) DO NOTHING`)
    .bind(event.id,event.type,event.livemode?1:0,event.data?.object?.id||null).run();
  if (!Number(inserted.meta?.changes || 0)) {
    const existing = await env.DB.prepare("SELECT processing_status FROM stripe_webhook_events WHERE event_id=?1").bind(event.id).first();
    if (existing?.processing_status === "processed") return { received: true, duplicate: true };
    const reclaimed = await env.DB.prepare(`UPDATE stripe_webhook_events SET processing_status='processing',error_code=NULL
      WHERE event_id=?1 AND processing_status IN ('failed','received')`).bind(event.id).run();
    if (!Number(reclaimed.meta?.changes || 0)) {
      throw new HttpError(503, "Stripe event processing is already in progress.", "stripe_event_in_progress");
    }
  }
  try {
    await processEvent(env,event);
    await env.DB.prepare("UPDATE stripe_webhook_events SET processing_status='processed',processed_at=CURRENT_TIMESTAMP,error_code=NULL WHERE event_id=?1").bind(event.id).run();
    return { received: true };
  } catch (error) {
    await env.DB.prepare("UPDATE stripe_webhook_events SET processing_status='failed',error_code=?1 WHERE event_id=?2")
      .bind(String(error?.message||error).slice(0,100),event.id).run();
    throw new HttpError(500, "Stripe event processing failed.", "stripe_event_processing_failed");
  }
}
