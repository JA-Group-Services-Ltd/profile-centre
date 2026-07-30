/**
 * Central entitlement library — getEffectiveUserAccess(userId)
 *
 * This is the SINGLE source of truth for all plan, subscription, seat and
 * role checks in the customer dashboard.  Every API route, sidebar gate,
 * feature gate and page guard must derive its answer from this function.
 *
 * Rules:
 * - Business access is ONLY granted by an active Business subscription,
 *   a valid admin manual grant, lifetime access, or a valid active seat
 *   invitation under an active Business account.
 * - Profile type, email domain, company name, username, localStorage,
 *   sessionStorage, cached values and hardcoded fallbacks are NEVER used.
 */

import db from '../db.js';

// ─── Role permission matrix ────────────────────────────────────────────────

export type SeatRole = 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'billing_manager';

export interface RolePermissions {
  canEditProfile: boolean;
  canEditLinks: boolean;
  canViewAnalytics: boolean;
  canViewEnquiries: boolean;
  canManageEnquiries: boolean;
  canViewMessages: boolean;
  canManageMessages: boolean;
  canManageSeats: boolean;
  canManageRoles: boolean;
  canManageBilling: boolean;
  canManageSettings: boolean;
  canManageThemes: boolean;
  canExportData: boolean;
  canDeleteWorkspace: boolean;
}

const ROLE_PERMISSIONS: Record<SeatRole, RolePermissions> = {
  owner: {
    canEditProfile: true, canEditLinks: true, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: true, canViewMessages: true, canManageMessages: true,
    canManageSeats: true, canManageRoles: true, canManageBilling: true,
    canManageSettings: true, canManageThemes: true, canExportData: true, canDeleteWorkspace: true,
  },
  admin: {
    canEditProfile: true, canEditLinks: true, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: true, canViewMessages: true, canManageMessages: true,
    canManageSeats: true, canManageRoles: false, canManageBilling: false,
    canManageSettings: true, canManageThemes: true, canExportData: false, canDeleteWorkspace: false,
  },
  manager: {
    canEditProfile: true, canEditLinks: true, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: true, canViewMessages: true, canManageMessages: false,
    canManageSeats: false, canManageRoles: false, canManageBilling: false,
    canManageSettings: false, canManageThemes: false, canExportData: false, canDeleteWorkspace: false,
  },
  editor: {
    canEditProfile: true, canEditLinks: true, canViewAnalytics: false,
    canViewEnquiries: false, canManageEnquiries: false, canViewMessages: false, canManageMessages: false,
    canManageSeats: false, canManageRoles: false, canManageBilling: false,
    canManageSettings: false, canManageThemes: false, canExportData: false, canDeleteWorkspace: false,
  },
  viewer: {
    canEditProfile: false, canEditLinks: false, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: false, canViewMessages: true, canManageMessages: false,
    canManageSeats: false, canManageRoles: false, canManageBilling: false,
    canManageSettings: false, canManageThemes: false, canExportData: false, canDeleteWorkspace: false,
  },
  billing_manager: {
    canEditProfile: false, canEditLinks: false, canViewAnalytics: false,
    canViewEnquiries: false, canManageEnquiries: false, canViewMessages: false, canManageMessages: false,
    canManageSeats: false, canManageRoles: false, canManageBilling: true,
    canManageSettings: false, canManageThemes: false, canExportData: false, canDeleteWorkspace: false,
  },
};

export function getRolePermissions(role: string): RolePermissions {
  const normalised = role.toLowerCase().replace(/[^a-z_]/g, '') as SeatRole;
  return ROLE_PERMISSIONS[normalised] ?? ROLE_PERMISSIONS.viewer;
}

// ─── Seat workspace access ─────────────────────────────────────────────────

export interface SeatWorkspace {
  profileId: number;
  businessName: string;
  bizSlug: string;
  role: SeatRole;
  permissions: RolePermissions;
  ownerHasActiveBusinessPlan: boolean;
  /** Human-readable plan name of the workspace owner, e.g. "Professional" or "Business" */
  ownerPlanName: string | null;
}

