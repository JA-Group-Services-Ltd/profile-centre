/**
 * Card Templates API
 * GET  /api/business-cards/templates        — public list of active templates
 * GET  /api/admin/business-cards/templates  — admin: all templates
 * POST /api/admin/business-cards/templates  — admin: create template
 * PUT  /api/admin/business-cards/templates/:id — admin: update template
 */
import type { Request, Response } from 'express';
import db from '../../db.js';

export async function getPublicTemplates(_req: Request, res: Response) {
  const templates = db.prepare(`
    SELECT * FROM card_templates WHERE status = 'active' ORDER BY sort_order ASC
  `).all();
  res.json({ templates });
}

export async function adminGetTemplates(_req: Request, res: Response) {
  const templates = db.prepare(`SELECT * FROM card_templates ORDER BY sort_order ASC`).all();
  res.json({ templates });
}

export async function adminCreateTemplate(req: Request, res: Response) {
  const { slug, name, description, front_bg_color, front_text_color, front_accent_color,
    back_bg_color, back_text_color, layout_style, sort_order, is_premium } = req.body;
  if (!slug || !name) return res.status(400).json({ error: 'slug and name are required' });
  try {
    const result = db.prepare(`
      INSERT INTO card_templates (slug, name, description, front_bg_color, front_text_color, front_accent_color,
        back_bg_color, back_text_color, layout_style, sort_order, is_premium)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, name, description ?? null, front_bg_color ?? '#ffffff', front_text_color ?? '#000000',
      front_accent_color ?? '#2563eb', back_bg_color ?? '#ffffff', back_text_color ?? '#000000',
      layout_style ?? 'classic', sort_order ?? 99, is_premium ? 1 : 0);
    const template = db.prepare(`SELECT * FROM card_templates WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ template });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: 'Failed to create template' });
  }
}

export async function adminUpdateTemplate(req: Request, res: Response) {
  const { id } = req.params;
  const allowed = ['name', 'description', 'status', 'is_premium', 'front_bg_color', 'front_text_color',
    'front_accent_color', 'back_bg_color', 'back_text_color', 'layout_style', 'sort_order', 'supports_back'];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { sets.push(`${key} = ?`); vals.push(req.body[key]); }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No valid fields' });
  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  db.prepare(`UPDATE card_templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  const template = db.prepare(`SELECT * FROM card_templates WHERE id = ?`).get(id);
  res.json({ template });
}
