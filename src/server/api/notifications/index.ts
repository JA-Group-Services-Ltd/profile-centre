import { type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const notifications = await db.prepare(`
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(userId);
    const unreadRow = await db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as { c: number } | undefined;
    const unread = unreadRow?.c ?? 0;
    res.json({ success: true, data: notifications, unread });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function markNotificationsRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { ids } = req.body; // optional array of IDs; if omitted, mark all
    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`).run(userId, ...ids);
    } else {
      await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function deleteNotification(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
