/**
 * Profile Centre — Database layer
 *
 * Uses SQLite (better-sqlite3) stored at /private/db/ — persistent and
 * not web-accessible. All schema creation happens at startup in this file.
 */

import { randomBytes } from 'node:crypto';

// ── Always use Airo SQLite — Azure SQL removed ────────────────────────────────

// ── SQLITE PATH (default / Airo production) ──────────────────────────────────
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync, existsSync, copyFileSync, renameSync } from 'node:fs';

// SECURITY: Database files must NEVER be stored under /shared-storage/public/
// because that path is served as static files and is publicly accessible.
// Use /private/ which is persistent but NOT web-accessible.
const privateDataDir = '/private/db';
const legacyPublicDir = '/shared-storage/public/assets/db';

mkdirSync(privateDataDir, { recursive: true });

// Migrate from old public location if needed
const legacyDbPath = join(legacyPublicDir, 'japrofilestudio.db');
const privateDbPath = join(privateDataDir, 'japrofilestudio.db');

if (existsSync(legacyDbPath) && !existsSync(privateDbPath)) {
  try {
    copyFileSync(legacyDbPath, privateDbPath);
    for (const ext of ['-wal', '-shm']) {
      const src = legacyDbPath + ext;
      const dst = privateDbPath + ext;
      if (existsSync(src)) copyFileSync(src, dst);
    }
    console.log('[db] Migrated database from public storage to /private/db — files are no longer web-accessible');
    for (const ext of ['', '-wal', '-shm']) {
      const src = legacyDbPath + ext;
      if (existsSync(src)) {
        try { renameSync(src, src + '.bak'); } catch { /* cross-device — leave in place */ }
      }
    }
  } catch (err) {
    console.error('[db] Migration from public to private failed — falling back to private path anyway:', err);
  }
}

// Fall back to local data/ dir in dev when /private/ is not available
const dataDir = existsSync('/private') ? privateDataDir : join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'japrofilestudio.db');
const sqliteDb = new Database(dbPath);

// Enable WAL mode for better performance
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

// Create all tables
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    plan_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    job_title TEXT,
    company TEXT,
    bio TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    profile_photo TEXT,
    is_published INTEGER DEFAULT 1,
    show_phone INTEGER DEFAULT 1,
    show_email INTEGER DEFAULT 1,
    show_website INTEGER DEFAULT 1,
    show_address INTEGER DEFAULT 1,
    show_bio INTEGER DEFAULT 1,
    theme_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profile_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    platform TEXT,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    is_enabled INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS qr_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    qr_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contact_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_hash TEXT,
    user_agent TEXT
  );

  CREATE TABLE IF NOT EXISTS link_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL REFERENCES profile_links(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    primary_color TEXT,
    accent_color TEXT,
    background_color TEXT,
    text_color TEXT,
    is_free INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price_monthly REAL DEFAULT 0,
    price_yearly REAL DEFAULT 0,
    max_profiles INTEGER DEFAULT 1,
    max_links INTEGER DEFAULT 5,
    has_qr_download INTEGER DEFAULT 0,
    has_contact_form INTEGER DEFAULT 0,
    has_advanced_analytics INTEGER DEFAULT 0,
    has_vcard_download INTEGER DEFAULT 0,
    has_custom_themes INTEGER DEFAULT 0,
    remove_branding INTEGER DEFAULT 0,
    has_custom_domain INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    status TEXT DEFAULT 'active',
    billing_interval TEXT DEFAULT 'monthly',
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    current_period_start DATETIME,
    current_period_end DATETIME,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    cancelled_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS stripe_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Idempotent column migrations
const runMigration = (sql: string) => { try { sqliteDb.exec(sql); } catch { /* column already exists */ } };
runMigration('ALTER TABLE users ADD COLUMN stripe_customer_id TEXT');
runMigration('ALTER TABLE users ADD COLUMN lifetime_access INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN lifetime_plan_id INTEGER');
runMigration('ALTER TABLE users ADD COLUMN lifetime_granted_at DATETIME');
runMigration('ALTER TABLE users ADD COLUMN lifetime_granted_by TEXT');
runMigration('ALTER TABLE users ADD COLUMN lifetime_reason_category TEXT');
runMigration('ALTER TABLE users ADD COLUMN lifetime_internal_note TEXT');
runMigration('ALTER TABLE users ADD COLUMN lifetime_review_date TEXT');
runMigration('ALTER TABLE users ADD COLUMN lifetime_customer_note TEXT');
runMigration('ALTER TABLE users ADD COLUMN lifetime_can_be_withdrawn INTEGER DEFAULT 1');

// ── Lifetime access log table ──────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS lifetime_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('granted','updated','reviewed','withdrawn')),
    reason_category TEXT,
    internal_note TEXT,
    customer_note TEXT,
    granted_by TEXT,
    review_date TEXT,
    can_be_withdrawn INTEGER DEFAULT 1,
    fallback_plan_slug TEXT,
    withdrawal_reason TEXT,
    notify_user INTEGER DEFAULT 0,
    actor_id INTEGER,
    actor_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
runMigration('ALTER TABLE users ADD COLUMN entra_oid TEXT');
runMigration('ALTER TABLE users ADD COLUMN referred_by_code TEXT');
runMigration('ALTER TABLE plans ADD COLUMN stripe_price_monthly TEXT');
runMigration('ALTER TABLE plans ADD COLUMN stripe_price_yearly TEXT');
runMigration('ALTER TABLE plans ADD COLUMN stripe_price_lifetime TEXT');
runMigration('ALTER TABLE plans ADD COLUMN has_lifetime INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN stripe_product_id TEXT');
runMigration('ALTER TABLE plans ADD COLUMN has_messaging INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN max_seats INTEGER DEFAULT 1');
// Index for OID lookups
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_users_entra_oid ON users (entra_oid)'); } catch { /* exists */ }

// ── Messaging 2-way: visitor token + verification ──────────────────────────
runMigration('ALTER TABLE plans ADD COLUMN has_messaging INTEGER DEFAULT 0');
runMigration('ALTER TABLE card_message_threads ADD COLUMN visitor_token TEXT');
runMigration('ALTER TABLE card_message_threads ADD COLUMN visitor_verified INTEGER DEFAULT 0');
runMigration('ALTER TABLE card_message_threads ADD COLUMN visitor_accepted INTEGER DEFAULT 0');

// ── Plan pause system ──────────────────────────────────────────────────────
runMigration('ALTER TABLE users ADD COLUMN is_paused INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN pause_reason TEXT');
runMigration('ALTER TABLE users ADD COLUMN referral_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN referral_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN last_login_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN phone TEXT');
runMigration('ALTER TABLE users ADD COLUMN marketing_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN marketing_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN terms_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN terms_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN privacy_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN privacy_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN data_improve_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN data_improve_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN updates_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN updates_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN crm_consent INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN crm_consent_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN consent_ip TEXT');
runMigration('ALTER TABLE users ADD COLUMN consent_version TEXT DEFAULT \'1.0\'');

// ── Free trial ─────────────────────────────────────────────────────────────
// trial_started_at: ISO timestamp set once when user claims the 1-month trial.
// NULL = never claimed. Once set, never overwritten.
runMigration('ALTER TABLE users ADD COLUMN trial_started_at TEXT');

// ── Post-trial plan selection period ───────────────────────────────────────
// plan_selection_deadline: set to (trial_end + 7 days) when trial expires.
// account_status: tracks the lifecycle stage of the account.
//   Values: 'active' | 'trial_active' | 'trial_ended' | 'plan_selection' | 'no_plan' | 'suspended'
// plan_selected_at: when the user chose a plan after trial ended.
runMigration('ALTER TABLE users ADD COLUMN plan_selection_deadline TEXT');
runMigration("ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'");
runMigration('ALTER TABLE users ADD COLUMN plan_selected_at TEXT');

// ── Onboarding / Assisted Setup ───────────────────────────────────────────
// assisted_setup_dismissed_at: ISO timestamp when user dismissed the overlay (or it auto-expired after 24h)
// assisted_setup_completed_steps: JSON array of step IDs the user has completed
// demo_mode: 1 = sandbox mode active (no live data written), 0 = live
// demo_mode_activated_at: when demo mode was last turned on
// legal_reaccepted_at: ISO timestamp of the most recent full legal re-acceptance
// legal_reaccept_version: version string of the terms they accepted (e.g. '2.0')
runMigration('ALTER TABLE users ADD COLUMN assisted_setup_dismissed_at TEXT');
runMigration("ALTER TABLE users ADD COLUMN assisted_setup_completed_steps TEXT DEFAULT '[]'");
runMigration('ALTER TABLE users ADD COLUMN demo_mode INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN demo_mode_activated_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN legal_reaccepted_at TEXT');
runMigration("ALTER TABLE users ADD COLUMN legal_reaccept_version TEXT DEFAULT '1.0'");


// entra_sync_failed: set to 1 when a Graph profile update fails after a local save.
// entra_sync_failed_at: ISO timestamp of the last failure.
// entra_sync_error: last error message for admin review.
runMigration('ALTER TABLE users ADD COLUMN entra_sync_failed INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN entra_sync_failed_at TEXT');
runMigration('ALTER TABLE users ADD COLUMN entra_sync_error TEXT');

// ── User blocking ──────────────────────────────────────────────────────────
// is_blocked: 1 = account blocked by admin, 0 = normal
// block_reason: optional admin note explaining the block
// blocked_at: ISO timestamp when the block was applied
runMigration('ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0');
runMigration('ALTER TABLE users ADD COLUMN block_reason TEXT');
runMigration('ALTER TABLE users ADD COLUMN blocked_at TEXT');

// ── User appearance preference ─────────────────────────────────────────────
// appearance_preference: 'light' | 'dark' | 'system'
// Stored per-user so their chosen theme persists across sessions/devices.
// 'system' = follow OS preference; 'light'/'dark' = explicit override.
runMigration("ALTER TABLE users ADD COLUMN appearance_preference TEXT DEFAULT 'dark'");

// ── Assisted Setup state (legacy column name) ──────────────────────────────
// assisted_setup_state: older column used in some handlers; kept for compatibility
runMigration("ALTER TABLE users ADD COLUMN assisted_setup_state TEXT DEFAULT '[]'");

// ── Subscription extra columns ─────────────────────────────────────────────
runMigration('ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0');
runMigration('ALTER TABLE subscriptions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');

// ── Admin notes on users ───────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS admin_user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name TEXT,
    note TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_admin_notes_user ON admin_user_notes (user_id, created_at DESC)'); } catch { /* exists */ }

// ── Data requests (GDPR / UK GDPR) ────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS data_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_name TEXT,
    internal_notes TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_data_requests_user ON data_requests (user_id, created_at DESC)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests (status, created_at DESC)'); } catch { /* exists */ }

// ── Profile URL scheme v2 ──────────────────────────────────────────────────
runMigration('ALTER TABLE profiles ADD COLUMN team_directory_public INTEGER DEFAULT 1');
try { sqliteDb.prepare("UPDATE profiles SET team_directory_public = 1 WHERE profile_type = 'business' AND team_directory_public IS NULL").run(); } catch { /* ignore */ }
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS account_closure_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by_name TEXT,
    confirmed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_closure_user ON account_closure_requests (user_id) WHERE status = \'pending\''); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_closure_status ON account_closure_requests (status, created_at DESC)'); } catch { /* exists */ }

// ── Theme plan gating ──────────────────────────────────────────────────────
runMigration('ALTER TABLE plans ADD COLUMN max_themes INTEGER DEFAULT -1');
try { sqliteDb.prepare("UPDATE plans SET max_themes = 1 WHERE slug = 'free' AND max_themes IS NULL OR max_themes = -1 AND slug = 'free'").run(); } catch { /* ignore */ }

// ── Audit log extra fields ─────────────────────────────────────────────────
runMigration('ALTER TABLE audit_log ADD COLUMN ip_address TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN user_agent TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN resource_type TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN resource_id TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN severity TEXT DEFAULT \'info\'');
runMigration('ALTER TABLE audit_log ADD COLUMN details TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN actor_id INTEGER');
runMigration('ALTER TABLE audit_log ADD COLUMN actor_name TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN actor_email TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN actor_type TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN tenant TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN auth_provider TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN result TEXT');
runMigration('ALTER TABLE audit_log ADD COLUMN resource_label TEXT');

