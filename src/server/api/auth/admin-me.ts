import { type Request, type Response } from 'express';
import db from '../../db.js';

/**
 * Returns the currently authenticated admin user from the admin session.
 * Reads req.session.adminUserId — completely separate from the customer session.
 */
export default async function adminMeHandler(req: Request, res: Response) {
  const adminUserId = req.session?.adminUserId;

  if (!adminUserId) {
    return res.status(401).json({ success: false, error: 'Not authenticated as admin' });
  }

  const user = await db.prepare(
    'SELECT id, email, name, role, plan_id FROM users WHERE id = ? AND role = ?'
  ).get(adminUserId, 'admin') as {
    id: number; email: string; name: string; role: string; plan_id: number;
  } | undefined;

  if (!user) {
    return res.status(401).json({ success: false, error: 'Admin user not found' });
  }

  res.json({ success: true, data: { user } });
}
