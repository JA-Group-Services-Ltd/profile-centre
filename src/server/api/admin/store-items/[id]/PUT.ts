/**
 * PUT /api/admin/store-items/:id
 * Admin-only. Updates an existing points store item.
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

  const { title, description, cost, category, icon, color, is_active, repeatable, sort_order } = req.body as {
    title?: string; description?: string; cost?: number;
    category?: string; icon?: string; color?: string;
    is_active?: boolean; repeatable?: boolean; sort_order?: number;
  };

  if (title !== undefined && !title.trim()) return res.status(400).json({ success: false, error: 'title cannot be empty' });
  if (cost !== undefined && Number(cost) < 1) return res.status(400).json({ success: false, error: 'cost must be at least 1' });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined)       { fields.push('title = ?');       values.push(title.trim()); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description.trim()); }
  if (cost !== undefined)        { fields.push('cost = ?');        values.push(Number(cost)); }
  if (category !== undefined)    { fields.push('category = ?');    values.push(category.trim()); }
  if (icon !== undefined)        { fields.push('icon = ?');        values.push(icon.trim()); }
  if (color !== undefined)       { fields.push('color = ?');       values.push(color.trim()); }
  if (is_active !== undefined)   { fields.push('is_active = ?');   values.push(is_active ? 1 : 0); }
  if (repeatable !== undefined)  { fields.push('repeatable = ?');  values.push(repeatable ? 1 : 0); }
  if (sort_order !== undefined)  { fields.push('sort_order = ?');  values.push(Number(sort_order)); }

  if (fields.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE points_store_items SET ${fields.join(', ')} WHERE id = ?`).run(...values as Parameters<ReturnType<typeof db.prepare>['run']>);

  const item = db.prepare(`SELECT * FROM points_store_items WHERE id = ?`).get(id);
  res.json({ success: true, item });
}