/**
 * Returns all active business workspaces the user is a seat member of,
 * but ONLY where the workspace owner still has an active Organisation plan.
 */
export function getActiveSeatWorkspaces(userId: number): SeatWorkspace[] {
  const rows = db.prepare(`
    SELECT
      bs.profile_id,
      bs.role,
      p.business_name,
      p.biz_slug,
      pl.slug AS owner_plan_slug,
      pl.name AS owner_plan_name,
      pl.max_seats AS owner_max_seats,
      s.status AS owner_sub_status,
      owner_u.trial_started_at AS owner_trial_started_at,
      owner_u.lifetime_access AS owner_lifetime_access
    FROM business_seats bs
    JOIN profiles p ON p.id = bs.profile_id
    JOIN users owner_u ON owner_u.id = p.user_id
    LEFT JOIN plans pl ON pl.id = owner_u.plan_id
    LEFT JOIN subscriptions s
      ON s.user_id = owner_u.id
      AND s.status NOT IN ('incomplete_expired')
    WHERE bs.user_id = ?
      AND bs.status = 'active'
    ORDER BY s.started_at DESC
  `).all(userId) as Array<{
    profile_id: number; role: string; business_name: string; biz_slug: string;
    owner_plan_slug: string | null; owner_plan_name: string | null;
    owner_max_seats: number | null; owner_sub_status: string | null;
    owner_trial_started_at: string | null; owner_lifetime_access: number;
  }>;

  // Deduplicate by profile_id (multiple sub rows possible) — keep first (most recent sub)
  const seen = new Set<number>();
  const workspaces: SeatWorkspace[] = [];
  for (const row of rows) {
    if (seen.has(row.profile_id)) continue;
    seen.add(row.profile_id);

    // Owner has active business if: active subscription, lifetime access, OR active trial
    const ownerTrialActive = (() => {
      if (!row.owner_trial_started_at) return false;
      const endsAt = new Date(new Date(row.owner_trial_started_at).getTime() + 30 * 24 * 60 * 60 * 1000);
      return new Date() < endsAt;
    })();

    const ownerHasActiveBusiness =
      !!row.owner_lifetime_access ||
      ownerTrialActive ||
      isBusinessPlanActive(row.owner_plan_slug, row.owner_max_seats, row.owner_sub_status);

    if (!ownerHasActiveBusiness) continue; // owner downgraded — block seat access

    const role = normaliseRole(row.role);
    workspaces.push({
      profileId: row.profile_id,
      businessName: row.business_name || 'Business',
      bizSlug: row.biz_slug || '',
      role,
      permissions: getRolePermissions(role),
      ownerHasActiveBusinessPlan: true,
      ownerPlanName: row.owner_plan_name ?? null,
    });
  }
  return workspaces;
}

// ─── Plan helpers ──────────────────────────────────────────────────────────

const BUSINESS_PLAN_SLUGS = ['business', 'ultimate_business', 'enterprise', 'team'];
const ACTIVE_SUB_STATUSES = ['active', 'trialing'];

function isBusinessPlanActive(
  planSlug: string | null,
  maxSeats: number | null,
  subStatus: string | null,
): boolean {
  if (!planSlug) return false;
  const slug = planSlug.toLowerCase();
  // Professional is NOT a business plan — it has a business page but no team seats
  if (slug === 'professional') return false;
  const isBusinessSlug = BUSINESS_PLAN_SLUGS.some(s => slug.includes(s));
  const hasSeats = (maxSeats ?? 0) > 1;
  const subActive = subStatus ? ACTIVE_SUB_STATUSES.includes(subStatus) : false;
  return (isBusinessSlug || hasSeats) && subActive;
}

function isUltimateBusinessPlanActive(
  planSlug: string | null,
  subStatus: string | null,
): boolean {
  if (!planSlug) return false;
  const subActive = subStatus ? ACTIVE_SUB_STATUSES.includes(subStatus) : false;
  return planSlug.toLowerCase() === 'ultimate_business' && subActive;
}

