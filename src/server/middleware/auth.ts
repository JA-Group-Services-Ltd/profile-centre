import { type Request, type Response, type NextFunction } from 'express';
import db from '../db.js';
import { assignUserNumber } from '../lib/user-number.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    plan_id: number;
    // Assisted access session metadata (set when admin is impersonating a user)
    isAssistedSession?: boolean;
    assistedRequestId?: number;
    assistedAdminId?: number;
    assistedAdminName?: string | null;
  };
}

// ─── Customer auth ─────────────────────────────────────────────────────────

/**
 * Requires a valid customer session (req.session.userId).
 *
 * Fallback: if no customer session exists but an admin session does
 * (req.session.adminUserId), we look up the admin's email and find their
 * role='member' customer record. If no member record exists yet, we create
 * one automatically so the admin can use the customer dashboard without a
 * separate CIAM login.
 *
 * Returns 401 JSON if neither session is present.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // ── Assisted-access session takes priority ────────────────────────────────
  // If this request carries a ja_assisted_session cookie (impersonation tab),
  // use the userId from that session. The primary ja_profile_studio_session is
  // never touched — the admin's original tab keeps its own session intact.
  const assistedSession = (req as any).assistedSession;
  const assistedUserId = assistedSession?.userId;

  if (assistedUserId) {
    Promise.resolve(
      db.prepare('SELECT id, email, name, role, plan_id FROM users WHERE id = ?').get(assistedUserId)
    ).then((user) => {
      if (!user) {
        res.status(401).json({ success: false, error: 'User not found' });
        return;
      }
      const u = user as AuthRequest['user'];
      if (u) {
        u.isAssistedSession = true;
        u.assistedRequestId = assistedSession.assistedAccessRequestId;
        u.assistedAdminId = assistedSession.assistedAccessAdminId;
        u.assistedAdminName = assistedSession.assistedAccessAdminName ?? null;
      }
      req.user = u;
      next();
    }).catch(() => {
      res.status(500).json({ success: false, error: 'Auth check failed' });
    });
    return;
  }

  const userId = req.session?.userId;

  // Primary path — customer session present
  if (userId) {
    Promise.resolve(
      db.prepare('SELECT id, email, name, role, plan_id FROM users WHERE id = ?').get(userId)
    ).then((user) => {
      if (!user) {
        res.status(401).json({ success: false, error: 'User not found' });
        return;
      }
      const u = user as AuthRequest['user'];
      // Attach assisted session metadata if present
      const assistedRequestId = req.session?.assistedAccessRequestId;
      if (assistedRequestId && u) {
        u.isAssistedSession = true;
        u.assistedRequestId = assistedRequestId;
        u.assistedAdminId = req.session?.assistedAccessAdminId;
        u.assistedAdminName = req.session?.assistedAccessAdminName ?? null;
      }
      req.user = u;
      next();
    }).catch(() => {
      res.status(500).json({ success: false, error: 'Auth check failed' });
    });
    return;
  }

  // Fallback — admin session present: bridge to a member record
  const adminUserId = req.session?.adminUserId;
  if (adminUserId) {
    Promise.resolve(
      db.prepare("SELECT id, email, name, role FROM users WHERE id = ? AND role = 'admin'").get(adminUserId)
    ).then((adminRecord) => {
      if (!adminRecord) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const admin = adminRecord as { id: number; email: string; name: string; role: string };

      // Look for an existing member record with the same email
      let memberRecord = db.prepare(
        "SELECT id, email, name, role, plan_id FROM users WHERE email = ? AND role = 'member'"
      ).get(admin.email) as { id: number; email: string; name: string; role: string; plan_id: number } | undefined;

      if (!memberRecord) {
        // Auto-create a member record so the admin can use the customer dashboard
        const freePlan = db.prepare("SELECT id FROM plans WHERE slug = 'free'").get() as { id: number } | undefined;
        const planId = freePlan?.id ?? 1;
        const ins = db.prepare(
          "INSERT INTO users (email, name, role, plan_id, created_at, updated_at) VALUES (?, ?, 'member', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ).run(admin.email, admin.name, planId) as { lastInsertRowid: number };
        memberRecord = {
          id: Number(ins.lastInsertRowid),
          email: admin.email,
          name: admin.name,
          role: 'member',
          plan_id: planId,
        };
        // Assign user number to the auto-created member record (non-fatal)
        try { assignUserNumber(memberRecord.id); } catch { /* non-fatal */ }
      }

      req.user = memberRecord;
      next();
    }).catch(() => {
      res.status(500).json({ success: false, error: 'Auth check failed' });
    });
    return;
  }

  res.status(401).json({ success: false, error: 'Authentication required' });
}

// ─── Admin auth ────────────────────────────────────────────────────────────

/**
 * Admin route guard — reads from req.session.adminUserId (workforce tenant).
 * Completely separate from the customer session (req.session.userId).
 *
 * If a customer (userId set, adminUserId not set) tries to access an admin
 * route, they are redirected to /login?error=wrong_account_type so they see
 * a clear message rather than a generic login page.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  // Belt-and-braces: never intercept the auth routes themselves
  const path = req.path || req.url?.split('?')[0] || '';
  const ADMIN_AUTH_PATHS = ['/admin/login', '/admin/auth/callback', '/admin/logout', '/admin/auth/start'];
  if (ADMIN_AUTH_PATHS.some(p => path === p || path.startsWith(p + '?'))) {
    return next();
  }

  const adminUserId = req.session?.adminUserId;

  if (!adminUserId) {
    if (req.path?.startsWith('/api/')) {
      res.status(401).json({ success: false, error: 'Authentication required' });
    } else {
      // If they have a customer session, show a clear "wrong account" message
      const hasCustomerSession = !!req.session?.userId;
      res.redirect(hasCustomerSession ? '/login?error=wrong_account_type' : '/admin/login');
    }
    return;
  }

  Promise.resolve(
    db.prepare('SELECT id, email, name, role, plan_id FROM users WHERE id = ?').get(adminUserId)
  ).then((user) => {
    const u = user as AuthRequest['user'];
    if (!u || u.role !== 'admin') {
      if (req.path?.startsWith('/api/')) {
        res.status(403).json({ success: false, error: 'Admin access required' });
      } else {
        res.redirect('/admin/login?error=access_denied');
      }
      return;
    }
    req.user = u;
    next();
  }).catch(() => {
    res.status(500).json({ success: false, error: 'Auth check failed' });
  });
}

/**
 * requireAdmin variant for API routes — always returns JSON, never redirects.
 * Async-safe: awaits the DB call so it works on both SQLite and Azure shim.
 */
export function requireAdminApi(req: AuthRequest, res: Response, next: NextFunction): void {
  const adminUserId = req.session?.adminUserId;

  if (!adminUserId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  Promise.resolve(
    db.prepare('SELECT id, email, name, role, plan_id FROM users WHERE id = ?').get(adminUserId)
  ).then((user) => {
    const u = user as AuthRequest['user'];
    if (!u || u.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }
    req.user = u;
    next();
  }).catch(() => {
    res.status(500).json({ success: false, error: 'Auth check failed' });
  });
}
