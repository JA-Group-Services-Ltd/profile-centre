/**
 * POST /api/admin/store-items
 * Admin-only. Creates a new points store item.
 * Body: { key, title, description, cost, category, icon, color, is_active, repeatable, sort_order }
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.js';
import db from '../../../db.js';
import { setupPointsTables } from '../../../lib/points-db-setup.js';

export default async function handler(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  setupPointsTables();

  const { key, title, description, cost, category, icon, color, is_active, repeatable, sort_order } = req.body as {
    key?: string; title?: string; description?: string; cost?: number;
    category?: string; icon?: string; color?: string;
    is_active?: boolean; repeatable?: boolean; sort_order?: number;
  };

  if (!key || !title) return res.status(400).json({ success: false, error: 'key and title are required' });
  if (!cost || cost < 1) return res.status(400).json({ success: false, error: 'cost must be at least 1' });

  // Validate key format
  if (!/^[a-z0-9_]+$/.test(key)) {
    return res.status(400).json({ success: false, error: 'key must be lowercase letters, numbers and underscores only' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO points_store_items (key, title, description, cost, category, icon, color, is_active, repeatable, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      key.trim(),
      title.trim(),
      (description ?? '').trim(),
      Number(cost),
      (category ?? 'feature').trim(),
      (icon ?? 'gift').trim(),
      (color ?? 'text-primary').trim(),
      is_active !== false ? 1 : 0,
      repeatable ? 1 : 0,
      Number(sort_order ?? 0),
    );

    const item = db.prepare(`SELECT * FROM points_store_items WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'A store item with that key already exists.' });
    console.error('[POST /api/admin/store-items]', err);
    res.status(500).json({ success: false, error: 'Failed to create store item' });
  }
}
