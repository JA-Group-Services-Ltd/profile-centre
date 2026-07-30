/**
 * Admin notification management API.
 *
 * POST /api/admin/notifications/send
 *   Send a notification to: a specific user (by ID or email search),
 *   all users with a given role, or all users. Admin-only.
 *
 * GET  /api/admin/notifications
 *   List recently sent notifications (admin view).
 *
 * GET  /api/admin/notifications/user-search?q=...
 *   Search users by name or email for the "single user" target selector.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { broadcastNotification } from '../../lib/sse.js';

const VALID_TYPES = [
  'service_update', 'account', 'account_update',
  'billing', 'payment', 'security', 'security_alert',
  'support', 'support_reply', 'warning', 'info',
];

/** Search users by name or email — for the single-user target picker */
export async function adminSearchUsers(req: Request, res: Response) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ success: true, data: [] });

    const rows = db.prepare(`
      SELECT id, name, email, role, plan_id
      FROM users
      WHERE role = 'member'
        AND (name LIKE ? OR email LIKE ?)
      ORDER BY name ASC
      LIMIT 10
    `).all(`%${q}%`, `%${q}%`) as { id: number; name: string; email: string; role: string; plan_id: number | null }[];

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminSendNotification(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user as { id: number; email: string; name: string } | undefined;
    const { target, userId, role, type, title, body, link } = req.body as {
      target: 'user' | 'role' | 'all';
      userId?: number;
      role?: string;
      type: string;
      title: string;
      body?: string;
      link?: string;
    };

    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Title is required' });
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ success: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    if (!['user', 'role', 'all'].includes(target)) return res.status(400).json({ success: false, error: 'target must be user, role, or all' });
    if (target === 'user' && !userId) return res.status(400).json({ success: false, error: 'userId required when target=user' });
    if (target === 'role' && !role) return res.status(400).json({ success: false, error: 'role required when target=role' });

    // Resolve recipient user IDs
    let recipientIds: number[] = [];
    if (target === 'user') {
      const u = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
      if (!u) return res.status(404).json({ success: false, error: 'User not found' });
      recipientIds = [u.id];
    } else if (target === 'role') {
      const rows = db.prepare('SELECT id FROM users WHERE role = ?').all(role) as { id: number }[];
      recipientIds = rows.map(r => r.id);
    } else {
      const rows = db.prepare("SELECT DISTINCT id FROM users WHERE role = 'member'").all() as { id: number }[];
      recipientIds = rows.map(r => r.id);
    }

    if (recipientIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No matching recipients found' });
    }

    // Insert notifications in a transaction
    const insert = db.prepare(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((ids: number[]) => {
      for (const uid of ids) {
        insert.run(uid, type, title.trim(), body?.trim() || null, link?.trim() || null);
      }
    });
    insertMany(recipientIds);

    // Push live SSE update to connected clients
    for (const uid of recipientIds) {
      broadcastNotification(uid);
    }

    // Audit log
    writeAudit({
      actorId: adminUser?.id ?? 0,
      actorName: adminUser?.name,
      actorEmail: adminUser?.email ?? 'unknown',
      actorType: 'admin',
      action: 'admin_notification_sent',
      resourceType: target === 'user' ? 'user' : 'platform',
      resourceId: target === 'user' ? String(userId) : null,
      details: JSON.stringify({ target, role: role ?? null, type, title, recipientCount: recipientIds.length }),
      result: 'success',
    });

    return res.json({
      success: true,
      sent: recipientIds.length,
      message: `Notification sent to ${recipientIds.length} user${recipientIds.length !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    console.error('[admin/notifications] send error:', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminDeleteNotification(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Notification ID required' });
    const existing = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Notification not found' });
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminEditNotification(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Notification ID required' });
    const { title, body, link } = req.body as { title?: string; body?: string; link?: string };
    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Title is required' });
    const existing = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Notification not found' });
    db.prepare('UPDATE notifications SET title = ?, body = ?, link = ? WHERE id = ?')
      .run(title.trim(), body?.trim() || null, link?.trim() || null, id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminListNotifications(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const rows = db.prepare(`
      SELECT n.id, n.user_id, n.type, n.title, n.body, n.link, n.is_read, n.created_at,
             u.email AS user_email, u.name AS user_name
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      WHERE n.type NOT IN ('new_message', 'visitor_reply')
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = (db.prepare(`
      SELECT COUNT(*) as c FROM notifications n
      WHERE n.type NOT IN ('new_message', 'visitor_reply')
    `).get() as { c: number }).c;

    return res.json({ success: true, data: rows, total });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
