import {
  mysqlTable, int, varchar, text, boolean,
  timestamp, json, bigint, float,
} from 'drizzle-orm/mysql-core';

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = mysqlTable('users', {
  id:                int('id').primaryKey().autoincrement(),
  externalId:        varchar('external_id', { length: 255 }),
  email:             varchar('email', { length: 255 }).notNull().unique(),
  name:              varchar('name', { length: 255 }).notNull(),
  role:              varchar('role', { length: 50 }).notNull().default('user'),
  planId:            int('plan_id'),
  planName:          varchar('plan_name', { length: 100 }),
  planSlug:          varchar('plan_slug', { length: 100 }),
  accountStatus:     varchar('account_status', { length: 50 }).default('active'),
  lifetimeAccess:    boolean('lifetime_access').default(false),
  isPaused:          boolean('is_paused').default(false),
  isBlocked:         boolean('is_blocked').default(false),
  phone:             varchar('phone', { length: 50 }),
  marketingConsent:  boolean('marketing_consent').default(false),
  termsConsent:      boolean('terms_consent').default(false),
  privacyConsent:    boolean('privacy_consent').default(false),
  crmConsent:        boolean('crm_consent').default(false),
  dataImproveConsent: boolean('data_improve_consent').default(false),
  updatesConsent:    boolean('updates_consent').default(false),
  consentVersion:    varchar('consent_version', { length: 20 }),
  userNumber:        varchar('user_number', { length: 50 }),
  stripeCustomerId:  varchar('stripe_customer_id', { length: 255 }),
  entraOid:          varchar('entra_oid', { length: 255 }),
  profileCount:      int('profile_count').default(0),
  trialStartedAt:    timestamp('trial_started_at'),
  planSelectionDeadline: timestamp('plan_selection_deadline'),
  lastLoginAt:       timestamp('last_login_at'),
  syncedAt:          timestamp('synced_at').defaultNow(),
  createdAt:         timestamp('created_at').defaultNow(),
  updatedAt:         timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ── Plans (reference data) ────────────────────────────────────────────────────
export const plans = mysqlTable('plans', {
  id:              int('id').primaryKey().autoincrement(),
  externalId:      varchar('external_id', { length: 255 }),
  name:            varchar('name', { length: 100 }).notNull(),
  slug:            varchar('slug', { length: 100 }).notNull(),
  priceMonthly:    float('price_monthly').default(0),
  maxProfiles:     int('max_profiles').default(1),
  maxLinks:        int('max_links').default(5),
  maxSeats:        int('max_seats').default(1),
  hasMessaging:    boolean('has_messaging').default(false),
  hasQrDownload:   boolean('has_qr_download').default(false),
  hasContactForm:  boolean('has_contact_form').default(false),
  hasAdvancedAnalytics: boolean('has_advanced_analytics').default(false),
  hasVcardDownload: boolean('has_vcard_download').default(false),
  hasCustomThemes: boolean('has_custom_themes').default(false),
  removeBranding:  boolean('remove_branding').default(false),
  isActive:        boolean('is_active').default(true),
  syncedAt:        timestamp('synced_at').defaultNow(),
  createdAt:       timestamp('created_at').defaultNow(),
});

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const subscriptions = mysqlTable('subscriptions', {
  id:                 int('id').primaryKey().autoincrement(),
  externalId:         varchar('external_id', { length: 255 }),
  userId:             int('user_id').notNull().references(() => users.id),
  userEmail:          varchar('user_email', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  status:             varchar('status', { length: 50 }),
  billingInterval:    varchar('billing_interval', { length: 20 }),
  currentPeriodEnd:   timestamp('current_period_end'),
  cancelAtPeriodEnd:  boolean('cancel_at_period_end').default(false),
  syncedAt:           timestamp('synced_at').defaultNow(),
  createdAt:          timestamp('created_at').defaultNow(),
  updatedAt:          timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ── Profiles ──────────────────────────────────────────────────────────────────
export const profiles = mysqlTable('profiles', {
  id:           int('id').primaryKey().autoincrement(),
  externalId:   varchar('external_id', { length: 255 }),
  userId:       int('user_id').notNull().references(() => users.id),
  userEmail:    varchar('user_email', { length: 255 }),
  name:         varchar('name', { length: 255 }),
  slug:         varchar('slug', { length: 255 }),
  jobTitle:     varchar('job_title', { length: 255 }),
  orgName:      varchar('org_name', { length: 255 }),
  profileType:  varchar('profile_type', { length: 50 }),
  isPublished:  boolean('is_published').default(false),
  isDefault:    boolean('is_default').default(false),
  viewCount:    int('view_count').default(0),
  syncedAt:     timestamp('synced_at').defaultNow(),
  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ── Profile Links ─────────────────────────────────────────────────────────────
export const profileLinks = mysqlTable('profile_links', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  profileId:   int('profile_id').notNull().references(() => profiles.id),
  userId:      int('user_id'),
  type:        varchar('type', { length: 100 }),
  platform:    varchar('platform', { length: 100 }),
  label:       varchar('label', { length: 255 }),
  url:         text('url'),
  isEnabled:   boolean('is_enabled').default(true),
  sortOrder:   int('sort_order').default(0),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Link Clicks (analytics) ───────────────────────────────────────────────────
export const linkClicks = mysqlTable('link_clicks', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  linkId:      int('link_id'),
  profileId:   int('profile_id'),
  userId:      int('user_id'),
  clickedAt:   timestamp('clicked_at').defaultNow(),
  syncedAt:    timestamp('synced_at').defaultNow(),
});

// ── Page Views (analytics) ────────────────────────────────────────────────────
export const pageViews = mysqlTable('page_views', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  profileId:   int('profile_id'),
  userId:      int('user_id'),
  viewedAt:    timestamp('viewed_at').defaultNow(),
  syncedAt:    timestamp('synced_at').defaultNow(),
});

// ── Contact Enquiries ─────────────────────────────────────────────────────────
export const contactEnquiries = mysqlTable('contact_enquiries', {
  id:           int('id').primaryKey().autoincrement(),
  externalId:   varchar('external_id', { length: 255 }),
  profileId:    int('profile_id'),
  userId:       int('user_id'),
  senderName:   varchar('sender_name', { length: 255 }),
  senderEmail:  varchar('sender_email', { length: 255 }),
  message:      text('message'),
  isRead:       boolean('is_read').default(false),
  syncedAt:     timestamp('synced_at').defaultNow(),
  createdAt:    timestamp('created_at').defaultNow(),
});

// ── Admin User Notes ──────────────────────────────────────────────────────────
export const adminUserNotes = mysqlTable('admin_user_notes', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id').notNull().references(() => users.id),
  adminName:   varchar('admin_name', { length: 255 }),
  note:        text('note'),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Lifetime Access Log ───────────────────────────────────────────────────────
export const lifetimeAccessLog = mysqlTable('lifetime_access_log', {
  id:               int('id').primaryKey().autoincrement(),
  externalId:       varchar('external_id', { length: 255 }),
  userId:           int('user_id').notNull().references(() => users.id),
  action:           varchar('action', { length: 50 }),
  reasonCategory:   varchar('reason_category', { length: 100 }),
  internalNote:     text('internal_note'),
  grantedBy:        varchar('granted_by', { length: 255 }),
  canBeWithdrawn:   boolean('can_be_withdrawn').default(true),
  syncedAt:         timestamp('synced_at').defaultNow(),
  createdAt:        timestamp('created_at').defaultNow(),
});

// ── Referral Codes ────────────────────────────────────────────────────────────
export const referralCodes = mysqlTable('referral_codes', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id').references(() => users.id),
  code:        varchar('code', { length: 100 }),
  isActive:    boolean('is_active').default(true),
  useCount:    int('use_count').default(0),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Referral Events ───────────────────────────────────────────────────────────
export const referralEvents = mysqlTable('referral_events', {
  id:             int('id').primaryKey().autoincrement(),
  externalId:     varchar('external_id', { length: 255 }),
  referrerId:     int('referrer_id').references(() => users.id),
  referredUserId: int('referred_user_id').references(() => users.id),
  code:           varchar('code', { length: 100 }),
  eventType:      varchar('event_type', { length: 50 }),
  syncedAt:       timestamp('synced_at').defaultNow(),
  createdAt:      timestamp('created_at').defaultNow(),
});

// ── Business Seats ────────────────────────────────────────────────────────────
export const businessSeats = mysqlTable('business_seats', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  ownerId:     int('owner_id').references(() => users.id),
  memberId:    int('member_id').references(() => users.id),
  memberEmail: varchar('member_email', { length: 255 }),
  role:        varchar('role', { length: 50 }),
  status:      varchar('status', { length: 50 }),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = mysqlTable('notifications', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id').references(() => users.id),
  type:        varchar('type', { length: 100 }),
  title:       varchar('title', { length: 500 }),
  isRead:      boolean('is_read').default(false),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Issue Reports (moderation) ────────────────────────────────────────────────
export const issueReports = mysqlTable('issue_reports', {
  id:             int('id').primaryKey().autoincrement(),
  externalId:     varchar('external_id', { length: 255 }),
  profileId:      int('profile_id'),
  reportedUserId: int('reported_user_id'),
  reporterEmail:  varchar('reporter_email', { length: 255 }),
  reason:         varchar('reason', { length: 255 }),
  status:         varchar('status', { length: 50 }).default('pending'),
  adminNotes:     text('admin_notes'),
  syncedAt:       timestamp('synced_at').defaultNow(),
  createdAt:      timestamp('created_at').defaultNow(),
});

// ── Account Closure Requests ──────────────────────────────────────────────────
export const accountClosureRequests = mysqlTable('account_closure_requests', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id').references(() => users.id),
  reason:      text('reason'),
  status:      varchar('status', { length: 50 }).default('pending'),
  adminNote:   text('admin_note'),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Card Message Threads ──────────────────────────────────────────────────────
export const cardMessageThreads = mysqlTable('card_message_threads', {
  id:           int('id').primaryKey().autoincrement(),
  externalId:   varchar('external_id', { length: 255 }),
  profileId:    int('profile_id'),
  userId:       int('user_id'),
  visitorEmail: varchar('visitor_email', { length: 255 }),
  visitorName:  varchar('visitor_name', { length: 255 }),
  status:       varchar('status', { length: 50 }).default('open'),
  messageCount: int('message_count').default(0),
  syncedAt:     timestamp('synced_at').defaultNow(),
  createdAt:    timestamp('created_at').defaultNow(),
});

// ── Affiliate Applications ────────────────────────────────────────────────────
export const affiliateApplications = mysqlTable('affiliate_applications', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id').references(() => users.id),
  email:       varchar('email', { length: 255 }),
  status:      varchar('status', { length: 50 }).default('pending'),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Profile Scans (security) ──────────────────────────────────────────────────
export const profileScans = mysqlTable('profile_scans', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  profileId:   int('profile_id'),
  userId:      int('user_id'),
  status:      varchar('status', { length: 50 }),
  riskLevel:   varchar('risk_level', { length: 50 }),
  issueCount:  int('issue_count').default(0),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Support Request Messages ──────────────────────────────────────────────────
export const supportRequestMessages = mysqlTable('support_request_messages', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  ticketId:    int('ticket_id'),
  userId:      int('user_id'),
  senderRole:  varchar('sender_role', { length: 50 }),
  message:     text('message'),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Moderation Actions ────────────────────────────────────────────────────────
export const moderationActions = mysqlTable('moderation_actions', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  targetId:    int('target_id'),
  targetType:  varchar('target_type', { length: 50 }),
  action:      varchar('action', { length: 100 }),
  adminId:     int('admin_id'),
  adminName:   varchar('admin_name', { length: 255 }),
  reason:      text('reason'),
  syncedAt:    timestamp('synced_at').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
});

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const auditLog = mysqlTable('audit_log', {
  id:         int('id').primaryKey().autoincrement(),
  externalId: varchar('external_id', { length: 255 }),
  userId:     int('user_id'),
  userEmail:  varchar('user_email', { length: 255 }),
  action:     varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId:   varchar('entity_id', { length: 255 }),
  details:    json('details'),
  ipAddress:  varchar('ip_address', { length: 100 }),
  userAgent:  text('user_agent'),
  createdAt:  timestamp('created_at').defaultNow(),
});

// ── Support Tickets ───────────────────────────────────────────────────────────
export const supportTickets = mysqlTable('support_tickets', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id'),
  userEmail:   varchar('user_email', { length: 255 }),
  subject:     varchar('subject', { length: 500 }),
  status:      varchar('status', { length: 50 }).default('open'),
  priority:    varchar('priority', { length: 50 }).default('normal'),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ── Data Requests (GDPR) ──────────────────────────────────────────────────────
export const dataRequests = mysqlTable('data_requests', {
  id:          int('id').primaryKey().autoincrement(),
  externalId:  varchar('external_id', { length: 255 }),
  userId:      int('user_id'),
  userEmail:   varchar('user_email', { length: 255 }),
  type:        varchar('type', { length: 50 }),
  status:      varchar('status', { length: 50 }).default('pending'),
  adminNotes:  text('admin_notes'),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ── Sync Log ──────────────────────────────────────────────────────────────────
export const syncLog = mysqlTable('sync_log', {
  id:          int('id').primaryKey().autoincrement(),
  tableName:   varchar('table_name', { length: 100 }).notNull(),
  rowsSynced:  int('rows_synced').default(0),
  syncedAt:    timestamp('synced_at').defaultNow(),
  triggeredBy: varchar('triggered_by', { length: 100 }).default('auto'),
});
