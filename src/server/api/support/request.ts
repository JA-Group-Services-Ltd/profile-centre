/**
 * Support request handlers — threaded messaging.
 *
 * UK GDPR compliance:
 * - consent_given_at recorded at submission time
 * - user_id linked from authenticated session (not from body — prevents spoofing)
 * - Email/name length-capped; message length-capped
 * - Table created at DB startup (db.ts), not here
 */
import { type Request, type Response } from 'express';
import { isValidEmail } from '../../../lib/validate-email.js';
import { type AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';
import { notifySupportRequest, notifySupportReply } from '../../lib/notifications.js';
import { sendEmail } from '../../lib/send-email.js';
import { adminSupportRequestEmail, EMAIL_REPLY_TO } from '../../lib/email-templates.js';
import { getSecret } from '#airo/secrets';

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;
const MAX_NAME    = 120;
const MAX_EMAIL   = 254;
const MAX_REPLY   = 5000;

function adminEmail(): string | null {
  try {
    const v = getSecret('ADMIN_NOTIFICATION_EMAIL');
    return typeof v === 'string' && v.includes('@') ? v : null;
  } catch { return null; }
}

// ── Submit new ticket ─────────────────────────────────────────────────────────

export async function submitSupportRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id ?? null;
    const { name, email, category, subject, message } = req.body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ success: false, error: 'A valid email address is required' });
      return;
    }
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const CATEGORY_LABELS: Record<string, string> = {
      account_access:       'Account access',
      security_concern:     'Security concern',
      report_profile:       'Report a profile',
      billing:              'Billing',
      business_cards:       'Business cards',
      email_signature:      'Email signature',
      technical_issue:      'Technical issue',
      privacy_data_request: 'Privacy / data request',
      other:                'Support request',
    };

    const safeName    = name.trim().slice(0, MAX_NAME);
    const safeEmail   = email.trim().toLowerCase().slice(0, MAX_EMAIL);
    const safeMessage = message.trim().slice(0, MAX_MESSAGE);

    // Auto-generate subject from category if not provided
    const rawSubject = typeof subject === 'string' && subject.trim()
      ? subject.trim()
      : typeof category === 'string' && CATEGORY_LABELS[category]
        ? CATEGORY_LABELS[category]
        : 'Support request';
    const safeSubject = rawSubject.slice(0, MAX_SUBJECT);

    const result = db.prepare(`
      INSERT INTO support_requests (user_id, name, email, subject, message, consent_given_at, unread_admin, unread_user)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, 0)
    `).run(userId, safeName, safeEmail, safeSubject, safeMessage);

    const ticketId = result.lastInsertRowid as number;

    // Seed the opening message into the thread
    db.prepare(`
      INSERT INTO support_request_messages (ticket_id, sender_type, sender_id, sender_name, body)
      VALUES (?, 'user', ?, ?, ?)
    `).run(ticketId, userId, safeName, safeMessage);

    // Audit log — non-fatal
    try {
      db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES (?, 'support.request', ?)`)
        .run(`user:${userId ?? 'anon'}`, `subject="${safeSubject}" from=${safeEmail}`);
    } catch { /* audit table may not exist yet */ }

    // Email admin notification
    notifySupportRequest({ userName: safeName, userEmail: safeEmail, subject: safeSubject, message: safeMessage });

    res.status(201).json({ success: true, id: ticketId });
  } catch (err) {
    console.error('[support] submitSupportRequest error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

// ── List all tickets (admin) ──────────────────────────────────────────────────

export async function getSupportRequests(_req: Request, res: Response): Promise<void> {
  try {
    const rows = db.prepare(`
      SELECT sr.id, sr.user_id, sr.name, sr.email, sr.subject, sr.message,
             sr.status, sr.priority, sr.category, sr.created_at, sr.updated_at,
             sr.resolved_at, sr.internal_notes, sr.related_profile_id,
             sr.related_domain_id, sr.assigned_to, sr.unread_admin, sr.unread_user,
             u.name as user_name, u.plan_id,
             (SELECT COUNT(*) FROM support_request_messages WHERE ticket_id = sr.id) as message_count,
             (SELECT name FROM users WHERE id = sr.assigned_to LIMIT 1) as assigned_name
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      ORDER BY sr.created_at DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[support] getSupportRequests error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
}

