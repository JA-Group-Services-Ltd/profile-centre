/**
 * Local admin email/password login
 * POST /api/admin/auth/login
 *
 * Sets req.session.adminUserId — completely separate from the customer session
 * (which uses req.session.userId). This allows admins to log in without
 * Microsoft OIDC, which is useful in dev/preview environments.
 *
 * Only users with role = 'admin' can use this endpoint.
 */
import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../../db.js';

export async function adminLocalLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await db.prepare(
      "SELECT id, email, name, role, plan_id, password_hash FROM users WHERE email = ? AND role = 'admin'"
    ).get(email.toLowerCase().trim()) as {
      id: number; email: string; name: string; role: string; plan_id: number; password_hash: string | null;
    } | undefined;

    if (!user) {
      // Generic message — don't reveal whether the email exists
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'This admin account uses Microsoft sign-in. Please use the "Sign in with Microsoft" button.',
      });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Set the admin session — separate key from customer session
    req.session.adminUserId = user.id;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    // Update last login
    await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    res.json({
      success: true,
      data: { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    });
  } catch (err) {
    console.error('[admin/auth] Local login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
}

/**
 * POST /api/admin/auth/create-first-admin
 *
 * One-time endpoint to create the first admin account when no admin exists.
 * Disabled once any admin user exists in the database.
 */
export async function createFirstAdmin(req: Request, res: Response) {
  try {
    const existingAdmin = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (existingAdmin) {
      return res.status(403).json({
        success: false,
        error: 'An admin account already exists. Use the login page.',
      });
    }

    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    if (password.length < 10) {
      return res.status(400).json({ success: false, error: 'Admin password must be at least 10 characters' });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      // Promote existing user to admin
      const hash = bcrypt.hashSync(password, 12);
      await db.prepare(
        "UPDATE users SET role = 'admin', password_hash = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?"
      ).run(hash, name.trim(), email.toLowerCase().trim());
      const user = await db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email.toLowerCase().trim()) as { id: number; email: string; name: string; role: string };
      req.session.adminUserId = user.id;
      await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      return res.json({ success: true, data: { user }, message: 'Existing account promoted to admin' });
    }

    const hash = bcrypt.hashSync(password, 12);
    const result = await db.prepare(
      "INSERT INTO users (email, password_hash, name, role, plan_id) VALUES (?, ?, ?, 'admin', 1)"
    ).run(email.toLowerCase().trim(), hash, name.trim());

    const userId = (result as { lastInsertRowid: number }).lastInsertRowid;
    req.session.adminUserId = userId;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    res.status(201).json({
      success: true,
      data: { user: { id: userId, email: email.toLowerCase().trim(), name: name.trim(), role: 'admin' } },
      message: 'First admin account created successfully',
    });
  } catch (err) {
    console.error('[admin/auth] Create first admin error:', err);
    res.status(500).json({ success: false, error: 'Failed to create admin account' });
  }
}
