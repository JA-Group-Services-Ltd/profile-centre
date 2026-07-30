/**
 * Session Activity API — server-side idle auto-logout
 *
 * POST /api/security/heartbeat
 *   Called by the client every 60s while the user is active.
 *   Updates last_active in session_activity table.
 *   Returns { active: true, idleSeconds, maxIdleSeconds }
 *
 * GET  /api/security/session-status
 *   Returns current session health: idle time, max idle, fingerprint match.
 *   Client polls this to know when to show the "you'll be logged out" warning.
 *
 * POST /api/security/logout-idle
 *   Called by client when idle timeout is reached. Destroys the session.
 */
import { type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';

// 20 minutes of inactivity → auto-logout warning at 18 min, logout at 20 min
export const MAX_IDLE_SECONDS = 20 * 60;
export const WARN_IDLE_SECONDS = 18 * 60;

function buildFingerprint(req: Request): string {
  const ua = req.headers['user-agent'] || '';
  const accept = req.headers['accept-language'] || '';
  // Deliberately NOT including IP — it can change on mobile networks
  return createHash('sha256').update(`${ua}|${accept}`).digest('hex').slice(0, 16);
}

export async function heartbeat(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const sessionId = req.sessionID;
    const now = new Date().toISOString();
    const fp = buildFingerprint(req);

    db.prepare(`
      INSERT INTO session_activity (session_id, user_id, last_active, ip_address, user_agent, fingerprint)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        last_active = excluded.last_active,
        ip_address = excluded.ip_address,
        fingerprint = excluded.fingerprint
    `).run(sessionId, userId, now, req.ip || null, req.headers['user-agent'] || null, fp);

    return res.json({ success: true, active: true, maxIdleSeconds: MAX_IDLE_SECONDS, warnIdleSeconds: WARN_IDLE_SECONDS });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function getSessionStatus(req: AuthRequest, res: Response) {
  try {
    const sessionId = req.sessionID;
    const fp = buildFingerprint(req);

    const row = db.prepare(
      'SELECT last_active, fingerprint, ip_address FROM session_activity WHERE session_id = ?'
    ).get(sessionId) as { last_active: string; fingerprint: string; ip_address: string } | undefined;

    if (!row) {
      // No activity record yet — session is fresh
      return res.json({
        success: true,
        idleSeconds: 0,
        maxIdleSeconds: MAX_IDLE_SECONDS,
        warnIdleSeconds: WARN_IDLE_SECONDS,
        fingerprintMatch: true,
        suspicious: false,
      });
    }

    const idleSeconds = Math.floor((Date.now() - new Date(row.last_active).getTime()) / 1000);
    const fingerprintMatch = row.fingerprint === fp;

    // Flag as suspicious if fingerprint changed mid-session (possible session hijack)
    const suspicious = !fingerprintMatch;

    return res.json({
      success: true,
      idleSeconds,
      maxIdleSeconds: MAX_IDLE_SECONDS,
      warnIdleSeconds: WARN_IDLE_SECONDS,
      fingerprintMatch,
      suspicious,
      lastActive: row.last_active,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function logoutIdle(req: AuthRequest, res: Response) {
  try {
    const sessionId = req.sessionID;
    // Clean up activity record
    db.prepare('DELETE FROM session_activity WHERE session_id = ?').run(sessionId);

    // Destroy the session
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.json({ success: true, reason: 'idle_timeout' });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
