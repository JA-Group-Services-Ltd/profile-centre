/**
 * Admin Compose Email
 *
 * POST /api/admin/email/compose   — send a custom email to one user, a list, or all users
 *
 * Body:
 *   recipientType: 'single' | 'all' | 'plan'
 *   recipientEmail?: string          (for single)
 *   planId?: number                  (for plan)
 *   subject: string
 *   body: string                     (plain text — also used as HTML with <br> line breaks)
 *
 * Security:
 *   - Requires requireAdminPin middleware (wired in entry.ts)
 *   - Full audit log entry on every send (success and partial)
 *   - Uses branded email template — no custom domain or inline HTML builder
 *   - Omits `from` — Airo gateway uses canonical sender
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { sendEmail } from '../../lib/send-email.js';
import { adminBroadcastEmail, EMAIL_REPLY_TO } from '../../lib/email-templates.js';
import { writeAudit } from '../../lib/audit.js';

export async function adminComposeEmail(req: Request, res: Response) {
  try {
    const admin = (req as any).adminSession;
    const { recipientType, recipientEmail, planId, subject, body } = req.body as {
      recipientType: 'single' | 'all' | 'plan';
      recipientEmail?: string;
      planId?: number;
      subject?: string;
      body?: string;
    };

    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'Subject is required.' });
    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Message body is required.' });

    let recipients: { email: string; name: string }[] = [];

    if (recipientType === 'single') {
      if (!recipientEmail?.includes('@')) return res.status(400).json({ success: false, error: 'Valid recipient email required.' });
      const user = db.prepare("SELECT email, name FROM users WHERE email = ? AND role != 'admin'").get(recipientEmail.trim()) as any;
      if (!user) return res.status(404).json({ success: false, error: 'No user found with that email address.' });
      recipients = [{ email: user.email, name: user.name || '' }];
    } else if (recipientType === 'all') {
      const users = db.prepare("SELECT email, name FROM users WHERE role != 'admin'").all() as any[];
      recipients = users.map(u => ({ email: u.email, name: u.name || '' }));
    } else if (recipientType === 'plan') {
      if (!planId) return res.status(400).json({ success: false, error: 'Plan ID required.' });
      const users = db.prepare("SELECT email, name FROM users WHERE role != 'admin' AND plan_id = ?").all(planId) as any[];
      recipients = users.map(u => ({ email: u.email, name: u.name || '' }));
    } else {
      return res.status(400).json({ success: false, error: 'Invalid recipientType.' });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'No recipients found matching your criteria.' });
    }

    // Send emails using the branded template — no custom domain, no inline HTML builder
    let sent = 0;
    let failed = 0;
    const failedEmails: string[] = [];

    for (const r of recipients) {
      try {
        const { subject: emailSubject, html, text } = adminBroadcastEmail({
          recipientName: r.name || undefined,
          subject: subject.trim(),
          body: body.trim(),
        });
        await sendEmail({ fromName: 'Sousa Murray Profiles', to: r.email, subject: emailSubject, html, text, replyTo: EMAIL_REPLY_TO });
        sent++;
      } catch (err) {
        failed++;
        failedEmails.push(r.email);
        console.error(`[admin-compose-email] Failed to send to ${r.email}:`, err);
      }
    }

    // Audit log — always written, even on partial failure
    writeAudit({
      actorId: admin?.adminId, actorName: admin?.name, actorEmail: admin?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'admin_compose_email',
      resourceType: 'email',
      details: `Admin sent email "${subject.trim()}" to ${sent}/${recipients.length} recipient(s) (type: ${recipientType}${planId ? `, plan: ${planId}` : ''})${failed > 0 ? `. ${failed} failed: ${failedEmails.slice(0, 5).join(', ')}${failedEmails.length > 5 ? '…' : ''}` : ''}`,
      ipAddress: req.ip, result: failed === 0 ? 'success' : sent > 0 ? 'partial' : 'failure',
    });

    res.json({
      success: true,
      message: `Email sent to ${sent} recipient${sent === 1 ? '' : 's'}${failed > 0 ? `. ${failed} failed to send.` : '.'}`,
      sent,
      failed,
      total: recipients.length,
    });
  } catch (err) {
    console.error('[admin-compose-email]', err);
    res.status(500).json({ success: false, error: 'Failed to send email.' });
  }
}