// ── Audit log schema fix: rebuild if schema is outdated ──────────────────────
// Triggers if: admin_id is NOT NULL (blocks writes), OR details column is missing.
// The live DB may have the old schema with 'detail' (not 'details') and no actor_* cols.
// This is idempotent — safe to run every boot.
try {
  const auditCols = sqliteDb.prepare("PRAGMA table_info(audit_log)").all() as { name: string; notnull: number }[];
  const adminIdCol = auditCols.find(c => c.name === 'admin_id');
  const hasActorId = auditCols.some(c => c.name === 'actor_id');
  const hasDetailCol = auditCols.some(c => c.name === 'detail');   // old column name
  const hasDetailsCol = auditCols.some(c => c.name === 'details'); // new column name
  // Rebuild if: admin_id NOT NULL constraint, OR details column missing entirely
  const needsRebuild = (adminIdCol && adminIdCol.notnull === 1) || (!hasDetailsCol);
  if (needsRebuild) {
    const actorExpr = hasActorId
      ? 'CASE WHEN actor_id IS NOT NULL THEN actor_id ELSE admin_id END'
      : 'admin_id';
    const detailsExpr = hasDetailCol && hasDetailsCol
      ? 'COALESCE(details, detail)'
      : hasDetailsCol ? 'details'
      : hasDetailCol  ? 'detail'
      : 'NULL';
    sqliteDb.exec(`
      ALTER TABLE audit_log RENAME TO audit_log_v1;
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER,
        actor_name TEXT,
        actor_email TEXT,
        actor_type TEXT NOT NULL DEFAULT 'user',
        tenant TEXT,
        auth_provider TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL DEFAULT '',
        resource_id TEXT,
        resource_label TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        result TEXT NOT NULL DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO audit_log (id, actor_id, action, resource_type, details, ip_address, user_agent, created_at)
        SELECT id, ${actorExpr}, action, COALESCE(resource_type, ''), ${detailsExpr}, ip_address, user_agent, created_at
        FROM audit_log_v1;
      DROP TABLE audit_log_v1;
    `);
    console.log('[db] Rebuilt audit_log — admin_id NOT NULL constraint removed');
  }
} catch (e) {
  console.error('[db] audit_log rebuild check failed (non-fatal):', e);
}
// Generate tokens for existing threads that don't have one
try {
  const noToken = sqliteDb.prepare("SELECT id FROM card_message_threads WHERE visitor_token IS NULL").all() as { id: number }[];
  const upd = sqliteDb.prepare("UPDATE card_message_threads SET visitor_token = ? WHERE id = ?");
  for (const t of noToken) upd.run(randomBytes(24).toString('hex'), t.id);
} catch { /* table may not exist yet — tokens generated on insert */ }

// ── URL prefix system ─────────────────────────────────────────────────────
runMigration('ALTER TABLE profiles ADD COLUMN profile_type TEXT DEFAULT \'personal\'');
runMigration('ALTER TABLE profiles ADD COLUMN url_prefix TEXT DEFAULT \'F\'');
runMigration('ALTER TABLE profiles ADD COLUMN biz_slug TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN person_slug TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_name TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_description TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_category TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN opening_hours TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN logo_url TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN cover_url TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN services TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN team_members TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN announcements TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_description_html TEXT');

// ── Profile verification ──────────────────────────────────────────────────
runMigration('ALTER TABLE profiles ADD COLUMN is_verified INTEGER DEFAULT 0');
runMigration('ALTER TABLE profiles ADD COLUMN verified_at DATETIME');
runMigration('ALTER TABLE profiles ADD COLUMN verified_by TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN verification_requested_at DATETIME');
runMigration('ALTER TABLE profiles ADD COLUMN verification_request_note TEXT');
try { sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_biz_person ON profiles (biz_slug, person_slug) WHERE biz_slug IS NOT NULL'); } catch { /* exists */ }

// ── Business seats ────────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS business_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS business_seat_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
  );
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_business_seats_profile ON business_seats (profile_id)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_seat_invites_token ON business_seat_invites (token)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_seat_invites_email ON business_seat_invites (email, status)'); } catch { /* exists */ }

runMigration('ALTER TABLE profiles ADD COLUMN business_tagline TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_email TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_phone TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_website TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN business_address TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN social_links TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN max_seats INTEGER DEFAULT 5');

// ── Profile PIN + feature toggles ─────────────────────────────────────────
runMigration('ALTER TABLE profiles ADD COLUMN pin_hash TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN messaging_enabled INTEGER DEFAULT 1');
runMigration('ALTER TABLE profiles ADD COLUMN enquiry_enabled INTEGER DEFAULT 1');
runMigration('UPDATE profiles SET messaging_enabled = 1 WHERE messaging_enabled IS NULL');
runMigration('UPDATE profiles SET enquiry_enabled = 1 WHERE enquiry_enabled IS NULL');

// ── SEO & indexing columns ─────────────────────────────────────────────────
// allow_indexing: 0 = noindex (default for personal), 1 = index (default for business)
// seo_title: custom page title override (falls back to display_name / business_name)
// seo_description: custom meta description override (falls back to bio / business_description)
runMigration("ALTER TABLE profiles ADD COLUMN allow_indexing INTEGER DEFAULT 0");
runMigration("ALTER TABLE profiles ADD COLUMN seo_title TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN seo_description TEXT");
// Business profiles default to indexable; personal profiles default to noindex
runMigration("UPDATE profiles SET allow_indexing = 1 WHERE profile_type = 'business' AND allow_indexing IS NULL");
runMigration("UPDATE profiles SET allow_indexing = 0 WHERE profile_type = 'personal' AND allow_indexing IS NULL");

// ── Public profile directory search ───────────────────────────────────────
// search_directory_enabled: 1 = profile appears in the public /search directory
// Defaults to 0 (opt-in). Users can toggle this in their profile settings.
// Only published profiles with search_directory_enabled = 1 appear in results.
runMigration("ALTER TABLE profiles ADD COLUMN search_directory_enabled INTEGER DEFAULT 0");

// ── HTML bio support ───────────────────────────────────────────────────────
runMigration("ALTER TABLE profiles ADD COLUMN bio_html TEXT");

// ── Public profile PIN lock ────────────────────────────────────────────────
// Separate from the dashboard PIN (pin_hash). public_pin_hash gates the public view.
runMigration("ALTER TABLE profiles ADD COLUMN public_pin_hash TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN public_pin_enabled INTEGER DEFAULT 0");

// ── Plans: is_public flag (admin controls whether plan appears on public pricing page) ──
// Default existing plans to NOT public — admin must explicitly publish them.
runMigration("ALTER TABLE plans ADD COLUMN is_public INTEGER DEFAULT 0");
runMigration("ALTER TABLE plans ADD COLUMN has_profile_link_customisation INTEGER DEFAULT 0");

// ── Users: plan_id should default to NULL (no plan assigned) ──────────────
// SQLite can't ALTER DEFAULT, but new rows will use NULL via INSERT.
// Existing rows with plan_id = 1 (the old default) are left as-is.

// ── GDPR: data export log ─────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS gdpr_export_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    ip_address TEXT
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_gdpr_export_user ON gdpr_export_log (user_id, requested_at DESC)'); } catch { /* exists */ }

// ── Notifications table ────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC)'); } catch { /* exists */ }

