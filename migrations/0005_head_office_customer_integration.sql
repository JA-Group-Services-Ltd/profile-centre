PRAGMA foreign_keys = ON;

ALTER TABLE head_office_event_outbox ADD COLUMN next_attempt_at TEXT;
ALTER TABLE head_office_event_outbox ADD COLUMN correlation_id TEXT;
ALTER TABLE head_office_event_outbox ADD COLUMN completed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_head_office_outbox_retry
  ON head_office_event_outbox(status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS head_office_reconciliation_log (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  profile_id INTEGER,
  outcome TEXT NOT NULL CHECK(outcome IN ('linked','updated','skipped','unresolved','failed')),
  reason_code TEXT,
  central_customer_id TEXT,
  customer_number TEXT,
  run_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_head_office_reconciliation_run
  ON head_office_reconciliation_log(run_id, outcome, created_at);
CREATE INDEX IF NOT EXISTS idx_head_office_reconciliation_user
  ON head_office_reconciliation_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS head_office_sync_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  scanned_count INTEGER NOT NULL DEFAULT 0,
  linked_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  unresolved_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);

INSERT INTO app_settings(key, value, updated_at)
VALUES ('schema_version', '6', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP;
