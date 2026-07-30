/**
 * Stripe Snapshot Webhook Handler
 *
 * Receives full-payload (snapshot) events from Stripe.
 * Verified using STRIPE_WEBHOOK_SECRET_SNAPSHOT via raw body HMAC.
 *
 * Registered BEFORE express.json() so we can read the raw body.
 */
import { type Request, type Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSecret } from '#airo/secrets';
import db from '../../db.js';

// ─── Signature verification ──────────────────────────────────────────────────

function verifyStripeSignature(rawBody: Buffer, sigHeader: string, secret: string): boolean {
  try {
    const parts = Object.fromEntries(
      sigHeader.split(',').map(p => { const [k, v] = p.split('='); return [k, v]; })
    );
    const timestamp = parts['t'];
    const sig       = parts['v1'];
    if (!timestamp || !sig) return false;

    // Reject events older than 5 minutes
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > 300) { console.warn('[stripe:webhook] Timestamp too old:', age, 's'); return false; }

    const payload  = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch (err) {
    console.error('[stripe:webhook] Signature verification error:', err);
    return false;
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function getUserByStripeCustomer(customerId: string) {
  return await db.prepare('SELECT id, email, name, plan_id FROM users WHERE stripe_customer_id = ?').get(customerId) as
    { id: number; email: string; name: string; plan_id: number } | undefined;
}

async function getPlanByPriceId(priceId: string) {
  return await db.prepare(`
    SELECT id, name, slug FROM plans
    WHERE stripe_price_monthly = ? OR stripe_price_yearly = ? OR stripe_price_lifetime = ?
  `).get(priceId, priceId, priceId) as { id: number; name: string; slug: string } | undefined;
}

async function upsertSubscription(userId: number, planId: number, status: string, interval: string, stripeSubId: string | null, periodEnd: string | null) {
  // Try to find an existing row by stripe_subscription_id first (most precise),
  // then fall back to user_id (handles cases where sub ID isn't set yet)
  const existing = stripeSubId
    ? await db.prepare('SELECT id FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as { id: number } | undefined
      ?? await db.prepare('SELECT id FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId) as { id: number } | undefined
    : await db.prepare('SELECT id FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId) as { id: number } | undefined;

  if (existing) {
    await db.prepare(`
      UPDATE subscriptions SET plan_id = ?, status = ?, billing_interval = ?,
        stripe_subscription_id = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(planId, status, interval, stripeSubId, periodEnd, existing.id);
  } else {
    await db.prepare(`
      INSERT INTO subscriptions (user_id, plan_id, status, billing_interval, stripe_subscription_id, current_period_end)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, planId, status, interval, stripeSubId, periodEnd);
  }
  await db.prepare('UPDATE users SET plan_id = ? WHERE id = ?').run(planId, userId);
}

async function logAudit(action: string, detail: string) {
  try {
    await db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES ('stripe:webhook', ?, ?)`).run(action, detail);
  } catch { /* audit table may not exist yet */ }
}

// ─── Event handlers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEvent(event: { type: string; data: { object: any } }) {
  const obj = event.data.object;
  console.log('[stripe:webhook] Processing event:', event.type);

  switch (event.type) {

    // ── Customer created / updated — link Stripe customer ID to our user ──
    case 'customer.created':
    case 'customer.updated': {
      const email = obj.email as string | undefined;
      if (!email) break;
      // Match by email (OIDC users have their Microsoft email stored in users.email)
      const user = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as { id: number } | undefined;
      if (user) {
        await db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(obj.id, user.id);
        await logAudit('customer.linked', `user=${user.id} stripe_customer=${obj.id} email=${email}`);
      } else {
        console.warn('[stripe:webhook] customer.updated — no user found for email:', email);
      }
      break;
    }

    // ── Subscription activated / renewed ──
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const customerId = obj.customer as string;
      const user = await getUserByStripeCustomer(customerId);
      if (!user) { console.warn('[stripe:webhook] No user for customer:', customerId); break; }

      const item     = obj.items?.data?.[0];
      const priceId  = item?.price?.id as string | undefined;
      if (!priceId) break;

      const plan = await getPlanByPriceId(priceId);
      if (!plan) { console.warn('[stripe:webhook] No plan for price:', priceId); break; }

      const interval  = (item?.price?.recurring?.interval as string) || 'month';
      const status    = obj.status as string;
      const periodEnd = obj.current_period_end
        ? new Date((obj.current_period_end as number) * 1000).toISOString()
        : null;

      await upsertSubscription(user.id, plan.id, status, interval, obj.id as string, periodEnd);
      await logAudit('subscription.updated', `user=${user.id} plan=${plan.slug} status=${status}`);
      break;
    }

    // ── Subscription cancelled ──
    case 'customer.subscription.deleted': {
      const customerId = obj.customer as string;
      const user = await getUserByStripeCustomer(customerId);
      if (!user) break;

      const freePlan = await db.prepare("SELECT id FROM plans WHERE slug = 'free'").get() as { id: number } | undefined;
      const planId   = freePlan?.id ?? 1;

      await db.prepare(`
        UPDATE subscriptions SET status = 'cancelled', plan_id = ?, cancelled_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(planId, user.id);
      await db.prepare('UPDATE users SET plan_id = ? WHERE id = ?').run(planId, user.id);
      await logAudit('subscription.cancelled', `user=${user.id}`);
      break;
    }

    // ── Checkout completed — handle one-time or subscription ──
    case 'checkout.session.completed': {
      const customerId = obj.customer as string;
      const mode       = obj.mode as string; // 'subscription' | 'payment'
      if (!customerId) break;

      // Link customer to user by email if not already linked
      const email = obj.customer_details?.email as string | undefined;
      if (email) {
        const user = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as { id: number } | undefined;
        if (user) {
          await db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
          await logAudit('customer.linked.checkout', `user=${user.id} stripe_customer=${customerId} email=${email}`);
        }
      }

      if (mode === 'payment') {
        // One-time payment (lifetime) — metadata contains plan_id set by checkout builder
        const metaPlanId = obj.metadata?.plan_id as string | undefined;
        const user = await getUserByStripeCustomer(customerId);
        if (metaPlanId && user) {
          const plan = await db.prepare('SELECT id, name, slug FROM plans WHERE id = ?').get(Number(metaPlanId)) as { id: number; name: string; slug: string } | undefined;
          if (plan) {
            await db.prepare('UPDATE users SET plan_id = ?, lifetime_access = 1 WHERE id = ?').run(plan.id, user.id);
            await upsertSubscription(user.id, plan.id, 'lifetime', 'lifetime', null, null);
            await logAudit('lifetime.granted', `user=${user.id} plan=${plan.slug} via checkout`);
          }
        }
      }
      break;
    }

    // ── Invoice paid — keep subscription active, clear any payment grace ──
    case 'invoice.paid': {
      const customerId = obj.customer as string;
      const user = await getUserByStripeCustomer(customerId);
      if (!user) break;
      await db.prepare(`UPDATE subscriptions SET status = 'active' WHERE user_id = ?`).run(user.id);
      // Clear grace period — payment resolved
      await db.prepare(`UPDATE users SET payment_grace_until = NULL WHERE id = ?`).run(user.id);
      await logAudit('invoice.paid', `user=${user.id} amount=${obj.amount_paid}`);
      break;
    }

    // ── Invoice payment failed — mark past_due and start 7-day grace period ──
    case 'invoice.payment_failed': {
      const customerId = obj.customer as string;
      const user = await getUserByStripeCustomer(customerId);
      if (!user) break;
      // Mark subscription past_due
      await db.prepare(`UPDATE subscriptions SET status = 'past_due' WHERE user_id = ?`).run(user.id);
      // Set payment_grace_until = now + 7 days (only if not already set — don't reset on repeated failures)
      const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
      const graceDeadline = new Date(Date.now() + GRACE_MS).toISOString();
      await db.prepare(`
        UPDATE users SET payment_grace_until = ?
        WHERE id = ? AND (payment_grace_until IS NULL OR payment_grace_until > ?)
      `).run(graceDeadline, user.id, new Date().toISOString());
      await logAudit('invoice.payment_failed', `user=${user.id} grace_until=${graceDeadline}`);
      break;
    }

    default:
      console.log('[stripe:webhook] Unhandled event type (ignored):', event.type);
  }
}

// ─── Express handler ─────────────────────────────────────────────────────────

export async function stripeWebhook(req: Request, res: Response) {
  const sigHeader = req.headers['stripe-signature'] as string | undefined;
  if (!sigHeader) {
    console.warn('[stripe:webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature' });
  }

  const secret = getSecret('STRIPE_WEBHOOK_SECRET_SNAPSHOT') as string | undefined;
  if (!secret) {
    console.error('[stripe:webhook] STRIPE_WEBHOOK_SECRET_SNAPSHOT not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    console.error('[stripe:webhook] Raw body not available — ensure route is registered before express.json()');
    return res.status(500).json({ error: 'Raw body unavailable' });
  }

  if (!verifyStripeSignature(rawBody, sigHeader, secret)) {
    console.warn('[stripe:webhook] Signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event: { type: string; data: { object: unknown } };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    await handleEvent(event as Parameters<typeof handleEvent>[0]);
  } catch (err) {
    console.error('[stripe:webhook] Handler error:', err);
    // Still return 200 so Stripe doesn't retry — log the error
    return res.status(200).json({ received: true, warning: 'Handler error — check logs' });
  }

  res.status(200).json({ received: true });
}