// ── Issue reports table ────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS issue_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    subject TEXT,
    description TEXT NOT NULL,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Custom Domains table ──────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS custom_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_connected'
      CHECK(status IN (
        'not_connected','waiting_dns','dns_verified','securing','active',
        'failed','suspended','removed','access_expired','access_disabled'
      )),
    dns_status TEXT DEFAULT 'pending',
    ssl_status TEXT DEFAULT 'pending',
    dns_verified_at DATETIME,
    ssl_activated_at DATETIME,
    activated_at DATETIME,
    failure_reason TEXT,
    suspended_at DATETIME,
    suspended_by TEXT,
    removed_at DATETIME,
    removed_by TEXT,
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains (domain) WHERE status NOT IN (\'removed\')'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_custom_domains_user ON custom_domains (user_id)'); } catch { /* exists */ }
// Migration: add connection_method column if not present
try { sqliteDb.exec("ALTER TABLE custom_domains ADD COLUMN connection_method TEXT DEFAULT NULL"); } catch { /* column already exists */ }
// Migration: add manual_approval_reason column if not present
try { sqliteDb.exec("ALTER TABLE custom_domains ADD COLUMN manual_approval_reason TEXT DEFAULT NULL"); } catch { /* column already exists */ }

// ── Add-ons catalogue ─────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    billing_interval TEXT NOT NULL DEFAULT 'monthly'
      CHECK(billing_interval IN ('monthly','yearly','one_off')),
    is_active INTEGER NOT NULL DEFAULT 1,
    is_visible INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 99,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Customer add-on assignments ───────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS customer_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addon_id INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active','paused','cancelled','expired','suspended')),
    assigned_by TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    cancelled_at DATETIME,
    notes TEXT,
    UNIQUE(user_id, addon_id)
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_customer_addons_user ON customer_addons (user_id)'); } catch { /* exists */ }

// No default add-ons seeded — all add-ons are created manually by admin only

// ── Complaints table ──────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reference TEXT UNIQUE,
    category TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'open',
    summary TEXT NOT NULL,
    handler_name TEXT,
    escalation_status TEXT DEFAULT 'none',
    resolution_date DATETIME,
    internal_notes TEXT,
    customer_response TEXT,
    outcome TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Visitor / profile reports table ───────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS visitor_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
    reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'other',
    details TEXT,
    reporter_name TEXT,
    reporter_email TEXT,
    good_faith_confirmed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    admin_notes TEXT,
    action_taken TEXT,
    outcome TEXT,
    assigned_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Points & Rewards System ────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS points_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'discount',
    value TEXT NOT NULL,
    points_cost INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    stock INTEGER DEFAULT -1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS points_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    description TEXT,
    ref_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reward_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id INTEGER NOT NULL REFERENCES rewards(id),
    points_spent INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    code TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS referral_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger (user_id, created_at DESC)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_redemptions_user ON reward_redemptions (user_id, created_at DESC)'); } catch { /* exists */ }

// Seed default points rules
const ruleCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM points_rules').get() as { c: number }).c;
if (ruleCount === 0) {
  const insertRule = sqliteDb.prepare(`INSERT INTO points_rules (action, label, points, description) VALUES (?, ?, ?, ?)`);
  insertRule.run('signup',              'Account Registration',       50,  'Awarded when a new account is created');
  insertRule.run('profile_complete',    'Profile Completion',         100, 'Awarded when profile is fully filled in');
  insertRule.run('referral_signup',     'Referral Sign-up',           200, 'Awarded when someone signs up using your referral link');
  insertRule.run('referral_purchase',   'Referral Purchase',          500, 'Awarded when a referred user upgrades to a paid plan');
  insertRule.run('subscription_renew',  'Subscription Renewal',       100, 'Awarded each time a paid subscription renews');
  insertRule.run('promo_bonus',         'Promotional Bonus',          0,   'Manual promotional bonus awarded by admin');
  insertRule.run('manual_adjustment',   'Manual Adjustment',          0,   'Manual points adjustment by admin');
}

// Seed default rewards
const rewardCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM rewards').get() as { c: number }).c;
if (rewardCount === 0) {
  const insertReward = sqliteDb.prepare(`INSERT INTO rewards (name, description, type, value, points_cost) VALUES (?, ?, ?, ?, ?)`);
  insertReward.run('1 Month Free — Starter',      'Get one month free on the Starter plan',      'free_month',    'starter',      500);
  insertReward.run('1 Month Free — Professional', 'Get one month free on the Professional plan', 'free_month',    'professional', 1000);
  insertReward.run('10% Discount',                '10% off your next subscription payment',      'discount',      '10',           300);
  insertReward.run('25% Discount',                '25% off your next subscription payment',      'discount',      '25',           700);
  insertReward.run('Plan Upgrade Credit — £5',    '£5 account credit towards any plan',          'account_credit','5',            400);
  insertReward.run('Plan Upgrade Credit — £10',   '£10 account credit towards any plan',         'account_credit','10',           800);
}

// ── Profile design / type column migrations ────────────────────────────────
// These columns store the Profile Type & Design panel selections so they
// survive page refreshes and are returned by GET /api/profiles/me.
runMigration("ALTER TABLE profiles ADD COLUMN personal_type TEXT DEFAULT 'professional'");
runMigration("ALTER TABLE profiles ADD COLUMN business_type TEXT DEFAULT 'other'");
runMigration("ALTER TABLE profiles ADD COLUMN layout_preset TEXT DEFAULT 'card'");
runMigration("ALTER TABLE profiles ADD COLUMN colour_palette TEXT DEFAULT 'brand'");
runMigration("ALTER TABLE profiles ADD COLUMN custom_colour TEXT DEFAULT '#2563eb'");
runMigration("ALTER TABLE profiles ADD COLUMN button_style TEXT DEFAULT 'rounded'");
runMigration("ALTER TABLE profiles ADD COLUMN photo_shape TEXT DEFAULT 'circle'");
// Extended JSON section columns for business profiles
runMigration("ALTER TABLE profiles ADD COLUMN gallery TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN awards TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN faqs TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN certifications TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN testimonials TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN cta_buttons TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN payment_methods TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN featured_offer TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN booking_link TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN map_embed TEXT");
// Extended personal profile fields
runMigration("ALTER TABLE profiles ADD COLUMN headline TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN skills TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN languages TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN education TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN experience TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN portfolio_url TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN availability TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN pronouns TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN location_city TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN cover_image TEXT");

// Type-specific extended profile columns
runMigration("ALTER TABLE profiles ADD COLUMN social_channels TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN content_niche TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN speaking_topics TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN coaching_areas TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN volunteer_causes TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN ministry_role TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN publications TEXT");
// Creator extras
runMigration("ALTER TABLE profiles ADD COLUMN collab_rate TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN content_formats TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN platforms TEXT");
// Student extras
runMigration("ALTER TABLE profiles ADD COLUMN gpa TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN graduation_year TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN internships TEXT");
runMigration("ALTER TABLE profiles ADD COLUMN clubs TEXT");

// Theme column migrations
runMigration('ALTER TABLE themes ADD COLUMN category TEXT DEFAULT \'minimal\'');
runMigration('ALTER TABLE themes ADD COLUMN font_heading TEXT DEFAULT \'Inter\'');
runMigration('ALTER TABLE themes ADD COLUMN font_body TEXT DEFAULT \'Inter\'');
runMigration('ALTER TABLE themes ADD COLUMN card_style TEXT DEFAULT \'rounded\'');
runMigration('ALTER TABLE themes ADD COLUMN gradient TEXT');
runMigration('ALTER TABLE themes ADD COLUMN border_radius TEXT DEFAULT \'12px\'');
runMigration('ALTER TABLE themes ADD COLUMN button_style TEXT DEFAULT \'filled\'');
runMigration('ALTER TABLE themes ADD COLUMN layout TEXT DEFAULT \'centered\'');
runMigration('ALTER TABLE themes ADD COLUMN sort_order INTEGER DEFAULT 0');

// Seed plans
const planCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM plans').get() as { c: number }).c;
if (planCount === 0) {
  const insertPlan = sqliteDb.prepare(`
    INSERT INTO plans (name, slug, price_monthly, max_profiles, max_links,
      has_qr_download, has_contact_form, has_advanced_analytics, has_vcard_download,
      has_custom_themes, remove_branding, has_custom_domain, has_lifetime, has_messaging)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPlan.run('Free',             'free',             0,   1,   1,  0, 0, 0, 0, 0, 0, 0, 0, 0);
  insertPlan.run('Starter',         'starter',          5,   1,  20,  1, 1, 0, 0, 1, 0, 0, 0, 1);
  insertPlan.run('Professional',    'professional',     15,  2,  999, 1, 1, 1, 1, 1, 1, 0, 0, 1);
  insertPlan.run('Organisation',         'business',          29,  2,  999, 1, 1, 1, 1, 1, 1, 1, 0, 1);
  insertPlan.run('Ultimate Organisation','ultimate_business',  79,  5,  999, 1, 1, 1, 1, 1, 1, 1, 0, 1);
  insertPlan.run('Lifetime',        'lifetime',         0,  999, 999, 1, 1, 1, 1, 1, 1, 1, 1, 1);
} else {
  // Ensure plan names are correct (guard against accidental admin edits)
  sqliteDb.prepare("UPDATE plans SET name = 'Free'             WHERE slug = 'free'").run();
  sqliteDb.prepare("UPDATE plans SET name = 'Starter'          WHERE slug = 'starter'").run();
  sqliteDb.prepare("UPDATE plans SET name = 'Professional'     WHERE slug = 'professional'").run();
  sqliteDb.prepare("UPDATE plans SET name = 'Organisation'          WHERE slug = 'business'").run();
  sqliteDb.prepare("UPDATE plans SET name = 'Ultimate Organisation'  WHERE slug = 'ultimate_business'").run();
  sqliteDb.prepare("UPDATE plans SET name = 'Lifetime'         WHERE slug = 'lifetime'").run();
  sqliteDb.prepare("UPDATE plans SET has_messaging = 1 WHERE slug IN ('starter','professional','business','ultimate_business','lifetime')").run();
  // Clear "Powered by" branding text from signatures — branding is wordmark only
  sqliteDb.prepare("INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES ('signature_branding_text', '', CURRENT_TIMESTAMP)").run();
  // Profile limits per plan:
  //   free             = 1 personal only
  //   starter          = 1 personal only (NO business profile)
  //   professional     = 1 personal + 1 business  (2 total)
  //   business         = 1 personal + 1 business  (2 total)
  //   ultimate_business= 1 personal + 4 business  (5 total)
  sqliteDb.prepare("UPDATE plans SET max_profiles = 1   WHERE slug = 'free'").run();
  sqliteDb.prepare("UPDATE plans SET max_profiles = 1   WHERE slug = 'starter'").run();
  sqliteDb.prepare("UPDATE plans SET max_profiles = 2   WHERE slug = 'professional'").run();
  sqliteDb.prepare("UPDATE plans SET max_profiles = 2   WHERE slug = 'business'").run();
  sqliteDb.prepare("UPDATE plans SET max_profiles = 5   WHERE slug = 'ultimate_business'").run();
  sqliteDb.prepare("UPDATE plans SET max_profiles = 999 WHERE slug = 'lifetime'").run();
  // Ensure ultimate_business plan exists (for existing DBs that pre-date this plan)
  const ubExists = sqliteDb.prepare("SELECT id FROM plans WHERE slug = 'ultimate_business'").get();
  if (!ubExists) {
    sqliteDb.prepare(`
      INSERT INTO plans (name, slug, price_monthly, max_profiles, max_links,
        has_qr_download, has_contact_form, has_advanced_analytics, has_vcard_download,
        has_custom_themes, remove_branding, has_custom_domain, has_lifetime, has_messaging)
      VALUES ('Ultimate Organisation','ultimate_business',79,5,999,1,1,1,1,1,1,1,0,1)
    `).run();
  }
  // Enforce correct max_links per plan
  sqliteDb.prepare("UPDATE plans SET max_links = 1   WHERE slug = 'free'").run();
  sqliteDb.prepare("UPDATE plans SET max_links = 20  WHERE slug = 'starter'").run();
  sqliteDb.prepare("UPDATE plans SET max_links = 999 WHERE slug IN ('professional','business','ultimate_business','lifetime')").run();
  // Ensure max_seats values are correct
  sqliteDb.prepare("UPDATE plans SET max_seats = 1   WHERE slug = 'free'").run();
  sqliteDb.prepare("UPDATE plans SET max_seats = 1   WHERE slug = 'starter'").run();
  sqliteDb.prepare("UPDATE plans SET max_seats = 5   WHERE slug = 'professional'").run();
  sqliteDb.prepare("UPDATE plans SET max_seats = 20  WHERE slug IN ('business','ultimate_business')").run();
  sqliteDb.prepare("UPDATE plans SET max_seats = 999 WHERE slug = 'lifetime'").run();
  // Ensure remove_branding is correct
  sqliteDb.prepare("UPDATE plans SET remove_branding = 0 WHERE slug IN ('free','starter')").run();
  sqliteDb.prepare("UPDATE plans SET remove_branding = 1 WHERE slug IN ('professional','business','ultimate_business','lifetime')").run();
  // Ensure has_custom_themes is correct
  sqliteDb.prepare("UPDATE plans SET has_custom_themes = 0 WHERE slug = 'free'").run();
  sqliteDb.prepare("UPDATE plans SET has_custom_themes = 1 WHERE slug IN ('starter','professional','business','ultimate_business','lifetime')").run();
  // Ensure max_themes is correct
  sqliteDb.prepare("UPDATE plans SET max_themes = 1  WHERE slug = 'free'").run();
  sqliteDb.prepare("UPDATE plans SET max_themes = -1 WHERE slug IN ('starter','professional','business','ultimate_business','lifetime')").run();
  // Custom Domain is NOT a plan feature — ensure has_custom_domain = 0 on all plans
  sqliteDb.prepare("UPDATE plans SET has_custom_domain = 0").run();
  // ── Rename plans to Organisation branding (idempotent — safe to run every boot) ──
  sqliteDb.prepare("UPDATE plans SET name = 'Organisation'         WHERE slug = 'business'         AND name != 'Organisation'").run();
  sqliteDb.prepare("UPDATE plans SET name = 'Ultimate Organisation' WHERE slug = 'ultimate_business' AND name != 'Ultimate Organisation'").run();
  // ── Ensure ultimate_plus ("Ultimate Organisation+") plan exists ──────────
  // Contact-us only plan — no Stripe price, price_monthly = 0 (shown as "Contact us")
  const upExists = sqliteDb.prepare("SELECT id FROM plans WHERE slug = 'ultimate_plus'").get();
  if (!upExists) {
    sqliteDb.prepare(`
      INSERT INTO plans (name, slug, price_monthly, max_profiles, max_links,
        has_qr_download, has_contact_form, has_advanced_analytics, has_vcard_download,
        has_custom_themes, remove_branding, has_custom_domain, has_lifetime, has_messaging,
        max_seats, is_active, is_public)
      VALUES ('Ultimate Organisation+','ultimate_plus',0,10,999,1,1,1,1,1,1,0,0,0,40,1,1)
    `).run();
  }
  // Idempotent: keep name + seats correct on every boot
  sqliteDb.prepare("UPDATE plans SET name = 'Ultimate Organisation+', max_seats = 40, max_profiles = 10 WHERE slug = 'ultimate_plus'").run();
  const lifetimePlanExists = (sqliteDb.prepare("SELECT COUNT(*) as c FROM plans WHERE slug = 'lifetime'").get() as { c: number }).c > 0;
  if (!lifetimePlanExists) {
    sqliteDb.prepare(`
      INSERT INTO plans (name, slug, price_monthly, price_yearly, max_profiles, max_links, max_seats,
        has_qr_download, has_contact_form, has_advanced_analytics, has_vcard_download,
        has_custom_themes, remove_branding, has_messaging, has_lifetime, is_active, is_public)
      VALUES ('Lifetime', 'lifetime', 0, 0, 999, 999, 999, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0)
    `).run();
  }
}

// Seed live Stripe Price IDs — loaded from secrets to avoid hardcoding in source
// NOTE: Only monthly billing is offered. Yearly prices are not seeded.
import { getSecret } from '#airo/secrets';
const stripeSeeds: Array<{
  slug: string;
  product_id: string;
  price_monthly: string;
  price_lifetime: string;
}> = [
  {
    slug: 'starter',
    product_id:    String(getSecret('STRIPE_PRODUCT_STARTER') || ''),
    price_monthly: String(getSecret('STRIPE_PRICE_STARTER_MONTHLY') || ''),
    price_lifetime: '',
  },
  {
    slug: 'professional',
    product_id:    String(getSecret('STRIPE_PRODUCT_PROFESSIONAL') || ''),
    price_monthly: String(getSecret('STRIPE_PRICE_PROFESSIONAL_MONTHLY') || ''),
    price_lifetime: '',
  },
  {
    slug: 'business',
    product_id:    String(getSecret('STRIPE_PRODUCT_BUSINESS') || ''),
    price_monthly: String(getSecret('STRIPE_PRICE_BUSINESS_MONTHLY') || ''),
    price_lifetime: '',
  },
  {
    slug: 'ultimate_business',
    product_id:    String(getSecret('STRIPE_PRODUCT_ULTIMATE_BUSINESS') || ''),
    price_monthly: String(getSecret('STRIPE_PRICE_ULTIMATE_BUSINESS_MONTHLY') || ''),
    price_lifetime: '',
  },
  {
    slug: 'lifetime',
    product_id:    String(getSecret('STRIPE_PRODUCT_LIFETIME') || ''),
    price_monthly: '',
    price_lifetime: String(getSecret('STRIPE_PRICE_LIFETIME') || ''),
  },
];
const upsertStripePlan = sqliteDb.prepare(
  `UPDATE plans
   SET stripe_product_id = ?,
       stripe_price_monthly  = CASE WHEN ? != '' THEN ? ELSE stripe_price_monthly END,
       stripe_price_lifetime = CASE WHEN ? != '' THEN ? ELSE stripe_price_lifetime END
   WHERE slug = ?`
);
for (const s of stripeSeeds) {
  if (s.product_id || s.price_monthly || s.price_lifetime) {
    upsertStripePlan.run(
      s.product_id || null,
      s.price_monthly, s.price_monthly,
      s.price_lifetime, s.price_lifetime,
      s.slug,
    );
  }
}

// Seed themes
const themeCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM themes').get() as { c: number }).c;
if (themeCount < 10) {
  sqliteDb.exec('DELETE FROM themes');

  const insertTheme = sqliteDb.prepare(`
    INSERT INTO themes (name, slug, description, primary_color, accent_color, background_color, text_color,
      is_free, category, font_heading, font_body, card_style, gradient, border_radius, button_style, layout, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  type ThemeSeed = [string, string, string, string, string, string, string, number, string, string, string, string, string|null, string, string, string, number];

  const themes: ThemeSeed[] = [
    ['Default Blue','default','Clean professional blue','#3B82F6','#3B82F6','#FFFFFF','#0F172A',1,'minimal','Inter','Inter','rounded',null,'12px','filled','centered',1],
    ['Pure White','pure-white','Ultra-clean white canvas','#1E293B','#3B82F6','#FFFFFF','#0F172A',1,'minimal','Inter','Inter','flat',null,'4px','outline','centered',2],
    ['Soft Grey','soft-grey','Subtle grey tones, easy on the eye','#6B7280','#374151','#F9FAFB','#111827',1,'minimal','Inter','Inter','rounded',null,'8px','ghost','centered',3],
    ['Warm Ivory','warm-ivory','Warm ivory with charcoal text','#92400E','#D97706','#FFFBEB','#1C1917',1,'minimal','Playfair Display','Inter','rounded',null,'8px','filled','centered',4],
    ['Cool Slate','cool-slate','Cool slate palette, modern feel','#475569','#64748B','#F8FAFC','#0F172A',1,'minimal','Inter','Inter','rounded',null,'6px','outline','centered',5],
    ['Chalk','chalk','Chalk-white with ink-black accents','#000000','#1F2937','#FAFAFA','#111827',1,'minimal','Space Grotesk','Inter','flat',null,'0px','filled','centered',6],
    ['Linen','linen','Soft linen texture feel','#78716C','#A8A29E','#FAFAF9','#1C1917',1,'minimal','Lora','Lora','rounded',null,'8px','outline','centered',7],
    ['Ash','ash','Ash grey with subtle warmth','#57534E','#78716C','#F5F5F4','#1C1917',1,'minimal','Inter','Inter','rounded',null,'6px','ghost','centered',8],
    ['Bone','bone','Bone white, ultra minimal','#A16207','#CA8A04','#FEFCE8','#1A1A00',1,'minimal','DM Sans','DM Sans','flat',null,'4px','filled','centered',9],
    ['Parchment','parchment','Aged parchment warmth','#92400E','#B45309','#FEF3C7','#1C1917',1,'minimal','Merriweather','Merriweather','rounded',null,'4px','outline','centered',10],
    ['Midnight','midnight','Deep midnight blue, premium feel','#3B82F6','#60A5FA','#0F172A','#F1F5F9',1,'dark','Inter','Inter','rounded',null,'12px','filled','centered',11],
    ['Obsidian','obsidian','Pure black, bold contrast','#6366F1','#818CF8','#09090B','#FAFAFA',1,'dark','Space Grotesk','Inter','rounded',null,'8px','filled','centered',12],
    ['Charcoal','charcoal','Rich charcoal with blue accents','#60A5FA','#93C5FD','#1C1C1E','#F5F5F7',1,'dark','Inter','Inter','rounded',null,'10px','filled','centered',13],
    ['Graphite','graphite','Graphite dark with green neon','#4ADE80','#86EFAC','#1A1A1A','#F0FDF4',1,'dark','DM Sans','DM Sans','rounded',null,'8px','filled','centered',14],
    ['Dark Slate','dark-slate','Dark slate with amber highlights','#F59E0B','#FCD34D','#0F172A','#FEF3C7',1,'dark','Inter','Inter','rounded',null,'12px','filled','centered',15],
    ['Void','void','Pure void black with white text','#FFFFFF','#E5E7EB','#000000','#FFFFFF',1,'dark','Space Grotesk','Inter','flat',null,'0px','outline','centered',16],
    ['Dark Forest','dark-forest','Deep forest green dark theme','#22C55E','#4ADE80','#052E16','#F0FDF4',1,'dark','Inter','Inter','rounded',null,'10px','filled','centered',17],
    ['Dark Rose','dark-rose','Dark with rose gold accents','#FB7185','#FDA4AF','#1C0A0A','#FFF1F2',1,'dark','Playfair Display','Inter','rounded',null,'12px','filled','centered',18],
    ['Dark Violet','dark-violet','Deep violet dark mode','#A78BFA','#C4B5FD','#0D0D1A','#F5F3FF',1,'dark','Inter','Inter','rounded',null,'12px','filled','centered',19],
    ['Dark Teal','dark-teal','Dark with teal cyan accents','#2DD4BF','#5EEAD4','#042F2E','#F0FDFA',1,'dark','DM Sans','DM Sans','rounded',null,'10px','filled','centered',20],
    ['Sunset','sunset','Warm sunset gradient','#F97316','#EC4899','#FFF7ED','#1C0A00',0,'gradient','Poppins','Inter','rounded','linear-gradient(135deg,#FED7AA,#FECDD3)','16px','filled','centered',26],
    ['Ocean Breeze','ocean-breeze','Cool ocean gradient','#0EA5E9','#6366F1','#EFF6FF','#0C1A3A',0,'gradient','Inter','Inter','rounded','linear-gradient(135deg,#DBEAFE,#EDE9FE)','12px','filled','centered',27],
    ['Aurora','aurora','Northern lights gradient','#10B981','#6366F1','#F0FDF4','#0A1628',0,'gradient','Space Grotesk','Inter','rounded','linear-gradient(135deg,#D1FAE5,#EDE9FE)','16px','filled','centered',28],
    ['Rose Gold','rose-gold','Luxurious rose gold gradient','#F43F5E','#FB923C','#FFF1F2','#1C0A0A',0,'gradient','Playfair Display','Inter','rounded','linear-gradient(135deg,#FFE4E6,#FED7AA)','12px','filled','centered',29],
    ['Twilight','twilight','Deep twilight purple gradient','#8B5CF6','#EC4899','#FAF5FF','#1A0028',0,'gradient','Inter','Inter','rounded','linear-gradient(135deg,#EDE9FE,#FCE7F3)','16px','filled','centered',30],
    ['Corporate Blue','corporate-blue','Classic corporate blue','#1D4ED8','#2563EB','#FFFFFF','#1E3A5F',0,'professional','Inter','Inter','rounded',null,'8px','filled','left',41],
    ['Executive Grey','executive-grey','Executive grey, authoritative','#374151','#6B7280','#F9FAFB','#111827',0,'professional','Inter','Inter','flat',null,'4px','filled','left',42],
    ['Navy Pro','navy-pro','Deep navy professional','#1E3A5F','#2563EB','#FFFFFF','#1E3A5F',0,'professional','Merriweather','Inter','rounded',null,'6px','filled','left',43],
    ['Electric Purple','electric-purple','Bold electric purple','#9333EA','#A855F7','#FAF5FF','#1A0028',0,'creative','Space Grotesk','Inter','rounded',null,'16px','filled','centered',51],
    ['Hot Pink','hot-pink','Vibrant hot pink energy','#EC4899','#F472B6','#FDF2F8','#1A0028',0,'creative','Poppins','Poppins','rounded',null,'20px','filled','centered',52],
    ['Neon Green','neon-green','Neon green on dark','#4ADE80','#86EFAC','#052E16','#F0FDF4',0,'creative','Space Grotesk','Inter','rounded',null,'12px','filled','centered',53],
    ['Baby Blue','baby-blue','Soft baby blue pastel','#3B82F6','#60A5FA','#EFF6FF','#1E3A5F',1,'pastel','Poppins','Inter','rounded',null,'16px','filled','centered',106],
    ['Blush Pink','blush-pink','Soft blush pink pastel','#EC4899','#F472B6','#FDF2F8','#1A0028',1,'pastel','Poppins','Inter','rounded',null,'20px','filled','centered',107],
    ['Mint','mint','Fresh mint pastel','#10B981','#34D399','#ECFDF5','#052E16',1,'pastel','Poppins','Inter','rounded',null,'16px','filled','centered',108],
    ['Lilac','lilac','Soft lilac pastel','#8B5CF6','#A78BFA','#FAF5FF','#1A0028',1,'pastel','Poppins','Inter','rounded',null,'20px','filled','centered',109],
    ['Peach','peach','Warm peach pastel','#F97316','#FB923C','#FFF7ED','#1C0A00',1,'pastel','Poppins','Inter','rounded',null,'16px','filled','centered',110],
  ];

  for (const t of themes) {
    try { insertTheme.run(...t); } catch { /* skip duplicates */ }
  }
}

// Seed admin settings
const settingCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM admin_settings').get() as { c: number }).c;
if (settingCount === 0) {
  const insertSetting = sqliteDb.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)');
  insertSetting.run('site_name', 'Profile Centre');
  insertSetting.run('site_tagline', 'Your digital business card, reimagined.');
  insertSetting.run('allow_registration', 'true');
  insertSetting.run('maintenance_mode', 'false');
}

// Seed branding settings
const brandingDefaults: [string, string][] = [
  ['platform_name', 'Profile Centre'],
  ['platform_tagline', 'Your digital business card, reimagined.'],
  ['platform_description', 'Create a stunning digital profile that showcases who you are and what you do — share it with a single link.'],
  ['platform_url', 'https://profilecentre.jagroupservices.co.uk'],
  ['master_brand_name', 'JA Group Services Ltd'],
  ['master_brand_url', 'https://jagroupservices.co.uk'],
  ['legal_company_name', 'JA Group Services Ltd'],
  ['legal_company_number', ''],
  ['legal_registered_address', ''],
  ['legal_vat_number', ''],
  ['legal_email', 'profilecentre@jagroupservices.co.uk'],
  ['legal_privacy_email', 'privacy@jagroupservices.co.uk'],
  ['support_email', 'profilecentre@jagroupservices.co.uk'],
  ['contact_email', 'profilecentre@jagroupservices.co.uk'],
  ['footer_tagline', 'Part of JA Group Services Ltd'],
  ['footer_show_legal_name', '1'],
  ['social_twitter', ''],
  ['social_linkedin', ''],
  ['social_instagram', ''],
  ['social_facebook', ''],
  ['email_from_name', 'Profile Centre'],
  ['custom_domain_cname_target', 'profilecentre.jagroupservices.co.uk'],
];
const upsertBranding = sqliteDb.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)');
for (const [k, v] of brandingDefaults) upsertBranding.run(k, v);

// Force-correct stale values (runs on every startup — idempotent)
const correctValues: [string, string][] = [
  ['platform_name',  'Profile Centre'],
  ['site_name',      'Profile Centre'],
  ['support_email',  'profilecentre@jagroupservices.co.uk'],
  ['contact_email',  'profilecentre@jagroupservices.co.uk'],
  ['legal_email',    'profilecentre@jagroupservices.co.uk'],
  ['platform_url',   'https://profilecentre.jagroupservices.co.uk'],
];
const fixBranding = sqliteDb.prepare('UPDATE admin_settings SET value = ? WHERE key = ? AND value != ?');
for (const [k, v] of correctValues) fixBranding.run(v, k, v);

// ── Referral & Points system ────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS referral_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'signup',
    points_awarded INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes (user_id)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events (referrer_user_id)'); } catch { /* exists */ }

// ── Profiles column migrations ───────────────────────────────────────────────
// SQLite does not support IF NOT EXISTS on ALTER TABLE ADD COLUMN, so each
// migration is wrapped in its own try/catch — already-existing columns are
// silently skipped.
const profileMigrations: [string, string][] = [
  ['profile_type',                "TEXT NOT NULL DEFAULT 'personal'"],
  ['biz_slug',                    'TEXT'],
  ['person_slug',                 'TEXT'],
  ['business_name',               'TEXT'],
  ['business_description',        'TEXT'],
  ['business_category',           'TEXT'],
  ['business_email',              'TEXT'],
  ['business_phone',              'TEXT'],
  ['contact_email',               'TEXT'],
  ['seo_title',                   'TEXT'],
  ['seo_description',             'TEXT'],
  ['is_suspended',                'INTEGER DEFAULT 0'],
  ['is_hidden',                   'INTEGER DEFAULT 0'],
  ['is_verified',                 'INTEGER DEFAULT 0'],
  ['verified_at',                 'DATETIME'],
  ['verified_by',                 'INTEGER'],
  ['verification_requested_at',   'DATETIME'],
  ['verification_request_note',   'TEXT'],
  ['cover_image',                 'TEXT'],
  ['avatar_url',                  'TEXT'],
  ['layout_style',                'TEXT'],
  ['design_style',                'TEXT'],
  ['color_scheme',                'TEXT'],
  ['font_style',                  'TEXT'],
  ['skills',                      'TEXT'],
  ['languages',                   'TEXT'],
  ['experience',                  'TEXT'],
  ['education',                   'TEXT'],
  ['awards',                      'TEXT'],
  ['certifications',              'TEXT'],
  ['gallery',                     'TEXT'],
  ['faqs',                        'TEXT'],
  ['testimonials',                'TEXT'],
  ['services',                    'TEXT'],
  ['team_members',                'TEXT'],
  ['payment_methods',             'TEXT'],
  ['business_hours',              'TEXT'],
  ['featured_offer',              'TEXT'],
  ['booking_url',                 'TEXT'],
  ['map_embed_url',               'TEXT'],
  ['cta_label',                   'TEXT'],
  ['cta_url',                     'TEXT'],
  ['show_contact_form',           'INTEGER DEFAULT 1'],
  ['show_qr_code',                'INTEGER DEFAULT 1'],
  ['plan_gated',                  'INTEGER DEFAULT 0'],
];
for (const [col, def] of profileMigrations) {
  try {
    sqliteDb.exec(`ALTER TABLE profiles ADD COLUMN ${col} ${def}`);
  } catch { /* column already exists — skip */ }
}

// ── Late-created tables ──────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS partner_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'affiliate',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    website TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT NULL,
    category TEXT DEFAULT NULL,
    assigned_to INTEGER DEFAULT NULL,
    internal_notes TEXT DEFAULT NULL,
    related_profile_id INTEGER DEFAULT NULL,
    related_domain_id INTEGER DEFAULT NULL,
    resolved_at DATETIME DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unread_admin INTEGER DEFAULT 0,
    unread_user INTEGER DEFAULT 0,
    consent_given_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT NOT NULL,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'pending'
  );
