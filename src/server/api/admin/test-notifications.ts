/**
 * POST /api/admin/test-notification
 * Fires a real email to ADMIN_NOTIFICATION_EMAIL so the admin can verify
 * the notification pipeline end-to-end.
 * Protected by requireAdminApi — admin session required.
 */
import { type Request, type Response } from 'express';
import { getSecret } from '#airo/secrets';
import {
  notifyNewSignup,
  notifyNewMessage,
  notifySupportRequest,
  notifyPlanChange,
  notifySecurityAlert,
} from '../../lib/notifications.js';

type NotificationType = 'signup' | 'message' | 'support' | 'plan_change' | 'security_alert';

export async function testNotification(req: Request, res: Response) {
  const type: NotificationType = req.body?.type ?? 'signup';

  const adminEmail = (() => {
    try {
      const v = getSecret('ADMIN_NOTIFICATION_EMAIL');
      return typeof v === 'string' && v.includes('@') ? v : null;
    } catch {
      return null;
    }
  })();

  if (!adminEmail) {
    return res.status(400).json({
      success: false,
      error: 'ADMIN_NOTIFICATION_EMAIL secret is not configured or invalid.',
    });
  }

  try {
    switch (type) {
      case 'signup':
        notifyNewSignup({
          userName: 'Test User',
          userEmail: 'testuser@example.com',
          userId: 9999,
          isReferral: false,
        });
        break;

      case 'message':
        notifyNewMessage({
          senderName: 'Jane Visitor',
          senderEmail: 'jane@example.com',
          recipientUsername: 'test-profile',
          preview: 'Hi, I saw your profile and wanted to get in touch about a potential collaboration.',
          threadId: 9999,
        });
        break;

      case 'support':
        notifySupportRequest({
          userName: 'Test User',
          userEmail: 'testuser@example.com',
          subject: 'Test support request',
          message: 'This is a test support request triggered from the admin panel to verify email notifications are working correctly.',
        });
        break;

      case 'plan_change':
        notifyPlanChange({
          userName: 'Test User',
          userEmail: 'testuser@example.com',
          userId: 9999,
          fromPlan: 'Free',
          toPlan: 'Pro',
          action: 'upgrade',
        });
        break;

      case 'security_alert':
        // Sends to adminEmail so the admin can preview what users receive
        notifySecurityAlert({
          userEmail: adminEmail,
          userName: 'Test Admin',
          userId: 9999,
          alertType: 'new_login',
          ip: '203.0.113.42',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          timestamp: new Date().toISOString(),
          detail: 'This is a test security alert email. No action required.',
        });
        break;

      default:
        return res.status(400).json({ success: false, error: `Unknown notification type: ${type}` });
    }

    return res.json({
      success: true,
      message: `Test "${type}" notification dispatched to ${adminEmail}. Check your inbox — it may take a few seconds.`,
      sentTo: adminEmail,
    });
  } catch (err) {
    console.error('[test-notification] error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch test notification.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
