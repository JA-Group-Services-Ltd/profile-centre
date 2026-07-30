import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../../db.js';
import jwt from 'jsonwebtoken';
import { notifySecurityAlert } from '../../lib/notifications.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Set it in your secrets before starting the server.');
}
function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET as string, { expiresIn: '7d' });
}

export default async function handler(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Explicit column list — never SELECT * on users (would pull password_hash into memory unnecessarily)
    const user = await db.prepare(
      'SELECT id, email, password_hash, name, role, plan_id FROM users WHERE email = ?'
    ).get(email.toLowerCase()) as {
      id: number; email: string; password_hash: string; name: string; role: string; plan_id: number;
    } | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Fire security alert — essential, always sent regardless of user prefs
    notifySecurityAlert({
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
      alertType: 'new_login',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id } } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
}
