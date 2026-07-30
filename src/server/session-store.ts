/**
 * SQLite-backed session store for express-session.
 * Persists sessions to the same SQLite DB so they survive server restarts.
 */
import { Store } from 'express-session';
import { rawSqliteDb } from './db.js';

// Ensure the sessions table exists
rawSqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

// Clean up expired sessions on startup
rawSqliteDb.exec(`DELETE FROM sessions WHERE expires_at < ${Date.now()}`);

export class SQLiteSessionStore extends Store {
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.cleanupInterval = setInterval(() => {
      try {
        rawSqliteDb.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
      } catch (e) {
        console.error('[session-store] Cleanup error:', e);
      }
    }, 15 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(sid: string, callback: (err: any, session?: any) => void): void {
    try {
      const row = rawSqliteDb.prepare(
        'SELECT data FROM sessions WHERE sid = ? AND expires_at > ?'
      ).get(sid, Date.now()) as { data: string } | undefined;

      if (!row) return callback(null, null);
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(sid: string, session: any, callback?: (err?: any) => void): void {
    try {
      const maxAge = session?.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + maxAge;
      const data = JSON.stringify(session);

      rawSqliteDb.prepare(`
        INSERT INTO sessions (sid, data, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
      `).run(sid, data, expiresAt);

      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      rawSqliteDb.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  touch(sid: string, session: any, callback?: (err?: unknown) => void): void {
    try {
      const maxAge = session?.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + maxAge;
      rawSqliteDb.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?').run(expiresAt, sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}

