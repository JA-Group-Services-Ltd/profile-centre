/**
 * Azure SQL Schema Initialisation + SQLite → Azure SQL Data Migration
 *
 * Uses rawExecute/rawQuery to bypass toTSQL translation — all SQL here is
 * already valid T-SQL.
 */

import { rawExecute, rawQuery } from './azure-proxy-db.js';
import { getSecret } from '#airo/secrets';

// ── DDL helper: run one statement, log but don't throw ───────────────────────
async function ddl(sql: string): Promise<void> {
  try {
    await rawExecute(sql);
  } catch (e) {
    const msg = String(e);
    if (!msg.includes('already exists') && !msg.includes('There is already')) {
      console.warn('[azure-schema] DDL warning:', msg.substring(0, 300));
    }
  }
}


// ── Create all tables ─────────────────────────────────────────────────────────
export async function initAzureSchema(): Promise<void> {
  console.log('[azure-schema] Initialising Azure SQL schema...');

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      email NVARCHAR(255) NOT NULL,
      password_hash NVARCHAR(MAX),
      name NVARCHAR(255) NOT NULL DEFAULT '',
      role NVARCHAR(50) NOT NULL DEFAULT 'user',
      plan_id INT DEFAULT 1,
      stripe_customer_id NVARCHAR(255),
      lifetime_access INT DEFAULT 0,
      lifetime_plan_id INT,
      entra_oid NVARCHAR(255),
      referred_by_code NVARCHAR(255),
      is_paused INT DEFAULT 0,
      pause_reason NVARCHAR(MAX),
      referral_consent INT DEFAULT 0,
      referral_consent_at NVARCHAR(50),
      last_login_at NVARCHAR(50),
      phone NVARCHAR(100),
      marketing_consent INT DEFAULT 0,
      marketing_consent_at NVARCHAR(50),
      terms_consent INT DEFAULT 0,
      terms_consent_at NVARCHAR(50),
      privacy_consent INT DEFAULT 0,
      privacy_consent_at NVARCHAR(50),
      data_improve_consent INT DEFAULT 0,
      data_improve_consent_at NVARCHAR(50),
      updates_consent INT DEFAULT 0,
      updates_consent_at NVARCHAR(50),
      crm_consent INT DEFAULT 0,
      crm_consent_at NVARCHAR(50),
      consent_ip NVARCHAR(100),
      consent_version NVARCHAR(20) DEFAULT '1.0',
      admin_notes NVARCHAR(MAX),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_users_email UNIQUE (email)
    )
  `);

  await ddl(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_entra_oid' AND object_id = OBJECT_ID('users')) CREATE INDEX idx_users_entra_oid ON users (entra_oid)`);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'plans')
    CREATE TABLE plans (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      slug NVARCHAR(100) NOT NULL,
      price_monthly FLOAT DEFAULT 0,
      price_yearly FLOAT DEFAULT 0,
      max_profiles INT DEFAULT 1,
      max_links INT DEFAULT 5,
      has_qr_download INT DEFAULT 0,
      has_contact_form INT DEFAULT 0,
      has_advanced_analytics INT DEFAULT 0,
      has_vcard_download INT DEFAULT 0,
      has_custom_themes INT DEFAULT 0,
      remove_branding INT DEFAULT 0,
      has_custom_domain INT DEFAULT 0,
      is_active INT DEFAULT 1,
      stripe_price_monthly NVARCHAR(255),
      stripe_price_yearly NVARCHAR(255),
      stripe_price_lifetime NVARCHAR(255),
      has_lifetime INT DEFAULT 0,
      stripe_product_id NVARCHAR(255),
      has_messaging INT DEFAULT 0,
      max_seats INT DEFAULT 1,
      max_themes INT DEFAULT -1,
      CONSTRAINT uq_plans_slug UNIQUE (slug)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'profiles')
    CREATE TABLE profiles (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      username NVARCHAR(255) NOT NULL,
      display_name NVARCHAR(255),
      job_title NVARCHAR(255),
      company NVARCHAR(255),
      bio NVARCHAR(MAX),
      phone NVARCHAR(100),
      email NVARCHAR(255),
      website NVARCHAR(2000),
      address NVARCHAR(500),
      profile_photo NVARCHAR(2000),
      is_published INT DEFAULT 1,
      show_phone INT DEFAULT 1,
      show_email INT DEFAULT 1,
      show_website INT DEFAULT 1,
      show_address INT DEFAULT 1,
      show_bio INT DEFAULT 1,
      theme_id INT DEFAULT 1,
      profile_type NVARCHAR(50) DEFAULT 'personal',
      url_prefix NVARCHAR(10) DEFAULT 'F',
      biz_slug NVARCHAR(255),
      person_slug NVARCHAR(255),
      business_name NVARCHAR(255),
      business_description NVARCHAR(MAX),
      business_category NVARCHAR(255),
      opening_hours NVARCHAR(MAX),
      logo_url NVARCHAR(2000),
      cover_url NVARCHAR(2000),
      services NVARCHAR(MAX),
      team_members NVARCHAR(MAX),
      announcements NVARCHAR(MAX),
      business_tagline NVARCHAR(500),
      business_email NVARCHAR(255),
      business_phone NVARCHAR(100),
      business_website NVARCHAR(2000),
      business_address NVARCHAR(500),
      social_links NVARCHAR(MAX),
      max_seats INT DEFAULT 5,
      pin_hash NVARCHAR(255),
      messaging_enabled INT DEFAULT 1,
      enquiry_enabled INT DEFAULT 1,
      team_directory_public INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_profiles_username UNIQUE (username)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'profile_links')
    CREATE TABLE profile_links (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      type NVARCHAR(100) NOT NULL,
      platform NVARCHAR(100),
      label NVARCHAR(255) NOT NULL DEFAULT '',
      url NVARCHAR(2000) NOT NULL DEFAULT '',
      icon NVARCHAR(100),
      is_enabled INT DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'qr_codes')
    CREATE TABLE qr_codes (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      qr_data NVARCHAR(MAX) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'contact_enquiries')
    CREATE TABLE contact_enquiries (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      sender_name NVARCHAR(255) NOT NULL DEFAULT '',
      sender_email NVARCHAR(255) NOT NULL DEFAULT '',
      message NVARCHAR(MAX) NOT NULL DEFAULT '',
      is_read INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'page_views')
    CREATE TABLE page_views (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_hash NVARCHAR(255),
      user_agent NVARCHAR(MAX)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'link_clicks')
    CREATE TABLE link_clicks (
      id INT IDENTITY(1,1) PRIMARY KEY,
      link_id INT NOT NULL,
      profile_id INT NOT NULL,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_hash NVARCHAR(255)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'themes')
    CREATE TABLE themes (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      slug NVARCHAR(100) NOT NULL,
      description NVARCHAR(MAX),
      primary_color NVARCHAR(50),
      accent_color NVARCHAR(50),
      background_color NVARCHAR(50),
      text_color NVARCHAR(50),
      is_free INT DEFAULT 1,
      is_active INT DEFAULT 1,
      category NVARCHAR(100) DEFAULT 'minimal',
      font_heading NVARCHAR(100) DEFAULT 'Inter',
      font_body NVARCHAR(100) DEFAULT 'Inter',
      card_style NVARCHAR(50) DEFAULT 'rounded',
      gradient NVARCHAR(500),
      border_radius NVARCHAR(20) DEFAULT '12px',
      button_style NVARCHAR(50) DEFAULT 'filled',
      layout NVARCHAR(50) DEFAULT 'centered',
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_themes_slug UNIQUE (slug)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'subscriptions')
    CREATE TABLE subscriptions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      plan_id INT NOT NULL,
      status NVARCHAR(50) DEFAULT 'active',
      billing_interval NVARCHAR(20) DEFAULT 'monthly',
      stripe_subscription_id NVARCHAR(255),
      stripe_customer_id NVARCHAR(255),
      current_period_start DATETIME,
      current_period_end DATETIME,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      cancelled_at DATETIME
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'stripe_config')
    CREATE TABLE stripe_config (
      id INT IDENTITY(1,1) PRIMARY KEY,
      [key] NVARCHAR(255) NOT NULL,
      value NVARCHAR(MAX),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_stripe_config_key UNIQUE ([key])
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_settings')
    CREATE TABLE admin_settings (
      id INT IDENTITY(1,1) PRIMARY KEY,
      [key] NVARCHAR(255) NOT NULL,
      value NVARCHAR(MAX),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_admin_settings_key UNIQUE ([key])
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'sessions')
    CREATE TABLE sessions (
      sid NVARCHAR(255) NOT NULL,
      sess NVARCHAR(MAX) NOT NULL,
      expired DATETIME2 NOT NULL,
      CONSTRAINT pk_sessions PRIMARY KEY (sid)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'audit_log')
    CREATE TABLE audit_log (
      id INT IDENTITY(1,1) PRIMARY KEY,
      actor_id INT,
      actor_name NVARCHAR(255),
      actor_email NVARCHAR(255),
      actor_type NVARCHAR(50) NOT NULL DEFAULT 'user',
      action NVARCHAR(255) NOT NULL,
      resource_type NVARCHAR(255) NOT NULL DEFAULT '',
      resource_id NVARCHAR(255),
      resource_label NVARCHAR(500),
      details NVARCHAR(MAX),
      ip_address NVARCHAR(100),
      user_agent NVARCHAR(MAX),
      severity NVARCHAR(20) DEFAULT 'info',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_user_notes')
    CREATE TABLE admin_user_notes (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      admin_id INT,
      admin_name NVARCHAR(255),
      note NVARCHAR(MAX) NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_admin_notes_user' AND object_id = OBJECT_ID('admin_user_notes')) CREATE INDEX idx_admin_notes_user ON admin_user_notes (user_id)`);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'data_requests')
    CREATE TABLE data_requests (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      request_type NVARCHAR(100) NOT NULL,
      description NVARCHAR(MAX),
      status NVARCHAR(50) NOT NULL DEFAULT 'pending',
      assigned_to INT,
      assigned_name NVARCHAR(255),
      internal_notes NVARCHAR(MAX),
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'account_closure_requests')
    CREATE TABLE account_closure_requests (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      reason NVARCHAR(MAX),
      status NVARCHAR(50) NOT NULL DEFAULT 'pending',
      admin_note NVARCHAR(MAX),
      confirmed_by INT,
      confirmed_by_name NVARCHAR(255),
      confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'business_seats')
    CREATE TABLE business_seats (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      user_id INT,
      email NVARCHAR(255) NOT NULL,
      name NVARCHAR(255),
      role NVARCHAR(50) NOT NULL DEFAULT 'member',
      status NVARCHAR(50) NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'business_seat_invites')
    CREATE TABLE business_seat_invites (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      invited_by INT NOT NULL,
      email NVARCHAR(255) NOT NULL,
      name NVARCHAR(255),
      role NVARCHAR(50) NOT NULL DEFAULT 'member',
      token NVARCHAR(255) NOT NULL,
      status NVARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      CONSTRAINT uq_seat_invites_token UNIQUE (token)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'notifications')
    CREATE TABLE notifications (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      type NVARCHAR(100) NOT NULL,
      title NVARCHAR(500) NOT NULL,
      body NVARCHAR(MAX),
      link NVARCHAR(500),
      is_read INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'issue_reports')
    CREATE TABLE issue_reports (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL DEFAULT '',
      email NVARCHAR(255) NOT NULL DEFAULT '',
      issue_type NVARCHAR(100) NOT NULL DEFAULT '',
      subject NVARCHAR(500),
      description NVARCHAR(MAX) NOT NULL DEFAULT '',
      page_url NVARCHAR(500),
      status NVARCHAR(50) NOT NULL DEFAULT 'open',
      admin_notes NVARCHAR(MAX),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'points_rules')
    CREATE TABLE points_rules (
      id INT IDENTITY(1,1) PRIMARY KEY,
      action NVARCHAR(100) NOT NULL,
      label NVARCHAR(255) NOT NULL,
      points INT NOT NULL DEFAULT 0,
      is_active INT DEFAULT 1,
      description NVARCHAR(MAX),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_points_rules_action UNIQUE (action)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'rewards')
    CREATE TABLE rewards (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      description NVARCHAR(MAX),
      type NVARCHAR(100) NOT NULL DEFAULT 'discount',
      value NVARCHAR(255) NOT NULL DEFAULT '0',
      points_cost INT NOT NULL DEFAULT 0,
      is_active INT DEFAULT 1,
      stock INT DEFAULT -1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'points_ledger')
    CREATE TABLE points_ledger (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      delta INT NOT NULL,
      balance_after INT NOT NULL DEFAULT 0,
      action NVARCHAR(100) NOT NULL,
      description NVARCHAR(MAX),
      ref_id INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'reward_redemptions')
    CREATE TABLE reward_redemptions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      reward_id INT NOT NULL,
      points_spent INT NOT NULL,
      status NVARCHAR(50) NOT NULL DEFAULT 'pending',
      code NVARCHAR(255),
      notes NVARCHAR(MAX),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      fulfilled_at DATETIME
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'referral_codes')
    CREATE TABLE referral_codes (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      code NVARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_referral_codes_user UNIQUE (user_id),
      CONSTRAINT uq_referral_codes_code UNIQUE (code)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'card_message_threads')
    CREATE TABLE card_message_threads (
      id INT IDENTITY(1,1) PRIMARY KEY,
      profile_id INT NOT NULL,
      visitor_name NVARCHAR(255),
      visitor_email NVARCHAR(255),
      visitor_token NVARCHAR(255),
      visitor_verified INT DEFAULT 0,
      visitor_accepted INT DEFAULT 0,
      subject NVARCHAR(500),
      status NVARCHAR(50) NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'card_messages')
    CREATE TABLE card_messages (
      id INT IDENTITY(1,1) PRIMARY KEY,
      thread_id INT NOT NULL,
      sender_type NVARCHAR(20) NOT NULL,
      body NVARCHAR(MAX) NOT NULL DEFAULT '',
      is_read INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'legal_policies')
    CREATE TABLE legal_policies (
      id INT IDENTITY(1,1) PRIMARY KEY,
      [key] NVARCHAR(100) NOT NULL,
      title NVARCHAR(500) NOT NULL DEFAULT '',
      version NVARCHAR(50),
      effective_date NVARCHAR(50),
      content NVARCHAR(MAX),
      is_published INT DEFAULT 0,
      last_updated NVARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_legal_policies_key UNIQUE ([key])
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'stripe_products')
    CREATE TABLE stripe_products (
      id NVARCHAR(255) NOT NULL,
      name NVARCHAR(500),
      description NVARCHAR(MAX),
      active INT DEFAULT 1,
      metadata NVARCHAR(MAX),
      created INT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT pk_stripe_products PRIMARY KEY (id)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'stripe_prices')
    CREATE TABLE stripe_prices (
      id NVARCHAR(255) NOT NULL,
      product_id NVARCHAR(255),
      currency NVARCHAR(10),
      unit_amount INT,
      recurring_interval NVARCHAR(20),
      active INT DEFAULT 1,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT pk_stripe_prices PRIMARY KEY (id)
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'partner_enquiries')
    CREATE TABLE partner_enquiries (
      id INT IDENTITY(1,1) PRIMARY KEY,
      type NVARCHAR(50) NOT NULL DEFAULT 'affiliate',
      name NVARCHAR(255) NOT NULL DEFAULT '',
      email NVARCHAR(255) NOT NULL DEFAULT '',
      company NVARCHAR(255),
      website NVARCHAR(500),
      message NVARCHAR(MAX) NOT NULL DEFAULT '',
      is_read INT DEFAULT 0,
      consent_given_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ddl(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'support_requests')
    CREATE TABLE support_requests (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT,
      name NVARCHAR(255) NOT NULL DEFAULT '',
      email NVARCHAR(255) NOT NULL DEFAULT '',
      subject NVARCHAR(500) NOT NULL DEFAULT '',
      message NVARCHAR(MAX) NOT NULL DEFAULT '',
      status NVARCHAR(50) DEFAULT 'open',
      consent_given_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[azure-schema] All tables created.');

  // ── Column migrations (idempotent — add missing columns) ──────────────────
  // These handle columns added after the initial schema was deployed.
  const addCol = async (table: string, col: string, def: string) => {
    try {
      await ddl(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${col}'
        )
        ALTER TABLE ${table} ADD ${col} ${def}
      `);
    } catch { /* ignore — column may already exist */ }
  };

  // page_views: ip_hash_v2 (GDPR migration)
  await addCol('page_views', 'ip_hash_v2', 'NVARCHAR(255)');
  // contact_enquiries: consent_given_at
  await addCol('contact_enquiries', 'consent_given_at', 'DATETIME');
  // partner_enquiries: consent_given_at
  await addCol('partner_enquiries', 'consent_given_at', 'DATETIME');
  // support_requests: consent_given_at
  await addCol('support_requests', 'consent_given_at', 'DATETIME');
  // audit_log: actor column (SQLite uses 'actor', Azure schema uses actor_name)
  await addCol('audit_log', 'actor', 'NVARCHAR(255)');
  await addCol('audit_log', 'detail', 'NVARCHAR(MAX)');
  await addCol('audit_log', 'admin_email', 'NVARCHAR(255)');
  await addCol('audit_log', 'admin_name', 'NVARCHAR(255)');
  await addCol('audit_log', 'admin_id', 'INT');
  // card_message_threads: sender_name, sender_email, last_message_at (SQLite column names)
  await addCol('card_message_threads', 'sender_name', 'NVARCHAR(255)');
  await addCol('card_message_threads', 'sender_email', 'NVARCHAR(255)');
  await addCol('card_message_threads', 'last_message_at', 'DATETIME');
  // card_messages: sender (SQLite uses 'sender', Azure was created with 'sender_type')
  // Add 'sender' column if missing, and make sender_type nullable so rows without it don't fail.
  await addCol('card_messages', 'sender', 'NVARCHAR(50)');
  try {
    await ddl(`ALTER TABLE card_messages ALTER COLUMN sender_type NVARCHAR(20) NULL`);
  } catch { /* ignore */ }
  // Back-fill sender from sender_type for any rows that have sender_type but not sender
  try {
    await ddl(`UPDATE card_messages SET sender = sender_type WHERE sender IS NULL AND sender_type IS NOT NULL`);
  } catch { /* ignore */ }
  // profiles: widen logo_url and url_prefix to avoid truncation
  try { await ddl(`ALTER TABLE profiles ALTER COLUMN logo_url NVARCHAR(2000)`); } catch { /* ignore */ }
  try { await ddl(`ALTER TABLE profiles ALTER COLUMN url_prefix NVARCHAR(50)`); } catch { /* ignore */ }
  // profiles: widen additional URL/text columns that may be truncated
  try { await ddl(`ALTER TABLE profiles ALTER COLUMN cover_url NVARCHAR(2000)`); } catch { /* ignore */ }
  try { await ddl(`ALTER TABLE profiles ALTER COLUMN website NVARCHAR(2000)`); } catch { /* ignore */ }
  try { await ddl(`ALTER TABLE profiles ALTER COLUMN profile_photo NVARCHAR(2000)`); } catch { /* ignore */ }
  try { await ddl(`ALTER TABLE profiles ALTER COLUMN business_website NVARCHAR(2000)`); } catch { /* ignore */ }
  // profile_links: widen url column
  try { await ddl(`ALTER TABLE profile_links ALTER COLUMN url NVARCHAR(2000)`); } catch { /* ignore */ }
  // subscriptions: ensure expires_at column exists (may be missing on older Azure schemas)
  await addCol('subscriptions', 'expires_at', 'DATETIME');
  // business_seat_invites: ensure expires_at column exists
  await addCol('business_seat_invites', 'expires_at', 'DATETIME');

  // ── Seed default data (only if tables are empty) ───────────────────────────
  await seedPlans();
  await seedPointsRules();
  await seedRewards();
  await seedAdminSettings();

  // ── Idempotent plan fix-ups (run every startup) ────────────────────────────
  // Ensure free plan has max_themes=1 so the theme gate works correctly.
  // Paid plans with has_custom_themes=1 get max_themes=-1 (unlimited).
  try {
    await rawExecute(`UPDATE plans SET max_themes = 1 WHERE slug = 'free' AND (max_themes IS NULL OR max_themes = -1)`);
    await rawExecute(`UPDATE plans SET max_themes = -1 WHERE slug IN ('starter','professional','business','lifetime') AND (max_themes IS NULL OR max_themes = 0)`);
  } catch { /* ignore — column may not exist yet on very old schemas */ }

  console.log('[azure-schema] Azure SQL schema ready.');
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedPlans(): Promise<void> {
  const rows = await rawQuery<{ c: number }>('SELECT COUNT(*) AS c FROM plans');
  if ((rows[0]?.c ?? 0) > 0) return;
  console.log('[azure-schema] Seeding plans...');
  const plans = [
    { name: 'Free',         slug: 'free',         price: 0,  max_profiles: 1,   max_links: 5,   qr: 0, cf: 0, aa: 0, vc: 0, ct: 0, rb: 0, cd: 0, lt: 0, msg: 0, seats: 1, mt: 1 },
    { name: 'Starter',      slug: 'starter',      price: 5,  max_profiles: 1,   max_links: 20,  qr: 1, cf: 1, aa: 0, vc: 0, ct: 1, rb: 0, cd: 0, lt: 0, msg: 1, seats: 1, mt: -1 },
    { name: 'Professional', slug: 'professional', price: 15, max_profiles: 5,   max_links: 999, qr: 1, cf: 1, aa: 1, vc: 1, ct: 1, rb: 1, cd: 0, lt: 0, msg: 1, seats: 5, mt: -1 },
    { name: 'Business',     slug: 'business',     price: 29, max_profiles: 20,  max_links: 999, qr: 1, cf: 1, aa: 1, vc: 1, ct: 1, rb: 1, cd: 1, lt: 0, msg: 1, seats: 20, mt: -1 },
    { name: 'Lifetime',     slug: 'lifetime',     price: 0,  max_profiles: 999, max_links: 999, qr: 1, cf: 1, aa: 1, vc: 1, ct: 1, rb: 1, cd: 1, lt: 1, msg: 1, seats: 999, mt: -1 },
  ];
  for (const p of plans) {
    await rawExecute(
      `INSERT INTO plans (name,slug,price_monthly,max_profiles,max_links,has_qr_download,has_contact_form,has_advanced_analytics,has_vcard_download,has_custom_themes,remove_branding,has_custom_domain,has_lifetime,has_messaging,max_seats,max_themes)
       VALUES ('${p.name}','${p.slug}',${p.price},${p.max_profiles},${p.max_links},${p.qr},${p.cf},${p.aa},${p.vc},${p.ct},${p.rb},${p.cd},${p.lt},${p.msg},${p.seats},${p.mt})`
    );
  }
  // Stripe plan IDs — loaded from secrets so they are never hardcoded in source
  const stripeStarterProduct   = getSecret('STRIPE_PRODUCT_STARTER')   || '';
  const stripeStarterMonthly   = getSecret('STRIPE_PRICE_STARTER_MONTHLY')   || '';
  const stripeProProduct       = getSecret('STRIPE_PRODUCT_PROFESSIONAL') || '';
  const stripeProMonthly       = getSecret('STRIPE_PRICE_PROFESSIONAL_MONTHLY') || '';
  const stripeBizProduct       = getSecret('STRIPE_PRODUCT_BUSINESS')   || '';
  const stripeBizMonthly       = getSecret('STRIPE_PRICE_BUSINESS_MONTHLY')   || '';
  if (stripeStarterProduct)   await rawExecute(`UPDATE plans SET stripe_product_id='${stripeStarterProduct}', stripe_price_monthly='${stripeStarterMonthly}' WHERE slug='starter'`);
  if (stripeProProduct)       await rawExecute(`UPDATE plans SET stripe_product_id='${stripeProProduct}', stripe_price_monthly='${stripeProMonthly}' WHERE slug='professional'`);
  if (stripeBizProduct)       await rawExecute(`UPDATE plans SET stripe_product_id='${stripeBizProduct}', stripe_price_monthly='${stripeBizMonthly}' WHERE slug='business'`);
}

async function seedPointsRules(): Promise<void> {
  const rows = await rawQuery<{ c: number }>('SELECT COUNT(*) AS c FROM points_rules');
  if ((rows[0]?.c ?? 0) > 0) return;
  console.log('[azure-schema] Seeding points rules...');
  const rules = [
    ['signup',            'Account Registration',  50,  'Awarded when a new account is created'],
    ['profile_complete',  'Profile Completion',    100, 'Awarded when profile is fully filled in'],
    ['referral_signup',   'Referral Sign-up',      200, 'Awarded when someone signs up using your referral link'],
    ['referral_purchase', 'Referral Purchase',     500, 'Awarded when a referred user upgrades to a paid plan'],
    ['subscription_renew','Subscription Renewal',  100, 'Awarded each time a paid subscription renews'],
    ['promo_bonus',       'Promotional Bonus',     0,   'Manual promotional bonus awarded by admin'],
    ['manual_adjustment', 'Manual Adjustment',     0,   'Manual points adjustment by admin'],
  ];
  for (const [action, label, points, desc] of rules) {
    await rawExecute(`INSERT INTO points_rules (action,label,points,description) VALUES ('${action}','${label}',${points},'${desc}')`);
  }
}

async function seedRewards(): Promise<void> {
  const rows = await rawQuery<{ c: number }>('SELECT COUNT(*) AS c FROM rewards');
  if ((rows[0]?.c ?? 0) > 0) return;
  console.log('[azure-schema] Seeding rewards...');
  const rewards = [
    ['1 Month Free — Starter',      'Get one month free on the Starter plan',      'free_month',    'starter',      500],
    ['1 Month Free — Professional', 'Get one month free on the Professional plan', 'free_month',    'professional', 1000],
    ['10% Discount',                '10% off your next subscription payment',      'discount',      '10',           300],
    ['25% Discount',                '25% off your next subscription payment',      'discount',      '25',           700],
    ['Plan Upgrade Credit — £5',    '£5 account credit towards any plan',          'account_credit','5',            400],
    ['Plan Upgrade Credit — £10',   '£10 account credit towards any plan',         'account_credit','10',           800],
  ];
  for (const [name, desc, type, value, cost] of rewards) {
    const safeName = String(name).replace(/'/g, "''");
    const safeDesc = String(desc).replace(/'/g, "''");
    await rawExecute(`INSERT INTO rewards (name,description,type,value,points_cost) VALUES ('${safeName}','${safeDesc}','${type}','${value}',${cost})`);
  }
}

async function seedAdminSettings(): Promise<void> {
  const rows = await rawQuery<{ c: number }>('SELECT COUNT(*) AS c FROM admin_settings');
  if ((rows[0]?.c ?? 0) > 0) return;
  console.log('[azure-schema] Seeding admin settings...');
  const settings = [
    ['platform_name',    'Profile Centre'],
    ['platform_url',     'https://japrofilestudio.jagroupservices.co.uk'],
    ['allow_registration','true'],
    ['plans_paused',     'false'],
  ];
  for (const [k, v] of settings) {
    await rawExecute(`IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE [key]='${k}') INSERT INTO admin_settings ([key],value) VALUES ('${k}','${v}')`);
  }
}

// ── SQLite → Azure SQL Data Migration ────────────────────────────────────────

interface MigrationResult {
  success: boolean;
  tables: Record<string, { migrated: number; skipped: number; errors: number }>;
  errors: string[];
}

/**
 * Migrate all data from the SQLite database to Azure SQL.
 * Runs in dependency order. Idempotent — skips rows that already exist.
 * Called from the /api/admin/migrate-to-azure endpoint.
 */
export async function migrateFromSQLite(sqliteDb: import('better-sqlite3').Database): Promise<MigrationResult> {
  const result: MigrationResult = { success: true, tables: {}, errors: [] };

  // Migration order respects FK dependencies
  const tables = [
    'plans', 'users', 'profiles', 'profile_links', 'themes', 'subscriptions',
    'stripe_config', 'admin_settings', 'audit_log', 'admin_user_notes',
    'data_requests', 'account_closure_requests', 'business_seats',
    'business_seat_invites', 'notifications', 'issue_reports',
    'points_rules', 'rewards', 'points_ledger', 'reward_redemptions',
    'referral_codes', 'card_message_threads', 'card_messages',
    'legal_policies', 'stripe_products', 'stripe_prices',
    'qr_codes', 'contact_enquiries', 'page_views', 'link_clicks',
  ];

  for (const table of tables) {
    result.tables[table] = { migrated: 0, skipped: 0, errors: 0 };
    try {
      // Check table exists in SQLite
      const tableCheck = sqliteDb.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(table) as { name: string } | undefined;
      if (!tableCheck) {
        result.tables[table].skipped = -1; // table doesn't exist in SQLite
        continue;
      }

      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      if (rows.length === 0) continue;

      for (const row of rows) {
        try {
          // Skip rows with NULL in critical NOT NULL columns
          if (table === 'referral_codes' && (row.user_id == null || row.code == null)) {
            result.tables[table].skipped++;
            continue;
          }
          await migrateRow(table, row);
          result.tables[table].migrated++;
        } catch (e) {
          const msg = String(e);
          // Skip duplicate key violations — row already exists
          if (msg.includes('Violation of UNIQUE') || msg.includes('PRIMARY KEY') || msg.includes('duplicate')) {
            result.tables[table].skipped++;
          } else {
            result.tables[table].errors++;
            if (result.errors.length < 50) {
              result.errors.push(`${table}: ${msg.substring(0, 150)}`);
            }
          }
        }
      }
    } catch (e) {
      result.errors.push(`${table} (table error): ${String(e).substring(0, 150)}`);
      result.success = false;
    }
  }

  return result;
}

// Insert a single row into Azure SQL, handling IDENTITY columns and reserved words
async function migrateRow(table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row);
  if (cols.length === 0) return;

  // Skip the id column for IDENTITY tables (Azure SQL auto-assigns it)
  // Exception: tables with string PKs (stripe_products, stripe_prices, sessions)
  const stringPkTables = new Set(['stripe_products', 'stripe_prices', 'sessions']);
  const filteredCols = stringPkTables.has(table) ? cols : cols.filter(c => c !== 'id');

  if (filteredCols.length === 0) return;

  // Quote reserved column names
  const reservedWords = new Set(['key', 'value', 'name', 'type', 'status', 'action', 'role', 'label', 'code', 'token', 'version']);
  const quotedCols = filteredCols.map(c => reservedWords.has(c.toLowerCase()) ? `[${c}]` : c);

  const params = filteredCols.map(c => {
    const val = row[c] ?? null;
    // Truncate oversized strings to avoid T-SQL truncation errors.
    // logo_url and similar URL columns can be very long in SQLite.
    if (typeof val === 'string' && val.length > 2000) return val.substring(0, 2000);
    if (typeof val === 'string' && val.length > 500 && (c === 'url_prefix' || c === 'avatar_url')) return val.substring(0, 50);
    return val;
  });
  const paramPlaceholders = filteredCols.map(() => `?`).join(', ');

  // Build parameterised SQL using ? placeholders — callProxy's toTSQL() will
  // convert them to @param0, @param1, ... before sending to the Azure Function.
  const sql = `INSERT INTO ${table} (${quotedCols.join(', ')}) VALUES (${paramPlaceholders})`;

  // Use the standard execute() path which goes through callProxy → toTSQL()
  const { execute } = await import('./azure-proxy-db.js');
  await execute(sql, params);
}
