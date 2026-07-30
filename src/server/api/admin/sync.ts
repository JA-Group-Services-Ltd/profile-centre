/**
 * Admin sync endpoint — copies data from the app's SQLite database into
 * Airo's managed MySQL database so it appears in the GoDaddy Tables viewer
 * and can be exported for GDPR / audit purposes.
 *
 * POST /api/admin/sync  — full sync (all tables)
 * GET  /api/admin/sync  — returns last sync timestamps + row counts
 */
import type { Request, Response } from 'express';
import { db as mysqlDb } from '../../db/client.js';
import {
  users as mysqlUsers,
  plans as mysqlPlans,
  subscriptions as mysqlSubscriptions,
  profiles as mysqlProfiles,
  profileLinks as mysqlProfileLinks,
  linkClicks as mysqlLinkClicks,
  pageViews as mysqlPageViews,
  contactEnquiries as mysqlContactEnquiries,
  adminUserNotes as mysqlAdminUserNotes,
  lifetimeAccessLog as mysqlLifetimeAccessLog,
  referralCodes as mysqlReferralCodes,
  referralEvents as mysqlReferralEvents,
  businessSeats as mysqlBusinessSeats,
  notifications as mysqlNotifications,
  issueReports as mysqlIssueReports,
  accountClosureRequests as mysqlAccountClosureRequests,
  cardMessageThreads as mysqlCardMessageThreads,
  affiliateApplications as mysqlAffiliateApplications,
  profileScans as mysqlProfileScans,
  supportRequestMessages as mysqlSupportRequestMessages,
  moderationActions as mysqlModerationActions,
  auditLog as mysqlAuditLog,
  supportTickets as mysqlSupportTickets,
  dataRequests as mysqlDataRequests,
  syncLog,
} from '../../db/schema.js';
import sqliteDb from '../../db.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function toBool(val: unknown): boolean {
  return val === 1 || val === true || val === '1';
}

/** Check which columns exist in a SQLite table */
function colSet(table: string): Set<string> {
  try {
    const cols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return new Set(cols.map(c => c.name));
  } catch {
    return new Set();
  }
}

/** Returns true if a SQLite table exists */
function tableExists(table: string): boolean {
  const row = sqliteDb.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table) as { name: string } | undefined;
  return !!row;
}