`);

// ── Card Messaging system ────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS card_message_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS card_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES card_message_threads(id) ON DELETE CASCADE,
    sender TEXT NOT NULL DEFAULT 'visitor',
    body TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_card_threads_profile ON card_message_threads (profile_id)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_card_messages_thread ON card_messages (thread_id)'); } catch { /* exists */ }

// ── Affiliate programme tables ──────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS affiliate_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    website TEXT,
    audience TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    commission_rate REAL DEFAULT 10.0,
    affiliate_code TEXT UNIQUE,
    approved_at DATETIME,
    rejected_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id INTEGER NOT NULL REFERENCES affiliate_applications(id) ON DELETE CASCADE,
    referred_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    stripe_subscription_id TEXT,
    plan_name TEXT,
    amount_gbp REAL NOT NULL DEFAULT 0,
    commission_gbp REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_affiliate_apps_user ON affiliate_applications (user_id)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_affiliate_apps_code ON affiliate_applications (affiliate_code)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON affiliate_commissions (affiliate_id)'); } catch { /* exists */ }

// ── UK GDPR migrations ──────────────────────────────────────────────────────
runMigration('ALTER TABLE page_views ADD COLUMN ip_hash_v2 TEXT');
// Drop user_agent column from page_views — it can fingerprint individuals (GDPR Art 4(1)).
// SQLite does not support DROP COLUMN before v3.35; we use a safe no-op approach:
// the column is never written to on new rows (recordView only writes ip_hash_v2).
// A full column removal would require a table rebuild — deferred to a future migration.
runMigration('ALTER TABLE contact_enquiries ADD COLUMN consent_given_at DATETIME');
runMigration('ALTER TABLE contact_enquiries ADD COLUMN sender_ip TEXT DEFAULT NULL');
runMigration('ALTER TABLE contact_enquiries ADD COLUMN sender_user_agent TEXT DEFAULT NULL');
runMigration('ALTER TABLE contact_enquiries ADD COLUMN is_vpn INTEGER DEFAULT NULL');
runMigration('ALTER TABLE contact_enquiries ADD COLUMN vpn_check_detail TEXT DEFAULT NULL');
runMigration('ALTER TABLE partner_enquiries ADD COLUMN consent_given_at DATETIME');
runMigration('ALTER TABLE support_requests ADD COLUMN consent_given_at DATETIME');
runMigration('ALTER TABLE support_requests ADD COLUMN priority TEXT DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN category TEXT DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN assigned_to INTEGER DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN internal_notes TEXT DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN related_profile_id INTEGER DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN related_domain_id INTEGER DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN resolved_at DATETIME DEFAULT NULL');
runMigration('ALTER TABLE support_requests ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
// Belt-and-braces: use PRAGMA to confirm the column exists before queries run.
// runMigration swallows all errors, so if the ALTER failed silently on the live DB
// this explicit check will add it now.
(function ensureSupportRequestsUpdatedAt() {
  try {
    const cols = sqliteDb.pragma('table_info(support_requests)') as { name: string }[];
    if (!cols.some(c => c.name === 'updated_at')) {
      sqliteDb.exec('ALTER TABLE support_requests ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
  } catch { /* table may not exist yet — CREATE TABLE above will add it with the column */ }
})();
runMigration('ALTER TABLE support_requests ADD COLUMN unread_admin INTEGER DEFAULT 0');
runMigration('ALTER TABLE support_requests ADD COLUMN unread_user INTEGER DEFAULT 0');

// Support request threaded messages
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS support_request_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('user','admin')),
    sender_id INTEGER,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_srm_ticket ON support_request_messages(ticket_id);
`);

