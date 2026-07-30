PRAGMA foreign_keys = ON;

-- Profile Centre Cloudflare D1 foundation
-- Schema version: 1

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  is_secret INTEGER NOT NULL DEFAULT 0 CHECK (is_secret IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_settings (key, value, is_secret)
VALUES
  ('schema_version', '1', 0),
  ('service_name', 'profile-centre', 0),
  ('site_status', 'operational', 0);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  external_identity_id TEXT UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email_verified_at TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'staff', 'administrator', 'super_administrator')),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('pending', 'active', 'paused', 'blocked', 'closed')),
  plan_id TEXT,
  stripe_customer_id TEXT UNIQUE,
  terms_accepted_at TEXT,
  privacy_accepted_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_external_identity_id
  ON users (external_identity_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status
  ON users (account_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users (created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  csrf_token_hash TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT,
  monthly_price_pence INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_pence >= 0),
  yearly_price_pence INTEGER NOT NULL DEFAULT 0 CHECK (yearly_price_pence >= 0),
  lifetime_price_pence INTEGER CHECK (lifetime_price_pence IS NULL OR lifetime_price_pence >= 0),
  max_profiles INTEGER NOT NULL DEFAULT 1 CHECK (max_profiles >= 0),
  max_links INTEGER NOT NULL DEFAULT 5 CHECK (max_links >= 0),
  max_seats INTEGER NOT NULL DEFAULT 1 CHECK (max_seats >= 0),
  features_json TEXT NOT NULL DEFAULT '{}',
  stripe_product_id TEXT,
  stripe_price_monthly_id TEXT,
  stripe_price_yearly_id TEXT,
  stripe_price_lifetime_id TEXT,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  profile_type TEXT NOT NULL DEFAULT 'personal'
    CHECK (profile_type IN ('personal', 'business', 'team')),
  display_name TEXT,
  job_title TEXT,
  company TEXT,
  biography TEXT,
  phone TEXT,
  public_email TEXT,
  website TEXT,
  address TEXT,
  profile_photo_url TEXT,
  theme_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'unlisted', 'private', 'suspended')),
  contact_preferences_json TEXT NOT NULL DEFAULT '{}',
  is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_visibility
  ON profiles (visibility);

CREATE TABLE IF NOT EXISTS profile_links (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  profile_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'website',
  platform TEXT,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_links_profile_sort
  ON profile_links (profile_id, sort_order);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialling', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  billing_interval TEXT
    CHECK (billing_interval IN ('monthly', 'yearly', 'lifetime', 'complimentary')),
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TEXT,
  current_period_end TEXT,
  trial_ends_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions (status);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  ticket_reference TEXT NOT NULL COLLATE NOCASE UNIQUE,
  user_id TEXT,
  requester_email TEXT COLLATE NOCASE,
  requester_name TEXT,
  subject TEXT NOT NULL,
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')),
  assigned_to_user_id TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  closed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
  ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority
  ON support_tickets (status, priority);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  author_user_id TEXT,
  author_type TEXT NOT NULL
    CHECK (author_type IN ('customer', 'staff', 'system')),
  body TEXT NOT NULL,
  is_internal_note INTEGER NOT NULL DEFAULT 0 CHECK (is_internal_note IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id
  ON support_ticket_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  request_reference TEXT NOT NULL COLLATE NOCASE UNIQUE,
  user_id TEXT,
  requester_email TEXT NOT NULL COLLATE NOCASE,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'other')),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'identity_verification', 'in_progress', 'extended', 'completed', 'refused', 'withdrawn')),
  details TEXT,
  identity_verified_at TEXT,
  statutory_due_at TEXT,
  completed_at TEXT,
  response_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_data_requests_status_due
  ON data_requests (status, statutory_due_at);
CREATE INDEX IF NOT EXISTS idx_data_requests_user_id
  ON data_requests (user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('customer', 'staff', 'administrator', 'system', 'integration')),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success'
    CHECK (outcome IN ('success', 'denied', 'failed')),
  request_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at
  ON audit_log (occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id
  ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id
  ON audit_log (request_id);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  legacy_id INTEGER UNIQUE,
  integration TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'partial', 'failed')),
  records_processed INTEGER NOT NULL DEFAULT 0 CHECK (records_processed >= 0),
  records_failed INTEGER NOT NULL DEFAULT 0 CHECK (records_failed >= 0),
  error_summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_integration_started
  ON sync_log (integration, started_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_status
  ON sync_log (status);
