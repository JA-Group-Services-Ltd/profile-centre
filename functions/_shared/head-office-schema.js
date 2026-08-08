const readyDatabases = new WeakSet();

const OUTBOX_COLUMNS = new Map([
  ["event_id", "TEXT"],
  ["user_id", "INTEGER"],
  ["event_type", "TEXT"],
  ["payload_json", "TEXT"],
  ["correlation_id", "TEXT"],
  ["status", "TEXT NOT NULL DEFAULT 'pending'"],
  ["attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["last_attempt_at", "TEXT"],
  ["next_attempt_at", "TEXT"],
  ["sent_at", "TEXT"],
  ["completed_at", "TEXT"],
  ["error", "TEXT"],
  ["created_at", "TEXT"],
]);

/**
 * Ensure the local Head Office operational-event outbox exists before API
 * handlers can emit lifecycle/profile/security events.
 *
 * This is deliberately idempotent and also repairs older partial versions of
 * the table. Cloudflare Pages deployments do not automatically apply D1 SQL
 * migrations, so runtime schema assurance prevents an operational event from
 * turning an otherwise successful customer action into a HTTP 500.
 */
export async function ensureHeadOfficeEventOutbox(database) {
  if (!database || typeof database.prepare !== "function") return;
  if (readyDatabases.has(database)) return;

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS head_office_event_outbox (
      event_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      correlation_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      next_attempt_at TEXT,
      sent_at TEXT,
      completed_at TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Repair a table created by an older deployment if it is missing any of the
  // fields now used by sendOperationalEvent/retryOperationalEvents.
  const info = await database.prepare("PRAGMA table_info(head_office_event_outbox)").all();
  const existing = new Set((info?.results || []).map((column) => String(column.name)));
  for (const [name, definition] of OUTBOX_COLUMNS) {
    if (existing.has(name)) continue;
    await database.prepare(`ALTER TABLE head_office_event_outbox ADD COLUMN ${name} ${definition}`).run();
  }

  await database.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_head_office_event_outbox_event_id
    ON head_office_event_outbox(event_id)
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_head_office_event_outbox_pending
    ON head_office_event_outbox(status, next_attempt_at, created_at)
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_head_office_event_outbox_user
    ON head_office_event_outbox(user_id, created_at)
  `).run();

  readyDatabases.add(database);
}
