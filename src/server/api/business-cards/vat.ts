/**
 * VAT Settings API
 * GET /api/admin/business-cards/vat-settings
 * PUT /api/admin/business-cards/vat-settings
 */
import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';

export async function getVatSettings(_req: Request, res: Response) {
  const settings = db.prepare(`SELECT * FROM vat_settings WHERE id = 1`).get();
  res.json({ settings: settings ?? { vat_enabled: 0 } });
}

export async function updateVatSettings(req: AuthRequest, res: Response) {
  const {
    vat_enabled, vat_number, vat_rate, vat_wording_invoice, vat_wording_quote,
    vat_shown_separately, vat_applies_to_delivery, vat_applies_to_design_fee,
    vat_invoice_notes,
  } = req.body;

  const current = db.prepare(`SELECT vat_enabled FROM vat_settings WHERE id = 1`).get() as any;
  const wasEnabled = current?.vat_enabled === 1;
  const nowEnabled = vat_enabled ? 1 : 0;

  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const vals: any[] = [];

  if (vat_enabled !== undefined) { sets.push('vat_enabled = ?'); vals.push(nowEnabled); }
  if (vat_number !== undefined) { sets.push('vat_number = ?'); vals.push(vat_number); }
  if (vat_rate !== undefined) { sets.push('vat_rate = ?'); vals.push(Number(vat_rate)); }
  if (vat_wording_invoice !== undefined) { sets.push('vat_wording_invoice = ?'); vals.push(vat_wording_invoice); }
  if (vat_wording_quote !== undefined) { sets.push('vat_wording_quote = ?'); vals.push(vat_wording_quote); }
  if (vat_shown_separately !== undefined) { sets.push('vat_shown_separately = ?'); vals.push(vat_shown_separately ? 1 : 0); }
  if (vat_applies_to_delivery !== undefined) { sets.push('vat_applies_to_delivery = ?'); vals.push(vat_applies_to_delivery ? 1 : 0); }
  if (vat_applies_to_design_fee !== undefined) { sets.push('vat_applies_to_design_fee = ?'); vals.push(vat_applies_to_design_fee ? 1 : 0); }
  if (vat_invoice_notes !== undefined) { sets.push('vat_invoice_notes = ?'); vals.push(vat_invoice_notes); }

  // Record who enabled VAT and when
  if (!wasEnabled && nowEnabled) {
    sets.push('vat_enabled_at = CURRENT_TIMESTAMP');
    sets.push('vat_enabled_by_admin_id = ?'); vals.push(req.user?.id ?? null);
    sets.push('vat_enabled_by_admin_name = ?'); vals.push(req.user?.name ?? null);
  }

  vals.push(1); // WHERE id = 1
  db.prepare(`UPDATE vat_settings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  const updated = db.prepare(`SELECT * FROM vat_settings WHERE id = 1`).get();
  res.json({ settings: updated });
}