function isProfessionalPlanActive(
  planSlug: string | null,
  subStatus: string | null,
): boolean {
  if (!planSlug) return false;
  const subActive = subStatus ? ACTIVE_SUB_STATUSES.includes(subStatus) : false;
  return planSlug.toLowerCase() === 'professional' && subActive;
}

function normaliseRole(role: string): SeatRole {
  const r = (role || 'viewer').toLowerCase().replace(/[^a-z_]/g, '');
  if (r === 'owner') return 'owner';
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'editor') return 'editor';
  if (r === 'billing_manager' || r === 'billing') return 'billing_manager';
  return 'viewer';
}

// ─── Main entitlement function ─────────────────────────────────────────────

export interface EffectiveUserAccess {
  userId: number;
  // Plan
  planName: string | null;
  planSlug: string | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  hasAdminManualGrant: boolean;
  hasLifetimeAccess: boolean;
  isPaused: boolean;
  // Access tiers (mutually exclusive, derived from live DB state only)
  hasBusinessAccess: boolean;           // own active Business/Ultimate plan OR lifetime OR admin grant
  hasUltimateBusinessAccess: boolean;   // own active Ultimate Organisation plan
  hasProfessionalAccess: boolean;       // own active Professional plan (business page, no team seats)
  hasBusinessProfileAccess: boolean;    // professional+ or business+ or ultimate — can create business profile
  hasStarterAccess: boolean;       // own active Starter plan
  hasFreeAccess: boolean;          // free plan (explicitly selected)
  hasNoActivePlan: boolean;     // no plan_id at all AND not on trial AND not in grace period
  isNoPlan: boolean;            // account_status = 'no_plan' (post-grace-period, no plan selected)
  isDowngraded: boolean;        // had Business, now on lower plan
  // Seat access
  seatWorkspaces: SeatWorkspace[];  // active workspaces user is a seat member of
  isSeatUser: boolean;              // true if user has at least one active seat workspace
  // Limits from own plan
  maxSeats: number;
  hasMessaging: boolean;
  // Feature flags — all server-enforced
  hasGallery: boolean;
  hasPdf: boolean;
  hasWhatsapp: boolean;
  hasVcard: boolean;
  hasEmailSignature: boolean;
  hasMenu: boolean;
  hasPremiumTemplates: boolean;
  hasSeats: boolean;
  hasQrDownload: boolean;
  hasContactForm: boolean;
  hasAnalytics: boolean;
  hasRemoveBranding: boolean;
  // Free trial
  trialActive: boolean;             // trial claimed and not yet expired (30 days)
  trialEndsAt: string | null;       // ISO timestamp when trial expires, or null
  trialExpired: boolean;            // trial was claimed but has now expired
  // Post-trial grace period (7 days to select a plan)
  inPlanSelectionPeriod: boolean;   // trial ended, within 7-day selection window
  planSelectionDeadline: string | null; // ISO timestamp — deadline to pick a plan
  // Payment grace period (7 days after invoice.payment_failed before downgrade)
  inPaymentGracePeriod: boolean;    // payment failed but still within 7-day grace window
  paymentGraceUntil: string | null; // ISO timestamp — deadline to pay before downgrade
  paymentOverdue: boolean;          // grace period expired — account downgraded to no-plan
  // Canonical account status label
  accountStatus: 'trial_active' | 'trial_ended' | 'plan_selection' | 'no_plan' | 'free' | 'paid_active' | 'lifetime' | 'suspended' | 'active' | 'payment_grace' | 'payment_overdue';
}

