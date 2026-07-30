/**
 * Account closure request API
 *
 * Customer:
 *   POST /api/account/closure-request   — submit a closure request
 *   GET  /api/account/closure-request   — get own closure request status
 *   DELETE /api/account/closure-request — cancel a pending request
 *
 * Admin:
 *   GET    /api/admin/closure-requests          — list all requests
 *   POST   /api/admin/closure-requests/:id/confirm — confirm and close account
 *   POST   /api/admin/closure-requests/:id/reject  — reject request
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { notifyAccountClosure, notifyAccountStatus } from '../../lib/notifications.js';

// ── Customer endpoints ─────────────────────────────────────────────────────

export async function submitClosureRequest(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { reason } = req.body as { reason?: string };

    // Check for existing pending request
    const existing = await db.prepare(
      "SELECT id, status FROM account_closure_requests WHERE user_id = ? AND status = 'pending'"
    ).get(userId) as { id: number; status: string } | undefined;

    if (existing) {
      return res.status(409).json({ success: false, error: 'You already have a pending closure request.' });
    }

    db.prepare(`
      INSERT INTO account_closure_requests (user_id, reason, status, created_at, updated_at)
      VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, reason ?? null);

    // Send closure confirmation email to the user
    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId) as
      { name: string; email: string } | undefined;
    if (user) {
      const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      notifyAccountClosure({
        userEmail: user.email,
        userName: user.name,
        scheduledDeletionDate: deletionDate,
      });
    }

    // Audit
    try {
      db.prepare(`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, 'account_closure_requested', 'user', ?, ?, CURRENT_TIMESTAMP)
      `).run(userId, String(userId), JSON.stringify({ reason }));
    } catch { /* audit table may not exist */ }

    res.json({ success: true, message: 'Closure request submitted. We will review and confirm within 5 business days.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit closure request' });
  }
}

export async function getClosureRequest(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const request = await db.prepare(
      'SELECT * FROM account_closure_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(userId);

    res.json({ success: true, data: request ?? null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch closure request' });
  }
}

export async function cancelClosureRequest(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const result = await db.prepare(
      "UPDATE account_closure_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'pending'"
    ).run(userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'No pending closure request found.' });
    }

    res.json({ success: true, message: 'Closure request cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to cancel closure request' });
  }
}

// ── Admin endpoints ────────────────────────────────────────────────────────

export async function adminListClosureRequests(_req: Request, res: Response) {
  try {
    const requests = await db.prepare(`
      SELECT cr.*, u.name as user_name, u.email as user_email, u.plan_id,
        p.name as plan_name
      FROM account_closure_requests cr
      JOIN users u ON cr.user_id = u.id
      LEFT JOIN plans p ON u.plan_id = p.id
      ORDER BY
        CASE cr.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
        cr.created_at DESC
    `).all();
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch closure requests' });
  }
}

export async function adminConfirmClosure(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminId = (req.session as { adminId?: number; adminName?: string }).adminId;
    const adminName = (req.session as { adminName?: string }).adminName ?? 'Admin';
    const { admin_note } = req.body as { admin_note?: string };

    const request = await db.prepare(
      'SELECT * FROM account_closure_requests WHERE id = ?'
    ).get(String(id)) as { id: number; user_id: number; status: string } | undefined;

    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Request is not pending' });
    }

    // Confirm the request
    await db.prepare(`
      UPDATE account_closure_requests
      SET status = 'confirmed', admin_note = ?, confirmed_by = ?, confirmed_by_name = ?,
          confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(admin_note ?? null, adminId ?? null, adminName, String(id));

    // Soft-delete: mark user as closed (is_paused=1, pause_reason='account_closed')
    // Full hard-delete is done separately to allow data export window
    await db.prepare(`
      UPDATE users SET is_paused = 1, pause_reason = 'account_closed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(request.user_id);

    // Notify the user their account has been closed
    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(request.user_id) as
      { name: string; email: string } | undefined;
    if (user) {
      notifyAccountStatus({ userEmail: user.email, userName: user.name, action: 'closed' });
    }

    // Audit
    try {
      db.prepare(`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, 'account_closure_confirmed', 'user', ?, ?, CURRENT_TIMESTAMP)
      `).run(adminId ?? 0, String(request.user_id), JSON.stringify({ admin_note, confirmed_by: adminName }));
    } catch { /* ignore */ }

    res.json({ success: true, message: 'Account closure confirmed. User account has been suspended.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to confirm closure' });
  }
}

export async function adminRejectClosure(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminId = (req.session as { adminId?: number }).adminId;
    const adminName = (req.session as { adminName?: string }).adminName ?? 'Admin';
    const { admin_note } = req.body as { admin_note?: string };

    const result = await db.prepare(`
      UPDATE account_closure_requests
      SET status = 'rejected', admin_note = ?, confirmed_by = ?, confirmed_by_name = ?,
          confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).run(admin_note ?? null, adminId ?? null, adminName, String(id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Pending request not found' });
    }

    res.json({ success: true, message: 'Closure request rejected.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject closure request' });
  }
}
