/**
 * GET /api/admin/store-items
 * Admin-only. Returns all points store items (active + inactive).
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.js';
import db from '../../../db.js';
import { setupPointsTables } from '../../../lib/points-db-setup.js';

export default async function handler(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  setupPointsTables();
  const items = db.prepare(`SELECT * FROM points_store_items ORDER BY sort_order ASC, id ASC`).all();
  res.json({ success: true, items });
}