// ── Plans visibility + HTML bio ──────────────────────────────────────────────
// is_public: 1 = shown on public pricing page, 0 = admin-only (hidden from public)
runMigration('ALTER TABLE plans ADD COLUMN is_public INTEGER DEFAULT 0');
// bio_html: allows raw HTML in profile bio (sanitised server-side)
runMigration('ALTER TABLE profiles ADD COLUMN bio_html TEXT');
// public_pin_hash: PIN to lock public profile view (separate from admin PIN)
runMigration('ALTER TABLE profiles ADD COLUMN public_pin_hash TEXT');
// public_pin_enabled: whether the public PIN gate is active
runMigration('ALTER TABLE profiles ADD COLUMN public_pin_enabled INTEGER DEFAULT 0');

// ── Profile reporting enhancements ────────────────────────────────────────
// Ensure issue_reports has all fields needed for profile reports
runMigration('ALTER TABLE issue_reports ADD COLUMN profile_type TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN reported_url TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN reporter_ip TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN reporter_ua TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN content_snapshot TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN reported_user_id INTEGER');
runMigration('ALTER TABLE issue_reports ADD COLUMN reported_profile_id INTEGER');
runMigration('ALTER TABLE issue_reports ADD COLUMN report_reason TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN ip_address TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN user_agent TEXT');

// ── Auto-scan columns on issue_reports ────────────────────────────────────────
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_status TEXT DEFAULT \'pending\'');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_risk_level TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_summary TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_completed_at DATETIME');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_id INTEGER');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_override_risk TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_override_by TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_override_at DATETIME');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_reviewed INTEGER DEFAULT 0');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_reviewed_by TEXT');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_reviewed_at DATETIME');
runMigration('ALTER TABLE issue_reports ADD COLUMN scan_internal_notes TEXT');

// ── Profile scans table ────────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS profile_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER REFERENCES issue_reports(id) ON DELETE SET NULL,
    profile_id INTEGER NOT NULL,
    profile_type TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'low',
    risk_score INTEGER NOT NULL DEFAULT 0,
    issue_categories TEXT,
    summary TEXT,
    evidence TEXT,
    recommended_action TEXT,
    scan_version TEXT DEFAULT '1.0',
    triggered_by TEXT DEFAULT 'auto_report',
    auto_hidden INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_profile_scans_profile ON profile_scans (profile_id)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_profile_scans_report ON profile_scans (report_id)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_profile_scans_risk ON profile_scans (risk_level)'); } catch { /* exists */ }

// Profile moderation: admins can suspend or hide a profile from public view
runMigration('ALTER TABLE profiles ADD COLUMN is_suspended INTEGER DEFAULT 0');
runMigration('ALTER TABLE profiles ADD COLUMN suspended_at DATETIME');
runMigration('ALTER TABLE profiles ADD COLUMN suspended_by TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN suspension_reason TEXT');
runMigration('ALTER TABLE profiles ADD COLUMN is_hidden INTEGER DEFAULT 0');
runMigration('ALTER TABLE profiles ADD COLUMN hidden_at DATETIME');
runMigration('ALTER TABLE profiles ADD COLUMN hidden_by TEXT');

// ── Site editor activation flag ────────────────────────────────────────────
// use_custom_editor: user must explicitly activate the site editor for a profile
// before they can save/publish custom HTML/CSS. Defaults to 0 (off).
// This ensures the standard profile template is shown unless the user has
// consciously opted in to custom HTML/CSS for that specific profile.
runMigration('ALTER TABLE profiles ADD COLUMN use_custom_editor INTEGER DEFAULT 0');

// Default plan = NULL (users must pick a plan; no auto-assignment to free)
// Existing users with plan_id = 1 (free) keep it — only NEW users get NULL
// The users.plan_id column already allows NULL (no NOT NULL constraint)
try {
  sqliteDb.exec(`ALTER TABLE users ALTER COLUMN plan_id DROP DEFAULT`);
} catch { /* SQLite doesn't support DROP DEFAULT — handled via INSERT logic */ }

// Mark all existing plans as NOT public by default (admin controls visibility)
// Admin can flip is_public=1 for plans they want shown on the pricing page
try {
  sqliteDb.prepare("UPDATE plans SET is_public = 0 WHERE is_public IS NULL").run();
} catch { /* ignore */ }

// ── Site theme / appearance settings ────────────────────────────────────────
const themeDefaults: [string, string][] = [
  ['site_color_mode', 'dark'],
  ['site_primary_color', '#3B82F6'],
  ['site_secondary_color', '#513bf6'],
  ['site_accent_color', '#3B82F6'],
];
const upsertThemeSetting = sqliteDb.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)');
for (const [k, v] of themeDefaults) upsertThemeSetting.run(k, v);

// ── Support PIN table ────────────────────────────────────────────────────────
// Auto-rotating 6-digit PIN for telephone support identity verification.
// PIN rotates every 30 minutes server-side. Never stored in localStorage.
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS support_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  )
`);

// ── Session activity table ───────────────────────────────────────────────────
// Tracks last activity time server-side for idle auto-logout.
// No localStorage — purely server-side session management.
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS session_activity (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    fingerprint TEXT
  )
`);

// ── Coming soon countdown ────────────────────────────────────────────────────
runMigration("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('coming_soon_launch_date', '')");
runMigration("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('coming_soon_headline', 'Coming Soon')");
runMigration("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('coming_soon_subtext', 'We are putting the finishing touches on something great.')");

// ── Messaging moderation: sender IP, blocked IPs, moderation actions ─────────
runMigration('ALTER TABLE card_message_threads ADD COLUMN sender_ip TEXT');
runMigration('ALTER TABLE card_message_threads ADD COLUMN severity TEXT DEFAULT \'normal\'');
runMigration('ALTER TABLE card_message_threads ADD COLUMN auto_flagged INTEGER DEFAULT 0');
runMigration('ALTER TABLE card_message_threads ADD COLUMN flag_reason TEXT');
runMigration('ALTER TABLE card_message_threads ADD COLUMN is_reported INTEGER DEFAULT 0');
runMigration('ALTER TABLE card_message_threads ADD COLUMN report_reason TEXT');
runMigration('ALTER TABLE card_message_threads ADD COLUMN reported_at TEXT');
runMigration('ALTER TABLE card_messages ADD COLUMN sender_type TEXT');
runMigration('ALTER TABLE card_messages ADD COLUMN sender_name TEXT');

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    blocked_by_name TEXT,
    thread_id INTEGER REFERENCES card_message_threads(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips (ip_address)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin ON moderation_actions (admin_id)'); } catch { /* exists */ }

// ── Business Card Orders ───────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS business_card_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    quantity INTEGER DEFAULT 50,
    finish TEXT DEFAULT 'matte',
    sides TEXT DEFAULT 'double',
    name TEXT,
    role TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    brand_colour TEXT,
    notes TEXT,
    internal_notes TEXT,
    provider TEXT,
    provider_ref TEXT,
    customer_approved INTEGER DEFAULT 0,
    customer_approved_at DATETIME,
    payment_status TEXT DEFAULT 'unpaid',
    dispatch_tracking TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_bc_orders_user ON business_card_orders (user_id, created_at DESC)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_bc_orders_status ON business_card_orders (status, created_at DESC)'); } catch { /* exists */ }

// ── Business cards: fee + proof columns (safe migrations) ──────────────────
runMigration('ALTER TABLE business_card_orders ADD COLUMN design_fee_amount REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN design_fee_description TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN design_fee_status TEXT DEFAULT \'none\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN fee_quoted_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN fee_accepted_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN fee_declined_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN proof_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN proof_sent_at DATETIME');
// Store overhaul v1 columns
runMigration("ALTER TABLE business_card_orders ADD COLUMN design_type TEXT DEFAULT 'human'");
runMigration('ALTER TABLE business_card_orders ADD COLUMN attached_image_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN card_color TEXT DEFAULT \'#1e3a5f\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN card_accent TEXT DEFAULT \'#c8a96e\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN card_layout TEXT DEFAULT \'classic\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN name_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN role_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN phone_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN email_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN website_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN tagline_on_card TEXT');
// Store overhaul v2 — proper storefront columns
runMigration("ALTER TABLE business_card_orders ADD COLUMN card_type TEXT DEFAULT 'standard'");   // standard|square|slim|folded|qr|logo
runMigration("ALTER TABLE business_card_orders ADD COLUMN card_size TEXT DEFAULT '85x55'");      // 85x55|65x65|85x40|87x49
runMigration("ALTER TABLE business_card_orders ADD COLUMN corner_type TEXT DEFAULT 'square'");   // square|rounded
runMigration('ALTER TABLE business_card_orders ADD COLUMN customer_notes TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN has_own_design INTEGER DEFAULT 0');    // 1=yes upload, 0=needs design
runMigration('ALTER TABLE business_card_orders ADD COLUMN upload_urls TEXT');                    // JSON array of uploaded file URLs
// Admin pricing & Stripe payment link fields
runMigration('ALTER TABLE business_card_orders ADD COLUMN provider TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN provider_cost REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN delivery_cost REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN vat_amount REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN handling_fee REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN total_quoted REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_payment_link TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_link_sent_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_payment_due_at DATETIME');
runMigration("ALTER TABLE business_card_orders ADD COLUMN stripe_payment_status TEXT DEFAULT 'not_sent'");
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_payment_ref TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_amount_requested REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_amount_paid REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_payment_notes TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN payment_received_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN provider_ref TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN dispatch_tracking TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN internal_notes TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN customer_approved INTEGER DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN customer_approved_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN payment_status TEXT DEFAULT \'none\'');

// ── Issue reports: add ip_address for rate-limiting profile reports ─────────
runMigration('ALTER TABLE issue_reports ADD COLUMN ip_address TEXT');

// ── Business card order messages ────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS business_card_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES business_card_orders(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('customer', 'admin')),
    sender_name TEXT,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_bc_messages_order ON business_card_messages (order_id, created_at)'); } catch { /* exists */ }

// ── Business cards feature flag (admin-controlled) ─────────────────────────
try {
  sqliteDb.prepare(`INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('business_cards_enabled', '1')`).run();
} catch { /* ignore */ }

// ── VAT settings table ──────────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS vat_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    vat_enabled INTEGER NOT NULL DEFAULT 0,
    vat_number TEXT,
    vat_rate REAL DEFAULT 20.0,
    vat_wording_invoice TEXT DEFAULT 'VAT',
    vat_wording_quote TEXT DEFAULT 'VAT',
    vat_shown_separately INTEGER NOT NULL DEFAULT 1,
    vat_applies_to_delivery INTEGER NOT NULL DEFAULT 0,
    vat_applies_to_design_fee INTEGER NOT NULL DEFAULT 0,
    vat_invoice_notes TEXT,
    vat_enabled_at DATETIME,
    vat_enabled_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    vat_enabled_by_admin_name TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try {
  sqliteDb.prepare(`INSERT OR IGNORE INTO vat_settings (id, vat_enabled) VALUES (1, 0)`).run();
} catch { /* exists */ }

