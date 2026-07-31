/**
 * Business Cards Storefront API
 *
 * Customer endpoints:
 *   GET  /api/business-cards/feature-flag        — public, no auth
 *   GET  /api/business-cards                     — list my requests
 *   POST /api/business-cards                     — submit a request
 *   POST /api/business-cards/:id/approve         — approve proof
 *
 * Admin endpoints:
 *   GET  /api/admin/business-cards               — list all requests
 *   GET  /api/admin/business-cards/:id           — single request detail
 *   PUT  /api/admin/business-cards/:id           — update any field
 *   POST /api/admin/business-cards/:id/quote-price   — set full quoted price breakdown
 *   POST /api/admin/business-cards/:id/send-payment-link — record Stripe link sent
 *   POST /api/admin/business-cards/:id/mark-paid     — mark payment received
 *   POST /api/admin/business-cards/:id/upload-proof  — set proof URL
 *   PUT  /api/admin/business-cards/feature-flag  — toggle feature on/off
 *
 * Business model:
 *   - Customer submits a REQUEST (not an order). No payment at submission.
 *   - Admin reviews, builds a price (provider cost + delivery + VAT + design fee + handling).
 *   - Admin manually sends a Stripe payment link.
 *   - Customer pays. Admin marks paid. Design/print work begins.
 *   - Customer approves proof before provider order is placed.
 */
import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isBusinessCardsEnabled(): boolean {
  try {
    const row = db.prepare(`SELECT value FROM admin_settings WHERE key = 'business_cards_enabled'`).get() as { value: string } | undefined;
    return row?.value === '1';
  } catch { return false; }
}


// ── Feature flag (public) ─────────────────────────────────────────────────────

export async function getFeatureFlag(_req: Request, res: Response) {
  res.json({ enabled: isBusinessCardsEnabled() });
}

// ── Customer: list my requests ────────────────────────────────────────────────

export async function getMyOrders(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!isBusinessCardsEnabled()) return res.status(403).json({ error: 'Business cards are not currently available.' });
  const orders = db.prepare(`
    SELECT id, user_id, request_type, card_type, card_size, finish, corner_type, sides, quantity,
           customer_notes, name_on_card, business_name_on_card, role_on_card, phone_on_card,
           email_on_card, website_on_card, tagline_on_card, address_on_card, social_links,
           logo_url, front_bg_color, front_text_color, front_accent_color, font_choice,
           front_back_preference, qr_required, upload_front_url, upload_back_url, upload_file_type,
           custom_design_brief, custom_design_style, custom_design_colours, custom_design_fonts,
           custom_design_examples, template_id, template_data,
           status, stripe_invoice_url, stripe_invoice_status, dispatch_tracking,
           created_at, updated_at
    FROM business_card_orders WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId);
  res.json({ orders });
}

// ── Customer: submit a request ────────────────────────────────────────────────

export async function createOrder(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!isBusinessCardsEnabled()) return res.status(403).json({ error: 'Business cards are not currently available.' });

  const {
    request_type = 'builder',   // 'builder' | 'upload_own' | 'custom_design'
    card_type = 'standard',
    card_size = '85x55',
    finish = 'matte',
    corner_type = 'square',
    sides = 'double',
    quantity = 50,
    customer_notes,
    // Builder fields
    template_id,
    template_data,
    name_on_card,
    business_name_on_card,
    role_on_card,
    phone_on_card,
    email_on_card,
    website_on_card,
    tagline_on_card,
    address_on_card,
    social_links,
    logo_url,
    front_bg_color,
    front_text_color,
    front_accent_color,
    font_choice,
    front_back_preference,
    qr_required,
    // Upload own design fields
    upload_front_url,
    upload_back_url,
    upload_file_type,
    upload_urls,
    delivery_address,
    // Custom design fields
    brand_colors,
    style_preference,
  } = req.body;

  const result = db.prepare(`
    INSERT INTO business_card_orders
      (user_id, request_type, card_type, card_size, finish, corner_type, sides, quantity,
       has_own_design, upload_urls, customer_notes,
       template_id, template_data,
       name_on_card, business_name_on_card, role_on_card, phone_on_card, email_on_card,
       website_on_card, tagline_on_card, address_on_card, social_links,
       logo_url, front_bg_color, front_text_color, front_accent_color, font_choice,
       front_back_preference, qr_required,
       upload_front_url, upload_back_url, upload_file_type, delivery_address,
       brand_colors, style_preference,
       status, stripe_payment_status, design_fee_status, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 'not_sent', 'none', 'none')
  `).run(
    userId,
    request_type,
    card_type, card_size, finish, corner_type, sides, quantity,
    request_type === 'upload_own' ? 1 : 0,
    upload_urls ? JSON.stringify(upload_urls) : null,
    customer_notes ?? null,
    template_id ?? null,
    template_data ? JSON.stringify(template_data) : null,
    name_on_card ?? null, business_name_on_card ?? null, role_on_card ?? null,
    phone_on_card ?? null, email_on_card ?? null, website_on_card ?? null,
    tagline_on_card ?? null, address_on_card ?? null,
    social_links ? JSON.stringify(social_links) : null,
    logo_url ?? null,
    front_bg_color ?? null, front_text_color ?? null, front_accent_color ?? null,
    font_choice ?? 'Inter',
    front_back_preference ?? 'double',
    qr_required !== undefined ? (qr_required ? 1 : 0) : 1,
    upload_front_url ?? null, upload_back_url ?? null, upload_file_type ?? null,
    delivery_address ?? null,
    brand_colors ? JSON.stringify(brand_colors) : null,
    style_preference ?? null,
  );
  const order = db.prepare(`SELECT * FROM business_card_orders WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ order });
}

