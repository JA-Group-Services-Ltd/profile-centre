/**
 * Admin — IP Blocking API
 *
 * GET    /api/admin/ip-blocks              — list all blocked IPs
 * POST   /api/admin/ip-blocks              — block an IP
 * DELETE /api/admin/ip-blocks/:id          — unblock an IP
 * GET    /api/admin/ip-blocks/check?ip=    — check if an IP is blocked
 * GET    /api/admin/moderation-log         — full moderation action log
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

type AdminReq = Request & { user?: { id: number; name: string; email: string } };

// ─── List blocked IPs ─────────────────────────────────────────────────────────

export function listBlockedIps(req: Request, res: Response) {
  try {
    const rows = db.prepare(`
      SELECT b.*, t.sender_name, t.sender_email
      FROM blocked_ips b
      LEFT JOIN card_message_threads t ON b.thread_id = t.id
      ORDER BY b.created_at DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Block an IP ──────────────────────────────────────────────────────────────

export function blockIp(req: AdminReq, res: Response) {
  try {
    const { ip_address, reason, thread_id, expires_hours } = req.body;
    if (!ip_address?.trim()) return res.status(400).json({ success: false, error: 'IP address required' });

    const admin = req.user;
    const expiresAt = expires_hours
      ? new Date(Date.now() + Number(expires_hours) * 3600 * 1000).toISOString()
      : null;

    try {
      db.prepare(`
        INSERT INTO blocked_ips (ip_address, reason, blocked_by_admin_id, blocked_by_name, thread_id, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        ip_address.trim(),
        reason?.trim() || 'Blocked by admin',
        admin?.id ?? null,
        admin?.name ?? 'Admin',
        thread_id ?? null,
        expiresAt
      );
    } catch {
      // Already blocked — update reason
      db.prepare(`
        UPDATE blocked_ips SET reason = ?, blocked_by_admin_id = ?, blocked_by_name = ?, expires_at = ?, created_at = CURRENT_TIMESTAMP
        WHERE ip_address = ?
      `).run(reason?.trim() || 'Blocked by admin', admin?.id ?? null, admin?.name ?? 'Admin', expiresAt, ip_address.trim());
    }

    // Log moderation action
    db.prepare(`
      INSERT INTO moderation_actions (admin_id, admin_name, action, target_type, target_id, notes)
      VALUES (?, ?, 'block_ip', 'ip', ?, ?)
    `).run(admin?.id ?? null, admin?.name ?? 'Admin', ip_address.trim(), reason?.trim() || null);

    writeAudit({
      actorId: admin?.id ?? 0,
      actorName: admin?.name,
      actorEmail: admin?.email ?? 'unknown',
      actorType: 'admin',
      action: 'ip_blocked',
      resourceType: 'ip',
      resourceId: ip_address.trim(),
      details: `IP ${ip_address.trim()} blocked. Reason: ${reason || 'none'}`,
      result: 'success',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Unblock an IP ────────────────────────────────────────────────────────────

export function unblockIp(req: AdminReq, res: Response) {
  try {
    const { id } = req.params;
    const admin = req.user;

    const row = db.prepare('SELECT ip_address FROM blocked_ips WHERE id = ?').get(id) as { ip_address: string } | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Block record not found' });

    db.prepare('DELETE FROM blocked_ips WHERE id = ?').run(id);

    db.prepare(`
      INSERT INTO moderation_actions (admin_id, admin_name, action, target_type, target_id, notes)
      VALUES (?, ?, 'unblock_ip', 'ip', ?, ?)
    `).run(admin?.id ?? null, admin?.name ?? 'Admin', row.ip_address, 'Unblocked by admin');

    writeAudit({
      actorId: admin?.id ?? 0,
      actorName: admin?.name,
      actorEmail: admin?.email ?? 'unknown',
      actorType: 'admin',
      action: 'ip_unblocked',
      resourceType: 'ip',
      resourceId: row.ip_address,
      details: `IP ${row.ip_address} unblocked`,
      result: 'success',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Check if IP is blocked ───────────────────────────────────────────────────

export function checkIpBlocked(req: Request, res: Response) {
  try {
    const { ip } = req.query;
    if (!ip) return res.status(400).json({ success: false, error: 'ip query param required' });

    const row = db.prepare(`
      SELECT * FROM blocked_ips
      WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `).get(String(ip)) as Record<string, unknown> | undefined;

    res.json({ success: true, blocked: !!row, data: row ?? null });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Moderation action log ────────────────────────────────────────────────────

export function getModerationLog(req: Request, res: Response) {
  try {
    const rows = db.prepare(`
      SELECT * FROM moderation_actions ORDER BY created_at DESC LIMIT 500
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Shared: is IP currently blocked (used by middleware) ────────────────────

export function isIpBlocked(ip: string): boolean {
  try {
    const row = db.prepare(`
      SELECT id FROM blocked_ips
      WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `).get(ip);
    return !!row;
  } catch {
    return false;
  }
}
