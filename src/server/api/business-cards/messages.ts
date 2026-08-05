/**
 * Business Card Order Messaging
 *
 * GET  /api/business-cards/:orderId/messages        — customer: get messages for their order
 * POST /api/business-cards/:orderId/messages        — customer: send a message
 * GET  /api/admin/business-cards/:orderId/messages  — admin: get messages
 * POST /api/admin/business-cards/:orderId/messages  — admin: reply
 */
import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';

// ── Customer: get messages ────────────────────────────────────────────────────
export async function getOrderMessages(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  const { orderId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ? AND user_id = ?`).get(orderId, userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Mark admin messages as read
  db.prepare(`UPDATE business_card_messages SET is_read = 1 WHERE order_id = ? AND sender_type = 'admin' AND is_read = 0`).run(orderId);

  const messages = db.prepare(`SELECT * FROM business_card_messages WHERE order_id = ? ORDER BY created_at ASC`).all(orderId);
  res.json({ messages });
}

// ── Customer: send message ────────────────────────────────────────────────────
export async function sendOrderMessage(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  const { orderId } = req.params;
  const { message } = req.body;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

  const order = db.prepare(`SELECT id, user_id FROM business_card_orders WHERE id = ? AND user_id = ?`).get(orderId, userId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Get customer name
  const user = db.prepare(`SELECT name FROM users WHERE id = ?`).get(userId) as { name: string } | undefined;

  const result = db.prepare(`
    INSERT INTO business_card_messages (order_id, sender_type, sender_name, message)
    VALUES (?, 'customer', ?, ?)
  `).run(orderId, user?.name ?? 'Customer', message.trim());

  const msg = db.prepare(`SELECT * FROM business_card_messages WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ message: msg });
}

// ── Admin: get messages ───────────────────────────────────────────────────────
export async function adminGetOrderMessages(req: Request, res: Response) {
  const { orderId } = req.params;
  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Mark customer messages as read
  db.prepare(`UPDATE business_card_messages SET is_read = 1 WHERE order_id = ? AND sender_type = 'customer' AND is_read = 0`).run(orderId);

  const messages = db.prepare(`SELECT * FROM business_card_messages WHERE order_id = ? ORDER BY created_at ASC`).all(orderId);
  res.json({ messages });
}

// ── Admin: reply ──────────────────────────────────────────────────────────────
export async function adminSendOrderMessage(req: Request, res: Response) {
  const { orderId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

  const order = db.prepare(`SELECT id FROM business_card_orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const result = db.prepare(`
    INSERT INTO business_card_messages (order_id, sender_type, sender_name, message)
    VALUES (?, 'admin', 'Sousa Murray Profiles Team', ?)
  `).run(orderId, message.trim());

  const msg = db.prepare(`SELECT * FROM business_card_messages WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ message: msg });
}

// ── Admin: unread count (for badge) ──────────────────────────────────────────
export async function adminUnreadMessageCount(_req: Request, res: Response) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM business_card_messages
    WHERE sender_type = 'customer' AND is_read = 0
  `).get() as { cnt: number };
  res.json({ unread: row.cnt });
}
