-- Sousa Murray Profiles
-- Public-profile PIN enforcement, analytics and visitor interaction support.
--
-- Existing production environments are also protected by idempotent runtime
-- schema assurance because Cloudflare Pages does not automatically execute D1
-- migration files on deploy. Runtime code adds legacy-table columns only when
-- they are actually missing.

CREATE TABLE IF NOT EXISTS profile_public_pin_unlocks (
  profile_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_profile_public_pin_unlocks_expiry
ON profile_public_pin_unlocks(expires_at);

CREATE TABLE IF NOT EXISTS profile_public_pin_attempts (
  profile_id INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, source_hash)
);

CREATE TABLE IF NOT EXISTS profile_interaction_events (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  link_id INTEGER,
  visitor_hash TEXT,
  referrer_origin TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_interaction_events_profile_time
ON profile_interaction_events(profile_id, created_at);

CREATE INDEX IF NOT EXISTS idx_profile_interaction_events_type_time
ON profile_interaction_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_profile_interaction_events_link_time
ON profile_interaction_events(link_id, created_at);

CREATE TABLE IF NOT EXISTS public_interaction_rate_limits (
  scope TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, subject_id, source_hash)
);

CREATE TABLE IF NOT EXISTS contact_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  profile_id INTEGER,
  profile_name TEXT,
  username TEXT,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_user_time
ON contact_enquiries(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_profile_time
ON contact_enquiries(profile_id, created_at);

CREATE TABLE IF NOT EXISTS issue_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  issue_type TEXT NOT NULL DEFAULT 'profile_report',
  subject TEXT,
  description TEXT,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  reported_user_id INTEGER,
  reported_profile_id INTEGER,
  report_reason TEXT,
  ip_address TEXT,
  reporter_ip TEXT,
  reported_url TEXT,
  resolution_notes TEXT,
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_profile_time
ON issue_reports(reported_profile_id, created_at);

CREATE INDEX IF NOT EXISTS idx_issue_reports_status_time
ON issue_reports(status, created_at);