// ── Business card templates ─────────────────────────────────────────────────
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS card_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','archived')),
    is_premium INTEGER NOT NULL DEFAULT 0,
    front_bg_color TEXT DEFAULT '#1e3a5f',
    front_text_color TEXT DEFAULT '#ffffff',
    front_accent_color TEXT DEFAULT '#c8a96e',
    back_bg_color TEXT DEFAULT '#ffffff',
    back_text_color TEXT DEFAULT '#1e3a5f',
    layout_style TEXT DEFAULT 'classic',
    supports_back INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 99,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed 5 default templates (INSERT OR IGNORE — never overwrites admin edits)
const seedTemplate = sqliteDb.prepare(`
  INSERT OR IGNORE INTO card_templates
    (slug, name, description, front_bg_color, front_text_color, front_accent_color, back_bg_color, back_text_color, layout_style, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const templateSeed: [string, string, string, string, string, string, string, string, string, number][] = [
  ['minimal-professional', 'Minimal Professional', 'Clean, minimal layout with subtle accent line. Ideal for consultants and professionals.', '#ffffff', '#1a1a2e', '#2563eb', '#f8f9fa', '#1a1a2e', 'minimal', 1],
  ['bold-modern',          'Bold Modern',          'High-contrast bold design with strong typography. Great for creative professionals.', '#0f172a', '#ffffff', '#f59e0b', '#ffffff', '#0f172a', 'bold', 2],
  ['premium-dark',         'Premium Dark',         'Sophisticated dark background with gold accents. Perfect for luxury or executive branding.', '#1a1a2e', '#f5f0e8', '#c8a96e', '#f5f0e8', '#1a1a2e', 'premium', 3],
  ['clean-corporate',      'Clean Corporate',      'Professional blue corporate style with clean layout. Ideal for business and finance.', '#1e3a5f', '#ffffff', '#e8f0fe', '#ffffff', '#1e3a5f', 'corporate', 4],
  ['qr-focus',             'QR Focus',             'Design built around your Profile Centre QR code. QR code is the centrepiece.', '#ffffff', '#111827', '#2563eb', '#111827', '#ffffff', 'qr_focus', 5],
];
for (const row of templateSeed) seedTemplate.run(...row);

// ── New business_card_orders columns (v3 — three-option rebuild) ────────────
runMigration("ALTER TABLE business_card_orders ADD COLUMN request_type TEXT DEFAULT 'builder'");
// request_type: 'builder' | 'upload_own' | 'custom_design'
runMigration('ALTER TABLE business_card_orders ADD COLUMN template_id INTEGER REFERENCES card_templates(id) ON DELETE SET NULL');
runMigration('ALTER TABLE business_card_orders ADD COLUMN template_data TEXT');   // JSON: all builder field values
runMigration('ALTER TABLE business_card_orders ADD COLUMN logo_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN qr_code_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN front_bg_color TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN front_text_color TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN front_accent_color TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN font_choice TEXT DEFAULT \'Inter\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN brand_colors TEXT');    // JSON: customer-provided brand colours
runMigration('ALTER TABLE business_card_orders ADD COLUMN style_preference TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN address_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN social_links TEXT');    // JSON
runMigration('ALTER TABLE business_card_orders ADD COLUMN front_back_preference TEXT DEFAULT \'double\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN qr_required INTEGER DEFAULT 1');
runMigration('ALTER TABLE business_card_orders ADD COLUMN upload_front_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN upload_back_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN upload_file_type TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN delivery_address TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN business_name_on_card TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN proof_download_count INTEGER DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN final_file_enabled INTEGER DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN final_file_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN final_file_enabled_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN final_file_enabled_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
// Stripe invoice fields (v3)
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_id TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_url TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_status TEXT DEFAULT \'not_required\'');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_line_items TEXT');  // JSON
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_due_date TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_notes TEXT');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_created_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN stripe_invoice_sent_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN artwork_prep_fee REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN logo_placement_fee REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN qr_setup_fee REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN premium_finish_cost REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN rush_fee REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN design_deposit_amount REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN design_deposit_paid INTEGER DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN design_deposit_paid_at DATETIME');
runMigration('ALTER TABLE business_card_orders ADD COLUMN vat_enabled_on_order INTEGER DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN vat_rate_on_order REAL DEFAULT 0');
runMigration('ALTER TABLE business_card_orders ADD COLUMN vat_amount_on_order REAL DEFAULT 0');

// ── New profile feature columns ──────────────────────────────────────────────
runMigration("ALTER TABLE profiles ADD COLUMN whatsapp_url TEXT");           // WhatsApp click-to-chat URL
runMigration("ALTER TABLE profiles ADD COLUMN whatsapp_label TEXT");         // Button label override
runMigration("ALTER TABLE profiles ADD COLUMN whatsapp_enabled INTEGER DEFAULT 0");
runMigration("ALTER TABLE profiles ADD COLUMN menu_items TEXT");             // JSON: [{category,name,description,price}]
runMigration("ALTER TABLE profiles ADD COLUMN menu_enabled INTEGER DEFAULT 0");
runMigration("ALTER TABLE profiles ADD COLUMN menu_title TEXT");             // e.g. "Our Menu" or "Price List"
runMigration("ALTER TABLE profiles ADD COLUMN pdf_attachments TEXT");        // JSON: [{label,url,description}]
runMigration("ALTER TABLE profiles ADD COLUMN pdf_enabled INTEGER DEFAULT 0");
runMigration("ALTER TABLE profiles ADD COLUMN gallery_enabled INTEGER DEFAULT 0");
runMigration("ALTER TABLE profiles ADD COLUMN social_links_enabled INTEGER DEFAULT 1");

// ── Feature Gate system ──────────────────────────────────────────────────────
// platform_features: one row per feature/add-on, admin controls status + plan rules + pricing
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS platform_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'addon',
    status TEXT NOT NULL DEFAULT 'hidden'
      CHECK(status IN ('hidden','coming_soon','active','inactive','disabled')),
    pricing_type TEXT NOT NULL DEFAULT 'quote_required'
      CHECK(pricing_type IN ('free','included','fixed','from','quote_required','manual','paid_addon')),
    fixed_price REAL,
    from_price REAL,
    coming_soon_text TEXT,
    show_coming_soon INTEGER NOT NULL DEFAULT 0,
    show_upgrade_prompt INTEGER NOT NULL DEFAULT 0,
    require_admin_approval INTEGER NOT NULL DEFAULT 0,
    allow_register_interest INTEGER NOT NULL DEFAULT 0,
    dashboard_icon_visible INTEGER NOT NULL DEFAULT 0,
    menu_visible INTEGER NOT NULL DEFAULT 0,
    request_form_enabled INTEGER NOT NULL DEFAULT 1,
    portal_comms_enabled INTEGER NOT NULL DEFAULT 1,
    file_uploads_enabled INTEGER NOT NULL DEFAULT 0,
    proof_download_enabled INTEGER NOT NULL DEFAULT 0,
    final_file_enabled INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 99,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_pf_slug ON platform_features (slug)'); } catch { /* exists */ }
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_pf_status ON platform_features (status)'); } catch { /* exists */ }

// feature_plan_rules: which plans can see/use each feature and how
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS feature_plan_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id INTEGER NOT NULL REFERENCES platform_features(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    access_type TEXT NOT NULL DEFAULT 'hidden'
      CHECK(access_type IN ('hidden','coming_soon','included','paid_addon','quote_required','restricted')),
    UNIQUE(feature_id, plan_id)
  )
`);

// customer_feature_overrides: per-customer overrides that trump plan rules
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS customer_feature_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id INTEGER NOT NULL REFERENCES platform_features(id) ON DELETE CASCADE,
    access_type TEXT NOT NULL DEFAULT 'hidden'
      CHECK(access_type IN ('hidden','coming_soon','included','paid_addon','quote_required','restricted','active')),
    notes TEXT,
    set_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    set_by_admin_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feature_id)
  )
`);
try { sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_cfo_user ON customer_feature_overrides (user_id)'); } catch { /* exists */ }

// feature_interest_registrations: customers registering interest in coming-soon features
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS feature_interest_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id INTEGER NOT NULL REFERENCES platform_features(id) ON DELETE CASCADE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feature_id)
  )
`);

// Seed the canonical feature catalogue (INSERT OR IGNORE — never overwrites admin edits)
const seedFeature = sqliteDb.prepare(`
  INSERT OR IGNORE INTO platform_features
    (slug, name, description, category, status, pricing_type, sort_order)
  VALUES (?, ?, ?, ?, 'hidden', 'quote_required', ?)
`);
const featureSeed: [string, string, string, string, number][] = [
  ['printed_business_cards',   'Printed Business Cards',          'Professionally printed business cards connected to your Profile Centre.',                    'print',    1],
  ['custom_card_design',       'Custom Business Card Design',     'Profile Centre designs your business card artwork from scratch.',                            'print',    2],
  ['business_card_builder',    'Business Card Builder',           'Self-service card builder — choose a template, customise, and submit for print.',              'print',    3],
  ['qr_code_pack',             'QR Code Pack',                    'High-resolution QR code files in multiple formats for print and digital use.',                 'qr',       10],
  ['qr_stickers',              'QR Stickers',                     'Printed QR code stickers for your products, packaging or premises.',                           'print',    11],
  ['window_qr_display',        'Window QR Display',               'Printed A5/A4 window display with your QR code and branding.',                                 'print',    12],
  ['desk_qr_display',          'Desk QR Display',                 'Freestanding desk display with your QR code for reception or counter use.',                    'print',    13],
  ['nfc_card_addon',           'NFC Card Add-on',                 'NFC-enabled card that taps to open your Profile Centre.',                                    'print',    14],
  ['email_signature_setup',    'Email Signature Setup',           'Admin-assisted setup of a branded HTML email signature linked to your profile.',               'setup',    20],
  ['social_media_link_setup',  'Social Media Link Setup',         'Admin adds and arranges your social media links on your profile.',                              'setup',    21],
  ['booking_link_setup',       'Booking Link Setup',              'Admin adds a booking link (Calendly, Acuity, etc.) to your profile.',                          'setup',    22],
  ['review_link_setup',        'Review Link Setup',               'Admin adds a Google, Trustpilot or other review link to your profile.',                        'setup',    23],
  ['custom_profile_theme',     'Custom Profile Theme',            'A bespoke colour scheme and layout designed to match your brand.',                              'design',   30],
  ['profile_setup_service',    'Profile Setup Service',           'Admin sets up your entire profile for you — content, links, branding.',                        'setup',    31],
  ['profile_refresh_service',  'Profile Refresh / Update',        'Admin reviews and refreshes your existing profile content and design.',                        'setup',    32],
  ['extra_profile_pages',      'Extra Profile Pages',             'Additional profile pages beyond your plan allowance.',                                          'account',  40],
  ['team_staff_profiles',      'Team / Staff Profiles',           'Individual profile pages for each member of your team.',                                        'account',  41],
  ['lead_enquiry_form',        'Lead / Enquiry Form',             'A custom enquiry form embedded in your profile.',                                               'feature',  50],
  ['whatsapp_button',          'WhatsApp Contact Button',         'A WhatsApp click-to-chat button on your profile.',                                              'feature',  51],
  ['menu_price_list',          'Menu / Price List Add-on',        'A formatted menu or price list section on your profile.',                                       'feature',  52],
  ['mini_portfolio',           'Mini Portfolio / Gallery',        'A photo or work gallery section on your profile.',                                              'feature',  53],
  ['document_pdf_attachment',  'Document / PDF Attachment',       'Attach a PDF (brochure, menu, CV) to your profile for visitors to download.',                  'feature',  54],
  ['custom_domain_link',       'Custom Domain Link',              'Link a custom domain to your Profile Centre where supported.',                                'account',  60],
  ['priority_setup_support',   'Priority Setup Support',          'Dedicated admin support to set up or configure your profile as a priority.',                   'support',  70],
  ['reorder_support',          'Reorder Support',                 'Admin-assisted reorder of a previous business card or print product.',                         'support',  71],
  ['admin_assisted_changes',   'Admin-Assisted Changes',          'Admin makes specific changes to your profile on your behalf.',                                  'support',  72],
];
for (const row of featureSeed) seedFeature.run(...row);