// ── Customer: approve proof ───────────────────────────────────────────────────

export async function approveOrder(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  const { orderId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const order = db.prepare(`SELECT * FROM business_card_orders WHERE id = ? AND user_id = ?`).get(orderId, userId) as any;
  if (!order) return res.status(404).json({ error: 'Request not found' });
  if (order.status !== 'awaiting_customer_approval') return res.status(400).json({ error: 'Request is not awaiting approval' });
  db.prepare(`
    UPDATE business_card_orders
    SET customer_approved = 1, customer_approved_at = CURRENT_TIMESTAMP,
        status = 'approved_for_print', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(orderId);
  res.json({ success: true });
}

// ── Legacy accept/decline fee (kept for compatibility) ────────────────────────

export async function acceptFee(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  const { orderId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const order = db.prepare(`SELECT * FROM business_card_orders WHERE id = ? AND user_id = ?`).get(orderId, userId) as any;
  if (!order) return res.status(404).json({ error: 'Request not found' });
  db.prepare(`UPDATE business_card_orders SET design_fee_status = 'accepted', fee_accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
  res.json({ success: true });
}

export async function declineFee(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  const { orderId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const order = db.prepare(`SELECT * FROM business_card_orders WHERE id = ? AND user_id = ?`).get(orderId, userId) as any;
  if (!order) return res.status(404).json({ error: 'Request not found' });
  db.prepare(`UPDATE business_card_orders SET design_fee_status = 'declined', fee_declined_at = CURRENT_TIMESTAMP, status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId);
  res.json({ success: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

/* ── Admin: list all requests ─────────────────────────────────────────────── */
export async function adminListOrders(req: Request, res: Response) {
  const { status, search } = req.query as Record<string, string>;
  let sql = `
    SELECT o.*, u.name as user_name, u.email as user_email, u.plan_id,
           p.name as plan_name
    FROM business_card_orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN plans p ON p.id = u.plan_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (status) { sql += ` AND o.status = ?`; params.push(status); }
  if (search) {
    sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR o.name_on_card LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY o.created_at DESC LIMIT 200`;
  const orders = db.prepare(sql).all(...params);
  res.json({ orders });
}

/* ── Admin: get single request ────────────────────────────────────────────── */
export async function adminGetOrder(req: Request, res: Response) {
  const { orderId } = req.params;
  const order = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email, u.plan_id,
           p.name as plan_name
    FROM business_card_orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN plans p ON p.id = u.plan_id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });
  res.json({ order });
}

/* ── Admin: update any field on a request ─────────────────────────────────── */
export async function adminUpdateOrder(req: Request, res: Response) {
  const { orderId } = req.params;
  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });

  const allowed = [
    'status', 'internal_notes', 'provider', 'provider_ref',
    'dispatch_tracking', 'stripe_payment_notes',
    'card_type', 'card_size', 'finish', 'corner_type', 'sides', 'quantity',
    'stripe_invoice_id', 'stripe_invoice_url', 'stripe_invoice_status',
    'stripe_invoice_line_items', 'stripe_invoice_due_date', 'stripe_invoice_notes',
    'artwork_prep_fee', 'logo_placement_fee', 'qr_setup_fee',
    'premium_finish_cost', 'rush_fee', 'design_deposit_amount',
  ];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(req.body[key]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(orderId);
  db.prepare(`UPDATE business_card_orders SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
}

/* ── Admin: enable final file access ─────────────────────────────────────── */
export async function adminEnableFinalFile(req: Request, res: Response) {
  const { orderId } = req.params;
  const { final_file_url, enabled } = req.body;
  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });
  db.prepare(`
    UPDATE business_card_orders
    SET final_file_enabled = ?, final_file_url = COALESCE(?, final_file_url),
        final_file_enabled_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE final_file_enabled_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(enabled ? 1 : 0, final_file_url ?? null, enabled ? 1 : 0, orderId);
  res.json({ success: true });
}

/* ── Admin: mark design deposit paid ─────────────────────────────────────── */
export async function adminMarkDepositPaid(req: Request, res: Response) {
  const { orderId } = req.params;
  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });
  db.prepare(`
    UPDATE business_card_orders
    SET design_deposit_paid = 1, design_deposit_paid_at = CURRENT_TIMESTAMP,
        status = 'design_work_can_start', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(orderId);
  res.json({ success: true });
}

/* ── Admin: set full quoted price breakdown ───────────────────────────────── */
export async function adminQuotePrice(req: Request, res: Response) {
  const { orderId } = req.params;
  const {
    provider_cost = 0,
    delivery_cost = 0,
    vat_amount = 0,
    design_fee_amount = 0,
    design_fee_description,
    handling_fee = 0,
    total_quoted,
    provider,
  } = req.body;

  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });

  const computed_total = total_quoted ?? (
    Number(provider_cost) + Number(delivery_cost) + Number(vat_amount) +
    Number(design_fee_amount) + Number(handling_fee)
  );

  db.prepare(`
    UPDATE business_card_orders
    SET provider_cost = ?, delivery_cost = ?, vat_amount = ?,
        design_fee_amount = ?, design_fee_description = ?,
        handling_fee = ?, total_quoted = ?,
        provider = COALESCE(?, provider),
        design_fee_status = CASE WHEN ? > 0 THEN 'quoted' ELSE design_fee_status END,
        status = 'price_quoted',
        stripe_payment_status = 'not_sent',
        stripe_amount_requested = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    Number(provider_cost), Number(delivery_cost), Number(vat_amount),
    Number(design_fee_amount), design_fee_description ?? null,
    Number(handling_fee), computed_total,
    provider ?? null,
    Number(design_fee_amount),
    computed_total,
    orderId,
  );
  res.json({ success: true, total_quoted: computed_total });
}

/* ── Admin: record Stripe payment link sent ───────────────────────────────── */
export async function adminSendPaymentLink(req: Request, res: Response) {
  const { orderId } = req.params;
  const { stripe_payment_link, stripe_payment_due_at, stripe_payment_notes } = req.body;
  if (!stripe_payment_link) return res.status(400).json({ error: 'stripe_payment_link is required' });

  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`
    UPDATE business_card_orders
    SET stripe_payment_link = ?, stripe_link_sent_at = CURRENT_TIMESTAMP,
        stripe_payment_due_at = ?, stripe_payment_notes = COALESCE(?, stripe_payment_notes),
        stripe_payment_status = 'link_sent',
        status = 'payment_link_sent',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(stripe_payment_link, stripe_payment_due_at ?? null, stripe_payment_notes ?? null, orderId);
  res.json({ success: true });
}

/* ── Admin: mark payment received ────────────────────────────────────────────*/
export async function adminMarkPaid(req: Request, res: Response) {
  const { orderId } = req.params;
  const { stripe_payment_ref, stripe_amount_paid, stripe_payment_notes } = req.body;

  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`
    UPDATE business_card_orders
    SET stripe_payment_status = 'paid',
        stripe_payment_ref = COALESCE(?, stripe_payment_ref),
        stripe_amount_paid = COALESCE(?, stripe_amount_paid),
        stripe_payment_notes = COALESCE(?, stripe_payment_notes),
        payment_received_at = CURRENT_TIMESTAMP,
        payment_status = 'paid',
        design_fee_status = 'paid',
        status = 'paid_design_can_start',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(stripe_payment_ref ?? null, stripe_amount_paid ?? null, stripe_payment_notes ?? null, orderId);
  res.json({ success: true });
}

/* ── Admin: upload / set proof URL ───────────────────────────────────────────*/
export async function adminUploadProof(req: Request, res: Response) {
  const { orderId } = req.params;
  const { proof_url } = req.body;
  if (!proof_url) return res.status(400).json({ error: 'proof_url is required' });

  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`
    UPDATE business_card_orders
    SET proof_url = ?, proof_sent_at = CURRENT_TIMESTAMP,
        status = 'awaiting_customer_approval', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(proof_url, orderId);
  res.json({ success: true });
}

/* ── Admin: toggle feature flag ──────────────────────────────────────────────*/
export async function adminToggleFeature(req: Request, res: Response) {
  const { enabled } = req.body;
  db.prepare(`INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('business_cards_enabled', ?, CURRENT_TIMESTAMP)`)
    .run(enabled ? '1' : '0');
  res.json({ enabled: !!enabled });
}

/* ── Legacy: quote design fee (kept for compatibility) ───────────────────────*/
export async function adminQuoteFee(req: Request, res: Response) {
  return adminQuotePrice(req, res);
}

/* ── Admin: generate Stripe Checkout Session for a business card order ───────
 * POST /api/admin/business-cards/:orderId/generate-checkout
 *
 * Reads the quoted total from the order, creates a Stripe Checkout Session,
 * saves the URL back to stripe_payment_link, and returns it so the admin can
 * copy/send it to the customer — or the UI can open it directly.
 */
export async function adminGenerateCheckout(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    const order = db.prepare(`
      SELECT bco.*, u.email AS customer_email, u.name AS customer_name
      FROM business_card_orders bco
      LEFT JOIN users u ON u.id = bco.user_id
      WHERE bco.id = ?
    `).get(orderId) as Record<string, unknown> | undefined;

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Determine amount — use computed_total if available, else total_quoted
    const amountPence = Math.round(
      Number((order.computed_total as number | null) ?? (order.total_quoted as number | null) ?? 0) * 100
    );

    if (!amountPence || amountPence < 50) {
      return res.status(400).json({ error: 'No quoted total set on this order. Run Quote Price first.' });
    }

    // Get Stripe secret key
    const keyRow = db.prepare("SELECT value FROM stripe_config WHERE key = 'stripe_secret_key'").get() as { value: string } | undefined;
    const secretKey = keyRow?.value;
    if (!secretKey) {
      return res.status(503).json({ error: 'Stripe is not configured. Add the Stripe secret key in Admin → Settings → Billing.' });
    }

    const origin = process.env.APP_URL || 'https://japrofilestudio.jagroupservices.co.uk';
    const successUrl = `${origin}/admin/business-cards?payment=success&order=${orderId}`;
    const cancelUrl  = `${origin}/admin/business-cards?payment=cancelled&order=${orderId}`;

    const description = `Business Card Order #${orderId}${order.customer_name ? ` — ${order.customer_name}` : ''}`;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('line_items[0][price_data][currency]', 'gbp');
    params.append('line_items[0][price_data][unit_amount]', String(amountPence));
    params.append('line_items[0][price_data][product_data][name]', description.slice(0, 127));
    params.append('line_items[0][price_data][product_data][description]', `Profile Centre — Business Card Order #${orderId}`);
    params.append('line_items[0][quantity]', '1');
    params.append('payment_method_types[0]', 'card');
    params.append('metadata[order_id]', String(orderId));
    params.append('metadata[source]', 'business_cards');

    const customerEmail = (order.customer_email as string | null)?.trim();
    if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      params.append('customer_email', customerEmail);
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json() as { id?: string; url?: string; error?: { message: string } };

    if (!stripeRes.ok || !session.url) {
      console.error('[BC generate-checkout] Stripe error:', session.error?.message);
      return res.status(502).json({ error: session.error?.message || 'Stripe could not create a checkout session.' });
    }

    // Save the generated URL back to the order
    db.prepare(`
      UPDATE business_card_orders
      SET stripe_payment_link = ?,
          stripe_link_sent_at = CURRENT_TIMESTAMP,
          stripe_payment_status = 'link_sent',
          status = 'payment_link_sent',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(session.url, orderId);

    return res.json({ success: true, checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[BC generate-checkout] error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
