import { HttpError } from "./http.js";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_ACCOUNT_ID = "acct_1TfUSWDLIZgCwhkL";
const encoder = new TextEncoder();

function configured(env) {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

function formBody(entries) {
  const form = new URLSearchParams();
  for (const [key, value] of entries) if (value !== null && value !== undefined) form.append(key, String(value));
  return form.toString();
}

async function stripeRequest(env, path, { method = "GET", entries = [], idempotencyKey } = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, "Stripe is not configured.", "stripe_not_configured");
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    ...(method === "POST" ? { body: formBody(entries) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status >= 500 ? 503 : 400,
    "Stripe could not complete the billing request.", "stripe_request_failed");
  return payload;
}

export async function verifyStripeAccount(env) {
  const account = await stripeRequest(env, "/account");
  if (account?.id !== STRIPE_ACCOUNT_ID) {
    throw new HttpError(503, "The configured Stripe account is not Profile Centre.", "stripe_account_mismatch");
  }
  return { id: account.id, livemode: true };
}

async function customerForUser(env, user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const matches = await stripeRequest(env, `/customers?email=${encodeURIComponent(user.email)}&limit=2`);
  if ((matches?.data?.length || 0) > 1) {
    throw new HttpError(409, "More than one Stripe customer matches this account.", "stripe_customer_ambiguous");
  }
  const existing = matches?.data?.[0] || null;
  if (existing?.metadata?.head_office_ucn && existing.metadata.head_office_ucn !== user.customer_number) {
    throw new HttpError(409, "The Stripe customer belongs to a different Head Office UCN.", "stripe_customer_ucn_mismatch");
  }
  if (existing) {
    await stripeRequest(env, `/customers/${encodeURIComponent(existing.id)}`, {
      method: "POST",
      idempotencyKey: `profile-centre-customer-link-${user.id}-${user.customer_number}`,
      entries: [
        ["metadata[profile_centre_user_id]", user.id],
        ["metadata[head_office_ucn]", user.customer_number],
        ["metadata[platform_code]", "PROFILE_CENTRE"],
      ],
    });
    await env.DB.prepare("UPDATE users SET stripe_customer_id=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2")
      .bind(existing.id, user.id).run();
    return existing.id;
  }
  const customer = await stripeRequest(env, "/customers", {
    method: "POST",
    idempotencyKey: `profile-centre-customer-${user.id}`,
    entries: [
      ["email", user.email], ["name", user.name || user.email],
      ["metadata[profile_centre_user_id]", user.id],
      ["metadata[head_office_ucn]", user.customer_number],
      ["metadata[platform_code]", "PROFILE_CENTRE"],
    ],
  });
  await env.DB.prepare("UPDATE users SET stripe_customer_id=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2")
    .bind(customer.id, user.id).run();
  return customer.id;
}

export async function initialiseStripeCustomer(env, userId) {
  await verifyStripeAccount(env);
  const user = await env.DB.prepare(`SELECT id,email,name,customer_number,stripe_customer_id FROM users WHERE id=?1`)
    .bind(userId).first();
  if (!user?.customer_number) throw new HttpError(409, "Head Office UCN linkage is required.", "ucn_required");
  await customerForUser(env, user);
  return { success: true, linked: true };
}

export async function createStripeCheckout(env, userId, input, origin) {
  await verifyStripeAccount(env);
  const planId = Number(input.plan_id);
  const interval = ["monthly", "yearly", "lifetime"].includes(input.interval) ? input.interval : "monthly";
  const plan = await env.DB.prepare(`SELECT id,name,stripe_price_monthly,stripe_price_yearly,stripe_price_lifetime
    FROM plans WHERE id=?1 AND is_active=1`).bind(planId).first();
  if (!plan) throw new HttpError(404, "Plan not found.", "plan_not_found");
  const priceId = interval === "yearly" ? plan.stripe_price_yearly
    : interval === "lifetime" ? plan.stripe_price_lifetime : plan.stripe_price_monthly;
  if (!priceId) throw new HttpError(400, "This billing interval is not configured.", "stripe_price_missing");
  const user = await env.DB.prepare(`SELECT id,email,name,customer_number,stripe_customer_id FROM users WHERE id=?1`)
    .bind(userId).first();
  if (!user?.customer_number) throw new HttpError(409, "Head Office UCN linkage is required.", "ucn_required");
  const customer = await customerForUser(env, user);
  const mode = interval === "lifetime" ? "payment" : "subscription";
  const metadata = [
    ["metadata[profile_centre_user_id]", user.id], ["metadata[head_office_ucn]", user.customer_number],
    ["metadata[plan_id]", plan.id], ["metadata[interval]", interval], ["metadata[platform_code]", "PROFILE_CENTRE"],
  ];
  const session = await stripeRequest(env, "/checkout/sessions", {
    method: "POST",
    idempotencyKey: `profile-centre-checkout-${user.id}-${plan.id}-${interval}-${new Date().toISOString().slice(0, 10)}`,
    entries: [
      ["mode", mode], ["customer", customer], ["line_items[0][price]", priceId], ["line_items[0][quantity]", 1],
      ["success_url", `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`],
      ["cancel_url", `${origin}/dashboard/billing?checkout=cancelled`], ["allow_promotion_codes", "true"],
      ...metadata,
      ...(mode === "subscription" ? metadata.map(([key,value]) => [key.replace("metadata", "subscription_data[metadata]"), value]) : []),
      ...(mode === "payment" ? metadata.map(([key,value]) => [key.replace("metadata", "payment_intent_data[metadata]"), value]) : []),
    ],
  });
  return { success: true, url: session.url };
}

export async function createBillingPortal(env, userId, origin) {
  await verifyStripeAccount(env);
  const user = await env.DB.prepare(`SELECT id,email,name,customer_number,stripe_customer_id FROM users WHERE id=?1`)
    .bind(userId).first();
  if (!user?.customer_number) throw new HttpError(409, "Head Office UCN linkage is required.", "ucn_required");
  const customer = await customerForUser(env, user);
  const session = await stripeRequest(env, "/billing_portal/sessions", {
    method: "POST", idempotencyKey: `profile-centre-portal-${user.id}-${crypto.randomUUID()}`,
    entries: [["customer", customer], ["return_url", `${origin}/dashboard/billing`]],
  });
  return { success: true, url: session.url };
}

export async function cancelStripeSubscription(env, userId) {
  await verifyStripeAccount(env);
  const subscription = await env.DB.prepare(`SELECT id,stripe_subscription_id,status FROM subscriptions
    WHERE user_id=?1 AND stripe_subscription_id IS NOT NULL ORDER BY id DESC LIMIT 1`).bind(userId).first();
  if (!subscription) throw new HttpError(404, "No Stripe subscription was found.", "subscription_not_found");
  if (subscription.status === "cancelled") throw new HttpError(409, "Subscription is already cancelled.", "subscription_cancelled");
  const result = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subscription.stripe_subscription_id)}`, {
    method: "POST", idempotencyKey: `profile-centre-cancel-${subscription.stripe_subscription_id}`,
    entries: [["cancel_at_period_end", "true"]],
  });
  await env.DB.prepare(`UPDATE subscriptions SET cancel_at_period_end=1,status=?1 WHERE id=?2`)
    .bind(result.status || subscription.status, subscription.id).run();
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

export async function handleStripeWebhook(request, env) {
  if (!configured(env)) throw new HttpError(503, "Stripe webhook is not configured.", "stripe_not_configured");
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
