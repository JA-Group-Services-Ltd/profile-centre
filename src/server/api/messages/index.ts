import { randomBytes } from 'crypto';
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { notifyNewMessage } from '../../lib/notifications.js';
import { pushToUser } from './sse.js';
import { checkMessageSafety } from '../../lib/message-safety.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createNotification(userId: number, type: string, title: string, body: string, link: string) {
  try {
    await db.prepare(`
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, title, body, link);
  } catch { /* non-fatal */ }
}

// ─── Public: Start a new message thread from a card visitor ──────────────────

export async function sendCardMessage(req: Request, res: Response) {
  try {
    const { username } = req.params;
    const { sender_name, sender_email, subject, body } = req.body;

    // Email is optional — only name and message body are required
    if (!sender_name?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, error: 'Name and message are required.' });
    }

    // Validate email format only when provided
    const emailTrimmed = sender_email?.trim() || '';
    if (emailTrimmed) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(emailTrimmed)) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
      }
    }

    // Safety checks — rate limit, blocked words, unsafe links
    const senderIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const safety = checkMessageSafety(body.trim(), senderIp, true);
    if (safety.blocked) {
      return res.status(429).json({ success: false, error: safety.reason });
    }

    // Resolve profile + check plan allows messaging
    const profile = await db.prepare(`
      SELECT p.id, p.user_id, p.display_name, pl.has_messaging
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      JOIN plans pl ON u.plan_id = pl.id
      WHERE p.username = ? AND p.is_published = 1
    `).get(username) as { id: number; user_id: number; display_name: string; has_messaging: number } | undefined;

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    if (!profile.has_messaging) {
      return res.status(403).json({ success: false, error: 'This profile does not have messaging enabled.' });
    }

    const visitorToken = randomBytes(24).toString('hex');

    // Store sender IP, severity, and flag data for moderation
    const thread = await db.prepare(`
      INSERT INTO card_message_threads
        (profile_id, sender_name, sender_email, subject, status, visitor_token, visitor_verified, visitor_accepted,
         sender_ip, severity, auto_flagged, flag_reason)
      VALUES (?, ?, ?, ?, 'open', ?, 0, 0, ?, ?, ?, ?)
    `).run(
      profile.id, sender_name.trim(), emailTrimmed, subject?.trim() || null, visitorToken,
      senderIp,
      safety.severity ?? 'normal',
      safety.flagged ? 1 : 0,
      safety.flagReason ?? null,
    );

    const threadId = (thread as { lastInsertRowid: number }).lastInsertRowid;

    // Azure SQL: card_messages was created with sender_type but app uses sender.
    // sender column was added via addCol migration — write to sender explicitly.
    await db.prepare(`
      INSERT INTO card_messages (thread_id, sender, body)
      VALUES (?, 'visitor', ?)
    `).run(threadId, body.trim());

    // Notify the card owner (awaited — Azure returns Promise)
    await createNotification(
      profile.user_id,
      'new_message',
      `New message from ${sender_name.trim()}`,
      body.trim().slice(0, 120),
      `/dashboard/messages`
    );

    // Push real-time SSE event to the card owner if they're connected
    pushToUser(profile.user_id, 'new_thread', {
      thread_id: threadId,
      sender_name: sender_name.trim(),
      sender_email: emailTrimmed,
      subject: subject?.trim() || null,
      preview: body.trim().slice(0, 120),
    });

    // Email admin notification (fire-and-forget — non-blocking)
    notifyNewMessage({
      senderName: sender_name.trim(),
      senderEmail: emailTrimmed || '(no email provided)',
      recipientUsername: String(username),
      preview: body.trim(),
      threadId: Number(threadId),
    });

    res.status(201).json({
      success: true,
      thread_id: threadId,
      visitor_token: visitorToken,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Public: Visitor replies to an existing thread via token ─────────────────

export async function visitorReply(req: Request, res: Response) {
  try {
    const { threadId } = req.params;
    const { body, visitor_token } = req.body;

    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Message body is required.' });
    if (!visitor_token) return res.status(401).json({ success: false, error: 'Visitor token required.' });

    // Safety checks on visitor replies
    const senderIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const safety = checkMessageSafety(body.trim(), senderIp, false);
    if (safety.blocked) {
      return res.status(429).json({ success: false, error: safety.reason });
    }

    const thread = await db.prepare(`
      SELECT t.id, t.status, t.visitor_token, t.visitor_accepted, t.profile_id,
             t.sender_name, p.user_id, p.display_name
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ?
    `).get(threadId) as {
      id: number; status: string; visitor_token: string; visitor_accepted: number;
      profile_id: number; sender_name: string; user_id: number; display_name: string;
    } | undefined;

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found.' });
    if (thread.visitor_token !== visitor_token) return res.status(403).json({ success: false, error: 'Invalid token.' });
    if (thread.status === 'closed') return res.status(400).json({ success: false, error: 'This conversation has been closed.' });
    if (!thread.visitor_accepted) return res.status(403).json({ success: false, error: 'The card owner has not yet accepted this conversation.' });

    await db.prepare(`INSERT INTO card_messages (thread_id, sender, body) VALUES (?, 'visitor', ?)`).run(threadId, body.trim());
    await db.prepare(`UPDATE card_message_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`).run(threadId);

    // Notify owner of visitor reply
    await createNotification(
      thread.user_id,
      'visitor_reply',
      `${thread.sender_name} replied`,
      body.trim().slice(0, 120),
      `/dashboard/messages`
    );

    // Push real-time SSE event to the thread owner
    pushToUser(thread.user_id, 'new_message', {
      thread_id: Number(threadId),
      sender: 'visitor',
      body: body.trim(),
    });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Public: Get thread status + messages for visitor (via token) ─────────────

export async function getVisitorThread(req: Request, res: Response) {
  try {
    const { threadId } = req.params;
    const { token } = req.query;

    const thread = await db.prepare(`
      SELECT t.id, t.status, t.visitor_token, t.visitor_accepted, t.sender_name,
             t.sender_email, t.subject, t.created_at, t.last_message_at,
             p.display_name as profile_name
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ?
    `).get(threadId) as Record<string, unknown> | undefined;

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found.' });
    if (thread.visitor_token !== token) return res.status(403).json({ success: false, error: 'Invalid token.' });

    const messages = await db.prepare(`SELECT * FROM card_messages WHERE thread_id = ? ORDER BY created_at ASC`).all(threadId);

    res.json({ success: true, data: { thread, messages } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Authenticated: Accept a visitor into live conversation ──────────────────

export async function acceptVisitor(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { threadId } = req.params;

    const thread = await db.prepare(`
      SELECT t.id FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId);

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    await db.prepare('UPDATE card_message_threads SET visitor_accepted = 1 WHERE id = ?').run(threadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Authenticated: Get all threads for the logged-in user's profiles ────────

export async function getMyThreads(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const threads = await db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM card_messages m WHERE m.thread_id = t.id AND m.is_read = 0 AND m.sender = 'visitor') as unread_count,
        (SELECT body FROM card_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        p.username as profile_username, p.display_name as profile_name
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE p.user_id = ?
      ORDER BY t.last_message_at DESC
    `).all(userId);
    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function getThread(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { threadId } = req.params;

    const thread = await db.prepare(`
      SELECT t.*, p.username as profile_username, p.display_name as profile_name
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId) as Record<string, unknown> | undefined;

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    const messages = await db.prepare(`SELECT * FROM card_messages WHERE thread_id = ? ORDER BY created_at ASC`).all(threadId);

    // Mark visitor messages as read
    await db.prepare(`UPDATE card_messages SET is_read = 1 WHERE thread_id = ? AND sender = 'visitor' AND is_read = 0`).run(threadId);

    res.json({ success: true, data: { thread, messages } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function replyToThread(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { threadId } = req.params;
    const { body } = req.body;

    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Reply body is required.' });

    const thread = await db.prepare(`
      SELECT t.id, t.status, t.sender_name FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId) as { id: number; status: string; sender_name: string } | undefined;

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });
    if (thread.status === 'closed') return res.status(400).json({ success: false, error: 'This conversation is closed.' });

    // Await the INSERT — on Azure this is a Promise; lastInsertRowid only available after await
    const insertResult = await db.prepare(`INSERT INTO card_messages (thread_id, sender, body) VALUES (?, 'owner', ?)`).run(threadId, body.trim());
    await db.prepare(`UPDATE card_message_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`).run(threadId);

    const newMsgId = (insertResult as { lastInsertRowid: number }).lastInsertRowid;
    const newMsg = newMsgId
      ? await db.prepare('SELECT * FROM card_messages WHERE id = ?').get(newMsgId)
      : { thread_id: Number(threadId), sender: 'owner', body: body.trim(), is_read: 0 };

    res.status(201).json({ success: true, data: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function setThreadStatus(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { threadId } = req.params;
    const { status } = req.body;

    if (!['open', 'closed'].includes(status)) return res.status(400).json({ success: false, error: 'Status must be open or closed.' });

    const thread = await db.prepare(`
      SELECT t.id FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId);

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    await db.prepare('UPDATE card_message_threads SET status = ? WHERE id = ?').run(status, threadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function deleteThread(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { threadId } = req.params;

    const thread = await db.prepare(`
      SELECT t.id FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId);

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    await db.prepare('DELETE FROM card_message_threads WHERE id = ?').run(threadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Public: Check thread status (for visitor) ───────────────────────────────

export async function getThreadStatus(req: Request, res: Response) {
  try {
    const { threadId } = req.params;
    const thread = await db.prepare('SELECT status, sender_email, visitor_accepted FROM card_message_threads WHERE id = ?').get(threadId) as { status: string; sender_email: string; visitor_accepted: number } | undefined;
    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });
    res.json({ success: true, data: { status: thread.status, visitor_accepted: thread.visitor_accepted } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Admin: Get all threads ───────────────────────────────────────────────────

export async function adminGetAllThreads(req: Request, res: Response) {
  try {
    const threads = await db.prepare(`
      SELECT t.*,
        p.username as profile_username, p.display_name as profile_name,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM card_messages m WHERE m.thread_id = t.id) as message_count
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      JOIN users u ON p.user_id = u.id
      ORDER BY t.last_message_at DESC
      LIMIT 500
    `).all();
    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Owner: Report a thread as abusive ───────────────────────────────────────

export async function reportThread(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorised' });

    const { threadId } = req.params;
    const { reason } = req.body;

    // Verify ownership
    const thread = await db.prepare(`
      SELECT t.id FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    // Ensure column exists (idempotent — SQLite ignores duplicate ADD COLUMN errors)
    try {
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN is_reported INTEGER DEFAULT 0`).run();
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN report_reason TEXT`).run();
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN reported_at TEXT`).run();
    } catch { /* column already exists */ }

    db.prepare(`
      UPDATE card_message_threads
      SET is_reported = 1, report_reason = ?, reported_at = CURRENT_TIMESTAMP, status = 'closed'
      WHERE id = ?
    `).run(reason?.trim() || 'Reported by profile owner', threadId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Owner: Block a sender (by email or thread) ───────────────────────────────

export async function blockSender(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorised' });

    const { threadId } = req.params;

    const thread = await db.prepare(`
      SELECT t.id, t.sender_email, t.sender_name FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      WHERE t.id = ? AND p.user_id = ?
    `).get(threadId, userId) as { id: number; sender_email: string; sender_name: string } | undefined;
    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    // Ensure blocked_senders table exists
    db.prepare(`
      CREATE TABLE IF NOT EXISTS blocked_senders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sender_email TEXT,
        sender_name TEXT,
        blocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, sender_email)
      )
    `).run();

    try {
      db.prepare(`
        INSERT INTO blocked_senders (user_id, sender_email, sender_name)
        VALUES (?, ?, ?)
      `).run(userId, thread.sender_email || null, thread.sender_name);
    } catch { /* already blocked */ }

    // Close the thread
    db.prepare(`UPDATE card_message_threads SET status = 'closed' WHERE id = ?`).run(threadId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Admin: Get reported threads ─────────────────────────────────────────────

export async function adminGetReportedThreads(req: Request, res: Response) {
  try {
    // Ensure column exists before querying
    try {
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN is_reported INTEGER DEFAULT 0`).run();
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN report_reason TEXT`).run();
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN reported_at TEXT`).run();
    } catch { /* already exists */ }

    const threads = await db.prepare(`
      SELECT t.*,
        p.username as profile_username, p.display_name as profile_name,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM card_messages m WHERE m.thread_id = t.id) as message_count
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE t.is_reported = 1
      ORDER BY t.reported_at DESC
      LIMIT 200
    `).all();
    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── Admin: Dismiss a report ──────────────────────────────────────────────────

export async function adminDismissReport(req: Request, res: Response) {
  try {
    const { threadId } = req.params;
    try {
      db.prepare(`ALTER TABLE card_message_threads ADD COLUMN is_reported INTEGER DEFAULT 0`).run();
    } catch { /* already exists */ }
    db.prepare(`UPDATE card_message_threads SET is_reported = 0, report_reason = NULL WHERE id = ?`).run(threadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
