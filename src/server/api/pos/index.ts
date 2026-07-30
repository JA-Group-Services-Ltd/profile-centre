/**
 * POS (Point of Sale) API
 *
 * POST /api/pos/initiate
 *   Creates a Stripe Checkout Session for a custom amount/description.
 *   The user fills in the details in the dashboard POS page; Stripe handles
 *   the actual card collection and payment confirmation.
 *
 * GET  /api/pos/history
 *   Returns the authenticated user's POS transaction history.
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

async function getStripeSecretKey(): Promise<string | null> {
  try {
    const row = db.prepare("SELECT value FROM stripe_config WHERE key = 'stripe_secret_key'").get() as { value: string } | undefined;
    return row?.value || null;
  } catch {
    return null;
  }
}

// ── POST /api/pos/initiate ─────────────────────────────────────────────────────
export async function posInitiate(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const user = db.prepare('SELECT id, email, name, plan_id, stripe_customer_id FROM users WHERE id = ?').get(userId) as {
      id: number; email: string; name: string; plan_id: number | null; stripe_customer_id: string | null;
    } | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { amount_pence, description, customer_name, customer_email, reference, success_url, cancel_url } = req.body as {
      amount_pence?: number;
      description?: string;
      customer_name?: string;
      customer_email?: string;
      reference?: string;
      success_url?: string;
      cancel_url?: string;
    };

    // Validation
    if (!amount_pence || typeof amount_pence !== 'number' || amount_pence < 50) {
      return res.status(400).json({ success: false, error: 'Amount must be at least 50p (£0.50).' });
    }
    if (amount_pence > 99999900) {
      return res.status(400).json({ success: false, error: 'Amount cannot exceed £999,999.' });
    }
    if (!description || description.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Description is required (minimum 3 characters).' });
    }

    const secretKey = await getStripeSecretKey();
    if (!secretKey) {
      return res.status(503).json({ success: false, error: 'Payment processing is not configured. Please contact support.' });
    }

    const origin = process.env.APP_URL || 'https://japrofilestudio.jagroupservices.co.uk';
    const successUrl = success_url || `${origin}/dashboard/pos?payment=success&ref={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = cancel_url  || `${origin}/dashboard/pos?payment=cancelled`;

    // Build line item
    const lineItem = {
      price_data: {
        currency: 'gbp',
        unit_amount: String(Math.round(amount_pence)),
        product_data: {
          name: description.trim().slice(0, 127),
          ...(reference ? { description: `Ref: ${reference.trim().slice(0, 127)}` } : {}),
        },
      },
      quantity: '1',
    };

    // Build form body for Stripe
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('line_items[0][price_data][currency]', lineItem.price_data.currency);
    params.append('line_items[0][price_data][unit_amount]', lineItem.price_data.unit_amount);
    params.append('line_items[0][price_data][product_data][name]', lineItem.price_data.product_data.name);
    if (reference) {
      params.append('line_items[0][price_data][product_data][description]', `Ref: ${reference.trim().slice(0, 127)}`);
    }
    params.append('line_items[0][quantity]', '1');
    params.append('payment_method_types[0]', 'card');
    params.append('metadata[created_by_user_id]', String(userId));
    params.append('metadata[created_by_email]', user.email);
    if (reference) params.append('metadata[reference]', reference.trim().slice(0, 127));

    // Pre-fill customer email if provided
    const payEmail = customer_email?.trim() || '';
    if (payEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payEmail)) {
      params.append('customer_email', payEmail);
    }

    const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await checkoutRes.json() as {
      id?: string; url?: string; error?: { message: string };
    };

    if (!checkoutRes.ok || !session.url) {
      console.error('[POS] Stripe checkout session error:', session.error?.message);
      return res.status(502).json({ success: false, error: session.error?.message || 'Could not create payment session.' });
    }

    // Log to POS history table (create if not exists)
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS pos_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          stripe_session_id TEXT NOT NULL,
          amount_pence INTEGER NOT NULL,
          description TEXT NOT NULL,
          customer_name TEXT,
          customer_email TEXT,
          reference TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      db.prepare(`
        INSERT INTO pos_transactions (user_id, stripe_session_id, amount_pence, description, customer_name, customer_email, reference, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        userId,
        session.id!,
        Math.round(amount_pence),
        description.trim(),
        customer_name?.trim() || null,
        payEmail || null,
        reference?.trim() || null,
      );
    } catch (dbErr) {
      console.error('[POS] Failed to log transaction:', dbErr);
      // Non-fatal — still return the checkout URL
    }

    writeAudit({
      actorId: userId,
      actorName: user.name,
      actorEmail: user.email,
      actorType: 'user',
      tenant: 'customer',
      authProvider: 'oidc',
      action: 'pos_initiate',
      resourceType: 'pos_transaction',
      resourceId: session.id!,
      resourceLabel: description.trim(),
      details: `POS payment initiated: £${(amount_pence / 100).toFixed(2)} — ${description.trim()}${reference ? ` (ref: ${reference})` : ''}`,
      ipAddress: req.ip,
      result: 'success',
    });

    return res.json({ success: true, checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[POS] posInitiate error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ── GET /api/pos/history ───────────────────────────────────────────────────────
export async function posHistory(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    // Table may not exist yet on first visit
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS pos_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          stripe_session_id TEXT NOT NULL,
          amount_pence INTEGER NOT NULL,
          description TEXT NOT NULL,
          customer_name TEXT,
          customer_email TEXT,
          reference TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
    } catch { /* already exists */ }

    const rows = db.prepare(`
      SELECT id, stripe_session_id, amount_pence, description, customer_name, customer_email, reference, status, created_at
      FROM pos_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(userId);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[POS] posHistory error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