// ── sync plans ────────────────────────────────────────────────────────────────
async function syncPlans(): Promise<number> {
  if (!tableExists('plans')) return 0;
  const rows = sqliteDb.prepare(`SELECT * FROM plans`).all() as any[];
  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlPlans).values({
      externalId:           String(r.id),
      name:                 r.name || '',
      slug:                 r.slug || '',
      priceMonthly:         r.price_monthly ?? 0,
      maxProfiles:          r.max_profiles ?? 1,
      maxLinks:             r.max_links ?? 5,
      maxSeats:             r.max_seats ?? 1,
      hasMessaging:         toBool(r.has_messaging),
      hasQrDownload:        toBool(r.has_qr_download),
      hasContactForm:       toBool(r.has_contact_form),
      hasAdvancedAnalytics: toBool(r.has_advanced_analytics),
      hasVcardDownload:     toBool(r.has_vcard_download),
      hasCustomThemes:      toBool(r.has_custom_themes),
      removeBranding:       toBool(r.remove_branding),
      isActive:             toBool(r.is_active ?? 1),
      createdAt:            toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        name:                 r.name || '',
        priceMonthly:         r.price_monthly ?? 0,
        maxProfiles:          r.max_profiles ?? 1,
        maxLinks:             r.max_links ?? 5,
        maxSeats:             r.max_seats ?? 1,
        hasMessaging:         toBool(r.has_messaging),
        isActive:             toBool(r.is_active ?? 1),
        syncedAt:             new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync users ────────────────────────────────────────────────────────────────
async function syncUsers(): Promise<number> {
  const rows = sqliteDb.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.plan_id,
           p.name AS plan_name, p.slug AS plan_slug,
           u.account_status, u.lifetime_access, u.is_paused,
           u.is_blocked, u.phone,
           u.marketing_consent, u.terms_consent, u.privacy_consent,
           u.crm_consent, u.data_improve_consent, u.updates_consent,
           u.consent_version, u.user_number, u.stripe_customer_id,
           u.entra_oid, u.last_login_at, u.trial_started_at,
           u.plan_selection_deadline, u.created_at,
           (SELECT COUNT(*) FROM profiles pr WHERE pr.user_id = u.id) AS profile_count
    FROM users u
    LEFT JOIN plans p ON u.plan_id = p.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlUsers).values({
      externalId:           String(r.id),
      email:                r.email,
      name:                 r.name || '',
      role:                 r.role || 'user',
      planId:               r.plan_id ?? null,
      planName:             r.plan_name ?? null,
      planSlug:             r.plan_slug ?? null,
      accountStatus:        r.account_status ?? 'active',
      lifetimeAccess:       toBool(r.lifetime_access),
      isPaused:             toBool(r.is_paused),
      isBlocked:            toBool(r.is_blocked),
      phone:                r.phone ?? null,
      marketingConsent:     toBool(r.marketing_consent),
      termsConsent:         toBool(r.terms_consent),
      privacyConsent:       toBool(r.privacy_consent),
      crmConsent:           toBool(r.crm_consent),
      dataImproveConsent:   toBool(r.data_improve_consent),
      updatesConsent:       toBool(r.updates_consent),
      consentVersion:       r.consent_version ?? null,
      userNumber:           r.user_number ?? null,
      stripeCustomerId:     r.stripe_customer_id ?? null,
      entraOid:             r.entra_oid ?? null,
      profileCount:         r.profile_count ?? 0,
      trialStartedAt:       toDate(r.trial_started_at),
      planSelectionDeadline: toDate(r.plan_selection_deadline),
      lastLoginAt:          toDate(r.last_login_at),
      createdAt:            toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        email:                r.email,
        name:                 r.name || '',
        role:                 r.role || 'user',
        planId:               r.plan_id ?? null,
        planName:             r.plan_name ?? null,
        planSlug:             r.plan_slug ?? null,
        accountStatus:        r.account_status ?? 'active',
        lifetimeAccess:       toBool(r.lifetime_access),
        isPaused:             toBool(r.is_paused),
        isBlocked:            toBool(r.is_blocked),
        phone:                r.phone ?? null,
        marketingConsent:     toBool(r.marketing_consent),
        termsConsent:         toBool(r.terms_consent),
        privacyConsent:       toBool(r.privacy_consent),
        crmConsent:           toBool(r.crm_consent),
        dataImproveConsent:   toBool(r.data_improve_consent),
        updatesConsent:       toBool(r.updates_consent),
        consentVersion:       r.consent_version ?? null,
        userNumber:           r.user_number ?? null,
        stripeCustomerId:     r.stripe_customer_id ?? null,
        entraOid:             r.entra_oid ?? null,
        profileCount:         r.profile_count ?? 0,
        trialStartedAt:       toDate(r.trial_started_at),
        planSelectionDeadline: toDate(r.plan_selection_deadline),
        lastLoginAt:          toDate(r.last_login_at),
        syncedAt:             new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync subscriptions ────────────────────────────────────────────────────────
async function syncSubscriptions(): Promise<number> {
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const rows = sqliteDb.prepare(`
    SELECT s.id, s.user_id, u.email,
           s.stripe_subscription_id, s.status, s.billing_interval,
           s.current_period_end, s.cancel_at_period_end, s.created_at
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    const mysqlUserId = extToMysqlId.get(String(r.user_id));
    if (!mysqlUserId) continue;
    await mysqlDb.insert(mysqlSubscriptions).values({
      externalId:           String(r.id),
      userId:               mysqlUserId,
      userEmail:            r.email ?? null,
      stripeSubscriptionId: r.stripe_subscription_id ?? null,
      status:               r.status ?? null,
      billingInterval:      r.billing_interval ?? null,
      currentPeriodEnd:     toDate(r.current_period_end),
      cancelAtPeriodEnd:    toBool(r.cancel_at_period_end),
      createdAt:            toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:           r.status ?? null,
        billingInterval:  r.billing_interval ?? null,
        currentPeriodEnd: toDate(r.current_period_end),
        cancelAtPeriodEnd: toBool(r.cancel_at_period_end),
        syncedAt:         new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync profiles ─────────────────────────────────────────────────────────────
async function syncProfiles(): Promise<number> {
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const cols = colSet('profiles');
  const selectCols = [
    'p.id', 'p.user_id', 'u.email',
    cols.has('name') ? 'p.name' : "'' AS name",
    cols.has('slug') ? 'p.slug' : "'' AS slug",
    cols.has('job_title') ? 'p.job_title' : "'' AS job_title",
    cols.has('org_name') ? 'p.org_name' : "'' AS org_name",
    cols.has('profile_type') ? 'p.profile_type' : "'' AS profile_type",
    cols.has('is_published') ? 'p.is_published' : '0 AS is_published',
    cols.has('is_default') ? 'p.is_default' : '0 AS is_default',
    cols.has('view_count') ? 'p.view_count' : '0 AS view_count',
    'p.created_at',
  ].join(', ');

  const rows = sqliteDb.prepare(`
    SELECT ${selectCols}
    FROM profiles p
    LEFT JOIN users u ON p.user_id = u.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    const mysqlUserId = extToMysqlId.get(String(r.user_id));
    if (!mysqlUserId) continue;
    await mysqlDb.insert(mysqlProfiles).values({
      externalId:  String(r.id),
      userId:      mysqlUserId,
      userEmail:   r.email ?? null,
      name:        r.name ?? null,
      slug:        r.slug ?? null,
      jobTitle:    r.job_title ?? null,
      orgName:     r.org_name ?? null,
      profileType: r.profile_type ?? null,
      isPublished: toBool(r.is_published),
      isDefault:   toBool(r.is_default),
      viewCount:   r.view_count ?? 0,
      createdAt:   toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        name:        r.name ?? null,
        slug:        r.slug ?? null,
        jobTitle:    r.job_title ?? null,
        orgName:     r.org_name ?? null,
        profileType: r.profile_type ?? null,
        isPublished: toBool(r.is_published),
        isDefault:   toBool(r.is_default),
        viewCount:   r.view_count ?? 0,
        syncedAt:    new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync profile links ────────────────────────────────────────────────────────
async function syncProfileLinks(): Promise<number> {
  if (!tableExists('profile_links')) return 0;
  const mysqlProfileRows = await mysqlDb.select({ id: mysqlProfiles.id, externalId: mysqlProfiles.externalId }).from(mysqlProfiles);
  const extToProfileId = new Map(mysqlProfileRows.map(r => [r.externalId, r.id]));

  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToUserId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const cols = colSet('profile_links');
  const rows = sqliteDb.prepare(`
    SELECT pl.id, pl.profile_id, p.user_id,
           pl.type, pl.platform, pl.label, pl.url,
           pl.is_enabled, pl.sort_order, pl.created_at
    FROM profile_links pl
    LEFT JOIN profiles p ON pl.profile_id = p.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    const mysqlProfileId = extToProfileId.get(String(r.profile_id));
    if (!mysqlProfileId) continue;
    const mysqlUserId = extToUserId.get(String(r.user_id)) ?? null;
    await mysqlDb.insert(mysqlProfileLinks).values({
      externalId: String(r.id),
      profileId:  mysqlProfileId,
      userId:     mysqlUserId,
      type:       r.type ?? null,
      platform:   r.platform ?? null,
      label:      r.label ?? null,
      url:        r.url ?? null,
      isEnabled:  toBool(r.is_enabled ?? 1),
      sortOrder:  r.sort_order ?? 0,
      createdAt:  toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        label:     r.label ?? null,
        url:       r.url ?? null,
        isEnabled: toBool(r.is_enabled ?? 1),
        sortOrder: r.sort_order ?? 0,
        syncedAt:  new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync link clicks ──────────────────────────────────────────────────────────
async function syncLinkClicks(): Promise<number> {
  if (!tableExists('link_clicks')) return 0;
  // Only sync recent clicks (last 90 days) to avoid huge inserts
  const existing = await mysqlDb.select({ externalId: mysqlLinkClicks.externalId }).from(mysqlLinkClicks);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT lc.id, lc.link_id, lc.profile_id,
           p.user_id, lc.clicked_at
    FROM link_clicks lc
    LEFT JOIN profiles p ON lc.profile_id = p.id
    WHERE lc.clicked_at >= datetime('now', '-90 days')
    ORDER BY lc.id DESC
    LIMIT 10000
  `).all() as any[];

  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToUserId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlLinkClicks).values({
      externalId: String(r.id),
      linkId:     r.link_id ?? null,
      profileId:  r.profile_id ?? null,
      userId:     extToUserId.get(String(r.user_id)) ?? null,
      clickedAt:  toDate(r.clicked_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync page views ───────────────────────────────────────────────────────────
async function syncPageViews(): Promise<number> {
  if (!tableExists('page_views')) return 0;
  const existing = await mysqlDb.select({ externalId: mysqlPageViews.externalId }).from(mysqlPageViews);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT pv.id, pv.profile_id, p.user_id, pv.viewed_at
    FROM page_views pv
    LEFT JOIN profiles p ON pv.profile_id = p.id
    WHERE pv.viewed_at >= datetime('now', '-90 days')
    ORDER BY pv.id DESC
    LIMIT 10000
  `).all() as any[];

  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToUserId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlPageViews).values({
      externalId: String(r.id),
      profileId:  r.profile_id ?? null,
      userId:     extToUserId.get(String(r.user_id)) ?? null,
      viewedAt:   toDate(r.viewed_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync contact enquiries ────────────────────────────────────────────────────
async function syncContactEnquiries(): Promise<number> {
  if (!tableExists('contact_enquiries')) return 0;
  const existing = await mysqlDb.select({ externalId: mysqlContactEnquiries.externalId }).from(mysqlContactEnquiries);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT ce.id, ce.profile_id, p.user_id,
           ce.sender_name, ce.sender_email, ce.message, ce.is_read, ce.created_at
    FROM contact_enquiries ce
    LEFT JOIN profiles p ON ce.profile_id = p.id
  `).all() as any[];

  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToUserId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlContactEnquiries).values({
      externalId:  String(r.id),
      profileId:   r.profile_id ?? null,
      userId:      extToUserId.get(String(r.user_id)) ?? null,
      senderName:  r.sender_name ?? null,
      senderEmail: r.sender_email ?? null,
      message:     r.message ?? null,
      isRead:      toBool(r.is_read),
      createdAt:   toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync admin user notes ─────────────────────────────────────────────────────
async function syncAdminUserNotes(): Promise<number> {
  if (!tableExists('admin_user_notes')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const existing = await mysqlDb.select({ externalId: mysqlAdminUserNotes.externalId }).from(mysqlAdminUserNotes);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT id, user_id, admin_name, note, created_at FROM admin_user_notes
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    const mysqlUserId = extToMysqlId.get(String(r.user_id));
    if (!mysqlUserId) continue;
    await mysqlDb.insert(mysqlAdminUserNotes).values({
      externalId: String(r.id),
      userId:     mysqlUserId,
      adminName:  r.admin_name ?? null,
      note:       r.note ?? null,
      createdAt:  toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync lifetime access log ──────────────────────────────────────────────────
async function syncLifetimeAccessLog(): Promise<number> {
  if (!tableExists('lifetime_access_log')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const existing = await mysqlDb.select({ externalId: mysqlLifetimeAccessLog.externalId }).from(mysqlLifetimeAccessLog);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT id, user_id, action, reason_category, internal_note,
           granted_by, can_be_withdrawn, created_at
    FROM lifetime_access_log
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    const mysqlUserId = extToMysqlId.get(String(r.user_id));
    if (!mysqlUserId) continue;
    await mysqlDb.insert(mysqlLifetimeAccessLog).values({
      externalId:     String(r.id),
      userId:         mysqlUserId,
      action:         r.action ?? null,
      reasonCategory: r.reason_category ?? null,
      internalNote:   r.internal_note ?? null,
      grantedBy:      r.granted_by ?? null,
      canBeWithdrawn: toBool(r.can_be_withdrawn ?? 1),
      createdAt:      toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync referral codes ───────────────────────────────────────────────────────
async function syncReferralCodes(): Promise<number> {
  if (!tableExists('referral_codes')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const rows = sqliteDb.prepare(`
    SELECT id, user_id, code, is_active, use_count, created_at FROM referral_codes
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    const mysqlUserId = extToMysqlId.get(String(r.user_id)) ?? null;
    await mysqlDb.insert(mysqlReferralCodes).values({
      externalId: String(r.id),
      userId:     mysqlUserId,
      code:       r.code ?? null,
      isActive:   toBool(r.is_active ?? 1),
      useCount:   r.use_count ?? 0,
      createdAt:  toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        isActive: toBool(r.is_active ?? 1),
        useCount: r.use_count ?? 0,
        syncedAt: new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync referral events ──────────────────────────────────────────────────────
async function syncReferralEvents(): Promise<number> {
  if (!tableExists('referral_events')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const existing = await mysqlDb.select({ externalId: mysqlReferralEvents.externalId }).from(mysqlReferralEvents);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT id, referrer_id, referred_user_id, code, event_type, created_at
    FROM referral_events
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlReferralEvents).values({
      externalId:     String(r.id),
      referrerId:     extToMysqlId.get(String(r.referrer_id)) ?? null,
      referredUserId: extToMysqlId.get(String(r.referred_user_id)) ?? null,
      code:           r.code ?? null,
      eventType:      r.event_type ?? null,
      createdAt:      toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync business seats ───────────────────────────────────────────────────────
async function syncBusinessSeats(): Promise<number> {
  if (!tableExists('business_seats')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const rows = sqliteDb.prepare(`
    SELECT id, owner_id, member_id, member_email, role, status, created_at
    FROM business_seats
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlBusinessSeats).values({
      externalId:  String(r.id),
      ownerId:     extToMysqlId.get(String(r.owner_id)) ?? null,
      memberId:    extToMysqlId.get(String(r.member_id)) ?? null,
      memberEmail: r.member_email ?? null,
      role:        r.role ?? null,
      status:      r.status ?? null,
      createdAt:   toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        role:     r.role ?? null,
        status:   r.status ?? null,
        syncedAt: new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync notifications ────────────────────────────────────────────────────────
async function syncNotifications(): Promise<number> {
  if (!tableExists('notifications')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const existing = await mysqlDb.select({ externalId: mysqlNotifications.externalId }).from(mysqlNotifications);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT id, user_id, type, title, is_read, created_at
    FROM notifications
    ORDER BY id DESC LIMIT 5000
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlNotifications).values({
      externalId: String(r.id),
      userId:     extToMysqlId.get(String(r.user_id)) ?? null,
      type:       r.type ?? null,
      title:      r.title ?? null,
      isRead:     toBool(r.is_read),
      createdAt:  toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync issue reports ────────────────────────────────────────────────────────
async function syncIssueReports(): Promise<number> {
  if (!tableExists('issue_reports')) return 0;
  const rows = sqliteDb.prepare(`
    SELECT ir.id, ir.profile_id, p.user_id AS reported_user_id,
           ir.reporter_email, ir.reason, ir.status, ir.admin_notes, ir.created_at
    FROM issue_reports ir
    LEFT JOIN profiles p ON ir.profile_id = p.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlIssueReports).values({
      externalId:     String(r.id),
      profileId:      r.profile_id ?? null,
      reportedUserId: r.reported_user_id ?? null,
      reporterEmail:  r.reporter_email ?? null,
      reason:         r.reason ?? null,
      status:         r.status ?? 'pending',
      adminNotes:     r.admin_notes ?? null,
      createdAt:      toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:     r.status ?? 'pending',
        adminNotes: r.admin_notes ?? null,
        syncedAt:   new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync account closure requests ────────────────────────────────────────────
async function syncAccountClosureRequests(): Promise<number> {
  if (!tableExists('account_closure_requests')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const rows = sqliteDb.prepare(`
    SELECT id, user_id, reason, status, admin_note, created_at
    FROM account_closure_requests
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    const mysqlUserId = extToMysqlId.get(String(r.user_id)) ?? null;
    await mysqlDb.insert(mysqlAccountClosureRequests).values({
      externalId: String(r.id),
      userId:     mysqlUserId,
      reason:     r.reason ?? null,
      status:     r.status ?? 'pending',
      adminNote:  r.admin_note ?? null,
      createdAt:  toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:    r.status ?? 'pending',
        adminNote: r.admin_note ?? null,
        syncedAt:  new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync card message threads ─────────────────────────────────────────────────
async function syncCardMessageThreads(): Promise<number> {
  if (!tableExists('card_message_threads')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const cols = colSet('card_message_threads');
  const rows = sqliteDb.prepare(`
    SELECT cmt.id, cmt.profile_id, p.user_id,
           ${cols.has('visitor_email') ? 'cmt.visitor_email' : "'' AS visitor_email"},
           ${cols.has('visitor_name') ? 'cmt.visitor_name' : "'' AS visitor_name"},
           ${cols.has('status') ? 'cmt.status' : "'open' AS status"},
           cmt.created_at,
           (SELECT COUNT(*) FROM card_messages cm WHERE cm.thread_id = cmt.id) AS message_count
    FROM card_message_threads cmt
    LEFT JOIN profiles p ON cmt.profile_id = p.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlCardMessageThreads).values({
      externalId:   String(r.id),
      profileId:    r.profile_id ?? null,
      userId:       extToMysqlId.get(String(r.user_id)) ?? null,
      visitorEmail: r.visitor_email ?? null,
      visitorName:  r.visitor_name ?? null,
      status:       r.status ?? 'open',
      messageCount: r.message_count ?? 0,
      createdAt:    toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:       r.status ?? 'open',
        messageCount: r.message_count ?? 0,
        syncedAt:     new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync affiliate applications ───────────────────────────────────────────────
async function syncAffiliateApplications(): Promise<number> {
  if (!tableExists('affiliate_applications')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const rows = sqliteDb.prepare(`
    SELECT id, user_id, email, status, created_at FROM affiliate_applications
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlAffiliateApplications).values({
      externalId: String(r.id),
      userId:     extToMysqlId.get(String(r.user_id)) ?? null,
      email:      r.email ?? null,
      status:     r.status ?? 'pending',
      createdAt:  toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:   r.status ?? 'pending',
        syncedAt: new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync profile scans ────────────────────────────────────────────────────────
async function syncProfileScans(): Promise<number> {
  if (!tableExists('profile_scans')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const cols = colSet('profile_scans');
  const existing = await mysqlDb.select({ externalId: mysqlProfileScans.externalId }).from(mysqlProfileScans);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT ps.id, ps.profile_id, p.user_id,
           ${cols.has('status') ? 'ps.status' : "'completed' AS status"},
           ${cols.has('risk_level') ? 'ps.risk_level' : "'unknown' AS risk_level"},
           ${cols.has('issue_count') ? 'ps.issue_count' : '0 AS issue_count'},
           ps.created_at
    FROM profile_scans ps
    LEFT JOIN profiles p ON ps.profile_id = p.id
    ORDER BY ps.id DESC LIMIT 5000
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlProfileScans).values({
      externalId:  String(r.id),
      profileId:   r.profile_id ?? null,
      userId:      extToMysqlId.get(String(r.user_id)) ?? null,
      status:      r.status ?? null,
      riskLevel:   r.risk_level ?? null,
      issueCount:  r.issue_count ?? 0,
      createdAt:   toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync support request messages ─────────────────────────────────────────────
async function syncSupportRequestMessages(): Promise<number> {
  if (!tableExists('support_request_messages')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const existing = await mysqlDb.select({ externalId: mysqlSupportRequestMessages.externalId }).from(mysqlSupportRequestMessages);
  const existingIds = new Set(existing.map(r => r.externalId));

  const cols = colSet('support_request_messages');
  const rows = sqliteDb.prepare(`
    SELECT id, ${cols.has('support_request_id') ? 'support_request_id AS ticket_id' : cols.has('ticket_id') ? 'ticket_id' : '0 AS ticket_id'},
           user_id,
           ${cols.has('sender_role') ? 'sender_role' : "'user' AS sender_role"},
           message, created_at
    FROM support_request_messages
    ORDER BY id DESC LIMIT 5000
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlSupportRequestMessages).values({
      externalId: String(r.id),
      ticketId:   r.ticket_id ?? null,
      userId:     extToMysqlId.get(String(r.user_id)) ?? null,
      senderRole: r.sender_role ?? null,
      message:    r.message ?? null,
      createdAt:  toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync moderation actions ───────────────────────────────────────────────────
async function syncModerationActions(): Promise<number> {
  if (!tableExists('moderation_actions')) return 0;
  const mysqlUserRows = await mysqlDb.select({ id: mysqlUsers.id, externalId: mysqlUsers.externalId }).from(mysqlUsers);
  const extToMysqlId = new Map(mysqlUserRows.map(r => [r.externalId, r.id]));

  const existing = await mysqlDb.select({ externalId: mysqlModerationActions.externalId }).from(mysqlModerationActions);
  const existingIds = new Set(existing.map(r => r.externalId));

  const cols = colSet('moderation_actions');
  const rows = sqliteDb.prepare(`
    SELECT id,
           ${cols.has('target_id') ? 'target_id' : '0 AS target_id'},
           ${cols.has('target_type') ? 'target_type' : "'' AS target_type"},
           action,
           ${cols.has('admin_id') ? 'admin_id' : '0 AS admin_id'},
           ${cols.has('admin_name') ? 'admin_name' : "'' AS admin_name"},
           ${cols.has('reason') ? 'reason' : "'' AS reason"},
           created_at
    FROM moderation_actions
    ORDER BY id DESC LIMIT 5000
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    await mysqlDb.insert(mysqlModerationActions).values({
      externalId: String(r.id),
      targetId:   r.target_id ?? null,
      targetType: r.target_type ?? null,
      action:     r.action ?? null,
      adminId:    extToMysqlId.get(String(r.admin_id)) ?? null,
      adminName:  r.admin_name ?? null,
      reason:     r.reason ?? null,
      createdAt:  toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync audit log ────────────────────────────────────────────────────────────
async function syncAuditLog(): Promise<number> {
  const existing = await mysqlDb.select({ externalId: mysqlAuditLog.externalId }).from(mysqlAuditLog);
  const existingIds = new Set(existing.map(r => r.externalId));

  const rows = sqliteDb.prepare(`
    SELECT al.id, al.user_id, u.email,
           al.action,
           COALESCE(al.entity_type, al.resource_type, '') AS entity_type,
           COALESCE(al.entity_id, al.resource_id, '') AS entity_id,
           al.details, al.ip_address, al.user_agent, al.created_at
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.id DESC
    LIMIT 5000
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    if (existingIds.has(String(r.id))) continue;
    let details = null;
    try { details = r.details ? JSON.parse(r.details) : null; } catch { details = null; }
    await mysqlDb.insert(mysqlAuditLog).values({
      externalId: String(r.id),
      userId:     r.user_id ?? null,
      userEmail:  r.email ?? null,
      action:     r.action,
      entityType: r.entity_type ?? null,
      entityId:   r.entity_id ? String(r.entity_id) : null,
      details,
      ipAddress:  r.ip_address ?? null,
      userAgent:  r.user_agent ?? null,
      createdAt:  toDate(r.created_at) ?? new Date(),
    });
    synced++;
  }
  return synced;
}

// ── sync support tickets ──────────────────────────────────────────────────────
async function syncSupportTickets(): Promise<number> {
  if (!tableExists('support_tickets') && !tableExists('support_requests')) return 0;
  const tableName = tableExists('support_requests') ? 'support_requests' : 'support_tickets';
  const cols = colSet(tableName);

  const selectCols = [
    'st.id', 'st.user_id', 'u.email',
    cols.has('subject') ? 'st.subject' : "'' AS subject",
    cols.has('status') ? 'st.status' : "'open' AS status",
    cols.has('priority') ? 'st.priority' : "'normal' AS priority",
    'st.created_at',
  ].join(', ');

  const rows = sqliteDb.prepare(`
    SELECT ${selectCols}
    FROM ${tableName} st
    LEFT JOIN users u ON st.user_id = u.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlSupportTickets).values({
      externalId: String(r.id),
      userId:     r.user_id ?? null,
      userEmail:  r.email ?? null,
      subject:    r.subject ?? null,
      status:     r.status ?? 'open',
      priority:   r.priority ?? 'normal',
      createdAt:  toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:    r.status ?? 'open',
        priority:  r.priority ?? 'normal',
        syncedAt:  new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── sync data requests ────────────────────────────────────────────────────────
async function syncDataRequests(): Promise<number> {
  if (!tableExists('data_requests')) return 0;

  const rows = sqliteDb.prepare(`
    SELECT dr.id, dr.user_id, u.email,
           dr.request_type AS type, dr.status, dr.internal_notes AS admin_notes, dr.created_at
    FROM data_requests dr
    LEFT JOIN users u ON dr.user_id = u.id
  `).all() as any[];

  let synced = 0;
  for (const r of rows) {
    await mysqlDb.insert(mysqlDataRequests).values({
      externalId:  String(r.id),
      userId:      r.user_id ?? null,
      userEmail:   r.email ?? null,
      type:        r.type ?? null,
      status:      r.status ?? 'pending',
      adminNotes:  r.admin_notes ?? null,
      createdAt:   toDate(r.created_at) ?? new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        status:     r.status ?? 'pending',
        adminNotes: r.admin_notes ?? null,
        updatedAt:  new Date(),
      },
    });
    synced++;
  }
  return synced;
}

// ── GET /api/admin/sync ───────────────────────────────────────────────────────
export async function getSyncStatus(req: Request, res: Response) {
  try {
    const logs = await mysqlDb.select().from(syncLog).limit(20);
    const userCount = await mysqlDb.select({ id: mysqlUsers.id }).from(mysqlUsers);
    const profileCount = await mysqlDb.select({ id: mysqlProfiles.id }).from(mysqlProfiles);
    const linkCount = await mysqlDb.select({ id: mysqlProfileLinks.id }).from(mysqlProfileLinks);
    res.json({
      success: true,
      counts: {
        users: userCount.length,
        profiles: profileCount.length,
        profileLinks: linkCount.length,
      },
      recentSyncs: logs,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── POST /api/admin/sync ──────────────────────────────────────────────────────
export async function runSync(req: Request, res: Response) {
  const results: Record<string, number | string> = {};
  try {
    // Order matters: plans → users → subscriptions → profiles → everything else
    results.plans                  = await syncPlans();
    results.users                  = await syncUsers();
    results.subscriptions          = await syncSubscriptions();
    results.profiles               = await syncProfiles();
    results.profileLinks           = await syncProfileLinks();
    results.linkClicks             = await syncLinkClicks();
    results.pageViews              = await syncPageViews();
    results.contactEnquiries       = await syncContactEnquiries();
    results.adminUserNotes         = await syncAdminUserNotes();
    results.lifetimeAccessLog      = await syncLifetimeAccessLog();
    results.referralCodes          = await syncReferralCodes();
    results.referralEvents         = await syncReferralEvents();
    results.businessSeats          = await syncBusinessSeats();
    results.notifications          = await syncNotifications();
    results.issueReports           = await syncIssueReports();
    results.accountClosureRequests = await syncAccountClosureRequests();
    results.cardMessageThreads     = await syncCardMessageThreads();
    results.affiliateApplications  = await syncAffiliateApplications();
    results.profileScans           = await syncProfileScans();
    results.supportRequestMessages = await syncSupportRequestMessages();
    results.moderationActions      = await syncModerationActions();
    results.auditLog               = await syncAuditLog();
    results.supportTickets         = await syncSupportTickets();
    results.dataRequests           = await syncDataRequests();

    // Log the sync
    for (const [table, count] of Object.entries(results)) {
      await mysqlDb.insert(syncLog).values({
        tableName:   table,
        rowsSynced:  typeof count === 'number' ? count : 0,
        triggeredBy: (req as any).session?.adminUserId ? 'admin' : 'auto',
      });
    }

    res.json({ success: true, synced: results, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[sync] Error during sync:', err);
    res.status(500).json({ success: false, error: String(err), partial: results });
  }
}