// ── Get ticket messages (admin) ───────────────────────────────────────────────

export async function getTicketMessages(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticket = db.prepare(`
      SELECT sr.id, sr.user_id, sr.name, sr.email, sr.subject, sr.status,
             sr.priority, sr.category, sr.created_at, sr.updated_at,
             sr.internal_notes, sr.unread_admin, sr.unread_user,
             u.name as user_name, u.plan_id,
             (SELECT name FROM users WHERE id = sr.assigned_to LIMIT 1) as assigned_name
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
    `).get(id);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }
    const messages = db.prepare(`
      SELECT id, sender_type, sender_id, sender_name, body, created_at
      FROM support_request_messages
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).all(id);

    // Mark as read by admin
    db.prepare(`UPDATE support_requests SET unread_admin = 0 WHERE id = ?`).run(id);

    res.json({ success: true, ticket, messages });
  } catch (err) {
    console.error('[support] getTicketMessages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
}

// ── Admin reply to ticket ─────────────────────────────────────────────────────

export async function adminReplyToTicket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { body, status, internal_notes } = req.body as {
      body?: string;
      status?: string;
      internal_notes?: string;
    };

    const ticket = db.prepare(`
      SELECT sr.id, sr.user_id, sr.name, sr.email, sr.subject, sr.status,
             u.name as user_name, u.id as uid
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
    `).get(id) as {
      id: number; user_id: number | null; name: string; email: string;
      subject: string; status: string; user_name: string | null; uid: number | null;
    } | undefined;

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const safeBody = body?.trim().slice(0, MAX_REPLY);
    const allowed = ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'];
    const newStatus = status && allowed.includes(status) ? status : undefined;

    // Insert message if body provided
    if (safeBody) {
      db.prepare(`
        INSERT INTO support_request_messages (ticket_id, sender_type, sender_name, body)
        VALUES (?, 'admin', 'Support Team', ?)
      `).run(id, safeBody);
    }

    // Update ticket
    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP', 'unread_user = unread_user + 1'];
    const params: unknown[] = [];
    if (newStatus) {
      updates.push('status = ?');
      params.push(newStatus);
      if (newStatus === 'resolved' || newStatus === 'closed') {
        updates.push('resolved_at = CURRENT_TIMESTAMP');
      }
    }
    if (internal_notes !== undefined) {
      updates.push('internal_notes = ?');
      params.push(internal_notes.slice(0, 5000));
    }
    params.push(id);
    db.prepare(`UPDATE support_requests SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Audit
    try {
      db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES ('admin', 'support.reply', ?)`)
        .run(`ticket=${id} status=${newStatus ?? 'unchanged'}`);
    } catch { /* non-fatal */ }

    // Notify user by email
    if (safeBody && ticket.email) {
      notifySupportReply({
        userEmail: ticket.email,
        userName: ticket.user_name ?? ticket.name,
        userId: ticket.uid ?? undefined,
        originalSubject: ticket.subject,
        replyBody: safeBody,
        ticketId: ticket.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[support] adminReplyToTicket error:', err);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
}

// ── User: get their own tickets ───────────────────────────────────────────────

export async function getUserTickets(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, error: 'Authentication required' }); return; }

    const rows = db.prepare(`
      SELECT id, subject, status, priority, created_at, updated_at, unread_user,
             (SELECT COUNT(*) FROM support_request_messages WHERE ticket_id = support_requests.id) as message_count
      FROM support_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[support] getUserTickets error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
}

// ── User: get messages for one of their tickets ───────────────────────────────

export async function getUserTicketMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, error: 'Authentication required' }); return; }

    const { id } = req.params;
    const ticket = db.prepare(`
      SELECT id, subject, status, priority, created_at, updated_at, unread_user
      FROM support_requests
      WHERE id = ? AND user_id = ?
    `).get(id, userId) as { id: number; subject: string; status: string; priority: string | null; created_at: string; updated_at: string; unread_user: number } | undefined;

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const messages = db.prepare(`
      SELECT id, sender_type, sender_name, body, created_at
      FROM support_request_messages
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).all(id);

    // Mark as read by user
    db.prepare(`UPDATE support_requests SET unread_user = 0 WHERE id = ?`).run(id);

    res.json({ success: true, ticket, messages });
  } catch (err) {
    console.error('[support] getUserTicketMessages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
}

// ── User: reply to their own ticket ──────────────────────────────────────────

export async function userReplyToTicket(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, error: 'Authentication required' }); return; }

    const { id } = req.params;
    const { body } = req.body as { body?: string };
    if (!body?.trim()) {
      res.status(400).json({ success: false, error: 'Message body is required' });
      return;
    }

    const ticket = db.prepare(`
      SELECT sr.id, sr.subject, sr.status, sr.email,
             u.name as user_name, u.email as user_email
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ? AND sr.user_id = ?
    `).get(id, userId) as {
      id: number; subject: string; status: string; email: string;
      user_name: string | null; user_email: string | null;
    } | undefined;

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }
    if (ticket.status === 'closed') {
      res.status(400).json({ success: false, error: 'This ticket is closed. Please open a new support request.' });
      return;
    }

    const safeBody = body.trim().slice(0, MAX_REPLY);
    const senderName = ticket.user_name ?? ticket.email ?? 'User';

    db.prepare(`
      INSERT INTO support_request_messages (ticket_id, sender_type, sender_id, sender_name, body)
      VALUES (?, 'user', ?, ?, ?)
    `).run(id, userId, senderName, safeBody);

    // Reopen if resolved/waiting
    if (ticket.status === 'resolved' || ticket.status === 'waiting_for_customer') {
      db.prepare(`UPDATE support_requests SET status = 'open', updated_at = CURRENT_TIMESTAMP, unread_admin = unread_admin + 1 WHERE id = ?`).run(id);
    } else {
      db.prepare(`UPDATE support_requests SET updated_at = CURRENT_TIMESTAMP, unread_admin = unread_admin + 1 WHERE id = ?`).run(id);
    }

    // Notify admin
    const ae = adminEmail();
    if (ae) {
      try {
        const { subject, html, text } = adminSupportRequestEmail({
          userName: senderName,
          userEmail: ticket.user_email ?? ticket.email,
          subject: `Re: ${ticket.subject} [#${ticket.id}]`,
          message: safeBody,
        });
        await sendEmail({ fromName: 'JA Profile Studio', to: ae, subject, html, text, replyTo: ticket.user_email ?? ticket.email });
      } catch { /* non-fatal */ }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[support] userReplyToTicket error:', err);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
}

