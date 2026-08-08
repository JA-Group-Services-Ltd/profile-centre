-- Sousa Murray Profiles — Head Office operational event outbox
-- Added 8 August 2026.
-- Runtime also self-heals this table because Cloudflare Pages does not apply D1
-- migrations automatically when a Git deployment is published.

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
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_head_office_event_outbox_event_id
  ON head_office_event_outbox(event_id);

CREATE INDEX IF NOT EXISTS idx_head_office_event_outbox_pending
  ON head_office_event_outbox(status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_head_office_event_outbox_user
  ON head_office_event_outbox(user_id, created_at);
