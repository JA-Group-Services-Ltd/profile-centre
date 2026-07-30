/**
 * Admin Add-On Management API
 *
 * Endpoints:
 *  GET    /api/admin/addons                        — list all add-ons
 *  POST   /api/admin/addons                        — create add-on
 *  PATCH  /api/admin/addons/:id                    — edit add-on (price, name, active, etc.)
 *  DELETE /api/admin/addons/:id                    — delete add-on (only if no active assignments)
 *
 *  GET    /api/admin/addons/:id/customers          — list customers with this add-on
 *  POST   /api/admin/addons/assign                 — assign add-on to customer
 *  DELETE /api/admin/addons/assign/:userId/:addonId — remove add-on from customer
 *
 *  GET    /api/admin/addons/customer/:userId       — list add-ons for a specific customer
 *  PATCH  /api/admin/addons/assign/:userId/:addonId — update assignment status
 */
import type { Request, Response } from 'express';
import db from '../../db.js';

function logAudit(action: string, details: string, adminId?: number, adminName?: string, userId?: number) {
  try {
    db.prepare(`
      INSERT INTO audit_log (actor_type, actor_id, actor_name, action, resource_type, details, result, user_id)
      VALUES ('admin', ?, ?, ?, 'addon', ?, 'success', ?)
    `).run(adminId ?? null, adminName ?? 'admin', action, details, userId ?? null);
  } catch { /* audit table may not have all columns */ }
}