// ── Legacy: update ticket status + optional reply (kept for backwards compat) ─

export async function updateSupportRequest(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, reply_body } = req.body as { status?: string; reply_body?: string };

    const allowed = ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ success: false, error: `Status must be one of: ${allowed.join(', ')}` });
      return;
    }

    const existing = db.prepare(`
      SELECT sr.id, sr.user_id, sr.name, sr.email, sr.subject, sr.status,
             u.name AS user_name, u.id AS uid
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
    `).get(id) as {
      id: number; user_id: number | null; name: string; email: string;
      subject: string; status: string; user_name: string | null; uid: number | null;
    } | undefined;

    if (!existing) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    db.prepare('UPDATE support_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

    if (reply_body && reply_body.trim() && existing.email) {
      const safeReply = reply_body.trim().slice(0, MAX_REPLY);
      db.prepare(`
        INSERT INTO support_request_messages (ticket_id, sender_type, sender_name, body)
        VALUES (?, 'admin', 'Support Team', ?)
      `).run(id, safeReply);
      db.prepare(`UPDATE support_requests SET unread_user = unread_user + 1 WHERE id = ?`).run(id);
      notifySupportReply({
        userEmail: existing.email,
        userName: existing.user_name ?? existing.name,
        userId: existing.uid ?? undefined,
        originalSubject: existing.subject,
        replyBody: safeReply,
        ticketId: existing.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[support] updateSupportRequest error:', err);
    res.status(500).json({ success: false, error: 'Failed to update request' });
  }
}
