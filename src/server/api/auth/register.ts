import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../../db.js';
import jwt from 'jsonwebtoken';
import { awardPoints, getOrCreateReferralCode } from '../../lib/points.js';
import { isValidEmail } from '../../../lib/validate-email.js';
import { notifyNewSignup, notifyWelcome } from '../../lib/notifications.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Set it in your secrets before starting the server.');
}
function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET as string, { expiresIn: '7d' });
}

export default async function handler(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Check registration allowed
    const allowReg = await db.prepare("SELECT value FROM admin_settings WHERE key = 'allow_registration'").get() as { value: string } | undefined;
    if (allowReg?.value === 'false') {
      return res.status(403).json({ success: false, error: 'Registration is currently disabled' });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await db.prepare(
      'INSERT INTO users (email, password_hash, name, role, plan_id) VALUES (?, ?, ?, ?, ?)'
    ).run(email.toLowerCase(), hash, name.trim(), 'user', 1);

    const userId = (result as { lastInsertRowid: number }).lastInsertRowid;

    // Award signup points
    await awardPoints(userId, 'signup', 'Welcome bonus for creating an account');

    // Handle referral code
    const pendingRef = (req.session as unknown as Record<string, unknown>)?.pendingReferralCode as string | undefined;
    if (pendingRef) {
      const refOwner = await db.prepare('SELECT user_id FROM referral_codes WHERE code = ?').get(pendingRef) as { user_id: number } | undefined;
      if (refOwner && refOwner.user_id !== userId) {
        await db.prepare('UPDATE users SET referred_by_code = ? WHERE id = ?').run(pendingRef, userId);
        awardPoints(refOwner.user_id, 'referral_signup', `Referral sign-up by new user`, userId);
      }
    }

    // Ensure referral code exists for new user
    await getOrCreateReferralCode(userId);

    // Create default profile
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 30);
    let finalUsername = username;
    let counter = 1;
    while (await db.prepare('SELECT id FROM profiles WHERE username = ?').get(finalUsername)) {
      finalUsername = `${username}${counter++}`;
    }

    await db.prepare(
      'INSERT INTO profiles (user_id, username, display_name, email, is_published) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, finalUsername, name.trim(), email.toLowerCase(), 1);

    const token = generateToken(userId);
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const user = await db.prepare('SELECT id, email, name, role, plan_id FROM users WHERE id = ?').get(userId);

    // Fire-and-forget: notify admin of new signup + send welcome email to user
    notifyNewSignup({ userName: name.trim(), userEmail: email.toLowerCase(), userId, isReferral: !!pendingRef });
    notifyWelcome({ userName: name.trim(), userEmail: email.toLowerCase() });

    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
}
