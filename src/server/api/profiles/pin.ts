/**
 * Profile PIN management + messaging/enquiry feature toggles.
 *
 * POST /api/profiles/:id/pin          — set or clear the dashboard PIN (owner only)
 * POST /api/profiles/:id/pin/verify   — verify dashboard PIN (owner only)
 * GET  /api/profiles/:id/pin/status   — get PIN + feature toggle status (owner only)
 * PATCH /api/profiles/:id/messaging   — toggle messaging_enabled on/off
 * PATCH /api/profiles/:id/enquiry     — toggle enquiry_enabled on/off
 *
 * Public profile PIN lock (separate from dashboard PIN):
 * POST /api/profiles/:id/public-pin        — set/clear/generate public PIN (owner only)
 * POST /api/profiles/:username/public-pin/verify — verify public PIN (unauthenticated visitors)
 * GET  /api/profiles/:id/public-pin/status — get public PIN status (owner only)
 */
import bcrypt from 'bcryptjs';
import { type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { type Request } from 'express';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function ownsProfile(userId: number, profileId: string | number) {
  const id = Array.isArray(profileId) ? profileId[0] : profileId;
  const row = await db.prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?').get(id, userId);
  return !!row;
}

// ─── Set / clear dashboard PIN ────────────────────────────────────────────────

export async function setProfilePin(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { pin } = req.body as { pin?: string };

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  if (pin === '' || pin === null || pin === undefined) {
    // Clear PIN
    await db.prepare('UPDATE profiles SET pin_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    return res.json({ success: true, pinSet: false });
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ success: false, error: 'PIN must be 4–6 digits.' });
  }

  const hash = bcrypt.hashSync(pin, 10);
  await db.prepare('UPDATE profiles SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, id);
  return res.json({ success: true, pinSet: true });
}

// ─── Verify dashboard PIN ─────────────────────────────────────────────────────

export async function verifyProfilePin(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { pin } = req.body as { pin?: string };

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  if (!pin) {
    return res.status(400).json({ success: false, error: 'PIN is required.' });
  }

  const profile = await db.prepare('SELECT pin_hash FROM profiles WHERE id = ?').get(id) as
    { pin_hash: string | null } | undefined;

  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
  if (!profile.pin_hash) return res.json({ success: true, verified: true }); // no PIN set — always pass

  const ok = bcrypt.compareSync(pin, profile.pin_hash);
  if (!ok) return res.status(401).json({ success: false, error: 'Incorrect PIN.' });

  // Store a per-session unlock flag so the client doesn't need to re-enter on every page load
  if (!req.session.unlockedProfiles) req.session.unlockedProfiles = [];
  if (!req.session.unlockedProfiles.includes(Number(id))) {
    req.session.unlockedProfiles.push(Number(id));
  }

  return res.json({ success: true, verified: true });
}

// ─── Get PIN status ───────────────────────────────────────────────────────────

export async function getProfilePinStatus(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const profile = await db.prepare(`
    SELECT pin_hash,
           COALESCE(messaging_enabled, 1) AS messaging_enabled,
           COALESCE(enquiry_enabled, 1)   AS enquiry_enabled,
           COALESCE(public_pin_enabled, 0) AS public_pin_enabled
    FROM profiles WHERE id = ?
  `).get(id) as
    { pin_hash: string | null; messaging_enabled: number; enquiry_enabled: number; public_pin_enabled: number } | undefined;

  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

  const unlocked = (req.session.unlockedProfiles ?? []).includes(Number(id));

  return res.json({
    success: true,
    data: {
      pinSet: !!profile.pin_hash,
      unlocked: !!profile.pin_hash ? unlocked : true,
      messaging_enabled: profile.messaging_enabled,
      enquiry_enabled: profile.enquiry_enabled,
      public_pin_enabled: profile.public_pin_enabled,
    },
  });
}

// ─── Toggle messaging ─────────────────────────────────────────────────────────

export async function toggleMessaging(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { enabled } = req.body as { enabled: boolean };

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const val = enabled ? 1 : 0;
  await db.prepare('UPDATE profiles SET messaging_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(val, id);
  return res.json({ success: true, messaging_enabled: val });
}

// ─── Toggle enquiry ───────────────────────────────────────────────────────────

export async function toggleEnquiry(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { enabled } = req.body as { enabled: boolean };

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const val = enabled ? 1 : 0;
  await db.prepare('UPDATE profiles SET enquiry_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(val, id);
  return res.json({ success: true, enquiry_enabled: val });
}

// ─── Get / set contact hours for messaging ────────────────────────────────────

export async function getContactHours(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  // Ensure column exists
  try {
    db.prepare(`ALTER TABLE profiles ADD COLUMN contact_hours TEXT`).run();
  } catch { /* already exists */ }

  const row = db.prepare('SELECT contact_hours FROM profiles WHERE id = ?').get(id) as { contact_hours: string | null } | undefined;
  if (!row) return res.status(404).json({ success: false, error: 'Profile not found' });

  let hours = null;
  try { hours = row.contact_hours ? JSON.parse(row.contact_hours) : null; } catch { hours = null; }

  return res.json({ success: true, data: hours });
}

export async function setContactHours(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const { enabled, start_time, end_time, days, outside_hours_message } = req.body as {
    enabled: boolean;
    start_time?: string;
    end_time?: string;
    days?: string[];
    outside_hours_message?: string;
  };

  // Ensure column exists
  try {
    db.prepare(`ALTER TABLE profiles ADD COLUMN contact_hours TEXT`).run();
  } catch { /* already exists */ }

  const payload = JSON.stringify({
    enabled: !!enabled,
    start_time: start_time || '09:00',
    end_time: end_time || '17:00',
    days: days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    outside_hours_message: outside_hours_message || 'This profile may respond during their listed contact hours.',
  });

  db.prepare('UPDATE profiles SET contact_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(payload, id);
  return res.json({ success: true });
}

// ─── Public profile PIN — set / generate / clear (owner only) ────────────────

export async function setPublicPin(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { action, pin } = req.body as { action: 'generate' | 'set' | 'clear'; pin?: string };

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  if (action === 'clear') {
    await db.prepare(
      'UPDATE profiles SET public_pin_hash = NULL, public_pin_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(id);
    return res.json({ success: true, enabled: false });
  }

  if (action === 'generate') {
    // Generate a random 6-digit PIN and return it ONCE — never stored in plaintext
    const generatedPin = String(Math.floor(100000 + Math.random() * 900000));
    const hash = bcrypt.hashSync(generatedPin, 10);
    await db.prepare(
      'UPDATE profiles SET public_pin_hash = ?, public_pin_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(hash, id);
    return res.json({ success: true, enabled: true, pin: generatedPin, warning: 'Save this PIN — it will not be shown again.' });
  }

  if (action === 'set') {
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'PIN must be 4–8 digits.' });
    }
    const hash = bcrypt.hashSync(pin, 10);
    await db.prepare(
      'UPDATE profiles SET public_pin_hash = ?, public_pin_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(hash, id);
    return res.json({ success: true, enabled: true });
  }

  return res.status(400).json({ success: false, error: 'Invalid action. Use generate, set, or clear.' });
}

// ─── Public profile PIN — get status (owner only) ────────────────────────────

export async function getPublicPinStatus(req: AuthRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!await ownsProfile(req.user!.id, id)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const profile = await db.prepare(
    'SELECT public_pin_hash, public_pin_enabled FROM profiles WHERE id = ?'
  ).get(id) as { public_pin_hash: string | null; public_pin_enabled: number } | undefined;

  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

  return res.json({
    success: true,
    data: {
      enabled: !!profile.public_pin_enabled && !!profile.public_pin_hash,
      pinSet: !!profile.public_pin_hash,
    },
  });
}

// ─── Public profile PIN — verify (unauthenticated visitors) ──────────────────

export async function verifyPublicPin(req: Request, res: Response) {
  const { username } = req.params;
  const { pin } = req.body as { pin?: string };

  if (!pin) return res.status(400).json({ success: false, error: 'PIN is required.' });

  const profile = await db.prepare(
    'SELECT id, public_pin_hash, public_pin_enabled FROM profiles WHERE username = ? AND is_published = 1'
  ).get(username) as { id: number; public_pin_hash: string | null; public_pin_enabled: number } | undefined;

  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found.' });
  if (!profile.public_pin_enabled || !profile.public_pin_hash) {
    return res.json({ success: true, verified: true }); // no PIN — always pass
  }

  const ok = bcrypt.compareSync(pin, profile.public_pin_hash);
  if (!ok) return res.status(401).json({ success: false, error: 'Incorrect PIN. Please try again.' });

  // Store unlock in session so visitor doesn't need to re-enter on every page load
  if (!req.session.unlockedPublicProfiles) req.session.unlockedPublicProfiles = [];
  if (!req.session.unlockedPublicProfiles.includes(profile.id)) {
    req.session.unlockedPublicProfiles.push(profile.id);
  }
  await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));

  return res.json({ success: true, verified: true });
}