export function getEffectiveUserAccess(userId: number): EffectiveUserAccess {
  const row = db.prepare(`
    SELECT
      u.id, u.plan_id, u.lifetime_access, u.is_paused, u.trial_started_at,
      u.plan_selection_deadline, u.account_status, u.payment_grace_until,
      pl.name AS plan_name, pl.slug AS plan_slug,
      pl.max_seats, pl.has_messaging,
      pl.has_gallery, pl.has_pdf, pl.has_whatsapp, pl.has_vcard,
      pl.has_email_signature, pl.has_menu, pl.has_premium_templates,
      pl.has_seats, pl.has_qr_download, pl.has_contact_form,
      pl.has_advanced_analytics, pl.remove_branding,
      s.status AS sub_status, s.billing_interval, s.current_period_end
    FROM users u
    LEFT JOIN plans pl ON pl.id = u.plan_id
    LEFT JOIN subscriptions s
      ON s.user_id = u.id
      AND s.status NOT IN ('incomplete_expired')
    WHERE u.id = ?
    ORDER BY s.started_at DESC
    LIMIT 1
  `).get(userId) as {
    id: number; plan_id: number | null; lifetime_access: number; is_paused: number;
    trial_started_at: string | null;
    plan_selection_deadline: string | null;
    account_status: string | null;
    payment_grace_until: string | null;
    plan_name: string | null; plan_slug: string | null;
    max_seats: number | null; has_messaging: number | null;
    has_gallery: number | null; has_pdf: number | null; has_whatsapp: number | null;
    has_vcard: number | null; has_email_signature: number | null; has_menu: number | null;
    has_premium_templates: number | null; has_seats: number | null;
    has_qr_download: number | null; has_contact_form: number | null;
    has_advanced_analytics: number | null; remove_branding: number | null;
    sub_status: string | null; billing_interval: string | null; current_period_end: string | null;
  } | undefined;

  if (!row) {
    return {
      userId, planName: null, planSlug: null, subscriptionStatus: null,
      billingInterval: null, currentPeriodEnd: null,
      hasAdminManualGrant: false, hasLifetimeAccess: false, isPaused: false,
      hasBusinessAccess: false, hasUltimateBusinessAccess: false,
      hasProfessionalAccess: false, hasBusinessProfileAccess: false,
      hasStarterAccess: false, hasFreeAccess: true,
      hasNoActivePlan: true, isNoPlan: false, isDowngraded: false,
      seatWorkspaces: [], isSeatUser: false,
      maxSeats: 0, hasMessaging: false,
      hasGallery: false, hasPdf: false, hasWhatsapp: false, hasVcard: false,
      hasEmailSignature: false, hasMenu: false, hasPremiumTemplates: false,
      hasSeats: false, hasQrDownload: false, hasContactForm: false,
      hasAnalytics: false, hasRemoveBranding: false,
      trialActive: false, trialEndsAt: null, trialExpired: false,
      inPlanSelectionPeriod: false, planSelectionDeadline: null,
      inPaymentGracePeriod: false, paymentGraceUntil: null, paymentOverdue: false,
      accountStatus: 'active',
    };
  }

  const lifetime = !!row.lifetime_access;
  const subActive = row.sub_status ? ACTIVE_SUB_STATUSES.includes(row.sub_status) : false;
  const slug = (row.plan_slug ?? '').toLowerCase();

  // ── Trial calculation ──────────────────────────────────────────────────────
  const TRIAL_DAYS = 30;
  const GRACE_DAYS = 7;
  let trialActive = false;
  let trialEndsAt: string | null = null;
  let trialExpired = false;
  let inPlanSelectionPeriod = false;
  let planSelectionDeadline: string | null = row.plan_selection_deadline ?? null;

  if (row.trial_started_at) {
    const startedAt = new Date(row.trial_started_at);
    const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    trialEndsAt = endsAt.toISOString();
    const now = new Date();
    trialActive = now < endsAt;
    trialExpired = !trialActive;

    if (trialExpired && !subActive && !lifetime) {
      // Set plan_selection_deadline if not already set
      if (!planSelectionDeadline) {
        const deadline = new Date(endsAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
        planSelectionDeadline = deadline.toISOString();
        // Persist it (fire-and-forget, safe to fail)
        try {
          db.prepare(`UPDATE users SET plan_selection_deadline = ? WHERE id = ? AND plan_selection_deadline IS NULL`)
            .run(planSelectionDeadline, userId);
        } catch { /* non-fatal */ }
      }
      inPlanSelectionPeriod = new Date() < new Date(planSelectionDeadline);
    }
  }

  // ── Payment grace period ───────────────────────────────────────────────────
  // When invoice.payment_failed fires, payment_grace_until is set to now + 7 days.
  // During this window the user keeps full access but sees an urgent banner.
  // After the deadline, we auto-downgrade: clear plan_id and set account_status = 'no_plan'.
  const PAYMENT_GRACE_DAYS = 7;
  let inPaymentGracePeriod = false;
  let paymentGraceUntil: string | null = row.payment_grace_until ?? null;
  let paymentOverdue = false;

  const isPastDue = row.sub_status === 'past_due';

  if (isPastDue && !lifetime) {
    const now = new Date();

    // Set grace deadline if not already set
    if (!paymentGraceUntil) {
      const deadline = new Date(now.getTime() + PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000);
      paymentGraceUntil = deadline.toISOString();
      try {
        db.prepare(`UPDATE users SET payment_grace_until = ? WHERE id = ? AND payment_grace_until IS NULL`)
          .run(paymentGraceUntil, userId);
      } catch { /* non-fatal */ }
    }

    const graceDeadline = new Date(paymentGraceUntil);
    if (now < graceDeadline) {
      // Still within grace — keep access, show warning
      inPaymentGracePeriod = true;
    } else {
      // Grace expired — downgrade to no-plan
      paymentOverdue = true;
      try {
        db.prepare(`
          UPDATE users
          SET plan_id = NULL, account_status = 'no_plan', payment_grace_until = NULL
          WHERE id = ? AND account_status != 'no_plan'
        `).run(userId);
        db.prepare(`
          UPDATE subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND status = 'past_due'
        `).run(userId);
        db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES ('system', 'payment.grace_expired', ?)`)
          .run(`user=${userId} — downgraded to no_plan after payment grace period expired`);
      } catch { /* non-fatal */ }
    }
  }

  const hasUltimateOwn = isUltimateBusinessPlanActive(row.plan_slug, row.sub_status);
  const hasBusinessOwn = !hasUltimateOwn && isBusinessPlanActive(row.plan_slug, row.max_seats, row.sub_status);
  const hasProfessionalOwn = isProfessionalPlanActive(row.plan_slug, row.sub_status);
  const hasStarterOwn = !hasBusinessOwn && !hasUltimateOwn && !hasProfessionalOwn && (subActive || inPaymentGracePeriod) && slug.includes('starter');
  const hasUltimateBusinessAccess = hasUltimateOwn || (inPaymentGracePeriod && isUltimateBusinessPlanActive(row.plan_slug, row.sub_status));
  const hasBusinessAccess = hasUltimateBusinessAccess || hasBusinessOwn || lifetime || (inPaymentGracePeriod && isBusinessPlanActive(row.plan_slug, row.max_seats, 'active'));
  const hasProfessionalAccess = !hasBusinessAccess && (hasProfessionalOwn || (inPaymentGracePeriod && isProfessionalPlanActive(row.plan_slug, row.sub_status)));
  const hasStarterAccess = hasStarterOwn && !hasBusinessAccess && !hasProfessionalAccess;
  // Business profile access: professional, business, ultimate_business, lifetime, or trial
  const hasBusinessProfileAccess = hasBusinessAccess || hasProfessionalAccess || lifetime || trialActive;
  // Trial grants full access — but is tracked separately, NOT merged into hasBusinessAccess
  const hasNoActivePlan = !row.plan_id && !trialActive && !inPlanSelectionPeriod && !inPaymentGracePeriod;
  const hasFreeAccess = !hasBusinessAccess && !hasStarterAccess && !trialActive && !!row.plan_id && slug === 'free';
  const isNoPlan = paymentOverdue || (row.account_status === 'no_plan') ||
    (!trialActive && !inPlanSelectionPeriod && !subActive && !lifetime && !row.plan_id && !!row.trial_started_at);
  const isDowngraded = !!row.plan_id && !subActive && !lifetime && slug !== 'free' && !inPaymentGracePeriod;

  // ── Canonical account status ───────────────────────────────────────────────
  let accountStatus: EffectiveUserAccess['accountStatus'] = 'active';
  if (lifetime) accountStatus = 'lifetime';
  else if (trialActive) accountStatus = 'trial_active';
  else if (inPaymentGracePeriod) accountStatus = 'payment_grace';
  else if (paymentOverdue) accountStatus = 'payment_overdue';
  else if (inPlanSelectionPeriod) accountStatus = 'plan_selection';
  else if (isNoPlan) accountStatus = 'no_plan';
  else if (hasFreeAccess) accountStatus = 'free';
  else if (hasBusinessAccess || hasProfessionalAccess || hasStarterAccess) accountStatus = 'paid_active';
  else if (trialExpired && !subActive) accountStatus = 'trial_ended';

  // Persist account_status transitions
  const dbStatus = row.account_status ?? 'active';
  if (dbStatus !== accountStatus) {
    try {
      db.prepare(`UPDATE users SET account_status = ? WHERE id = ?`).run(accountStatus, userId);
    } catch { /* non-fatal */ }
  }

  const seatWorkspaces = getActiveSeatWorkspaces(userId);

  // ── Feature flags — lifetime and trial get all features ───────────────────
  // During a trial or with lifetime access, all features are unlocked regardless
  // of what the plan row says. For paid plans, read directly from the plan row.
  const allFeatures = lifetime || trialActive;

  return {
    userId,
    planName: row.plan_name,
    planSlug: row.plan_slug,
    subscriptionStatus: row.sub_status,
    billingInterval: row.billing_interval,
    currentPeriodEnd: row.current_period_end,
    hasAdminManualGrant: false,
    hasLifetimeAccess: lifetime,
    isPaused: !!row.is_paused,
    hasBusinessAccess: hasBusinessAccess || trialActive,
    hasUltimateBusinessAccess: hasUltimateBusinessAccess || trialActive,
    hasProfessionalAccess: hasProfessionalAccess && !trialActive,
    hasBusinessProfileAccess: hasBusinessProfileAccess,
    hasStarterAccess,
    hasFreeAccess,
    hasNoActivePlan,
    isNoPlan,
    isDowngraded,
    seatWorkspaces,
    isSeatUser: seatWorkspaces.length > 0,
    maxSeats: allFeatures ? 999 : (row.max_seats ?? 0),
    hasMessaging: allFeatures || !!(row.has_messaging),
    // Feature flags
    hasGallery:           allFeatures || !!(row.has_gallery),
    hasPdf:               allFeatures || !!(row.has_pdf),
    hasWhatsapp:          allFeatures || !!(row.has_whatsapp),
    hasVcard:             allFeatures || !!(row.has_vcard),
    hasEmailSignature:    allFeatures || !!(row.has_email_signature),
    hasMenu:              allFeatures || !!(row.has_menu),
    hasPremiumTemplates:  allFeatures || !!(row.has_premium_templates),
    hasSeats:             allFeatures || !!(row.has_seats),
    hasQrDownload:        allFeatures || !!(row.has_qr_download),
    hasContactForm:       allFeatures || !!(row.has_contact_form),
    hasAnalytics:         allFeatures || !!(row.has_advanced_analytics),
    hasRemoveBranding:    allFeatures || !!(row.remove_branding),
    trialActive,
    trialEndsAt,
    trialExpired,
    inPlanSelectionPeriod,
    planSelectionDeadline,
    inPaymentGracePeriod,
    paymentGraceUntil,
    paymentOverdue,
    accountStatus,
  };
}
