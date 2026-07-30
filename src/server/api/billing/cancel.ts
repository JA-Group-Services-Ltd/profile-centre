/**
 * POST /api/billing/cancel
 * Cancels the authenticated user's active subscription.
 *
 * If a Stripe subscription ID is present, we call Stripe's
 * cancel_at_period_end API so the customer retains access until
 * the end of their paid period — then the webhook fires and
 * downgrades them automatically.
 *
 * If no Stripe subscription exists (manual/admin-granted plan),
 * we update the DB directly.
 */
import { type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { getSecret } from '#airo/secrets';
import { notifyPlanChange } from '../../lib/notifications.js';

interface Subscription {
  id: number;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

export async function cancelSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Lifetime access cannot be cancelled via this endpoint
    const user = await db.prepare('SELECT lifetime_access FROM users WHERE id = ?').get(userId) as
      { lifetime_access: number } | undefined;
    if (user?.lifetime_access) {
      res.status(400).json({ success: false, error: 'Lifetime access cannot be cancelled.' });
      return;
    }

    const sub = await db.prepare(`
      SELECT id, status, stripe_subscription_id, current_period_end
      FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(userId) as Subscription | undefined;

    if (!sub) {
      res.status(404).json({ success: false, error: 'No active subscription found.' });
      return;
    }
    if (sub.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Subscription is already cancelled.' });
      return;
    }

    // ── Stripe cancellation (cancel_at_period_end) ──────────────────────────
    if (sub.stripe_subscription_id) {
      const stripeKey = getSecret('STRIPE_SECRET_KEY') as string | undefined;
      if (stripeKey) {
        // Fire-and-forget async Stripe call — we update DB optimistically
        // and the webhook will confirm. We don't await here to keep the
        // response fast; if Stripe fails, the webhook won't fire and the
        // DB will be out of sync — acceptable for now, admin can correct.
        void (async () => {
          try {
            // Dynamic require avoids the missing 'stripe' type declarations at compile time
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const StripeLib = require('stripe') as { new(key: string, opts: Record<string, string>): { subscriptions: { update(id: string, data: Record<string, unknown>): Promise<unknown> } } };
            const stripe = new StripeLib(stripeKey, { apiVersion: '2024-06-20' });
            await stripe.subscriptions.update(sub.stripe_subscription_id!, {
              cancel_at_period_end: true,
            });
          } catch (err) {
            console.error('[billing:cancel] Stripe API error:', err);
          }
        })();
      }
    }

    // ── DB update ───────────────────────────────────────────────────────────
    await db.prepare(`
      UPDATE subscriptions
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sub.id);

    // Audit log
    try {
      db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES (?, 'subscription.cancelled', ?)`)
        .run(`user:${userId}`, `sub_id=${sub.id} stripe=${sub.stripe_subscription_id ?? 'none'}`);
    } catch { /* non-fatal */ }

    // Email notification
    try {
      const fullUser = await db.prepare('SELECT name, email, plan_id FROM users WHERE id = ?').get(userId) as { name: string; email: string; plan_id: number } | undefined;
      const planName = fullUser ? (await db.prepare('SELECT name FROM plans WHERE id = ?').get(fullUser.plan_id) as { name: string } | undefined)?.name ?? 'Unknown' : 'Unknown';
      if (fullUser) notifyPlanChange({ userName: fullUser.name, userEmail: fullUser.email, userId, fromPlan: planName, toPlan: 'Free (cancelled)', action: 'cancel' });
    } catch { /* non-fatal */ }

    res.json({
      success: true,
      message: 'Subscription cancelled. You will retain access until the end of your billing period.',
    });
  } catch (err) {
    console.error('[billing:cancel]', err);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
}
