import { type Request, type Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

// ─── Stripe Config (keys stored in DB, not env) ────────────────────────────

const STRIPE_KEYS = ['stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret', 'stripe_mode'];

export function getStripeConfig(_req: Request, res: Response) {
  try {
    const rows = db.prepare('SELECT key, value FROM stripe_config').all() as { key: string; value: string }[];
    const obj: Record<string, string> = {};
    for (const r of rows) obj[r.key] = r.value;
    // Mask secret key — only show last 4 chars
    if (obj.stripe_secret_key && obj.stripe_secret_key.length > 8) {
      obj.stripe_secret_key_masked = '••••••••' + obj.stripe_secret_key.slice(-4);
      delete obj.stripe_secret_key;
    }
    res.json({ success: true, data: obj });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch Stripe config' });
  }
}

export function updateStripeConfig(req: Request, res: Response) {
  try {
    for (const key of STRIPE_KEYS) {
      if (key in req.body && req.body[key] !== undefined) {
        if (key === 'stripe_secret_key' && String(req.body[key]).startsWith('••••')) continue;
        db.prepare('INSERT OR REPLACE INTO stripe_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
          .run(key, String(req.body[key]));
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update Stripe config' });
  }
}

// ─── Lifetime Access ───────────────────────────────────────────────────────

const LIFETIME_REASON_CATEGORIES = [
  'founder_goodwill',
  'manual_compensation',
  'service_issue_resolution',
  'internal_test_account',
  'approved_organisation_support',
  'special_business_agreement',
  'migration_old_arrangement',
  'staff_admin_approved_exception',
] as const;

export function grantLifetimeAccess(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const {
      plan_id,
      reason_category,
      internal_note,
      customer_note,
      review_date,
      can_be_withdrawn = 1,
    } = req.body;

    if (!plan_id) return res.status(400).json({ success: false, error: 'plan_id required' });
    if (!reason_category || !LIFETIME_REASON_CATEGORIES.includes(reason_category)) {
      return res.status(400).json({ success: false, error: 'Valid reason_category required' });
    }
    if (!internal_note || String(internal_note).trim().length < 5) {
      return res.status(400).json({ success: false, error: 'internal_note required (min 5 chars)' });
    }

    const plan = db.prepare('SELECT id, name FROM plans WHERE id = ?').get(plan_id) as { id: number; name: string } | undefined;
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

    const actor = (req as any).adminUser ?? (req as any).user;
    const actorName = actor?.name ?? 'Admin';
    const actorId   = actor?.id ?? null;

    // Update user record
    db.prepare(`UPDATE users SET
      plan_id = ?, lifetime_access = 1, lifetime_plan_id = ?,
      lifetime_granted_at = CURRENT_TIMESTAMP,
      lifetime_granted_by = ?,
      lifetime_reason_category = ?,
      lifetime_internal_note = ?,
      lifetime_review_date = ?,
      lifetime_customer_note = ?,
      lifetime_can_be_withdrawn = ?,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`)
      .run(plan_id, plan_id, actorName, reason_category,
           String(internal_note).trim(),
           review_date || null,
           customer_note ? String(customer_note).trim() : null,
           can_be_withdrawn ? 1 : 0,
           userId);

    // Upsert subscription record
    const existing = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(userId) as { id: number } | undefined;
    if (existing) {
      db.prepare(`UPDATE subscriptions SET plan_id = ?, status = 'lifetime', billing_interval = 'lifetime',
        stripe_subscription_id = NULL, current_period_end = NULL WHERE user_id = ?`).run(plan_id, userId);
    } else {
      db.prepare(`INSERT INTO subscriptions (user_id, plan_id, status, billing_interval) VALUES (?, ?, 'lifetime', 'lifetime')`).run(userId, plan_id);
    }

    // Write lifetime_access_log entry
    db.prepare(`INSERT INTO lifetime_access_log
      (user_id, action, reason_category, internal_note, customer_note, granted_by, review_date, can_be_withdrawn, actor_id, actor_name)
      VALUES (?, 'granted', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(userId, reason_category, String(internal_note).trim(),
           customer_note ? String(customer_note).trim() : null,
           actorName, review_date || null, can_be_withdrawn ? 1 : 0, actorId, actorName);

    // Write audit log
    writeAudit({
      actorId, actorName, actorType: 'admin',
      action: 'lifetime_access_granted',
      resourceType: 'user', resourceId: String(userId),
      details: `Reason: ${reason_category}. Plan: ${plan.name}. Note: ${String(internal_note).trim()}`,
      result: 'success',
    });

    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.plan_id, u.lifetime_access, u.lifetime_plan_id,
        u.lifetime_granted_at, u.lifetime_granted_by, u.lifetime_reason_category,
        u.lifetime_internal_note, u.lifetime_review_date, u.lifetime_customer_note,
        u.lifetime_can_be_withdrawn,
        p.name as plan_name,
        (SELECT COUNT(*) FROM profiles WHERE user_id = u.id) as profile_count,
        u.created_at
      FROM users u LEFT JOIN plans p ON u.plan_id = p.id WHERE u.id = ?
    `).get(userId);
    res.json({ success: true, data: user });
  } catch (e) {
    console.error('[grantLifetimeAccess]', e);
    res.status(500).json({ success: false, error: 'Failed to grant lifetime access' });
  }
}

export function revokeLifetimeAccess(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const {
      withdrawal_reason,
      fallback_plan_slug = 'free',
      notify_user = 0,
      internal_note,
    } = req.body;

    if (!withdrawal_reason || String(withdrawal_reason).trim().length < 3) {
      return res.status(400).json({ success: false, error: 'withdrawal_reason required' });
    }

    const fallbackPlan = db.prepare('SELECT id, name FROM plans WHERE slug = ?').get(fallback_plan_slug) as { id: number; name: string } | undefined;
    const freePlan = db.prepare('SELECT id FROM plans WHERE slug = ?').get('free') as { id: number } | undefined;
    const planId = fallbackPlan?.id ?? freePlan?.id ?? 1;

    const actor = (req as any).adminUser ?? (req as any).user;
    const actorName = actor?.name ?? 'Admin';
    const actorId   = actor?.id ?? null;

    db.prepare(`UPDATE users SET
      plan_id = ?, lifetime_access = 0, lifetime_plan_id = NULL,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`).run(planId, userId);

    db.prepare(`UPDATE subscriptions SET plan_id = ?, status = 'cancelled', billing_interval = 'monthly',
      cancelled_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(planId, userId);

    // Write lifetime_access_log entry
    db.prepare(`INSERT INTO lifetime_access_log
      (user_id, action, withdrawal_reason, internal_note, fallback_plan_slug, notify_user, actor_id, actor_name)
      VALUES (?, 'withdrawn', ?, ?, ?, ?, ?, ?)`)
      .run(userId, String(withdrawal_reason).trim(),
           internal_note ? String(internal_note).trim() : null,
           fallback_plan_slug, notify_user ? 1 : 0, actorId, actorName);

    // Write audit log
    writeAudit({
      actorId, actorName, actorType: 'admin',
      action: 'lifetime_access_withdrawn',
      resourceType: 'user', resourceId: String(userId),
      details: `Reason: ${String(withdrawal_reason).trim()}. Fallback plan: ${fallback_plan_slug}. Notify: ${notify_user ? 'yes' : 'no'}.`,
      result: 'success',
    });

    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.plan_id, u.lifetime_access, u.lifetime_plan_id,
        p.name as plan_name,
        (SELECT COUNT(*) FROM profiles WHERE user_id = u.id) as profile_count,
        u.created_at
      FROM users u LEFT JOIN plans p ON u.plan_id = p.id WHERE u.id = ?
    `).get(userId);
    res.json({ success: true, data: user });
  } catch (e) {
    console.error('[revokeLifetimeAccess]', e);
    res.status(500).json({ success: false, error: 'Failed to revoke lifetime access' });
  }
}

export function getLifetimeLog(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const entries = db.prepare(`
      SELECT * FROM lifetime_access_log WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
    res.json({ success: true, data: entries });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch lifetime log' });
  }
}

// ─── Stripe Product Sync ───────────────────────────────────────────────────

function getStripeSecretKey(): string | null {
  try {
    const row = db.prepare("SELECT value FROM stripe_config WHERE key = 'stripe_secret_key'").get() as { value: string } | undefined;
    return row?.value || null;
  } catch {
    return null;
  }
}

export async function syncStripeProducts(_req: Request, res: Response) {
  try {
    const secretKey = await getStripeSecretKey();
    if (!secretKey) return res.status(400).json({ success: false, error: 'Stripe secret key not configured.' });

    // Fetch products from Stripe REST API (no SDK needed)
    const productsRes = await fetch('https://api.stripe.com/v1/products?limit=100&active=true', {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!productsRes.ok) {
      const err = await productsRes.json() as { error?: { message?: string } };
      return res.status(400).json({ success: false, error: err?.error?.message || 'Stripe API error' });
    }
    const productsData = await productsRes.json() as { data: StripeProduct[] };

    // Fetch prices
    const pricesRes = await fetch('https://api.stripe.com/v1/prices?limit=100&active=true', {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const pricesData = pricesRes.ok ? await pricesRes.json() as { data: StripePrice[] } : { data: [] };

    // Ensure tables exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS stripe_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        active INTEGER DEFAULT 1,
        metadata TEXT,
        created INTEGER,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS stripe_prices (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        currency TEXT,
        unit_amount INTEGER,
        recurring_interval TEXT,
        active INTEGER DEFAULT 1,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Upsert products and prices sequentially (transactions are no-ops on Azure)
    for (const p of productsData.data) {
      db.prepare(`
        INSERT OR REPLACE INTO stripe_products (id, name, description, active, metadata, created, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(p.id, p.name, p.description || '', p.active ? 1 : 0, JSON.stringify(p.metadata || {}), p.created);
    }
    for (const pr of pricesData.data) {
      db.prepare(`
        INSERT OR REPLACE INTO stripe_prices (id, product_id, currency, unit_amount, recurring_interval, active, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(pr.id, pr.product, pr.currency, pr.unit_amount, pr.recurring?.interval || null, pr.active ? 1 : 0);
    }

    res.json({ success: true, synced: { products: productsData.data.length, prices: pricesData.data.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function getStripeProducts(_req: Request, res: Response) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS stripe_products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, active INTEGER DEFAULT 1,
      metadata TEXT, created INTEGER, synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS stripe_prices (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, currency TEXT, unit_amount INTEGER,
      recurring_interval TEXT, active INTEGER DEFAULT 1, synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const products = db.prepare('SELECT * FROM stripe_products ORDER BY created DESC').all() as StripeProductRow[];
    const prices = db.prepare('SELECT * FROM stripe_prices ORDER BY unit_amount ASC').all() as StripePriceRow[];
    // Attach prices to products
    const result = products.map(p => ({
      ...p,
      prices: prices.filter(pr => pr.product_id === p.id),
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
}

interface StripeProduct { id: string; name: string; description?: string; active: boolean; metadata?: Record<string, string>; created: number; }
interface StripePrice { id: string; product: string; currency: string; unit_amount: number; recurring?: { interval: string }; active: boolean; }
interface StripeProductRow { id: string; name: string; description: string; active: number; metadata: string; created: number; synced_at: string; }
interface StripePriceRow { id: string; product_id: string; currency: string; unit_amount: number; recurring_interval: string | null; active: number; synced_at: string; }


export function getSubscriptions(_req: Request, res: Response) {
  try {
    const subs = db.prepare(`
      SELECT s.*, u.email, u.name, u.lifetime_access, p.name as plan_name, p.price_monthly
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      JOIN plans p ON s.plan_id = p.id
      ORDER BY s.started_at DESC
    `).all();
    res.json({ success: true, data: subs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
}
