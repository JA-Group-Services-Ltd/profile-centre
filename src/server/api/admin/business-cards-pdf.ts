/**
 * GET /api/admin/business-cards/:orderId/pdf
 * Admin-only: generate a PDF summary of a business card order.
 * Uses pdf-lib (no external font files needed in prod bundle).
 */
import type { Request, Response } from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import db from '../../db.js';

const C_DARK  = rgb(0.10, 0.12, 0.20);
const C_MID   = rgb(0.35, 0.40, 0.50);
const C_BLUE  = rgb(0.14, 0.38, 0.93);
const C_WHITE = rgb(1, 1, 1);
const C_LIGHT = rgb(0.95, 0.96, 0.98);

export async function adminBusinessCardPdf(req: Request, res: Response) {
  const { orderId } = req.params;

  const order = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email, p.name as plan_name
    FROM business_card_orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN plans p ON p.id = u.plan_id
    WHERE o.id = ?
  `).get(orderId) as any;

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const messages = db.prepare(`
    SELECT * FROM business_card_messages WHERE order_id = ? ORDER BY created_at ASC
  `).all(orderId) as any[];

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([595, 842]); // A4
  const { width } = page.getSize();
  let y = 800;
  const L = 50;
  const R = width - 50;

  const newPage = () => {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < 60) newPage();
  };

  const line = (x1: number, y1: number, x2: number, y2: number, color = C_LIGHT, thickness = 1) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  };

  const text = (str: string, x: number, size: number, font = fontR, color = C_DARK, maxWidth = R - x) => {
    ensureSpace(size + 6);
    // Truncate if too long
    let s = str;
    while (s.length > 1 && font.widthOfTextAtSize(s, size) > maxWidth) {
      s = s.slice(0, -4) + '…';
    }
    page.drawText(s, { x, y, size, font, color });
    y -= size + 6;
  };

  const row = (label: string, value: string) => {
    ensureSpace(14);
    page.drawText(label, { x: L, y, size: 9, font: fontB, color: C_MID });
    page.drawText(String(value || '—').slice(0, 80), { x: L + 160, y, size: 9, font: fontR, color: C_DARK });
    y -= 14;
  };

  const sectionHeader = (title: string) => {
    ensureSpace(28);
    y -= 6;
    page.drawRectangle({ x: L, y: y - 4, width: R - L, height: 20, color: C_BLUE });
    page.drawText(title, { x: L + 8, y: y + 2, size: 10, font: fontB, color: C_WHITE });
    y -= 24;
  };

  // ── Header ─────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: C_BLUE });
  page.drawText('Sousa Murray Profiles — Business Card Order', { x: L, y: 815, size: 14, font: fontB, color: C_WHITE });
  page.drawText(`Order #${order.id}`, { x: R - 80, y: 815, size: 11, font: fontR, color: C_WHITE });
  y = 790;

  text(`Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}`, L, 8, fontR, C_MID);
  y -= 4;

  // ── Customer ───────────────────────────────────────────────────────────────
  sectionHeader('Customer');
  row('Name', order.user_name ?? '—');
  row('Email', order.user_email ?? '—');
  row('Plan', order.plan_name ?? 'No plan');

  // ── Request details ────────────────────────────────────────────────────────
  sectionHeader('Request Details');
  row('Status', order.status ?? '—');
  row('Submitted', order.created_at ? new Date(order.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : '—');
  row('Card type', order.card_type ?? '—');
  row('Card size', order.card_size ?? '—');
  row('Finish', order.finish ?? '—');
  row('Corners', order.corner_type ?? '—');
  row('Sides', order.sides ?? '—');
  row('Quantity', String(order.quantity ?? '—'));
  row('Design option', order.has_own_design ? 'Customer uploading own design' : 'Sousa Murray Profiles to create design');

  // ── Card content ───────────────────────────────────────────────────────────
  sectionHeader('Card Content');
  row('Name on card', order.name_on_card ?? '—');
  row('Role / title', order.role_on_card ?? '—');
  row('Phone', order.phone_on_card ?? '—');
  row('Email', order.email_on_card ?? '—');
  row('Website', order.website_on_card ?? '—');
  row('Tagline', order.tagline_on_card ?? '—');

  if (order.customer_notes) {
    ensureSpace(20);
    page.drawText('Customer notes:', { x: L, y, size: 9, font: fontB, color: C_MID });
    y -= 14;
    // Wrap notes
    const words = order.customer_notes.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (fontR.widthOfTextAtSize(test, 9) > R - L - 10) {
        ensureSpace(14);
        page.drawText(currentLine, { x: L + 10, y, size: 9, font: fontR, color: C_DARK });
        y -= 14;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) {
      ensureSpace(14);
      page.drawText(currentLine, { x: L + 10, y, size: 9, font: fontR, color: C_DARK });
      y -= 14;
    }
  }

  // ── Pricing ────────────────────────────────────────────────────────────────
  sectionHeader('Pricing & Payment');
  row('Provider', order.provider ?? '—');
  row('Provider cost', order.provider_cost > 0 ? `£${Number(order.provider_cost).toFixed(2)}` : '—');
  row('Delivery cost', order.delivery_cost > 0 ? `£${Number(order.delivery_cost).toFixed(2)}` : '—');
  row('VAT', order.vat_amount > 0 ? `£${Number(order.vat_amount).toFixed(2)}` : '—');
  row('Design fee', order.design_fee_amount > 0 ? `£${Number(order.design_fee_amount).toFixed(2)}${order.design_fee_description ? ` (${order.design_fee_description})` : ''}` : '—');
  row('Handling fee', order.handling_fee > 0 ? `£${Number(order.handling_fee).toFixed(2)}` : '—');
  ensureSpace(16);
  page.drawText('TOTAL QUOTED', { x: L, y, size: 10, font: fontB, color: C_DARK });
  page.drawText(order.total_quoted > 0 ? `£${Number(order.total_quoted).toFixed(2)}` : '—', { x: L + 160, y, size: 10, font: fontB, color: C_BLUE });
  y -= 16;

  // ── Stripe ─────────────────────────────────────────────────────────────────
  sectionHeader('Stripe Payment');
  row('Payment status', order.stripe_payment_status ?? 'not_sent');
  row('Amount requested', order.stripe_amount_requested > 0 ? `£${Number(order.stripe_amount_requested).toFixed(2)}` : '—');
  row('Amount paid', order.stripe_amount_paid > 0 ? `£${Number(order.stripe_amount_paid).toFixed(2)}` : '—');
  row('Payment ref', order.stripe_payment_ref ?? '—');
  row('Payment received', order.payment_received_at ? new Date(order.payment_received_at).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : '—');
  if (order.stripe_payment_link) {
    row('Payment link', order.stripe_payment_link.slice(0, 60));
  }

  // ── Proof ──────────────────────────────────────────────────────────────────
  sectionHeader('Proof & Approval');
  row('Proof URL', order.proof_url ? order.proof_url.slice(0, 60) : '—');
  row('Customer approved', order.customer_approved ? `Yes — ${order.customer_approved_at ? new Date(order.customer_approved_at).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : 'date unknown'}` : 'No');

  // ── Fulfilment ─────────────────────────────────────────────────────────────
  sectionHeader('Fulfilment');
  row('Provider ref', order.provider_ref ?? '—');
  row('Dispatch tracking', order.dispatch_tracking ?? '—');

  // ── Internal notes ─────────────────────────────────────────────────────────
  if (order.internal_notes) {
    sectionHeader('Internal Notes (Admin Only)');
    const words = order.internal_notes.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (fontR.widthOfTextAtSize(test, 9) > R - L - 10) {
        ensureSpace(14);
        page.drawText(currentLine, { x: L, y, size: 9, font: fontR, color: C_DARK });
        y -= 14;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) {
      ensureSpace(14);
      page.drawText(currentLine, { x: L, y, size: 9, font: fontR, color: C_DARK });
      y -= 14;
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────
  if (messages.length > 0) {
    sectionHeader(`Message Thread (${messages.length} messages)`);
    for (const msg of messages) {
      ensureSpace(40);
      const prefix = msg.sender_type === 'admin' ? '[ADMIN]' : '[CUSTOMER]';
      const ts = new Date(msg.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' });
      page.drawText(`${prefix} ${msg.sender_name} — ${ts}`, { x: L, y, size: 8, font: fontB, color: msg.sender_type === 'admin' ? C_BLUE : C_DARK });
      y -= 12;
      // Wrap message
      const words = msg.message.split(' ');
      let currentLine = '';
      for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word;
        if (fontR.widthOfTextAtSize(test, 8) > R - L - 10) {
          ensureSpace(12);
          page.drawText(currentLine, { x: L + 10, y, size: 8, font: fontR, color: C_DARK });
          y -= 12;
          currentLine = word;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) {
        ensureSpace(12);
        page.drawText(currentLine, { x: L + 10, y, size: 8, font: fontR, color: C_DARK });
        y -= 12;
      }
      y -= 4;
      line(L, y, R, y, C_LIGHT);
      y -= 6;
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const pg = pdfDoc.getPage(i);
    pg.drawText(`Sousa Murray Profiles — Business Card Order #${order.id} — CONFIDENTIAL`, { x: L, y: 30, size: 7, font: fontR, color: C_MID });
    pg.drawText(`Page ${i + 1} of ${pageCount}`, { x: R - 50, y: 30, size: 7, font: fontR, color: C_MID });
  }

  const pdfBytes = await pdfDoc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bc-order-${order.id}.pdf"`);
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
}
