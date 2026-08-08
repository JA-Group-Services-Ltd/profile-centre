const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);
const BUSINESS_PLAN_SLUGS = new Set(["business", "ultimate_business", "ultimate_plus", "enterprise", "team"]);
const CUSTOM_DOMAIN_PLAN_SLUGS = new Set(["professional", "business", "ultimate_business", "ultimate_plus"]);
const CUSTOM_DOMAIN_PLAN_NAMES = new Set([
  "professional",
  "organisation",
  "ultimate organisation",
  "ultimate organisation+",
]);

const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze({
    canEditProfile: true, canEditLinks: true, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: true, canViewMessages: true,
    canManageMessages: true, canManageSeats: true, canManageRoles: true,
    canManageBilling: true, canManageSettings: true, canManageThemes: true,
    canExportData: true, canDeleteWorkspace: true,
  }),
  admin: Object.freeze({
    canEditProfile: true, canEditLinks: true, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: true, canViewMessages: true,
    canManageMessages: true, canManageSeats: true, canManageRoles: false,
    canManageBilling: false, canManageSettings: true, canManageThemes: true,
    canExportData: false, canDeleteWorkspace: false,
  }),
  manager: Object.freeze({
    canEditProfile: true, canEditLinks: true, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: true, canViewMessages: true,
    canManageMessages: false, canManageSeats: false, canManageRoles: false,
    canManageBilling: false, canManageSettings: false, canManageThemes: false,
    canExportData: false, canDeleteWorkspace: false,
  }),
  editor: Object.freeze({
    canEditProfile: true, canEditLinks: true, canViewAnalytics: false,
    canViewEnquiries: false, canManageEnquiries: false, canViewMessages: false,
    canManageMessages: false, canManageSeats: false, canManageRoles: false,
    canManageBilling: false, canManageSettings: false, canManageThemes: false,
    canExportData: false, canDeleteWorkspace: false,
  }),
  viewer: Object.freeze({
    canEditProfile: false, canEditLinks: false, canViewAnalytics: true,
    canViewEnquiries: true, canManageEnquiries: false, canViewMessages: true,
    canManageMessages: false, canManageSeats: false, canManageRoles: false,
    canManageBilling: false, canManageSettings: false, canManageThemes: false,
    canExportData: false, canDeleteWorkspace: false,
  }),
  billing_manager: Object.freeze({
    canEditProfile: false, canEditLinks: false, canViewAnalytics: false,
    canViewEnquiries: false, canManageEnquiries: false, canViewMessages: false,
    canManageMessages: false, canManageSeats: false, canManageRoles: false,
    canManageBilling: true, canManageSettings: false, canManageThemes: false,
    canExportData: false, canDeleteWorkspace: false,
  }),
});

