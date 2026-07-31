ALTER TABLE users ADD COLUMN head_office_customer_id TEXT;
ALTER TABLE users ADD COLUMN customer_number TEXT;
ALTER TABLE users ADD COLUMN head_office_link_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN head_office_last_synced_at TEXT;
ALTER TABLE users ADD COLUMN head_office_access_decision TEXT;
ALTER TABLE users ADD COLUMN head_office_access_decided_at TEXT;
ALTER TABLE users ADD COLUMN head_office_security_status TEXT;
ALTER TABLE users ADD COLUMN head_office_restrictions_json TEXT;
ALTER TABLE users ADD COLUMN head_office_age_assurance_json TEXT;
ALTER TABLE users ADD COLUMN head_office_connector_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_head_office_customer_id
  ON users(head_office_customer_id) WHERE head_office_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_customer_number
  ON users(customer_number) WHERE customer_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS head_office_command_receipts (
  command_id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'received',
  payload_json TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  acknowledged_at TEXT,
  error TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS head_office_event_outbox (
  event_id TEXT PRIMARY KEY,
  user_id INTEGER,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  sent_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_settings(key, value, updated_at)
VALUES ('schema_version', '4', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;

INSERT INTO app_settings(key, value, updated_at)
VALUES ('head_office_age_assurance_contract', 'ja-head-office-age-assurance-v1', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;
