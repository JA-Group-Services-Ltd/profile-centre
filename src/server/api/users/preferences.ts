/**
 * User Preferences API
 * GET  /api/users/me/preferences  — fetch current user's preferences
 * PUT  /api/users/me/preferences  — save preferences (server-side, no localStorage)
 *
 * GET  /api/users/me/notification-prefs  — fetch email notification preferences
 * PUT  /api/users/me/notification-prefs  — save email notification preferences
 *
 * Preferences are stored in the users table as a JSON blob in the
 * `preferences` column. Email notification preferences are stored in
 * `email_notification_prefs` column.
 *
 * ESSENTIAL notifications (security_alerts, billing_notices, sar_updates, legal_notices)
 * are always sent and cannot be disabled.
 */
import { type Request, type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';

// Ensure columns exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT NULL`);
} catch {
  // Column already exists — ignore
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN email_notification_prefs TEXT DEFAULT NULL`);
} catch {
  // Column already exists — ignore
}

const ALLOWED_KEYS = new Set([
  'display_density', 'date_format', 'dashboard_card_style',
  'show_profile_completion', 'show_quick_actions', 'show_analytics_preview',
  'email_notifications_enabled', 'email_on_new_enquiry',
  'email_on_plan_change', 'email_on_business_card_update',
]);

// Optional notification categories (essential ones are always on and not listed here)
const OPTIONAL_NOTIFICATION_CATEGORIES = new Set([
  'support_replies',
  'profile_status',
  'enquiry_notifications',
  'service_updates',
]);

export async function getPreferences(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ success: false, error: 'Authentication required' });

  try {
    const row = db.prepare('SELECT preferences FROM users WHERE id = ?').get(authReq.user.id) as { preferences: string | null } | undefined;
    const data = row?.preferences ? JSON.parse(row.preferences) : {};
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to load preferences' });
  }
}

export async function savePreferences(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ success: false, error: 'Authentication required' });

  try {
    // Only allow known preference keys — strip anything else
    const incoming = req.body as Record<string, unknown>;
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (ALLOWED_KEYS.has(k)) safe[k] = v;
    }

    // Merge with existing
    const row = db.prepare('SELECT preferences FROM users WHERE id = ?').get(authReq.user.id) as { preferences: string | null } | undefined;
    const existing = row?.preferences ? JSON.parse(row.preferences) : {};
    const merged = { ...existing, ...safe };

    db.prepare('UPDATE users SET preferences = ? WHERE id = ?').run(JSON.stringify(merged), authReq.user.id);
    return res.json({ success: true, data: merged });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
}

// ── Email notification preferences ───────────────────────────────────────────

export async function getNotificationPrefs(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ success: false, error: 'Authentication required' });

  try {
    const row = db.prepare('SELECT email_notification_prefs FROM users WHERE id = ?').get(authReq.user.id) as
      { email_notification_prefs: string | null } | undefined;
    const stored = row?.email_notification_prefs ? JSON.parse(row.email_notification_prefs) as Record<string, boolean> : {};

    // Build full response: essential always true, optional default true
    const data: Record<string, { enabled: boolean; essential: boolean; label: string; description: string }> = {
      // Essential — always on
      security_alerts: {
        enabled: true, essential: true,
        label: 'Security alerts',
        description: 'Login activity, PIN changes, and suspicious account activity. Cannot be disabled.',
      },
      billing_notices: {
        enabled: true, essential: true,
        label: 'Billing and plan notices',
        description: 'Plan changes, trial expiry, and payment confirmations. Cannot be disabled.',
      },
      sar_updates: {
        enabled: true, essential: true,
        label: 'Data request updates',
        description: 'Status updates on your Subject Access Requests and data deletion requests. Cannot be disabled.',
      },
      legal_notices: {
        enabled: true, essential: true,
        label: 'Legal and policy notices',
        description: 'Policy updates and legal communications that require your attention. Cannot be disabled.',
      },
      // Optional — user can toggle
      support_replies: {
        enabled: stored.support_replies !== false,
        essential: false,
        label: 'Support replies',
        description: 'Email notifications when our team replies to your support requests.',
      },
      profile_status: {
        enabled: stored.profile_status !== false,
        essential: false,
        label: 'Profile status changes',
        description: 'Notifications when your profile is hidden, suspended, or restored.',
      },
      enquiry_notifications: {
        enabled: stored.enquiry_notifications !== false,
        essential: false,
        label: 'New enquiries',
        description: 'Email notifications when someone sends an enquiry through your profile.',
      },
      service_updates: {
        enabled: stored.service_updates !== false,
        essential: false,
        label: 'Service updates',
        description: 'Platform announcements, feature updates, and maintenance notices.',
      },
    };

    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to load notification preferences' });
  }
}

export async function saveNotificationPrefs(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ success: false, error: 'Authentication required' });

  try {
    const incoming = req.body as Record<string, unknown>;
    const safe: Record<string, boolean> = {};

    // Only allow optional categories — essential ones cannot be changed
    for (const [k, v] of Object.entries(incoming)) {
      if (OPTIONAL_NOTIFICATION_CATEGORIES.has(k) && typeof v === 'boolean') {
        safe[k] = v;
      }
    }

    // Merge with existing
    const row = db.prepare('SELECT email_notification_prefs FROM users WHERE id = ?').get(authReq.user.id) as
      { email_notification_prefs: string | null } | undefined;
    const existing = row?.email_notification_prefs ? JSON.parse(row.email_notification_prefs) as Record<string, boolean> : {};
    const merged = { ...existing, ...safe };

    db.prepare('UPDATE users SET email_notification_prefs = ? WHERE id = ?').run(JSON.stringify(merged), authReq.user.id);
    return res.json({ success: true, data: merged });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to save notification preferences' });
  }
}