function normalisePlan(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normaliseRole(value) {
  const role = String(value ?? "viewer").toLowerCase().replace(/[^a-z_]/g, "");
  if (role === "owner" || role === "admin" || role === "manager" || role === "editor" || role === "billing_manager") return role;
  if (role === "billing") return "billing_manager";
  return "viewer";
}

function planAllowsCustomDomain(row) {
  const slug = normalisePlan(row?.plan_slug);
  const name = String(row?.plan_name ?? "").trim().toLowerCase();
  return CUSTOM_DOMAIN_PLAN_SLUGS.has(slug) || CUSTOM_DOMAIN_PLAN_NAMES.has(name);
}

function isoAfter(value, days) {
  const started = Date.parse(String(value ?? ""));
  if (!Number.isFinite(started)) return null;
  return new Date(started + days * 86400000).toISOString();
}

async function activeSeatWorkspaces(database, userId) {
  try {
    const result = await database.prepare(`
      SELECT bs.profile_id,bs.role,
             COALESCE(p.display_name,p.username,'Organisation') AS business_name,
             COALESCE(p.biz_slug,p.username,'') AS biz_slug,
             owner_u.lifetime_access AS owner_lifetime_access,
             owner_u.trial_started_at AS owner_trial_started_at,
             owner_u.account_status AS owner_account_status,
             pl.slug AS owner_plan_slug,pl.name AS owner_plan_name,pl.max_seats AS owner_max_seats,
             s.status AS owner_sub_status
      FROM business_seats bs
      JOIN profiles p ON p.id=bs.profile_id
      JOIN users owner_u ON owner_u.id=p.user_id
      LEFT JOIN plans pl ON pl.id=owner_u.plan_id
      LEFT JOIN subscriptions s ON s.user_id=owner_u.id AND s.status NOT IN ('incomplete_expired','cancelled')
      WHERE bs.user_id=?1 AND bs.status='active'
      ORDER BY s.started_at DESC
    `).bind(userId).all();

    const now = Date.now();
    const seen = new Set();
    const workspaces = [];
    for (const row of result.results ?? []) {
      const profileId = Number(row.profile_id);
      if (!profileId || seen.has(profileId)) continue;
      seen.add(profileId);

      const ownerSlug = normalisePlan(row.owner_plan_slug);
      const ownerTrialEnd = row.owner_trial_started_at ? Date.parse(row.owner_trial_started_at) + 30 * 86400000 : 0;
      const ownerTrialActive = ownerTrialEnd > now;
      const ownerSubActive = ACTIVE_SUB_STATUSES.has(String(row.owner_sub_status ?? ""));
      const ownerManualActive = row.owner_account_status === "paid_active";
      const ownerBusinessTier = BUSINESS_PLAN_SLUGS.has(ownerSlug) || Number(row.owner_max_seats ?? 0) > 1;
      const ownerActive = Number(row.owner_lifetime_access ?? 0) === 1
        || ownerTrialActive
        || (ownerBusinessTier && (ownerSubActive || ownerManualActive));
      if (!ownerActive) continue;

      const role = normaliseRole(row.role);
      workspaces.push({
        profileId,
        businessName: row.business_name || "Organisation",
        bizSlug: row.biz_slug || "",
        role,
        permissions: ROLE_PERMISSIONS[role],
        ownerHasActiveBusinessPlan: true,
        ownerPlanName: row.owner_plan_name ?? null,
      });
    }
    return workspaces;
  } catch {
    return [];
  }
}

export async function getCurrentUserAccess(database, userId, sessionData = {}) {
  const row = await database.prepare(`
    SELECT u.id,u.email,u.name,u.role,u.plan_id,u.lifetime_access,u.created_at,
           COALESCE(u.is_paused,0) AS is_paused,u.pause_reason,u.account_status,
           u.trial_started_at,u.plan_selection_deadline,u.payment_grace_until,
           u.customer_number,u.appearance_preference,
           CASE WHEN u.stripe_customer_id GLOB 'cus_[A-Za-z0-9]*' THEN 1 ELSE 0 END AS has_stripe_customer,
           p.name AS plan_name,p.slug AS plan_slug,p.has_messaging,p.max_seats,
           COALESCE(p.max_org_profiles,0) AS max_org_profiles,
           COALESCE(p.has_custom_domain,0) AS has_custom_domain,
           s.status AS subscription_status,s.billing_interval,s.current_period_end
    FROM users u
    LEFT JOIN plans p ON p.id=u.plan_id
    LEFT JOIN subscriptions s ON s.user_id=u.id AND s.status NOT IN ('incomplete_expired','cancelled')
    WHERE u.id=?1
    ORDER BY s.started_at DESC,s.id DESC
    LIMIT 1
  `).bind(userId).first();

  if (!row) return null;

  const now = Date.now();
  const slug = normalisePlan(row.plan_slug);
  const lifetime = Number(row.lifetime_access ?? 0) === 1;
  const subscriptionStatus = String(row.subscription_status ?? "");
  const subActive = ACTIVE_SUB_STATUSES.has(subscriptionStatus);
  const manualPaidGrant = row.account_status === "paid_active";

  const trialEndsAt = row.trial_started_at ? isoAfter(row.trial_started_at, 30) : null;
  const trialActive = !!trialEndsAt && Date.parse(trialEndsAt) > now && !lifetime;
  const trialExpired = !!row.trial_started_at && !trialActive;

  let planSelectionDeadline = row.plan_selection_deadline ?? null;
  if (trialExpired && !planSelectionDeadline && !subActive && !manualPaidGrant && !lifetime && trialEndsAt) {
    planSelectionDeadline = isoAfter(trialEndsAt, 7);
  }
  const inPlanSelectionPeriod = !!planSelectionDeadline && Date.parse(planSelectionDeadline) > now
    && !subActive && !manualPaidGrant && !lifetime;

  const paymentGraceUntil = row.payment_grace_until ?? null;
  const inPaymentGracePeriod = subscriptionStatus === "past_due"
    && !!paymentGraceUntil
    && Date.parse(paymentGraceUntil) > now
    && !lifetime;
  const paymentOverdue = subscriptionStatus === "past_due"
    && !!paymentGraceUntil
    && Date.parse(paymentGraceUntil) <= now
    && !lifetime;

  const ownPlanActive = subActive || manualPaidGrant || inPaymentGracePeriod;
  const isUltimatePlan = slug === "ultimate_business" || slug === "ultimate_plus";
  const isBusinessPlan = BUSINESS_PLAN_SLUGS.has(slug);
  const isProfessionalPlan = slug === "professional";
  const isStarterPlan = slug === "starter";
  const isFreePlan = slug === "free";

  // Lifetime is an administrative entitlement and must never depend on Stripe state.
  // It unlocks the selected lifetime plan immediately throughout the dashboard.
  const hasUltimateBusinessAccess = lifetime || trialActive || (ownPlanActive && isUltimatePlan);
  const hasBusinessAccess = lifetime || trialActive || (ownPlanActive && isBusinessPlan);
  const hasProfessionalAccess = lifetime || trialActive || (ownPlanActive && isProfessionalPlan);
  const hasStarterAccess = lifetime || trialActive || (ownPlanActive && isStarterPlan);
  const hasFreeAccess = lifetime || trialActive || isFreePlan || ownPlanActive;
  const hasBusinessProfileAccess = lifetime || trialActive || hasProfessionalAccess || hasBusinessAccess || hasUltimateBusinessAccess;

  const seatWorkspaces = await activeSeatWorkspaces(database, userId);
  const isSeatUser = seatWorkspaces.length > 0;
  const hasNoActivePlan = !row.plan_id && !lifetime && !trialActive && !inPlanSelectionPeriod && !inPaymentGracePeriod && !isSeatUser;
  const isNoPlan = !lifetime && !trialActive && !isSeatUser
    && (row.account_status === "no_plan" || paymentOverdue || hasNoActivePlan);
  const isDowngraded = !!row.plan_id && !lifetime && !trialActive && !ownPlanActive && !isFreePlan;

  const hasCustomDomainAccess = planAllowsCustomDomain(row)
    && !row.is_paused
    && (lifetime || subActive || manualPaidGrant || inPaymentGracePeriod);

  let accountStatus = row.account_status || "active";
  if (lifetime) accountStatus = "lifetime";
  else if (trialActive) accountStatus = "trial_active";
  else if (inPaymentGracePeriod) accountStatus = "payment_grace";
  else if (paymentOverdue) accountStatus = "payment_overdue";
  else if (inPlanSelectionPeriod) accountStatus = "plan_selection";
  else if (isNoPlan) accountStatus = "no_plan";
  else if (isFreePlan) accountStatus = "free";
  else if (ownPlanActive) accountStatus = "paid_active";

  let hasEmailSignatureBeta = false;
  try {
    const beta = await database.prepare("SELECT enabled FROM email_signature_beta WHERE user_id=?1 LIMIT 1").bind(userId).first();
    hasEmailSignatureBeta = Number(beta?.enabled ?? 0) === 1;
  } catch {
    hasEmailSignatureBeta = false;
  }

  return {
    ...row,
    hasBusinessAccess,
    hasUltimateBusinessAccess,
    hasProfessionalAccess,
    hasBusinessProfileAccess,
    hasStarterAccess,
    hasFreeAccess,
    hasNoActivePlan,
    hasLifetimeAccess: lifetime,
    isDowngraded,
    isSeatUser,
    seatWorkspaces,
    trialActive,
    trialEndsAt,
    trialExpired,
    inPlanSelectionPeriod,
    planSelectionDeadline,
    isNoPlan,
    accountStatus,
    inPaymentGracePeriod,
    paymentGraceUntil,
    paymentOverdue,
    hasEmailSignatureBeta,
    hasCustomDomainAccess,
    max_org_profiles: Number(row.max_org_profiles ?? 0),
    isAssistedSession: Boolean(sessionData?.isAssistedSession),
    assistedRequestId: sessionData?.assistedRequestId ?? null,
  };
}
