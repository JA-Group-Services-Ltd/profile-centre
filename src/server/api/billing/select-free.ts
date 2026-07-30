import { type Request, type Response } from 'express';
import db from '../../db.js';

/**
 * POST /api/billing/select-free
 *
 * Allows a user in the plan-selection period or no-plan state to explicitly
 * choose the Free plan. Sets plan_id to the free plan and account_status to 'free'.
 * Does NOT touch any Stripe subscription — this is a local-only operation.
 */
export async function selectFreePlan(req: Request, res: Response) {
  try {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const user = db.prepare(
      `SELECT id, account_status, plan_id FROM users WHERE id = ?`
    ).get(userId) as { id: number; account_status: string; plan_id: number | null } | undefined;

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Only allow if in plan_selection or no_plan state
    const allowed = ['plan_selection', 'no_plan', 'trial_ended'];
    if (!allowed.includes(user.account_status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot select free plan from account status: ${user.account_status}`,
      });
    }

    // Get the free plan id
    const freePlan = db.prepare(`SELECT id FROM plans WHERE slug = 'free' LIMIT 1`).get() as { id: number } | undefined;
    if (!freePlan) return res.status(500).json({ success: false, error: 'Free plan not found' });

    // Update user
    db.prepare(
      `UPDATE users SET plan_id = ?, account_status = 'free', payment_grace_until = NULL WHERE id = ?`
    ).run(freePlan.id, userId);

    // Write audit log
    try {
      db.prepare(
        `INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, 'select_free_plan', ?, datetime('now'))`
      ).run(userId, `user=${userId} — selected free plan from status=${user.account_status}`);
    } catch { /* audit log is best-effort */ }

    return res.json({ success: true });
  } catch (err) {
    console.error('[select-free] error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
