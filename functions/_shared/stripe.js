import { HttpError } from "./http.js";
import {
  cancelCentralSubscription,
  createCentralBillingPortal,
  createCentralCheckout,
  initialiseCentralPaymentCustomer,
} from "./central-payments.js";

const encoder = new TextEncoder();

// New customer-facing billing is centralised at Head Office. These exported
// function names are retained so the existing API router and frontend contract
// do not need a parallel set of billing routes during cutover.
export async function initialiseStripeCustomer(env, userId) {
  return initialiseCentralPaymentCustomer(env, userId);
}

export async function createStripeCheckout(env, userId, input, origin) {
  return createCentralCheckout(env, userId, input, origin);
}

export async function createBillingPortal(env, userId, origin) {
  return createCentralBillingPortal(env, userId, origin);
}

export async function cancelStripeSubscription(env, userId) {
  return cancelCentralSubscription(env, userId);
}

// Legacy webhook compatibility only. Existing subscriptions created in the old
// Profiles Stripe account may continue to send lifecycle events during the
// migration window. No new checkout or portal operation uses this site-level
// Stripe connection.
function legacyWebhookConfigured(env) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET);
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

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

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

function iso(seconds) {
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : null;
}

async function linkedUser(env, object) {
  const userId = Number(object?.metadata?.profile_centre_user_id || object?.subscription_details?.metadata?.profile_centre_user_id);
  const customerId = typeof object?.customer === "string" ? object.customer : object?.id?.startsWith("cus_") ? object.id : null;
  const customerNumber = object?.metadata?.head_office_ucn || object?.subscription_details?.metadata?.head_office_ucn || null;
  let user = Number.isInteger(userId)
    ? await env.DB.prepare("SELECT id,customer_number FROM users WHERE id=?1").bind(userId).first()
    : null;
  if (!user && customerId) {
    user = await env.DB.prepare("SELECT id,customer_number FROM users WHERE stripe_customer_id=?1").bind(customerId).first();
  }
  if (!user || (customerNumber && user.customer_number !== customerNumber)) throw new Error("stripe_customer_link_mismatch");
  if (customerId) await env.DB.prepare("UPDATE users SET stripe_customer_id=?1 WHERE id=?2").bind(customerId, user.id).run();
  return user;
}

async function applyLegacySubscription(env, object, deleted = false) {
  const user = await linkedUser(env, object);
  const item = object.items?.data?.[0];
  const priceId = item?.price?.id;
  const plan = priceId
    ? await env.DB.prepare(`SELECT id FROM plans WHERE stripe_price_monthly=?1 OR stripe_price_yearly=?1 OR stripe_price_lifetime=?1`).bind(priceId).first()
    : null;
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
    .bind(
      user.id,
      planId,
      deleted ? "cancelled" : object.status,
      item?.price?.recurring?.interval || "monthly",
      object.id,
      typeof object.customer === "string" ? object.customer : null,
      iso(object.current_period_start),
      iso(object.current_period_end),
      deleted ? new Date().toISOString() : iso(object.canceled_at),
      object.cancel_at_period_end ? 1 : 0,
    ).run();
  await env.DB.prepare("UPDATE users SET plan_id=?1 WHERE id=?2").bind(planId, user.id).run();
}

async function processLegacyEvent(env, event) {
  const object = event.data?.object || {};
  if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
    await applyLegacySubscription(env, object);
  } else if (event.type === "customer.subscription.deleted") {
    await applyLegacySubscription(env, object, true);
  } else if (["checkout.session.completed", "customer.created", "customer.updated"].includes(event.type)) {
    await linkedUser(env, object);
  } else if (["invoice.paid", "invoice.payment_succeeded"].includes(event.type)) {
    const user = await linkedUser(env, object);
    await env.DB.prepare("UPDATE subscriptions SET status='active' WHERE user_id=?1").bind(user.id).run();
  } else if (event.type === "invoice.payment_failed") {
    const user = await linkedUser(env, object);
    await env.DB.prepare("UPDATE subscriptions SET status='past_due' WHERE user_id=?1").bind(user.id).run();
  }
}

export async function handleStripeWebhook(request, env) {
  if (!legacyWebhookConfigured(env)) {
    throw new HttpError(503, "The legacy Profiles Stripe webhook is not configured.", "legacy_stripe_webhook_not_configured");
  }
  const rawBody = await request.text();
  if (!await verifyWebhookSignature(rawBody, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET)) {
    throw new HttpError(400, "Invalid Stripe signature.", "stripe_signature_invalid");
  }
  const event = JSON.parse(rawBody);
  if (!event?.id || !event?.type || event.object !== "event") throw new HttpError(400, "Invalid Stripe event.", "stripe_event_invalid");
  const inserted = await env.DB.prepare(`INSERT INTO stripe_webhook_events
    (event_id,event_type,livemode,object_id,processing_status)
    VALUES (?1,?2,?3,?4,'processing') ON CONFLICT(event_id) DO NOTHING`)
    .bind(event.id, event.type, event.livemode ? 1 : 0, event.data?.object?.id || null).run();
  if (!Number(inserted.meta?.changes || 0)) {
    const existing = await env.DB.prepare("SELECT processing_status FROM stripe_webhook_events WHERE event_id=?1").bind(event.id).first();
    if (existing?.processing_status === "processed") return { received: true, duplicate: true, legacy: true };
    const reclaimed = await env.DB.prepare(`UPDATE stripe_webhook_events SET processing_status='processing',error_code=NULL
      WHERE event_id=?1 AND processing_status IN ('failed','received')`).bind(event.id).run();
    if (!Number(reclaimed.meta?.changes || 0)) {
      throw new HttpError(503, "Stripe event processing is already in progress.", "stripe_event_in_progress");
    }
  }
  try {
    await processLegacyEvent(env, event);
    await env.DB.prepare("UPDATE stripe_webhook_events SET processing_status='processed',processed_at=CURRENT_TIMESTAMP,error_code=NULL WHERE event_id=?1")
      .bind(event.id).run();
    return { received: true, legacy: true };
  } catch (error) {
    await env.DB.prepare("UPDATE stripe_webhook_events SET processing_status='failed',error_code=?1 WHERE event_id=?2")
      .bind(String(error?.message || error).slice(0, 100), event.id).run();
    throw new HttpError(500, "Legacy Stripe event processing failed.", "stripe_event_processing_failed");
  }
}
