/**
 * Admin API — Email Signature Beta Access
 *
 * GET  /api/admin/users/:userId/email-signature-beta  — get current beta status
 * POST /api/admin/users/:userId/email-signature-beta  — enable / disable + note
 *
 * Access is admin-only. Completely independent of plan/subscription.
 * All changes are written to audit_log.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

// ── Schema migration (idempotent) ─────────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_signature_beta (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL UNIQUE,
      enabled           INTEGER NOT NULL DEFAULT 0,
      admin_note        TEXT,
      granted_by_id     INTEGER,
      granted_by_name   TEXT,
      granted_by_email  TEXT,
      granted_at        DATETIME,
      revoked_at        DATETIME,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
} catch { /* already exists */ }

// ── GET ───────────────────────────────────────────────────────────────────────
export async function getEmailSignatureBeta(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });

  const row = db.prepare(`
    SELECT esb.*, u.email AS user_email, u.name AS user_name
    FROM email_signature_beta esb
    JOIN users u ON u.id = esb.user_id
    WHERE esb.user_id = ?
  `).get(userId) as Record<string, unknown> | undefined;

  return res.json({
    success: true,
    data: row ?? { user_id: userId, enabled: 0, admin_note: null, granted_by_name: null, granted_at: null },
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function setEmailSignatureBeta(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ success: false, error: 'Invalid user ID' });

  const { enabled, admin_note } = req.body as { enabled: boolean; admin_note?: string };
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: '"enabled" (boolean) is required' });
  }

  // Resolve target user
  const targetUser = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId) as
    { id: number; email: string; name: string } | undefined;
  if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

  // Admin actor from session
  const adminReq = req as Request & { admin?: { id: number; name: string; email: string } };
  const adminId    = adminReq.admin?.id    ?? null;
  const adminName  = adminReq.admin?.name  ?? 'Admin';
  const adminEmail = adminReq.admin?.email ?? null;

  const now = new Date().toISOString();
  const note = (admin_note ?? '').trim() || null;

  // Upsert
  db.prepare(`
    INSERT INTO email_signature_beta (user_id, enabled, admin_note, granted_by_id, granted_by_name, granted_by_email, granted_at, revoked_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      enabled          = excluded.enabled,
      admin_note       = excluded.admin_note,
      granted_by_id    = excluded.granted_by_id,
      granted_by_name  = excluded.granted_by_name,
      granted_by_email = excluded.granted_by_email,
      granted_at       = CASE WHEN excluded.enabled = 1 THEN excluded.granted_at ELSE granted_at END,
      revoked_at       = CASE WHEN excluded.enabled = 0 THEN excluded.revoked_at ELSE NULL END,
      updated_at       = excluded.updated_at
  `).run(
    userId,
    enabled ? 1 : 0,
    note,
    adminId,
    adminName,
    adminEmail,
    enabled ? now : null,
    enabled ? null : now,
    now,
  );

  // Audit log
  await writeAudit({
    actorId:       adminId,
    actorName:     adminName,
    actorEmail:    adminEmail,
    actorType:     'admin',
    action:        enabled ? 'email_signature_beta_enabled' : 'email_signature_beta_disabled',
    resourceType:  'user',
    resourceId:    String(userId),
    resourceLabel: targetUser.email,
    details:       JSON.stringify({
      enabled,
      admin_note: note,
      target_user_id:    userId,
      target_user_email: targetUser.email,
      target_user_name:  targetUser.name,
    }),
    result: 'success',
  });

  return res.json({ success: true, data: { user_id: userId, enabled, admin_note: note } });
}