// ── Seed feature_plan_rules — activate core features per plan ─────────────────
// This runs every startup using INSERT OR IGNORE so admin edits are never overwritten.
// Maps: feature slug → { plan slug → access_type }
try {
  const seedRule = sqliteDb.prepare(`
    INSERT OR IGNORE INTO feature_plan_rules (feature_id, plan_id, access_type)
    SELECT pf.id, p.id, ?
    FROM platform_features pf, plans p
    WHERE pf.slug = ? AND p.slug = ?
  `);

  // QR Code Pack — quote_required on all paid plans (print service, not a self-service download)
  seedRule.run('coming_soon',    'qr_code_pack', 'free');
  seedRule.run('quote_required', 'qr_code_pack', 'starter');
  seedRule.run('quote_required', 'qr_code_pack', 'professional');
  seedRule.run('quote_required', 'qr_code_pack', 'business');
  seedRule.run('quote_required', 'qr_code_pack', 'lifetime');

  // Printed Business Cards — quote_required on all paid plans, coming_soon on free
  seedRule.run('coming_soon',    'printed_business_cards', 'free');
  seedRule.run('quote_required', 'printed_business_cards', 'starter');
  seedRule.run('quote_required', 'printed_business_cards', 'professional');
  seedRule.run('quote_required', 'printed_business_cards', 'business');
  seedRule.run('quote_required', 'printed_business_cards', 'lifetime');

  // Custom Card Design — quote_required on Professional+
  seedRule.run('coming_soon',    'custom_card_design', 'free');
  seedRule.run('coming_soon',    'custom_card_design', 'starter');
  seedRule.run('quote_required', 'custom_card_design', 'professional');
  seedRule.run('quote_required', 'custom_card_design', 'business');
  seedRule.run('quote_required', 'custom_card_design', 'lifetime');

  // Business Card Builder — quote_required on all plans (order/request service, not a self-service builder)
  seedRule.run('coming_soon',    'business_card_builder', 'free');
  seedRule.run('quote_required', 'business_card_builder', 'starter');
  seedRule.run('quote_required', 'business_card_builder', 'professional');
  seedRule.run('quote_required', 'business_card_builder', 'business');
  seedRule.run('quote_required', 'business_card_builder', 'lifetime');

  // QR Stickers — quote_required on Starter+
  seedRule.run('coming_soon',    'qr_stickers', 'free');
  seedRule.run('quote_required', 'qr_stickers', 'starter');
  seedRule.run('quote_required', 'qr_stickers', 'professional');
  seedRule.run('quote_required', 'qr_stickers', 'business');
  seedRule.run('quote_required', 'qr_stickers', 'lifetime');

  // Window QR Display — quote_required on Professional+
  seedRule.run('coming_soon',    'window_qr_display', 'free');
  seedRule.run('coming_soon',    'window_qr_display', 'starter');
  seedRule.run('quote_required', 'window_qr_display', 'professional');
  seedRule.run('quote_required', 'window_qr_display', 'business');
  seedRule.run('quote_required', 'window_qr_display', 'lifetime');

  // Desk QR Display — quote_required on Professional+
  seedRule.run('coming_soon',    'desk_qr_display', 'free');
  seedRule.run('coming_soon',    'desk_qr_display', 'starter');
  seedRule.run('quote_required', 'desk_qr_display', 'professional');
  seedRule.run('quote_required', 'desk_qr_display', 'business');
  seedRule.run('quote_required', 'desk_qr_display', 'lifetime');

  // NFC Card Add-on — quote_required on Professional+
  seedRule.run('coming_soon',    'nfc_card_addon', 'free');
  seedRule.run('coming_soon',    'nfc_card_addon', 'starter');
  seedRule.run('quote_required', 'nfc_card_addon', 'professional');
  seedRule.run('quote_required', 'nfc_card_addon', 'business');
  seedRule.run('quote_required', 'nfc_card_addon', 'lifetime');

  // Email Signature — included on Starter+ (self-service tool exists in dashboard)
  seedRule.run('coming_soon', 'email_signature_setup', 'free');
  seedRule.run('included',    'email_signature_setup', 'starter');
  seedRule.run('included',    'email_signature_setup', 'professional');
  seedRule.run('included',    'email_signature_setup', 'business');
  seedRule.run('included',    'email_signature_setup', 'lifetime');

  // Social Media Link Setup — quote_required (admin-assisted service, not self-service)
  seedRule.run('coming_soon',    'social_media_link_setup', 'free');
  seedRule.run('quote_required', 'social_media_link_setup', 'starter');
  seedRule.run('quote_required', 'social_media_link_setup', 'professional');
  seedRule.run('quote_required', 'social_media_link_setup', 'business');
  seedRule.run('quote_required', 'social_media_link_setup', 'lifetime');

  // Booking Link Setup — quote_required (admin-assisted service, not self-service)
  seedRule.run('coming_soon',    'booking_link_setup', 'free');
  seedRule.run('quote_required', 'booking_link_setup', 'starter');
  seedRule.run('quote_required', 'booking_link_setup', 'professional');
  seedRule.run('quote_required', 'booking_link_setup', 'business');
  seedRule.run('quote_required', 'booking_link_setup', 'lifetime');

  // Review Link Setup — quote_required (admin-assisted service, not self-service)
  seedRule.run('coming_soon',    'review_link_setup', 'free');
  seedRule.run('quote_required', 'review_link_setup', 'starter');
  seedRule.run('quote_required', 'review_link_setup', 'professional');
  seedRule.run('quote_required', 'review_link_setup', 'business');
  seedRule.run('quote_required', 'review_link_setup', 'lifetime');

  // Custom Profile Theme — included on Starter+
  seedRule.run('coming_soon', 'custom_profile_theme', 'free');
  seedRule.run('included',    'custom_profile_theme', 'starter');
  seedRule.run('included',    'custom_profile_theme', 'professional');
  seedRule.run('included',    'custom_profile_theme', 'business');
  seedRule.run('included',    'custom_profile_theme', 'lifetime');

  // Profile Setup Service — quote_required on Starter+
  seedRule.run('coming_soon',    'profile_setup_service', 'free');
  seedRule.run('quote_required', 'profile_setup_service', 'starter');
  seedRule.run('quote_required', 'profile_setup_service', 'professional');
  seedRule.run('quote_required', 'profile_setup_service', 'business');
  seedRule.run('quote_required', 'profile_setup_service', 'lifetime');

  // Profile Refresh Service — quote_required on Starter+
  seedRule.run('coming_soon',    'profile_refresh_service', 'free');
  seedRule.run('quote_required', 'profile_refresh_service', 'starter');
  seedRule.run('quote_required', 'profile_refresh_service', 'professional');
  seedRule.run('quote_required', 'profile_refresh_service', 'business');
  seedRule.run('quote_required', 'profile_refresh_service', 'lifetime');

  // Extra Profile Pages — paid_addon on Professional+
  seedRule.run('coming_soon', 'extra_profile_pages', 'free');
  seedRule.run('coming_soon', 'extra_profile_pages', 'starter');
  seedRule.run('paid_addon',  'extra_profile_pages', 'professional');
  seedRule.run('paid_addon',  'extra_profile_pages', 'business');
  seedRule.run('paid_addon',  'extra_profile_pages', 'lifetime');

  // Team / Staff Profiles — paid_addon on Business+
  seedRule.run('coming_soon', 'team_staff_profiles', 'free');
  seedRule.run('coming_soon', 'team_staff_profiles', 'starter');
  seedRule.run('coming_soon', 'team_staff_profiles', 'professional');
  seedRule.run('paid_addon',  'team_staff_profiles', 'business');
  seedRule.run('paid_addon',  'team_staff_profiles', 'lifetime');

  // Lead / Enquiry Form — included on Starter+ (Contact Enquiries page exists from Starter)
  seedRule.run('coming_soon', 'lead_enquiry_form', 'free');
  seedRule.run('included',    'lead_enquiry_form', 'starter');
  seedRule.run('included',    'lead_enquiry_form', 'professional');
  seedRule.run('included',    'lead_enquiry_form', 'business');
  seedRule.run('included',    'lead_enquiry_form', 'lifetime');

  // WhatsApp Contact Button — included on Starter+ (self-service dashboard page)
  seedRule.run('coming_soon', 'whatsapp_button', 'free');
  seedRule.run('included',    'whatsapp_button', 'starter');
  seedRule.run('included',    'whatsapp_button', 'professional');
  seedRule.run('included',    'whatsapp_button', 'business');
  seedRule.run('included',    'whatsapp_button', 'lifetime');

  // Menu / Price List — included on Starter+ (self-service dashboard page)
  seedRule.run('coming_soon', 'menu_price_list', 'free');
  seedRule.run('included',    'menu_price_list', 'starter');
  seedRule.run('included',    'menu_price_list', 'professional');
  seedRule.run('included',    'menu_price_list', 'business');
  seedRule.run('included',    'menu_price_list', 'lifetime');

  // Mini Portfolio / Gallery — included on Starter+ (self-service dashboard page)
  seedRule.run('coming_soon', 'mini_portfolio', 'free');
  seedRule.run('included',    'mini_portfolio', 'starter');
  seedRule.run('included',    'mini_portfolio', 'professional');
  seedRule.run('included',    'mini_portfolio', 'business');
  seedRule.run('included',    'mini_portfolio', 'lifetime');

  // Document / PDF Attachment — included on Starter+ (self-service dashboard page)
  seedRule.run('coming_soon', 'document_pdf_attachment', 'free');
  seedRule.run('included',    'document_pdf_attachment', 'starter');
  seedRule.run('included',    'document_pdf_attachment', 'professional');
  seedRule.run('included',    'document_pdf_attachment', 'business');
  seedRule.run('included',    'document_pdf_attachment', 'lifetime');

  // Custom Domain Link — add-on only, NOT included in any plan
  // Use INSERT OR IGNORE so existing admin-set rules are never overwritten.
  // All plans get 'paid_addon' — access is granted only via the customer_addons table.
  seedRule.run('paid_addon', 'custom_domain_link', 'free');
  seedRule.run('paid_addon', 'custom_domain_link', 'starter');
  seedRule.run('paid_addon', 'custom_domain_link', 'professional');
  seedRule.run('paid_addon', 'custom_domain_link', 'business');
  seedRule.run('paid_addon', 'custom_domain_link', 'lifetime');

  // Priority Setup Support — included on Business+
  seedRule.run('coming_soon',    'priority_setup_support', 'free');
  seedRule.run('coming_soon',    'priority_setup_support', 'starter');
  seedRule.run('quote_required', 'priority_setup_support', 'professional');
  seedRule.run('included',       'priority_setup_support', 'business');
  seedRule.run('included',       'priority_setup_support', 'lifetime');

  // Reorder Support — quote_required on Starter+
  seedRule.run('coming_soon',    'reorder_support', 'free');
  seedRule.run('quote_required', 'reorder_support', 'starter');
  seedRule.run('quote_required', 'reorder_support', 'professional');
  seedRule.run('quote_required', 'reorder_support', 'business');
  seedRule.run('quote_required', 'reorder_support', 'lifetime');

  // Admin-Assisted Changes — included on Business+
  seedRule.run('coming_soon',    'admin_assisted_changes', 'free');
  seedRule.run('coming_soon',    'admin_assisted_changes', 'starter');
  seedRule.run('quote_required', 'admin_assisted_changes', 'professional');
  seedRule.run('included',       'admin_assisted_changes', 'business');
  seedRule.run('included',       'admin_assisted_changes', 'lifetime');

  // Also mark the features as 'active' so they're visible (INSERT OR IGNORE won't overwrite admin edits)
  sqliteDb.prepare(`
    UPDATE platform_features SET status = 'active'
    WHERE slug IN (
      'qr_code_pack','printed_business_cards','custom_card_design','business_card_builder',
      'qr_stickers','window_qr_display','desk_qr_display','nfc_card_addon',
      'email_signature_setup','social_media_link_setup','booking_link_setup','review_link_setup',
      'custom_profile_theme','profile_setup_service','profile_refresh_service',
      'extra_profile_pages','team_staff_profiles','lead_enquiry_form','whatsapp_button',
      'menu_price_list','mini_portfolio','document_pdf_attachment','custom_domain_link',
      'priority_setup_support','reorder_support','admin_assisted_changes'
    ) AND status = 'hidden'
  `).run();

  // CRITICAL: custom_domain_link must NEVER be 'included' in any plan — it is add-on only.
  // Force-correct any existing rows that were seeded as 'included' or 'coming_soon'.
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'paid_addon'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'custom_domain_link')
      AND access_type IN ('included', 'coming_soon')
  `).run();

  // ── Force-correct rows that were seeded with wrong access_type in earlier versions ──
  // INSERT OR IGNORE means the original (wrong) rows survive restarts — these UPDATEs fix them.

  // business_card_builder: was 'included' on paid plans — correct to 'quote_required'
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'quote_required'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'business_card_builder')
      AND access_type = 'included'
  `).run();

  // qr_code_pack: was 'included' on paid plans — correct to 'quote_required'
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'quote_required'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'qr_code_pack')
      AND access_type = 'included'
  `).run();

  // social_media_link_setup: was 'included' — correct to 'quote_required'
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'quote_required'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'social_media_link_setup')
      AND access_type = 'included'
  `).run();

  // booking_link_setup: was 'included' — correct to 'quote_required'
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'quote_required'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'booking_link_setup')
      AND access_type = 'included'
  `).run();

  // review_link_setup: was 'included' — correct to 'quote_required'
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'quote_required'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'review_link_setup')
      AND access_type = 'included'
  `).run();

  // whatsapp_button: was 'quote_required' — now 'included' (self-service page built)
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'included'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'whatsapp_button')
      AND access_type IN ('quote_required', 'coming_soon')
      AND plan_id IN (SELECT id FROM plans WHERE slug IN ('starter','professional','business','lifetime'))
  `).run();

  // menu_price_list: was 'coming_soon' — now 'included' (self-service page built)
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'included'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'menu_price_list')
      AND access_type = 'coming_soon'
      AND plan_id IN (SELECT id FROM plans WHERE slug IN ('starter','professional','business','lifetime'))
  `).run();

  // mini_portfolio: was 'coming_soon' — now 'included' (self-service page built)
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'included'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'mini_portfolio')
      AND access_type = 'coming_soon'
      AND plan_id IN (SELECT id FROM plans WHERE slug IN ('starter','professional','business','lifetime'))
  `).run();

  // document_pdf_attachment: was 'coming_soon' — now 'included' (self-service page built)
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'included'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'document_pdf_attachment')
      AND access_type = 'coming_soon'
      AND plan_id IN (SELECT id FROM plans WHERE slug IN ('starter','professional','business','lifetime'))
  `).run();

  // Update feature names to match new self-service reality
  sqliteDb.prepare(`UPDATE platform_features SET name = 'WhatsApp Button' WHERE slug = 'whatsapp_button'`).run();
  sqliteDb.prepare(`UPDATE platform_features SET name = 'Menu / Price List' WHERE slug = 'menu_price_list'`).run();
  sqliteDb.prepare(`UPDATE platform_features SET name = 'Gallery' WHERE slug = 'mini_portfolio'`).run();
  sqliteDb.prepare(`UPDATE platform_features SET name = 'PDF Attachments' WHERE slug = 'document_pdf_attachment'`).run();

  // lead_enquiry_form: was 'coming_soon' on Starter — correct to 'included' (Contact Enquiries page exists)
  sqliteDb.prepare(`
    UPDATE feature_plan_rules
    SET access_type = 'included'
    WHERE feature_id = (SELECT id FROM platform_features WHERE slug = 'lead_enquiry_form')
      AND access_type = 'coming_soon'
      AND plan_id = (SELECT id FROM plans WHERE slug = 'starter')
  `).run();

  // Also update platform_features names to be accurate
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'Business Cards Service'
    WHERE slug = 'business_card_builder'
  `).run();
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'Email Signature'
    WHERE slug = 'email_signature_setup'
  `).run();
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'Social Media Links (assisted setup)'
    WHERE slug = 'social_media_link_setup'
  `).run();
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'Booking Link (assisted setup)'
    WHERE slug = 'booking_link_setup'
  `).run();
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'Review Link (assisted setup)'
    WHERE slug = 'review_link_setup'
  `).run();
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'WhatsApp Contact Setup'
    WHERE slug = 'whatsapp_button'
  `).run();
  sqliteDb.prepare(`
    UPDATE platform_features SET name = 'QR Code Files (print pack)'
    WHERE slug = 'qr_code_pack'
  `).run();
} catch (e) {
  console.error('[db] feature plan rules seed error:', e);
}

