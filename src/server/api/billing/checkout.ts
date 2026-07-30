import { type Request, type Response } from 'express';
import db from '../../db.js';

async function getStripeSecretKey(): Promise<string | null> {
  try {
    const row = await db.prepare("SELECT value FROM stripe_config WHERE key = 'stripe_secret_key'").get() as { value: string } | undefined;
    return row?.value || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/billing/init-customer
 * Ensures the authenticated user has a Stripe customer record linked to their account.
 * Called when a user visits the billing page so their email is pre-linked before checkout.
 * This is especially important for OIDC users whose email may differ from what Stripe has.
 */
export async function initStripeCustomer(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const user = await db.prepare('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?').get(userId) as {
      id: number; email: string; name: string; stripe_customer_id: string | null;
    } | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Already linked — check the customer still exists in Stripe
    if (user.stripe_customer_id) {
      return res.json({ success: true, stripe_customer_id: user.stripe_customer_id, linked: true });
    }

    const secretKey = await getStripeSecretKey();
    if (!secretKey) {
      return res.json({ success: true, linked: false, message: 'Stripe not configured' });
    }

    // Search for existing Stripe customer by email
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(`email:"${user.email}"`)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const searchData = await searchRes.json() as { data?: { id: string }[] };
    const existingCustomer = searchData.data?.[0];

    if (existingCustomer) {
      // Link existing Stripe customer to this user
      await db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(existingCustomer.id, userId);
      return res.json({ success: true, stripe_customer_id: existingCustomer.id, linked: true, source: 'existing' });
    }

    // Create a new Stripe customer for this user
    const createRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&metadata[user_id]=${userId}`,
    });
    const customer = await createRes.json() as { id?: string; error?: { message: string } };
    if (!createRes.ok || !customer.id) {
      console.error('[billing/init-customer] Failed to create Stripe customer:', customer.error?.message);
      return res.json({ success: true, linked: false, message: 'Could not create Stripe customer' });
    }

    await db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customer.id, userId);
    return res.json({ success: true, stripe_customer_id: customer.id, linked: true, source: 'created' });
  } catch (err) {
    console.error('[billing/init-customer] Error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for a plan upgrade.
 * Requires the user to be authenticated.
 */
export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ success: false, error: 'plan_id is required' });

    const secretKey = await getStripeSecretKey();
    if (!secretKey) {
      return res.status(503).json({ success: false, error: 'Stripe is not configured. Please contact support.' });
    }

    // Fetch plan with Stripe price IDs
    const plan = await db.prepare(`
      SELECT id, name, stripe_price_monthly, stripe_price_yearly, stripe_price_lifetime, stripe_product_id, price_monthly, has_lifetime
      FROM plans WHERE id = ?
    `).get(plan_id) as {
      id: number; name: string;
      stripe_price_monthly: string | null; stripe_price_yearly: string | null;
      stripe_price_lifetime: string | null; stripe_product_id: string | null;
      price_monthly: number; has_lifetime: number;
    } | undefined;

    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

    // Determine which price ID to use based on billing interval requested
    const interval = (req.body.interval as string) || 'monthly';
    let priceId: string | null = null;
    let checkoutMode: 'subscription' | 'payment' = 'subscription';

    if (interval === 'yearly' && plan.stripe_price_yearly) {
      priceId = plan.stripe_price_yearly;
    } else if (interval === 'lifetime' && plan.stripe_price_lifetime) {
      priceId = plan.stripe_price_lifetime;
      checkoutMode = 'payment'; // lifetime = one-time payment
    } else {
      priceId = plan.stripe_price_monthly;
    }

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: `This plan does not have a Stripe price configured for ${interval} billing. Please contact support.`,
      });
    }

    // Get user info
    const user = await db.prepare('SELECT email, name, stripe_customer_id FROM users WHERE id = ?').get(userId) as {
      email: string; name: string; stripe_customer_id: string | null;
    } | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const appUrl = await db.prepare("SELECT value FROM admin_settings WHERE key = 'platform_url'").get() as { value: string } | undefined;
    const baseUrl = appUrl?.value || 'https://japrofilestudio.jagroupservices.co.uk';

    // Build Checkout Session params
    const params: Record<string, unknown> = {
      mode: checkoutMode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?checkout=success&plan=${encodeURIComponent(plan.name)}`,
      cancel_url: `${baseUrl}/dashboard/billing?checkout=cancelled`,
      metadata: { user_id: String(userId), plan_id: String(plan_id), interval },
      allow_promotion_codes: true,
    };

    // subscription_data only for recurring plans
    if (checkoutMode === 'subscription') {
      params.subscription_data = { metadata: { user_id: String(userId), plan_id: String(plan_id) } };
    } else {
      params.payment_intent_data = { metadata: { user_id: String(userId), plan_id: String(plan_id) } };
    }

    // Attach or create Stripe customer
    if (user.stripe_customer_id) {
      params.customer = user.stripe_customer_id;
    } else {
      params.customer_email = user.email;
    }

    // Create session via Stripe REST API
    const formBody = buildFormEncoded(params);
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const session = await stripeRes.json() as { id?: string; url?: string; error?: { message: string } };
    if (!stripeRes.ok || !session.url) {
      return res.status(400).json({ success: false, error: session.error?.message || 'Failed to create checkout session' });
    }

    res.json({ success: true, url: session.url });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// Recursively build application/x-www-form-urlencoded for nested Stripe params
function buildFormEncoded(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(buildFormEncoded(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          parts.push(buildFormEncoded(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}
