/**
 * DELETE /api/admin/store-items/:id
 * Admin-only. Deletes a points store item.
 * Note: existing redemptions are preserved (orphaned perk_key is fine — historical record).
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../../../middleware/auth.js';
import db from '../../../../db.js';

export default async function handler(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

  const existing = db.prepare(`SELECT id FROM points_store_items WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ success: false, error: 'Store item not found' });

  db.prepare(`DELETE FROM points_store_items WHERE id = ?`).run(id);
  res.json({ success: true });
}