// ── max_org_profiles column — explicit org profile limit per plan ──────────
// This replaces the fragile (max_profiles - 1) formula in createProfile.
try { sqliteDb.prepare("ALTER TABLE plans ADD COLUMN max_org_profiles INTEGER DEFAULT 0").run(); } catch { /* already exists */ }
sqliteDb.prepare("UPDATE plans SET max_org_profiles = 0 WHERE slug IN ('free','starter')").run();
sqliteDb.prepare("UPDATE plans SET max_org_profiles = 1 WHERE slug IN ('professional','business')").run();
sqliteDb.prepare("UPDATE plans SET max_org_profiles = 4 WHERE slug = 'ultimate_business'").run();
sqliteDb.prepare("UPDATE plans SET max_org_profiles = 10 WHERE slug = 'ultimate_plus'").run();
sqliteDb.prepare("UPDATE plans SET max_org_profiles = 999 WHERE slug = 'lifetime'").run();

// ── Feature flag columns — server-side enforcement ────────────────────────
// Each flag maps 1:1 to a feature that is gated at the API layer.
// Adding columns is idempotent (runMigration swallows "already exists").
// has_gallery          — gallery section on profile
// has_pdf              — PDF attachments section
// has_whatsapp         — WhatsApp contact button
// has_vcard            — vCard download
// has_email_signature  — email signature builder
// has_qr_download      — QR code download (vs. share-only on free)
// has_analytics        — advanced analytics dashboard
// has_menu             — menu / price list section
// has_contact_form     — contact/enquiry form
// has_premium_templates— premium profile themes/templates
// has_seats            — team seats (>0 seats allowed)
runMigration('ALTER TABLE plans ADD COLUMN has_gallery INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_pdf INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_whatsapp INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_vcard INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_email_signature INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_menu INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_premium_templates INTEGER DEFAULT 0');
runMigration('ALTER TABLE plans ADD COLUMN has_seats INTEGER DEFAULT 0');

// ── Authoritative plan feature values (run every boot — idempotent) ────────
// FREE: bare minimum — 1 profile, 1 link, QR share only, JA branding locked
sqliteDb.prepare(`UPDATE plans SET
  max_links = 1, max_seats = 0, max_org_profiles = 0,
  has_qr_download = 0, has_contact_form = 0, has_advanced_analytics = 0,
  has_vcard_download = 0, has_custom_themes = 0, remove_branding = 0,
  has_messaging = 0, has_gallery = 0, has_pdf = 0, has_whatsapp = 0,
  has_vcard = 0, has_email_signature = 0, has_menu = 0,
  has_premium_templates = 0, has_seats = 0
  WHERE slug = 'free'`).run();

// STARTER: £5 — 1 profile, 20 links, most features, NO analytics, NO vCard, NO org profile, JA branding stays
sqliteDb.prepare(`UPDATE plans SET
  max_links = 20, max_seats = 0, max_org_profiles = 0,
  has_qr_download = 1, has_contact_form = 1, has_advanced_analytics = 0,
  has_vcard_download = 0, has_custom_themes = 1, remove_branding = 0,
  has_messaging = 1, has_gallery = 1, has_pdf = 1, has_whatsapp = 1,
  has_vcard = 0, has_email_signature = 1, has_menu = 1,
  has_premium_templates = 1, has_seats = 0
  WHERE slug = 'starter'`).run();

// PROFESSIONAL: £15 — 1 personal + 1 org, unlimited links, analytics, vCard, remove branding, NO seats
sqliteDb.prepare(`UPDATE plans SET
  max_links = 999, max_seats = 0, max_org_profiles = 1,
  has_qr_download = 1, has_contact_form = 1, has_advanced_analytics = 1,
  has_vcard_download = 1, has_custom_themes = 1, remove_branding = 1,
  has_messaging = 1, has_gallery = 1, has_pdf = 1, has_whatsapp = 1,
  has_vcard = 1, has_email_signature = 1, has_menu = 1,
  has_premium_templates = 1, has_seats = 0
  WHERE slug = 'professional'`).run();

// ORGANISATION: £29 — 1 personal + 1 org, unlimited links, analytics, vCard, remove branding, up to 20 seats
sqliteDb.prepare(`UPDATE plans SET
  max_links = 999, max_seats = 20, max_org_profiles = 1,
  has_qr_download = 1, has_contact_form = 1, has_advanced_analytics = 1,
  has_vcard_download = 1, has_custom_themes = 1, remove_branding = 1,
  has_messaging = 1, has_gallery = 1, has_pdf = 1, has_whatsapp = 1,
  has_vcard = 1, has_email_signature = 1, has_menu = 1,
  has_premium_templates = 1, has_seats = 1
  WHERE slug = 'business'`).run();

// ULTIMATE ORGANISATION: £79 — 1 personal + 4 org, unlimited links, up to 20 seats
sqliteDb.prepare(`UPDATE plans SET
  max_links = 999, max_seats = 20, max_org_profiles = 4,
  has_qr_download = 1, has_contact_form = 1, has_advanced_analytics = 1,
  has_vcard_download = 1, has_custom_themes = 1, remove_branding = 1,
  has_messaging = 1, has_gallery = 1, has_pdf = 1, has_whatsapp = 1,
  has_vcard = 1, has_email_signature = 1, has_menu = 1,
  has_premium_templates = 1, has_seats = 1
  WHERE slug = 'ultimate_business'`).run();

// ULTIMATE ORGANISATION+: contact-us — 1 personal + 10 org, up to 40 seats
sqliteDb.prepare(`UPDATE plans SET
  max_links = 999, max_seats = 40, max_org_profiles = 10,
  has_qr_download = 1, has_contact_form = 1, has_advanced_analytics = 1,
  has_vcard_download = 1, has_custom_themes = 1, remove_branding = 1,
  has_messaging = 1, has_gallery = 1, has_pdf = 1, has_whatsapp = 1,
  has_vcard = 1, has_email_signature = 1, has_menu = 1,
  has_premium_templates = 1, has_seats = 1
  WHERE slug = 'ultimate_plus'`).run();

// LIFETIME: all features, unlimited everything
sqliteDb.prepare(`UPDATE plans SET
  max_links = 999, max_seats = 999, max_org_profiles = 999,
  has_qr_download = 1, has_contact_form = 1, has_advanced_analytics = 1,
  has_vcard_download = 1, has_custom_themes = 1, remove_branding = 1,
  has_messaging = 1, has_gallery = 1, has_pdf = 1, has_whatsapp = 1,
  has_vcard = 1, has_email_signature = 1, has_menu = 1,
  has_premium_templates = 1, has_seats = 1
  WHERE slug = 'lifetime'`).run();

console.log('[db] Plan feature flags enforced on all plans');

// ── Payment grace period ──────────────────────────────────────────────────────
// When a Stripe invoice.payment_failed fires, we give the user 7 days to pay
// before downgrading them to no-plan. payment_grace_until stores the deadline.
runMigration('ALTER TABLE users ADD COLUMN payment_grace_until TEXT');

// ── Profile Centre User Number ──────────────────────────────────────────────
// user_number: unique 12-digit identifier (no letters, no hyphens, no leading zero)
// Format: 11-digit base + 1 Luhn check digit. Stored without spaces.
// Display: "742 918 305 614"
runMigration('ALTER TABLE users ADD COLUMN user_number TEXT');
try {
  sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_number ON users (user_number) WHERE user_number IS NOT NULL');
} catch { /* exists */ }

// ── Tables created lazily in handler files — guaranteed here on startup ──────
// These tables were previously created inside individual API handlers (CREATE TABLE
// IF NOT EXISTS at first call). Moving them here ensures they exist before any
// request is served, so /api/auth/me and other endpoints never crash on a fresh DB.

// email_signature_beta — admin-granted beta access flag per user
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS email_signature_beta (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL UNIQUE,
    enabled          INTEGER NOT NULL DEFAULT 0,
    admin_note       TEXT,
    granted_by_id    INTEGER,
    granted_by_name  TEXT,
    granted_by_email TEXT,
    granted_at       DATETIME,
    revoked_at       DATETIME,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// admin_pins — bcrypt-hashed admin dashboard PIN
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS admin_pins (
    admin_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    pin_hash        TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// oidc_state — DB-backed OIDC state (survives cross-domain redirects)
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS oidc_state (
    state         TEXT PRIMARY KEY,
    flow          TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    expires_at    INTEGER NOT NULL,
    redirect_to   TEXT,
    callback_uri  TEXT
  )
`);
try { sqliteDb.exec('ALTER TABLE oidc_state ADD COLUMN redirect_to TEXT'); } catch { /* exists */ }
try { sqliteDb.exec('ALTER TABLE oidc_state ADD COLUMN callback_uri TEXT'); } catch { /* exists */ }

// assisted_access_requests — admin impersonation consent flow
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS assisted_access_requests (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id               INTEGER NOT NULL,
    admin_name             TEXT,
    admin_email            TEXT,
    user_id                INTEGER NOT NULL,
    reason                 TEXT NOT NULL,
    access_areas           TEXT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'pending',
    session_token          TEXT,
    session_expires_at     TEXT,
    session_started_at     TEXT,
    launch_token           TEXT,
    launch_token_expires_at TEXT,
    approved_at            TEXT,
    rejected_at            TEXT,
    revoked_at             TEXT,
    exited_at              TEXT,
    created_at             TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
try { sqliteDb.exec('ALTER TABLE assisted_access_requests ADD COLUMN session_started_at TEXT'); } catch { /* exists */ }
try { sqliteDb.exec('ALTER TABLE assisted_access_requests ADD COLUMN launch_token TEXT'); } catch { /* exists */ }
try { sqliteDb.exec('ALTER TABLE assisted_access_requests ADD COLUMN launch_token_expires_at TEXT'); } catch { /* exists */ }

// points_store_items — admin-managed perks catalogue (used by /api/points GET)
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS points_store_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT    NOT NULL UNIQUE,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    cost        INTEGER NOT NULL DEFAULT 100,
    category    TEXT    NOT NULL DEFAULT 'feature',
    icon        TEXT    NOT NULL DEFAULT 'gift',
    color       TEXT    NOT NULL DEFAULT 'text-primary',
    is_active   INTEGER NOT NULL DEFAULT 1,
    repeatable  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// user_achievements — persisted achievement records
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS user_achievements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    achievement_key TEXT    NOT NULL,
    earned          INTEGER NOT NULL DEFAULT 0,
    points          INTEGER NOT NULL DEFAULT 0,
    earned_at       TEXT,
    UNIQUE(user_id, achievement_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// points_redemptions — user redemption history
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS points_redemptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    perk_key    TEXT    NOT NULL,
    cost        INTEGER NOT NULL DEFAULT 0,
    redeemed_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ── WAL checkpoint on startup ─────────────────────────────────────────────────
// Forces all WAL data into the main db file so nothing is lost if the process
// restarts. WAL mode is still used for concurrent reads during normal operation.
try {
  sqliteDb.pragma('wal_checkpoint(TRUNCATE)');
  console.log('[db] WAL checkpoint completed on startup');
} catch (err) {
  console.warn('[db] WAL checkpoint failed (non-fatal):', err);
}

// ── Export: always SQLite ─────────────────────────────────────────────────────
/** Resolves immediately — kept for API compatibility (was used by Azure path). */
export const schemaReady: Promise<void> = Promise.resolve();

const db = sqliteDb;
export default db;
export { randomBytes, sqliteDb as rawSqliteDb };