// ── List all add-ons ──────────────────────────────────────────────────────
export async function listAddons(_req: Request, res: Response) {
  try {
    const addons = db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM customer_addons ca WHERE ca.addon_id = a.id AND ca.status = 'active') AS active_customer_count
      FROM addons a
      ORDER BY a.sort_order ASC, a.name ASC
    `).all();
    res.json({ success: true, data: addons });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Create add-on ─────────────────────────────────────────────────────────
export async function createAddon(req: Request, res: Response) {
  try {
    const { slug, name, description, price, billing_interval, is_active, is_visible, sort_order } = req.body;
    if (!slug?.trim() || !name?.trim()) {
      return res.status(400).json({ success: false, error: 'slug and name are required' });
    }
    const existing = db.prepare('SELECT id FROM addons WHERE slug = ?').get(slug.trim());
    if (existing) return res.status(409).json({ success: false, error: 'An add-on with this slug already exists' });

    const result = db.prepare(`
      INSERT INTO addons (slug, name, description, price, billing_interval, is_active, is_visible, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slug.trim(), name.trim(), description ?? null,
      price ?? 0, billing_interval ?? 'monthly',
      is_active !== false ? 1 : 0,
      is_visible !== false ? 1 : 0,
      sort_order ?? 99,
    );
    const admin = (req as Request & { admin?: { id: number; name: string } }).admin;
    logAudit('addon_created', `Add-on "${name}" (${slug}) created`, admin?.id, admin?.name);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Edit add-on ───────────────────────────────────────────────────────────
export async function updateAddon(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, price, billing_interval, is_active, is_visible, sort_order } = req.body;
    const existing = db.prepare('SELECT * FROM addons WHERE id = ?').get(id) as { name: string } | undefined;
    if (!existing) return res.status(404).json({ success: false, error: 'Add-on not found' });

    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const vals: unknown[] = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (price !== undefined) { sets.push('price = ?'); vals.push(price); }
    if (billing_interval !== undefined) { sets.push('billing_interval = ?'); vals.push(billing_interval); }
    if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
    if (is_visible !== undefined) { sets.push('is_visible = ?'); vals.push(is_visible ? 1 : 0); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }

    db.prepare(`UPDATE addons SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    const admin = (req as Request & { admin?: { id: number; name: string } }).admin;
    logAudit('addon_updated', `Add-on ID ${id} updated`, admin?.id, admin?.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Delete add-on ─────────────────────────────────────────────────────────
export async function deleteAddon(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const activeCount = (db.prepare(`
      SELECT COUNT(*) AS c FROM customer_addons WHERE addon_id = ? AND status = 'active'
    `).get(id) as { c: number }).c;
    if (activeCount > 0) {
      return res.status(409).json({ success: false, error: `Cannot delete — ${activeCount} customer(s) have this add-on active. Remove all assignments first.` });
    }
    db.prepare('DELETE FROM addons WHERE id = ?').run(id);
    const admin = (req as Request & { admin?: { id: number; name: string } }).admin;
    logAudit('addon_deleted', `Add-on ID ${id} deleted`, admin?.id, admin?.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── List customers with a specific add-on ─────────────────────────────────
export async function listAddonCustomers(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const rows = db.prepare(`
      SELECT ca.*, u.name AS user_name, u.email AS user_email
      FROM customer_addons ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.addon_id = ?
      ORDER BY ca.assigned_at DESC
    `).all(id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Assign add-on to customer ─────────────────────────────────────────────
export async function assignAddon(req: Request, res: Response) {
  try {
    const { user_id, addon_id, expires_at, notes } = req.body;
    if (!user_id || !addon_id) {
      return res.status(400).json({ success: false, error: 'user_id and addon_id are required' });
    }
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(user_id) as { id: number; name: string; email: string } | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const addon = db.prepare('SELECT id, name, slug FROM addons WHERE id = ?').get(addon_id) as { id: number; name: string; slug: string } | undefined;
    if (!addon) return res.status(404).json({ success: false, error: 'Add-on not found' });

    const admin = (req as Request & { admin?: { id: number; name: string } }).admin;

    // Upsert — if already assigned, reactivate
    db.prepare(`
      INSERT INTO customer_addons (user_id, addon_id, status, assigned_by, expires_at, notes)
      VALUES (?, ?, 'active', ?, ?, ?)
      ON CONFLICT(user_id, addon_id) DO UPDATE SET
        status = 'active',
        assigned_by = excluded.assigned_by,
        assigned_at = CURRENT_TIMESTAMP,
        expires_at = excluded.expires_at,
        notes = excluded.notes,
        cancelled_at = NULL
    `).run(user_id, addon_id, admin?.name ?? 'admin', expires_at ?? null, notes ?? null);

    logAudit('addon_assigned', `Add-on "${addon.name}" assigned to user ${user.email}`, admin?.id, admin?.name, user_id);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Remove add-on from customer ───────────────────────────────────────────
export async function removeAddonFromCustomer(req: Request, res: Response) {
  try {
    const { userId, addonId } = req.params;
    const addon = db.prepare('SELECT id, name, slug FROM addons WHERE id = ?').get(addonId) as { id: number; name: string; slug: string } | undefined;
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as { id: number; email: string } | undefined;

    db.prepare(`
      UPDATE customer_addons SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND addon_id = ?
    `).run(userId, addonId);

    const admin = (req as Request & { admin?: { id: number; name: string } }).admin;
    logAudit('addon_removed', `Add-on "${addon?.name ?? addonId}" removed from user ${user?.email ?? userId}`, admin?.id, admin?.name, Number(userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Update assignment status ──────────────────────────────────────────────
export async function updateAddonAssignment(req: Request, res: Response) {
  try {
    const { userId, addonId } = req.params;
    const { status, notes, expires_at } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (status) { sets.push('status = ?'); vals.push(status); }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes); }
    if (expires_at !== undefined) { sets.push('expires_at = ?'); vals.push(expires_at); }
    if (status === 'cancelled') { sets.push('cancelled_at = CURRENT_TIMESTAMP'); }
    if (!sets.length) return res.status(400).json({ success: false, error: 'Nothing to update' });

    db.prepare(`UPDATE customer_addons SET ${sets.join(', ')} WHERE user_id = ? AND addon_id = ?`).run(...vals, userId, addonId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── List add-ons for a specific customer ──────────────────────────────────
export async function getCustomerAddons(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const rows = db.prepare(`
      SELECT ca.*, a.name AS addon_name, a.slug AS addon_slug,
             a.description AS addon_description, a.price AS addon_price,
             a.billing_interval AS addon_billing_interval
      FROM customer_addons ca
      JOIN addons a ON ca.addon_id = a.id
      WHERE ca.user_id = ?
      ORDER BY ca.assigned_at DESC
    `).all(userId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
