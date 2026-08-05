import express, { type NextFunction, type Request, type Response } from "express";
import { fileURLToPath } from "node:url";
import { dirname, extname, join } from "node:path";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import cookieParser from "cookie-parser";
import session from "express-session";
import { getSecret } from "#airo/secrets";
import { SQLiteSessionStore } from "./session-store.js";
import db, { rawSqliteDb } from "./db.js";

// Global unhandled rejection logger
process.on('unhandledRejection', (reason) => {
  console.error('[entry] Unhandled rejection:', reason);
});

// <api-imports>
import admin_points_overview_get_0 from "./api/admin/points-overview/GET";
import admin_store_items_get_1 from "./api/admin/store-items/GET";
import admin_store_items_post_2 from "./api/admin/store-items/POST";
import admin_store_items_id_delete_3 from "./api/admin/store-items/[id]/DELETE";
import admin_store_items_id_put_4 from "./api/admin/store-items/[id]/PUT";
import analytics_config_get_5 from "./api/analytics/config/GET";
import feature_flags_get_6 from "./api/feature-flags/GET";
import health_get_7 from "./api/health/GET";
import partner_enquiry_post_8 from "./api/partner-enquiry/POST";
import plans_get_9 from "./api/plans/GET";
import points_get_10 from "./api/points/GET";
import points_redeem_post_11 from "./api/points/redeem/POST";
import profiles_report_post_12 from "./api/profiles/report/POST";
import report_issue_post_13 from "./api/report-issue/POST";
import rewards_get_14 from "./api/rewards/GET";
import status_get_15 from "./api/status/GET";
import trial_post_16 from "./api/trial/POST";
// </api-imports>

// Auth (OIDC)
import {
  customerLoginStart, customerLoginCallback, customerLogout,
  adminLoginStart, adminLoginCallback, adminLogout,
} from "./api/auth/oidc";
import authMe from "./api/auth/me";
import trialClaim from "./api/trial/POST";
import adminMe from "./api/auth/admin-me";

// Profiles
import { getMyProfiles, createProfile, updateProfile, deleteProfile, getProfilePreview, getPublicProfile, getPublicBusinessProfile, getPublicBusinessPage, getPublicTeamDirectory, updateTeamDirectoryVisibility } from "./api/profiles/index";
import { searchPublicProfiles } from "./api/profiles/search";
import { getBusinessProfile, updateBusinessProfile } from "./api/business/profile.js";
import { getSeats, inviteSeat, removeSeat, cancelInvite, updateSeatRole, getMyInvites, getMySeats, acceptInvite, declineInvite, leaveSeat, getInviteByToken } from "./api/business/seats.js";
import { setProfilePin, verifyProfilePin, getProfilePinStatus, toggleMessaging, toggleEnquiry, setPublicPin, getPublicPinStatus, verifyPublicPin, getContactHours, setContactHours } from "./api/profiles/pin";

// Links
import { getLinks, createLink, updateLink, deleteLink, reorderLinks, recordClick } from "./api/links/index";

// QR
import { getQRCode, getPersonCardQRCode, getPublicQRCode } from "./api/qr/index";

// Enquiries
import { submitEnquiry, getEnquiries, markRead } from "./api/enquiries/index";

// Analytics
import { recordView, getAnalytics } from "./api/analytics/index";

// Themes & Plans
import { getThemes } from "./api/themes/index";

// Site Status
import { getSiteStatus, setSiteStatus } from "./api/admin/site-status";

// Admin
import {
  getUsers, createUser, updateUser, deleteUser,
  getProfiles, updateAdminProfile, deleteAdminProfile, getAdminProfilePreview,
  getAllEnquiries, adminMarkEnquiryRead, adminDeleteEnquiry,
  getAdminAnalytics,
  getAdminPlans, createPlan, updatePlan, deletePlan,
  togglePlanPublic, assignPlanToUser,
  getAdminThemes, createTheme, updateTheme,
  getSettings, updateSettings,
  updateUserSettings, deleteAccount,
  getBranding, updateBranding, getPublicBranding,
  getSiteTheme, updateSiteTheme,
  pauseUser, getGlobalPauseState, setGlobalPauseState,
  getAdminUserDetail, blockUser, unblockUser,
  backfillUserNumbersEndpoint,
} from "./api/admin/index";

// Assisted Access
import {
  createAssistedAccessRequest, getAssistedAccessStatus, enterAssistedSession,
  exitAssistedSession, listAssistedAccessRequests,
  getCustomerPendingRequests, approveAssistedAccessRequest,
  rejectAssistedAccessRequest, revokeAssistedAccessSession,
  ensureAssistedAccessTable, lookupUserForAssistedAccess,
  endAssistedImpersonation, getAssistedSessionInfo,
  generateLaunchUrl, redeemLaunchToken,
} from "./api/admin/assisted-access";
ensureAssistedAccessTable();
ensureAccountPinTable();
ensureAdminPinTable();
ensureSiteEditorTables(); // keep tables intact — existing data preserved for admin review
startAutoBackupScheduler(); // daily SQLite snapshots to /private/db/backups/

// ── Sousa Murray Profiles User Number — backfill on startup ────────────────────────
import { backfillUserNumbers } from './lib/user-number.js';
try {
  const backfillResult = backfillUserNumbers();
  if (backfillResult.updated > 0) {
    console.log(`[user-number] Backfilled ${backfillResult.updated} user(s). Failed: ${backfillResult.failed}`);
  }
} catch (err) {
  console.error('[user-number] Backfill error on startup:', err);
}

// Audit & Legal
import { getAuditLog, clearAuditLog, getLegalPolicies, updateLegalPolicy, getPublicPolicy } from "./api/admin/audit";
import { testNotification } from "./api/admin/test-notifications";
import { getEmailStatus, recheckEmailStatus, sendTestEmail } from "./api/admin/email-status";
import { adminSendNotification, adminListNotifications, adminSearchUsers, adminDeleteNotification, adminEditNotification } from "./api/admin/notifications";
import { getHomepageContent, updateHomepageContent } from "./api/admin/homepage.js";
import { sarGetData, sarGeneratePdf } from "./api/admin/sar";
import { getManualPdf } from "./api/admin/manual-pdf";
import { generateAuthorityReport } from "./api/admin/authority-report-pdf";
import { listBlockedIps, blockIp, unblockIp, checkIpBlocked, getModerationLog } from "./api/admin/ip-blocking";
import { generateThreadReportPdf } from "./api/admin/thread-report-pdf";
import { sseHandler as notificationSseHandler } from "./lib/sse";
import { getSupportPin, rotateSupportPin, setCustomPin, verifyEmailAndSetPin } from "./api/security/support-pin";
import { heartbeat, getSessionStatus, logoutIdle } from "./api/security/session-activity";
import { getPinStatus, setPin, removePin, verifyPin, ensureAccountPinTable, adminUnlockUserPin, selfUnlockPin, getPinSessionStatus } from "./api/security/account-pin";
import { ensureSiteEditorTables } from "./api/site-editor/index";
import { getComingSoonConfig, updateComingSoonConfig } from "./api/admin/coming-soon";
import { getMyOrders, createOrder, approveOrder, acceptFee, declineFee, getFeatureFlag, adminListOrders, adminGetOrder, adminUpdateOrder, adminToggleFeature, adminQuoteFee, adminQuotePrice, adminSendPaymentLink, adminMarkPaid, adminUploadProof, adminEnableFinalFile, adminMarkDepositPaid, adminGenerateCheckout } from "./api/business-cards/index";
import { getOrderMessages, sendOrderMessage, adminGetOrderMessages, adminSendOrderMessage, adminUnreadMessageCount } from "./api/business-cards/messages";
import { getPublicTemplates, adminGetTemplates, adminCreateTemplate, adminUpdateTemplate } from "./api/business-cards/templates";
import { adminBusinessCardPdf } from "./api/admin/business-cards-pdf";
import {
  extendTrial, endTrial, moveToNoPlan, moveToFree, assignPlan, removePlan, setAccountStatus,
} from "./api/admin/trial-management";

// Add-ons
import {
  listAddons, createAddon, updateAddon, deleteAddon,
  listAddonCustomers, assignAddon, removeAddonFromCustomer,
  updateAddonAssignment, getCustomerAddons,
} from "./api/admin/addons";
// Custom Domain removed from product — import disabled
// Direct Messaging removed from product — import disabled
// Email Signature Beta removed — feature is now available to all eligible users

// Stripe & Billing
import { getStripeConfig, updateStripeConfig, grantLifetimeAccess, revokeLifetimeAccess, getLifetimeLog, getSubscriptions, syncStripeProducts, getStripeProducts } from "./api/admin/stripe";
import { lookupUserByRef } from "./api/admin/lookup-user";
import { lookupProfileByUsername } from "./api/admin/lookup-profile";
import { stripeWebhook } from "./api/stripe/webhook";
import {
  submitSupportRequest,
  getSupportRequests,
  updateSupportRequest,
  getTicketMessages,
  adminReplyToTicket,
  getUserTickets,
  getUserTicketMessages,
  userReplyToTicket,
} from "./api/support/request";
import accountUpdate from "./api/account/update";
import { cancelSubscription } from "./api/billing/cancel";
import { selectFreePlan } from "./api/billing/select-free";
import { getOnboardingState, markOnboardingStep, dismissOnboarding, resetOnboarding, getLegalReacceptStatus, submitLegalReaccept } from "./api/onboarding/index";
import { verifyProfile, unverifyProfile } from "./api/admin/verify-profile";
import { requestVerification } from "./api/profiles/request-verification";
import { profileCardPdf } from "./api/profiles/card-pdf";
import { profilePosterPdf } from "./api/profiles/poster-pdf";
import { getPreferences, savePreferences, getNotificationPrefs, saveNotificationPrefs } from "./api/users/preferences";
import { createCheckoutSession } from "./api/billing/checkout";
import { initStripeCustomer } from "./api/billing/checkout";
// Direct Messaging removed — import kept for reference only
// import { sendCardMessage, ... } from "./api/messages/index"; // REMOVED
// import { sseHandler } from "./api/messages/sse"; // REMOVED
import { getNotifications, markNotificationsRead, deleteNotification } from "./api/notifications/index";
import {
  crmListUsers, crmGetUser, crmAddNote, crmDeleteNote,

  crmListDataRequests, crmUpdateDataRequest,
  customerSubmitDataRequest, customerGetDataRequests,
  customerUpdateConsent, customerGetConsent,
} from "./api/admin/crm";
import { runSync, getSyncStatus } from "./api/admin/sync";
// Email Signature Beta removed — feature is now available to all eligible users
// import { getEmailSignatureBeta, setEmailSignatureBeta } from "./api/admin/email-signature-beta"; // REMOVED
import {
  adminListFeatures, adminGetFeature, adminUpdateFeature,
  adminSetFeaturePlanRules, adminListFeatureOverrides,
  adminSetFeatureOverride, adminDeleteFeatureOverride,
  adminListFeatureInterest,
  getMyFeatures, checkFeatureAccess, registerFeatureInterest,
} from "./api/admin/features";

// Middleware
import { requireAuth, requireAdminApi } from "./middleware/auth";
import { requireAdminPin, requireAdminPinHighRisk } from "./middleware/admin-pin";
import { securityHeaders } from "./middleware/security-headers";
import { authLimiter, formSubmitLimiter, analyticsLimiter, publicApiLimiter, pinLimiter, reportLimiter } from "./middleware/rate-limit";
import { auditMiddleware } from "./middleware/audit-middleware";
import { getIssueReports, updateIssueReport } from "./api/admin/issue-reports";
import { suspendProfile, unsuspendProfile, hideProfile, unhideProfile } from "./api/admin/profile-moderation";
import { getScanForReport, rescanReport, overrideScanRisk, dismissScan, markScanReviewed } from "./api/admin/scans";
// adminLocalLogin — re-enabled as fallback for preview/dev when OIDC is not configured
// NOTE: local password login is intentionally disabled for admin — OIDC-only per security policy.
// The createFirstAdmin endpoint remains available for initial setup only.
import { createFirstAdmin } from "./api/admin/auth";
import {
  ensureAdminPinTable, getAdminPinStatus, setAdminPin,
  verifyAdminPin, removeAdminPin, clearAdminPinSession,
  adminPinHeartbeat, issueAdminPinChallenge, resetAdminPinLockout,
} from "./api/admin/admin-pin";
import { adminComposeEmail } from "./api/admin/compose-email";
import {
  createBackup, listBackups, downloadBackup, deleteBackup,
  listExportTables, exportJson, exportCsv,
  getBackupSchedule, updateBackupSchedule,
  startAutoBackupScheduler,
} from "./api/admin/backup";

import { getAllowedThemes } from "./api/themes/index";
import {
  submitClosureRequest, getClosureRequest, cancelClosureRequest,
  adminListClosureRequests, adminConfirmClosure, adminRejectClosure,
} from "./api/account/closure";

import { seoRoutes } from "../lib/seo-routes";

function normalizeCommerceApiBaseUrlEnv() {
	if (process.env.GODADDY_API_BASE_URL) return;
	const hostOnly = process.env.VITE_GODADDY_API_HOST;
	if (!hostOnly) return;
	const normalizedHost = hostOnly.replace(/^https?:\/\//, "").trim();
	if (!normalizedHost) return;
	process.env.GODADDY_API_BASE_URL = `https://${normalizedHost}`;
}

normalizeCommerceApiBaseUrlEnv();

const app = express();

// Remove Express fingerprint header (belt-and-braces alongside securityHeaders middleware)
app.disable('x-powered-by');

// Honour x-forwarded-* from the load balancer so req.protocol/req.hostname
// reflect the public-facing values. Express-maintained parsing respects the
// existing trust-proxy config; direct header reads would let a client spoof
// the sitemap origin in robots.txt.
//
// SECURITY: trust exactly 1 proxy hop (the Airo edge/load-balancer).
// `true` would trust ALL X-Forwarded-For hops, allowing a client to spoof
// req.ip by prepending a fake IP to the header chain.
app.set("trust proxy", 1);

// Security headers — applied to every response before any route logic
app.use(securityHeaders);

// ── Block direct access to database files ────────────────────────────────────
// Belt-and-suspenders: even if a .db file somehow ends up in a public path,
// this middleware ensures it can never be served over HTTP.
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path.toLowerCase();
  if (p.endsWith('.db') || p.endsWith('.db-wal') || p.endsWith('.db-shm') || p.endsWith('.db-journal') || p.endsWith('.bak')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ⚠️  Stripe webhook MUST be registered before express.json() so it receives the raw body
app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), stripeWebhook);

// Body parsing — 100kb limit (was 10mb — prevents DoS via oversized payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Use Azure SQL session store when proxy secrets are configured AND the Function
// Always use Airo SQLite session store — Azure SQL removed
const sessionStore = new SQLiteSessionStore();
console.log('[session] Using SQLiteSessionStore (Airo /private/db)');

const sessionSecret = (getSecret('SESSION_SECRET') as string) || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set — refusing to start in production without a secure session secret');
  }
  // Dev only: persist the secret in SQLite so it survives HMR module reloads.
  // A per-process random value is regenerated on every file save, which invalidates
  // all existing session cookies and forces re-login on every code change.
  try {
    rawSqliteDb.exec(`CREATE TABLE IF NOT EXISTS dev_session_secret (id INTEGER PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL)`);
    const row = rawSqliteDb.prepare('SELECT secret FROM dev_session_secret WHERE id = 1').get() as { secret: string } | undefined;
    if (row?.secret) {
      console.warn('[session] WARNING: SESSION_SECRET not set — using persisted dev secret (sessions survive HMR, but NOT production-safe).');
      return row.secret;
    }
    const newSecret = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    rawSqliteDb.prepare('INSERT INTO dev_session_secret (id, secret) VALUES (1, ?)').run(newSecret);
    console.warn('[session] WARNING: SESSION_SECRET not set — generated and persisted a dev secret. Set SESSION_SECRET for production.');
    return newSecret;
  } catch {
    const fallback = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    console.warn('[session] WARNING: SESSION_SECRET not set — using ephemeral fallback (sessions will break on restart).');
    return fallback;
  }
})();

// ── Primary session — customer + admin logins ─────────────────────────────
app.use(session({
  name: 'ja_profile_studio_session',
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  },
}));

// ── Assisted-access session reader ────────────────────────────────────────
// Reads the `ja_assisted_session` cookie (if present) directly from the
// session store and attaches the data as req.assistedSession.
// This does NOT use a second express-session middleware (which would overwrite
// req.session). Instead we read the store manually so the primary session is
// completely untouched — the admin's tab keeps its own cookie and session.
app.use((req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
  const sid = (req as any).cookies?.ja_assisted_session;
  if (!sid) { (req as any).assistedSession = null; return next(); }
  try {
    const row = rawSqliteDb.prepare(
      'SELECT data FROM sessions WHERE sid = ? AND expires_at > ?'
    ).get(sid, Date.now()) as { data: string } | undefined;
    (req as any).assistedSession = row ? JSON.parse(row.data) : null;
  } catch {
    (req as any).assistedSession = null;
  }
  next();
});

// <api-registrations>
app.get("/api/admin/points-overview", admin_points_overview_get_0);
app.get("/api/admin/store-items", admin_store_items_get_1);
app.post("/api/admin/store-items", admin_store_items_post_2);
app.delete("/api/admin/store-items/:id", admin_store_items_id_delete_3);
app.put("/api/admin/store-items/:id", admin_store_items_id_put_4);
app.get("/api/analytics/config", analytics_config_get_5);
app.get("/api/feature-flags", feature_flags_get_6);
app.get("/api/health", health_get_7);
app.post("/api/partner-enquiry", partner_enquiry_post_8);
app.get("/api/plans", plans_get_9);
app.get("/api/points", points_get_10);
app.post("/api/points/redeem", points_redeem_post_11);
app.post("/api/profiles/report", profiles_report_post_12);
app.post("/api/report-issue", report_issue_post_13);
app.get("/api/rewards", rewards_get_14);
app.get("/api/status", status_get_15);
app.post("/api/trial", trial_post_16);
// </api-registrations>

// Global audit middleware — logs all mutating API calls
app.use('/api', auditMiddleware);

// Auth routes (OIDC only — local email/password login is disabled)
// All customer authentication goes through Microsoft CIAM OIDC.
app.get("/auth/login", authLimiter, customerLoginStart);
app.get("/auth/callback", authLimiter, customerLoginCallback);
app.get("/auth/logout", customerLogout);

// Explicitly block legacy local auth endpoints — return 410 Gone so clients
// know these are permanently removed, not temporarily unavailable.
app.post("/api/auth/login", (_req, res) => res.status(410).json({
  success: false,
  error: 'Local email/password login has been removed. Please sign in with Microsoft.',
}));
app.post("/api/auth/register", (_req, res) => res.status(410).json({
  success: false,
  error: 'Local registration has been removed. Please sign in with Microsoft to create your account.',
}));
// Admin local password login is disabled — admin access is OIDC-only (workforce tenant).
// Returning 410 Gone so any cached client-side calls fail clearly.
app.post("/api/admin/auth/login", (_req, res) => res.status(410).json({
  success: false,
  error: 'Local admin login is not available. Admin access requires Microsoft SSO via /admin/auth/start.',
}));
app.post("/api/admin/auth/create-first-admin", createFirstAdmin);
// Admin login page — show error page if ?error= is present, otherwise start OIDC
app.get("/admin/login", authLimiter, (req, res, next) => {
  if (req.query.error) {
    // Render a plain error page — do NOT start a new OIDC flow
    // Sanitise the error param — only allow known error codes to prevent reflected XSS
    const ALLOWED_ERRORS = ['oidc_callback_failed', 'oidc_init_failed', 'access_denied', 'no_email'];
    const rawError = String(req.query.error);
    const error = ALLOWED_ERRORS.includes(rawError) ? rawError : 'unknown_error';
    const messages: Record<string, string> = {
      oidc_callback_failed: 'Authentication failed. The admin client secret may be misconfigured — check ADMIN_OIDC_CLIENT_SECRET in Settings → Secrets.',
      oidc_init_failed:     'Could not start the login flow. Check server logs.',
      access_denied:        'Your Microsoft account does not have the Administrator role on this application.',
      no_email:             'Your Microsoft account did not return an email address.',
      unknown_error:        'An unexpected error occurred during login.',
    };
    const msg = messages[error];
    return res.status(401).send(`<!DOCTYPE html><html><head><title>Admin Login Error</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f1f5f9}
      .box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem 2.5rem;max-width:480px;text-align:center}
      h2{color:#f87171;margin-top:0}p{color:#94a3b8;line-height:1.6}
      a{display:inline-block;margin-top:1.5rem;padding:.6rem 1.5rem;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-weight:600}
      a:hover{background:#2563eb}code{background:#0f172a;padding:.2rem .4rem;border-radius:4px;font-size:.85em;color:#fbbf24}</style>
      </head><body><div class="box">
      <h2>Admin Login Failed</h2>
      <p>${msg}</p>
      <code>${error}</code>
      <a href="/admin/login">Try again</a>
      </div></body></html>`);
  }
  // No error — fall through to React SPA (the login page UI)
  return next();
});
// Dedicated server-only OIDC start — React Router never intercepts /admin/auth/...
app.get("/admin/auth/start", authLimiter, adminLoginStart);
app.get("/admin/auth/callback", adminLoginCallback);
app.get("/admin/logout", adminLogout);
// Local admin login/setup removed — OIDC only
app.get("/api/auth/me", requireAuth, authMe);
app.post("/api/trial/claim", requireAuth, trialClaim);
app.get("/api/auth/admin/me", adminMe);

// Profile routes
app.get("/api/profiles/search", searchPublicProfiles);              // public directory search
app.get("/api/profiles/me", requireAuth, getMyProfiles);
app.post("/api/profiles", requireAuth, createProfile);
app.put("/api/profiles/:id", requireAuth, updateProfile);
app.delete("/api/profiles/:id", requireAuth, deleteProfile);
// Owner-only preview — must come BEFORE the public :username route so /:id/preview isn't swallowed
app.get("/api/profiles/:id/preview", requireAuth, getProfilePreview);
// ── Public profile lookups ─────────────────────────────────────────────────
// New scheme: /profile/* (no plan prefix)
app.get("/api/profiles/:username/public", getPublicProfile);          // personal: /profile/username
app.get("/api/profiles/:prefix/:username/public", getPublicProfile);  // legacy prefix — still works
// Seat invites — member-facing (static routes BEFORE any /:bizSlug or /:profileId param routes)
app.get("/api/business/seats/me", requireAuth, getMySeats);
app.get("/api/business/invites/me", requireAuth, getMyInvites);
app.get("/api/business/invites/:token", getInviteByToken);          // public — no auth needed
app.post("/api/business/invites/:token/accept", requireAuth, acceptInvite);
app.post("/api/business/invites/:token/decline", requireAuth, declineInvite);
app.delete("/api/business/seats/me/leave", requireAuth, leaveSeat);
app.get("/api/business/:bizSlug/public", getPublicBusinessPage);      // business page: /profile/bizslug
app.get("/api/business/:bizSlug/team", getPublicTeamDirectory);       // team directory: /profile/bizslug/team
app.get("/api/business/:bizSlug/:personSlug/public", getPublicBusinessProfile); // person: /profile/bizslug/personslug
app.put("/api/business/:profileId/team-directory", requireAuth, updateTeamDirectoryVisibility);
// Business profile owner CRUD
app.get("/api/business/:profileId", requireAuth, getBusinessProfile);
app.put("/api/business/:profileId", requireAuth, updateBusinessProfile);
// Business seats (param routes after static)
app.get("/api/business/:profileId/seats", requireAuth, getSeats);
app.post("/api/business/:profileId/seats/invite", requireAuth, inviteSeat);
app.patch("/api/business/:profileId/seats/:seatId", requireAuth, updateSeatRole);
app.delete("/api/business/:profileId/seats/:seatId", requireAuth, removeSeat);
app.delete("/api/business/:profileId/invites/:inviteId", requireAuth, cancelInvite);
// PIN + feature toggles
app.get("/api/profiles/:id/pin/status", requireAuth, getProfilePinStatus);
app.post("/api/profiles/:id/pin", requireAuth, setProfilePin);
app.post("/api/profiles/:id/pin/verify", requireAuth, verifyProfilePin);
app.patch("/api/profiles/:id/messaging", requireAuth, toggleMessaging);
app.patch("/api/profiles/:id/enquiry", requireAuth, toggleEnquiry);
app.get("/api/profiles/:id/contact-hours", requireAuth, getContactHours);
app.put("/api/profiles/:id/contact-hours", requireAuth, setContactHours);
// Public profile PIN (visitor-facing)
app.get("/api/profiles/:id/public-pin/status", requireAuth, getPublicPinStatus);
app.post("/api/profiles/:id/public-pin", requireAuth, setPublicPin);
app.post("/api/profiles/:username/public-pin/verify", verifyPublicPin);

// Link routes
app.get("/api/links/:profileId", requireAuth, getLinks);
app.post("/api/links", requireAuth, createLink);
app.put("/api/links/reorder", requireAuth, reorderLinks);
app.put("/api/links/:id", requireAuth, updateLink);
app.delete("/api/links/:id", requireAuth, deleteLink);
app.post("/api/links/:id/click", publicApiLimiter, recordClick);

// QR routes — public route MUST come before parameterised :profileId routes
// so Express does not treat the literal string "public" as a profileId.
app.get("/api/qr/public/:username", publicApiLimiter, getPublicQRCode);
app.get("/api/qr/:profileId/person", requireAuth, getPersonCardQRCode);
app.get("/api/qr/:profileId", requireAuth, getQRCode);

// Enquiry routes
app.post("/api/enquiries/:username", formSubmitLimiter, submitEnquiry);
app.get("/api/enquiries", requireAuth, getEnquiries);
app.put("/api/enquiries/:id/read", requireAuth, markRead);

// Analytics routes
app.post("/api/analytics/view/:username", analyticsLimiter, recordView);
app.get("/api/analytics/:profileId", requireAuth, getAnalytics);

// Themes & Plans
app.get("/api/themes", getThemes);
app.get("/api/themes/allowed", requireAuth, getAllowedThemes);

// User settings
app.put("/api/users/:id/settings", requireAuth, updateUserSettings);
app.get("/api/users/me/preferences", requireAuth, getPreferences);
app.put("/api/users/me/preferences", requireAuth, savePreferences);
app.get("/api/users/me/notification-prefs", requireAuth, getNotificationPrefs);
app.put("/api/users/me/notification-prefs", requireAuth, saveNotificationPrefs);
app.delete("/api/users/:id", requireAuth, deleteAccount);

// Site Status — public GET (no auth), admin-only PUT
app.get("/api/site-status", getSiteStatus);
app.put("/api/site-status", requireAdminApi, setSiteStatus);

// Admin routes — all use requireAdminApi (JSON-only, reads adminUserId from session)
// Sensitive routes additionally require requireAdminPin (15-min PIN session).
// Highest-risk routes also require requireAdminPinHighRisk (per-action challenge token).
app.get("/api/admin/users", requireAdminApi, requireAdminPin, getUsers);
app.post("/api/admin/users", requireAdminApi, requireAdminPin, createUser);
app.put("/api/admin/users/:id", requireAdminApi, requireAdminPin, updateUser);
app.delete("/api/admin/users/:id", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('delete_user'), deleteUser);
app.patch("/api/admin/users/:id/pause", requireAdminApi, requireAdminPin, pauseUser);
app.patch("/api/admin/users/:id/block", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('suspend_user'), blockUser);
app.patch("/api/admin/users/:id/unblock", requireAdminApi, requireAdminPin, unblockUser);

// ── Assisted Access ────────────────────────────────────────────────────────
app.get("/api/admin/assisted-access/lookup", requireAdminApi, requireAdminPin, lookupUserForAssistedAccess);
app.post("/api/admin/assisted-access/request", requireAdminApi, requireAdminPin, createAssistedAccessRequest);
app.get("/api/admin/assisted-access", requireAdminApi, requireAdminPin, listAssistedAccessRequests);
app.get("/api/admin/assisted-access/:id/status", requireAdminApi, requireAdminPin, getAssistedAccessStatus);
app.post("/api/admin/assisted-access/:id/enter", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('assisted_access'), enterAssistedSession);
app.post("/api/admin/assisted-access/:id/generate-launch-url", requireAdminApi, generateLaunchUrl);
app.post("/api/admin/assisted-access/:id/exit", requireAdminApi, requireAdminPin, exitAssistedSession);
app.post("/api/admin/assisted-access/end-impersonation", requireAdminApi, endAssistedImpersonation);
// Session info — used by the customer dashboard banner
app.get("/api/assisted-access/session-info", requireAuth, getAssistedSessionInfo);
// Customer-facing assisted access routes
app.get("/api/assisted-access/pending", requireAuth, getCustomerPendingRequests);
app.post("/api/assisted-access/:id/approve", requireAuth, approveAssistedAccessRequest);
app.post("/api/assisted-access/:id/reject", requireAuth, rejectAssistedAccessRequest);
app.post("/api/assisted-access/:id/revoke", requireAuth, revokeAssistedAccessSession);
app.post("/api/admin/users/:id/view-as", requireAdminApi, requireAdminPin, (_req, res) => res.status(410).json({ success: false, error: 'Feature removed' }));
app.get("/api/admin/users/:id/detail", requireAdminApi, requireAdminPin, getAdminUserDetail);

// Admin user data endpoints for dashboard preview (read-only, admin-only)
app.get("/api/admin/users/:id/analytics", requireAdminApi, requireAdminPin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Get all profile IDs for this user
    const profiles = db.prepare("SELECT id FROM profiles WHERE user_id = ?").all(id) as { id: number }[];
    if (!profiles.length) return res.json({ success: true, data: { totalViews: 0, totalClicks: 0, recentViews: 0, recentClicks: 0 } });
    const pids = profiles.map(p => p.id);
    const placeholders = pids.map(() => '?').join(',');
    const views = db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE profile_id IN (${placeholders})`).get(...pids) as { c: number };
    const clicks = db.prepare(`SELECT COUNT(*) as c FROM link_clicks WHERE profile_id IN (${placeholders})`).get(...pids) as { c: number };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentViews = db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE profile_id IN (${placeholders}) AND viewed_at > ?`).get(...pids, thirtyDaysAgo) as { c: number };
    const recentClicks = db.prepare(`SELECT COUNT(*) as c FROM link_clicks WHERE profile_id IN (${placeholders}) AND clicked_at > ?`).get(...pids, thirtyDaysAgo) as { c: number };
    res.json({ success: true, data: { totalViews: views.c, totalClicks: clicks.c, recentViews: recentViews.c, recentClicks: recentClicks.c } });
  } catch { res.json({ success: true, data: { totalViews: 0, totalClicks: 0, recentViews: 0, recentClicks: 0 } }); }
});
app.get("/api/admin/users/:id/enquiries", requireAdminApi, requireAdminPin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profiles = db.prepare("SELECT id FROM profiles WHERE user_id = ?").all(id) as { id: number }[];
    if (!profiles.length) return res.json({ success: true, data: [] });
    const pids = profiles.map(p => p.id);
    const placeholders = pids.map(() => '?').join(',');
    const enquiries = db.prepare(`SELECT id, sender_name, sender_email, message, created_at, is_read FROM contact_enquiries WHERE profile_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 20`).all(...pids);
    res.json({ success: true, data: enquiries });
  } catch { res.json({ success: true, data: [] }); }
});
app.get("/api/admin/users/:id/links", requireAdminApi, requireAdminPin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profiles = db.prepare("SELECT id FROM profiles WHERE user_id = ?").all(id) as { id: number }[];
    if (!profiles.length) return res.json({ success: true, data: [] });
    const pids = profiles.map(p => p.id);
    const placeholders = pids.map(() => '?').join(',');
    const links = db.prepare(`SELECT id, title, url, is_enabled FROM profile_links WHERE profile_id IN (${placeholders}) ORDER BY sort_order ASC`).all(...pids);
    res.json({ success: true, data: links });
  } catch { res.json({ success: true, data: [] }); }
});
app.get("/api/admin/pause", requireAdminApi, requireAdminPin, getGlobalPauseState);
app.put("/api/admin/pause", requireAdminApi, requireAdminPin, setGlobalPauseState);
app.get("/api/admin/profiles", requireAdminApi, requireAdminPin, getProfiles);
app.patch("/api/admin/profiles/:id", requireAdminApi, requireAdminPin, updateAdminProfile);
app.delete("/api/admin/profiles/:id", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('delete_profile'), deleteAdminProfile);
app.get("/api/admin/profiles/:id/preview", requireAdminApi, requireAdminPin, getAdminProfilePreview);
app.post("/api/admin/profiles/:id/verify", requireAdminApi, requireAdminPin, verifyProfile);
app.delete("/api/admin/profiles/:id/verify", requireAdminApi, requireAdminPin, unverifyProfile);
app.post("/api/profiles/:id/request-verification", requireAuth, requestVerification);
app.get("/api/profiles/:id/card-pdf", profileCardPdf);
app.get("/api/profiles/:id/poster-pdf", profilePosterPdf);
app.get("/api/admin/enquiries", requireAdminApi, requireAdminPin, getAllEnquiries);
app.put("/api/admin/enquiries/:id/read", requireAdminApi, requireAdminPin, adminMarkEnquiryRead);
app.delete("/api/admin/enquiries/:id", requireAdminApi, requireAdminPin, adminDeleteEnquiry);
app.get("/api/admin/analytics", requireAdminApi, requireAdminPin, getAdminAnalytics);
app.get("/api/admin/plans", requireAdminApi, requireAdminPin, getAdminPlans);
app.post("/api/admin/plans", requireAdminApi, requireAdminPin, createPlan);
app.put("/api/admin/plans/:id", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('assign_plan'), updatePlan);
app.delete("/api/admin/plans/:id", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('assign_plan'), deletePlan);
app.put("/api/admin/plans/:id/toggle-public", requireAdminApi, requireAdminPin, togglePlanPublic);
// NOTE: /api/admin/users/:userId/assign-plan is registered below with the full trial-management handler (line ~1083)
app.get("/api/admin/themes", requireAdminApi, requireAdminPin, getAdminThemes);
app.post("/api/admin/themes", requireAdminApi, requireAdminPin, createTheme);
app.put("/api/admin/themes/:id", requireAdminApi, requireAdminPin, updateTheme);
app.get("/api/admin/settings", requireAdminApi, requireAdminPin, getSettings);
app.put("/api/admin/settings", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('update_settings'), updateSettings);
app.get("/api/admin/branding", requireAdminApi, requireAdminPin, getBranding);
app.put("/api/admin/branding", requireAdminApi, requireAdminPin, updateBranding);
app.get("/api/admin/theme", requireAdminApi, requireAdminPin, getSiteTheme);
app.put("/api/admin/theme", requireAdminApi, requireAdminPin, updateSiteTheme);
app.post("/api/admin/user-numbers/backfill", requireAdminApi, requireAdminPin, backfillUserNumbersEndpoint);
// Public branding (no auth — used by frontend)
app.get("/api/branding", getPublicBranding);

// ── Admin image upload (logo / favicon) ──────────────────────────────────────
app.post("/api/admin/upload-image", requireAdminApi, requireAdminPin, express.raw({ type: 'image/*', limit: '4mb' }), (req: Request, res: Response) => {
  try {
    const contentType = req.headers['content-type'] ?? '';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('svg') ? 'svg' : 'jpg';
    const slot = String(req.query.slot ?? 'upload').replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${slot}-${Date.now()}.${ext}`;
    const uploadDir = '/shared-storage/public/assets/uploads/branding';
    mkdirSync(uploadDir, { recursive: true });
    writeFileSync(`${uploadDir}/${filename}`, req.body as Buffer);
    res.json({ success: true, url: `/airo-assets/uploads/branding/${filename}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});
app.get("/api/admin/audit", requireAdminApi, requireAdminPin, getAuditLog);
app.delete("/api/admin/audit/clear", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('update_settings'), clearAuditLog);
app.get("/api/admin/legal", requireAdminApi, requireAdminPin, getLegalPolicies);
app.put("/api/admin/legal/:key", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('update_legal'), updateLegalPolicy);
app.get("/api/admin/homepage-content", requireAdminApi, requireAdminPin, getHomepageContent);
app.put("/api/admin/homepage-content", requireAdminApi, requireAdminPin, updateHomepageContent);
app.get("/api/homepage-content", getHomepageContent);
app.get("/api/legal/reaccept-status", requireAuth, getLegalReacceptStatus);
app.post("/api/legal/reaccept",       requireAuth, submitLegalReaccept);
app.get("/api/legal/:key", getPublicPolicy);
app.get("/api/legal-version", async (_req, res) => {
  try {
    const row = db.prepare("SELECT value FROM admin_settings WHERE key='required_consent_version'").get() as { value: string } | undefined;
    res.json({ success: true, required_consent_version: row?.value ?? null });
  } catch {
    res.json({ success: true, required_consent_version: null });
  }
});
app.post("/api/admin/test-notification", requireAdminApi, requireAdminPin, testNotification);
app.get("/api/admin/email/status",       requireAdminApi, requireAdminPin, getEmailStatus);
app.post("/api/admin/email/recheck",     requireAdminApi, requireAdminPin, recheckEmailStatus);
app.post("/api/admin/email/test",        requireAdminApi, requireAdminPin, sendTestEmail);
app.post("/api/admin/email/compose",     requireAdminApi, requireAdminPin, adminComposeEmail);

// ── Backup & Export ──────────────────────────────────────────────────────────
app.post("/api/admin/backup/create",              requireAdminApi, requireAdminPin, createBackup);
app.get("/api/admin/backup/list",                 requireAdminApi, requireAdminPin, listBackups);
app.get("/api/admin/backup/download/:filename",   requireAdminApi, requireAdminPin, downloadBackup);
app.delete("/api/admin/backup/:filename",         requireAdminApi, requireAdminPin, deleteBackup);
app.get("/api/admin/backup/export/tables",        requireAdminApi, requireAdminPin, listExportTables);
app.get("/api/admin/backup/export/json",          requireAdminApi, requireAdminPin, exportJson);
app.get("/api/admin/backup/export/csv/:table",    requireAdminApi, requireAdminPin, exportCsv);
app.get("/api/admin/backup/schedule",             requireAdminApi, requireAdminPin, getBackupSchedule);
app.post("/api/admin/backup/schedule",            requireAdminApi, requireAdminPin, updateBackupSchedule);

// Admin PIN gate
app.get("/api/admin/pin/status",        requireAdminApi, getAdminPinStatus);
app.post("/api/admin/pin/set",          requireAdminApi, pinLimiter, setAdminPin);
app.post("/api/admin/pin/verify",       requireAdminApi, pinLimiter, verifyAdminPin);
app.post("/api/admin/pin/remove",       requireAdminApi, pinLimiter, removeAdminPin);
app.post("/api/admin/pin/clear",        requireAdminApi, clearAdminPinSession);
app.post("/api/admin/pin/heartbeat",    requireAdminApi, adminPinHeartbeat);
app.post("/api/admin/pin/challenge",    requireAdminApi, pinLimiter, issueAdminPinChallenge);
app.post("/api/admin/pin/reset-lockout",requireAdminApi, pinLimiter, resetAdminPinLockout);

// Stripe & Billing admin routes — billing controls require PIN + challenge
app.get("/api/admin/stripe/config", requireAdminApi, requireAdminPin, getStripeConfig);
app.put("/api/admin/stripe/config", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('billing_control'), updateStripeConfig);
app.get("/api/admin/subscriptions", requireAdminApi, requireAdminPin, getSubscriptions);
app.post("/api/admin/users/:userId/lifetime", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('billing_control'), grantLifetimeAccess);
app.delete("/api/admin/users/:userId/lifetime", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('billing_control'), revokeLifetimeAccess);
app.get("/api/admin/users/:userId/lifetime-log", requireAdminApi, requireAdminPin, getLifetimeLog);
// Subject lookup for authority reports (email or user_number → user; username → profile)
app.get("/api/admin/users/lookup", requireAdminApi, requireAdminPin, lookupUserByRef);
app.get("/api/admin/profiles/lookup", requireAdminApi, requireAdminPin, lookupProfileByUsername);
// Stripe product sync
app.post("/api/admin/stripe/sync-products", requireAdminApi, requireAdminPin, syncStripeProducts);
app.get("/api/admin/stripe/products", requireAdminApi, requireAdminPin, getStripeProducts);
// Support requests — user-facing + admin threaded messaging
app.post("/api/support/request", requireAuth, formSubmitLimiter, submitSupportRequest);
app.get("/api/support/tickets", requireAuth, getUserTickets);
app.get("/api/support/tickets/:id/messages", requireAuth, getUserTicketMessages);
app.post("/api/support/tickets/:id/reply", requireAuth, formSubmitLimiter, userReplyToTicket);
app.put("/api/account/update", requireAuth, accountUpdate);
app.get("/api/admin/support-requests", requireAdminApi, requireAdminPin, getSupportRequests);
app.patch("/api/admin/support-requests/:id", requireAdminApi, requireAdminPin, updateSupportRequest);
app.get("/api/admin/support-requests/:id/messages", requireAdminApi, requireAdminPin, getTicketMessages);
app.post("/api/admin/support-requests/:id/reply", requireAdminApi, requireAdminPin, adminReplyToTicket);
app.get("/api/admin/issue-reports", requireAdminApi, requireAdminPin, getIssueReports);
app.patch("/api/admin/issue-reports/:id", requireAdminApi, requireAdminPin, updateIssueReport);
app.delete("/api/admin/issue-reports/:id", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    db.prepare('DELETE FROM issue_reports WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
// Profile moderation (suspend / hide from report queue)
app.post("/api/admin/profiles/:profileId/suspend",   requireAdminApi, requireAdminPin, requireAdminPinHighRisk('suspend_user'), suspendProfile);
app.post("/api/admin/profiles/:profileId/unsuspend", requireAdminApi, requireAdminPin, unsuspendProfile);
// Scan endpoints
app.get("/api/admin/scans/:reportId",              requireAdminApi, requireAdminPin, getScanForReport);
app.post("/api/admin/scans/:reportId/rescan",      requireAdminApi, requireAdminPin, rescanReport);
app.post("/api/admin/scans/:scanId/override",      requireAdminApi, requireAdminPin, overrideScanRisk);
app.post("/api/admin/scans/:scanId/dismiss",       requireAdminApi, requireAdminPin, dismissScan);
app.post("/api/admin/scans/:scanId/review",        requireAdminApi, requireAdminPin, markScanReviewed);
app.post("/api/admin/profiles/:profileId/hide",      requireAdminApi, requireAdminPin, hideProfile);
app.post("/api/admin/profiles/:profileId/unhide",    requireAdminApi, requireAdminPin, unhideProfile);

// ── Direct Messaging — REMOVED ────────────────────────────────────────────
// All /api/messages/* routes have been removed from the product.
// Return 410 Gone for any legacy clients still calling these endpoints.
// Fixed: use string prefix match instead of regex with optional nested group (ReDoS prevention)
app.all('/api/messages',                    (_req, res) => res.status(410).json({ success: false, error: 'Direct messaging has been removed.' }));
app.all('/api/messages{/*path}',            (_req, res) => res.status(410).json({ success: false, error: 'Direct messaging has been removed.' }));
app.all('/api/admin/messages',              (_req, res) => res.status(410).json({ success: false, error: 'Direct messaging has been removed.' }));
app.all('/api/admin/messages{/*path}',      (_req, res) => res.status(410).json({ success: false, error: 'Direct messaging has been removed.' }));

// Notifications
app.get("/api/notifications", requireAuth, getNotifications);
app.get("/api/notifications/stream", requireAuth, notificationSseHandler);
app.post("/api/notifications/read", requireAuth, markNotificationsRead);
app.delete("/api/notifications/:id", requireAuth, deleteNotification);

// Admin — notifications
app.get("/api/admin/notifications", requireAdminApi, requireAdminPin, adminListNotifications);
app.get("/api/admin/notifications/user-search", requireAdminApi, requireAdminPin, adminSearchUsers);
app.post("/api/admin/notifications/send", requireAdminApi, requireAdminPin, adminSendNotification);
app.delete("/api/admin/notifications/:id", requireAdminApi, requireAdminPin, adminDeleteNotification);
app.patch("/api/admin/notifications/:id", requireAdminApi, requireAdminPin, adminEditNotification);

// Admin — SAR (Subject Access Request) PDF generation — highest risk: requires challenge token
app.get("/api/admin/sar/:userId/data", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('sar_view'), sarGetData);
app.get("/api/admin/sar/:userId/pdf", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('sar_export'), sarGeneratePdf);
app.get("/api/admin/manual/pdf", requireAdminApi, requireAdminPin, getManualPdf);

// Admin — Authority & Incident Report — highest risk: requires challenge token
app.post("/api/admin/authority-report/generate", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('authority_report'), generateAuthorityReport);

// Admin — IP Blocking
app.get("/api/admin/ip-blocks", requireAdminApi, requireAdminPin, listBlockedIps);
app.post("/api/admin/ip-blocks", requireAdminApi, requireAdminPin, blockIp);
app.delete("/api/admin/ip-blocks/:id", requireAdminApi, requireAdminPin, unblockIp);
app.get("/api/admin/ip-blocks/check", requireAdminApi, requireAdminPin, checkIpBlocked);
app.get("/api/admin/moderation-log", requireAdminApi, requireAdminPin, getModerationLog);

// Admin — Thread evidence report PDF
app.get("/api/admin/messages/:threadId/report-pdf", requireAdminApi, requireAdminPin, generateThreadReportPdf);

// Security — support PIN & session activity
app.get("/api/security/support-pin", requireAuth, getSupportPin);
app.post("/api/security/support-pin/rotate", requireAuth, rotateSupportPin);
app.post("/api/security/support-pin/set", requireAuth, setCustomPin);
app.post("/api/security/support-pin/verify-email", requireAuth, verifyEmailAndSetPin);
app.post("/api/security/heartbeat", requireAuth, heartbeat);
app.get("/api/security/session-status", requireAuth, getSessionStatus);
app.post("/api/security/logout-idle", requireAuth, logoutIdle);

// Active sessions list + logout-all
app.get("/api/security/sessions", requireAuth, (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const currentSid = (req as any).session?.id ?? null;

    // Attempt to read from the sessions store if it exposes enumeration.
    // Most express-session stores do not expose per-user enumeration, so we
    // return the current session only — which is always accurate and safe.
    const currentSession = {
      id: currentSid ?? 'current',
      ip: req.ip ?? 'Unknown',
      user_agent: req.headers['user-agent'] ?? 'Unknown',
      created_at: (req as any).session?.createdAt ?? new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      is_current: true,
    };
    return res.json({ success: true, sessions: [currentSession] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load sessions' });
  }
});

app.post("/api/security/sessions/logout-all", requireAuth, (req: Request, res: Response) => {
  try {
    // Destroy the current session — the session store does not support
    // cross-session enumeration, so we destroy the caller's session and
    // clear the cookie. The user is redirected to /login by the client.
    (req as any).session.destroy((err: unknown) => {
      if (err) {
        console.error('[logout-all]', err);
        return res.status(500).json({ success: false, error: 'Failed to sign out' });
      }
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to sign out' });
  }
});

// Account security PIN
app.get("/api/security/pin/status",    requireAuth, getPinStatus);
app.post("/api/security/pin",          requireAuth, pinLimiter, setPin);
app.delete("/api/security/pin",        requireAuth, pinLimiter, removePin);
app.post("/api/security/pin/verify",   requireAuth, pinLimiter, verifyPin);
app.get("/api/security/pin/session-status", requireAuth, getPinSessionStatus);
app.post("/api/security/pin/self-unlock", requireAuth, selfUnlockPin);
app.post("/api/security/pin/unlock",   requireAdminApi, adminUnlockUserPin);

// Public Site Editor
// ── Site Editor API — REMOVED ─────────────────────────────────────────────
// The custom HTML/CSS site editor has been removed. All routes return 410 Gone
// so any cached bookmarks or old clients get a clear, permanent response.
const siteEditorGone = (_req: Request, res: Response) =>
  res.status(410).json({ success: false, error: 'The custom site editor has been removed. Use the built-in profile builders instead.' });
app.get("/api/site-editor",                    requireAuth,     siteEditorGone);
app.post("/api/site-editor/activate",          requireAuth,     siteEditorGone);
app.post("/api/site-editor/deactivate",        requireAuth,     siteEditorGone);
app.post("/api/site-editor/draft",             requireAuth,     siteEditorGone);
app.post("/api/site-editor/publish",           requireAuth,     siteEditorGone);
app.post("/api/site-editor/reset",             requireAuth,     siteEditorGone);
app.get("/api/site-editor/versions",           requireAuth,     siteEditorGone);
app.get("/api/admin/site-editor/:userId",      requireAdminApi, siteEditorGone);
app.post("/api/admin/site-editor/:userId/disable", requireAdminApi, siteEditorGone);
app.post("/api/admin/site-editor/:userId/enable",  requireAdminApi, siteEditorGone);
app.post("/api/admin/site-editor/:userId/revert",  requireAdminApi, siteEditorGone);

// Admin — support PIN lookup (for telephone verification)
// Legacy email-based lookup (kept for backwards compat)
app.get("/api/admin/support-pin-lookup", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, error: 'email query param required' });

    const user = db.prepare(
      "SELECT id, name, email, user_number FROM users WHERE LOWER(email) = ? AND role = 'user' LIMIT 1"
    ).get(email) as { id: number; name: string; email: string; user_number: string | null } | undefined;

    if (!user) return res.status(404).json({ success: false, error: 'No customer found with that email' });

    const pin = db.prepare(
      'SELECT pin, issued_at, expires_at FROM support_pins WHERE user_id = ? AND expires_at > ?'
    ).get(user.id, new Date().toISOString()) as { pin: string; issued_at: string; expires_at: string } | undefined;

    const secondsRemaining = pin
      ? Math.max(0, Math.floor((new Date(pin.expires_at).getTime() - Date.now()) / 1000))
      : 0;

    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, user_number: user.user_number },
      pin: pin?.pin ?? null,
      expiresAt: pin?.expires_at ?? null,
      secondsRemaining,
      hasPin: !!pin,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * GET /api/admin/support-pin-lookup-by-number
 * Look up a customer by their Sousa Murray Profiles User Number.
 * Accepts the number with or without spaces (e.g. "742 918 305 614" or "742918305614").
 * Returns basic identity — no PIN data exposed.
 */
app.get("/api/admin/support-pin-lookup-by-number", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    const raw = String(req.query.user_number || '').replace(/\s+/g, '').trim();
    if (!raw) return res.status(400).json({ success: false, error: 'user_number query param required' });
    if (!/^\d{12}$/.test(raw)) {
      return res.status(400).json({ success: false, error: 'User number must be exactly 12 digits.' });
    }

    const user = db.prepare(
      "SELECT id, name, email, user_number FROM users WHERE user_number = ? AND role = 'user' LIMIT 1"
    ).get(raw) as { id: number; name: string; email: string; user_number: string | null } | undefined;

    if (!user) return res.status(404).json({ success: false, error: 'No customer found with that user number.' });

    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, user_number: user.user_number },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * POST /api/admin/support-pin-verify
 * Admin enters the PIN a caller has given over the phone.
 * Returns the account the PIN belongs to (if valid and not expired).
 * Body: { pin: string }
 */
app.post("/api/admin/support-pin-verify", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin || !/^\d{6}$/.test(pin.trim())) {
      return res.status(400).json({ success: false, error: 'A 6-digit PIN is required.' });
    }

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const row = db.prepare(`
      SELECT sp.pin, sp.issued_at, sp.expires_at,
             u.id AS user_id, u.name, u.email, u.plan_id, u.user_number,
             p.name AS plan_name, p.slug AS plan_slug
      FROM support_pins sp
      JOIN users u ON u.id = sp.user_id
      LEFT JOIN plans p ON p.id = u.plan_id
      WHERE sp.pin = ? AND sp.expires_at > ? AND u.role = 'user'
      LIMIT 1
    `).get(pin.trim(), now) as {
      pin: string; issued_at: string; expires_at: string;
      user_id: number; name: string; email: string; user_number: string | null;
      plan_name: string | null; plan_slug: string | null;
    } | undefined;

    if (!row) {
      // Log failed attempt
      const adminId = (req as import('./middleware/auth.js').AuthRequest).user?.id;
      const adminName = (req as import('./middleware/auth.js').AuthRequest).user?.name;
      const { writeAudit } = await import('./lib/audit.js');
      await writeAudit({
        actorId: adminId, actorName: adminName, actorType: 'admin',
        action: 'support_pin_verify_failed',
        resourceType: 'support_pin',
        details: `PIN entered did not match any active account`,
        ipAddress: req.ip,
        result: 'failed',
      });
      return res.status(404).json({ success: false, error: 'PIN not recognised or has expired. Ask the caller to check their PIN in Dashboard → Settings.' });
    }

    const secondsRemaining = Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000));

    // Audit successful verification
    const adminId = (req as import('./middleware/auth.js').AuthRequest).user?.id;
    const adminName = (req as import('./middleware/auth.js').AuthRequest).user?.name;
    const { writeAudit } = await import('./lib/audit.js');
    await writeAudit({
      actorId: adminId, actorName: adminName, actorType: 'admin',
      action: 'support_pin_verified',
      resourceType: 'user',
      resourceId: String(row.user_id),
      resourceLabel: row.email,
      details: `Caller identity verified via telephone support PIN`,
      ipAddress: req.ip,
      result: 'success',
    });

    return res.json({
      success: true,
      verified: true,
      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
        user_number: row.user_number,
        plan_name: row.plan_name,
        plan_slug: row.plan_slug,
      },
      expiresAt: row.expires_at,
      secondsRemaining,
    });
  } catch (err) {
    console.error('[support-pin-verify]', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// Coming soon config
app.get("/api/coming-soon-config", getComingSoonConfig);
app.put("/api/admin/coming-soon", requireAdminApi, requireAdminPin, updateComingSoonConfig);

// Business Cards
app.get("/api/business-cards/feature-flag", getFeatureFlag);
app.get("/api/business-cards/templates", getPublicTemplates);
app.get("/api/business-cards", requireAuth, getMyOrders);
app.post("/api/business-cards", requireAuth, createOrder);
app.post("/api/business-cards/:orderId/approve", requireAuth, approveOrder);
app.post("/api/business-cards/:orderId/accept-fee", requireAuth, acceptFee);
app.post("/api/business-cards/:orderId/decline-fee", requireAuth, declineFee);
app.get("/api/business-cards/:orderId/messages", requireAuth, getOrderMessages);
app.post("/api/business-cards/:orderId/messages", requireAuth, sendOrderMessage);
// Admin — static routes BEFORE param routes
app.put("/api/admin/business-cards/feature-flag", requireAdminApi, requireAdminPin, adminToggleFeature);
app.get("/api/admin/business-cards/messages/unread-count", requireAdminApi, requireAdminPin, adminUnreadMessageCount);
app.get("/api/admin/business-cards/templates", requireAdminApi, requireAdminPin, adminGetTemplates);
app.post("/api/admin/business-cards/templates", requireAdminApi, requireAdminPin, adminCreateTemplate);
app.put("/api/admin/business-cards/templates/:id", requireAdminApi, requireAdminPin, adminUpdateTemplate);
app.get("/api/admin/business-cards/vat-settings", requireAdminApi, requireAdminPin, (_req, res) => res.status(410).json({ error: 'VAT settings removed — JA Group Services Ltd is not VAT registered.' }));
app.put("/api/admin/business-cards/vat-settings", requireAdminApi, requireAdminPin, (_req, res) => res.status(410).json({ error: 'VAT settings removed — JA Group Services Ltd is not VAT registered.' }));
app.get("/api/admin/business-cards", requireAdminApi, requireAdminPin, adminListOrders);
app.get("/api/admin/business-cards/:orderId", requireAdminApi, requireAdminPin, adminGetOrder);
app.put("/api/admin/business-cards/:orderId", requireAdminApi, requireAdminPin, adminUpdateOrder);
app.post("/api/admin/business-cards/:orderId/quote-price", requireAdminApi, requireAdminPin, adminQuotePrice);
app.post("/api/admin/business-cards/:orderId/quote-fee", requireAdminApi, requireAdminPin, adminQuoteFee);
app.post("/api/admin/business-cards/:orderId/send-payment-link", requireAdminApi, requireAdminPin, adminSendPaymentLink);
app.post("/api/admin/business-cards/:orderId/generate-checkout", requireAdminApi, requireAdminPin, adminGenerateCheckout);
app.post("/api/admin/business-cards/:orderId/mark-paid", requireAdminApi, requireAdminPin, adminMarkPaid);
app.post("/api/admin/business-cards/:orderId/upload-proof", requireAdminApi, requireAdminPin, adminUploadProof);
app.post("/api/admin/business-cards/:orderId/enable-final-file", requireAdminApi, requireAdminPin, adminEnableFinalFile);
app.post("/api/admin/business-cards/:orderId/final-file", requireAdminApi, requireAdminPin, adminEnableFinalFile);
app.post("/api/admin/business-cards/:orderId/mark-deposit-paid", requireAdminApi, requireAdminPin, adminMarkDepositPaid);
app.get("/api/admin/business-cards/:orderId/messages", requireAdminApi, requireAdminPin, adminGetOrderMessages);
app.post("/api/admin/business-cards/:orderId/messages", requireAdminApi, requireAdminPin, adminSendOrderMessage);
app.get("/api/admin/business-cards/:orderId/pdf", requireAdminApi, requireAdminPin, adminBusinessCardPdf);
// POS — create order on behalf of customer
app.post("/api/admin/business-cards/pos", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const userEmail = String(body.user_email ?? '').trim();
    if (!userEmail) return res.status(400).json({ success: false, error: 'user_email is required' });
    const targetUser = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND role = 'user' LIMIT 1").get(userEmail) as { id: number } | undefined;
    if (!targetUser) return res.status(404).json({ success: false, error: 'No user found with that email address' });
    const result = db.prepare(`
      INSERT INTO business_card_orders
        (user_id, request_type, status, name_on_card, business_name_on_card,
         phone_on_card, email_on_card, website_on_card,
         quantity, card_size, finish, corner_type,
         customer_notes, artwork_url, internal_notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `).run(
      targetUser.id, body.request_type ?? 'upload_own', 'submitted',
      body.name_on_card ?? '', body.business_name_on_card ?? '',
      body.phone_on_card ?? '', body.email_on_card ?? '', body.website_on_card ?? '',
      body.quantity ?? 250, body.card_size ?? '85x55mm',
      body.finish ?? 'gloss', body.corner_type ?? 'rounded',
      body.customer_notes ?? '', body.artwork_url ?? '', body.internal_notes ?? '',
    );
    return res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});
// Business Cards settings (read/write from admin_settings)
const BC_SETTING_KEYS = ['bc_turnaround_days','bc_accepted_formats','bc_min_dpi','bc_bleed_mm','bc_custom_design_fee','bc_design_deposit_pct','bc_default_provider','bc_upload_instructions','bc_custom_design_brief'];
app.get("/api/admin/settings/business-cards", requireAdminApi, requireAdminPin, (_req, res) => {
  try {
    const rows = db.prepare(`SELECT key, value FROM admin_settings WHERE key IN (${BC_SETTING_KEYS.map(() => '?').join(',')})`).all(...BC_SETTING_KEYS) as { key: string; value: string }[];
    const data: Record<string, string> = {};
    for (const r of rows) data[r.key] = r.value;
    return res.json({ success: true, data });
  } catch { return res.status(500).json({ success: false, error: 'Failed to load settings' }); }
});
app.post("/api/admin/settings/business-cards", requireAdminApi, requireAdminPin, (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const upsert = db.prepare("INSERT INTO admin_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    for (const key of BC_SETTING_KEYS) {
      if (key in body) upsert.run(key, String(body[key]));
    }
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Failed to save settings' }); }
});

// ── Feature Gate (admin) ───────────────────────────────────────────────────
app.get("/api/admin/features", requireAdminApi, requireAdminPin, adminListFeatures);
app.get("/api/admin/features/:id/overrides", requireAdminApi, requireAdminPin, adminListFeatureOverrides);
app.get("/api/admin/features/:id/interest", requireAdminApi, requireAdminPin, adminListFeatureInterest);
app.get("/api/admin/features/:id", requireAdminApi, requireAdminPin, adminGetFeature);
app.put("/api/admin/features/:id", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('feature_change'), adminUpdateFeature);
app.put("/api/admin/features/:id/plan-rules", requireAdminApi, requireAdminPin, adminSetFeaturePlanRules);
app.post("/api/admin/features/:id/overrides", requireAdminApi, requireAdminPin, adminSetFeatureOverride);
app.delete("/api/admin/features/:id/overrides/:userId", requireAdminApi, requireAdminPin, adminDeleteFeatureOverride);

// ── Feature Gate (customer) ────────────────────────────────────────────────
app.get("/api/features/me", requireAuth, getMyFeatures);
app.get("/api/features/:slug/access", requireAuth, checkFeatureAccess);
app.post("/api/features/:slug/register-interest", requireAuth, registerFeatureInterest);

// Affiliate/referral/partner — REMOVED. Single middleware catches all sub-paths.
const REMOVED_API_PREFIXES: Array<[string, string]> = [
  ['/api/affiliate', 'Affiliate programme has been removed.'],
  ['/api/referral', 'Referral programme has been removed.'],
  ['/api/partner-enquiry', 'Partner enquiry programme has been removed.'],
  ['/api/partner', 'Partner programme has been removed.'],
  ['/api/admin/affiliates', 'Affiliate management has been removed.'],
  ['/api/admin/referrals', 'Referral management has been removed.'],
  ['/api/partner-enquiry', 'Partner enquiry has been removed.'],
  ['/api/admin/partner-enquiries', 'Partner enquiry management has been removed.'],
];
app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  const url = req.path;
  for (const [prefix, msg] of REMOVED_API_PREFIXES) {
    if (url === prefix || url.startsWith(prefix + '/')) {
      return res.status(410).json({ success: false, error: msg });
    }
  }
  next();
});

// Billing
app.post("/api/billing/checkout", requireAuth, createCheckoutSession);
app.post("/api/billing/init-customer", requireAuth, initStripeCustomer);
app.post("/api/billing/cancel", requireAuth, cancelSubscription);
app.post("/api/billing/select-free", requireAuth, selectFreePlan);

// ── Onboarding / Assisted Setup ───────────────────────────────────────────────
app.get("/api/onboarding/state",    requireAuth, getOnboardingState);
app.post("/api/onboarding/step",    requireAuth, markOnboardingStep);
app.post("/api/onboarding/dismiss", requireAuth, dismissOnboarding);
app.post("/api/onboarding/reset",   requireAuth, resetOnboarding);

// ── Admin CRM ──────────────────────────────────────────────────────────────
app.get("/api/admin/crm/users", requireAdminApi, requireAdminPin, crmListUsers);
app.get("/api/admin/crm/users/:id", requireAdminApi, requireAdminPin, crmGetUser);
app.post("/api/admin/crm/users/:id/notes", requireAdminApi, requireAdminPin, crmAddNote);
app.delete("/api/admin/crm/users/:id/notes/:noteId", requireAdminApi, requireAdminPin, crmDeleteNote);
app.get("/api/admin/crm/data-requests", requireAdminApi, requireAdminPin, crmListDataRequests);
app.patch("/api/admin/crm/data-requests/:id", requireAdminApi, requireAdminPin, crmUpdateDataRequest);

// ── MySQL sync (GDPR / audit mirror) ─────────────────────────────────────────
app.get("/api/admin/sync", requireAdminApi, requireAdminPin, getSyncStatus);
app.post("/api/admin/sync", requireAdminApi, requireAdminPin, runSync);

// ── Visitor / profile reports ─────────────────────────────────────────────
app.post("/api/profiles/:slug/report", async (req, res) => {
  try {
    const { slug } = req.params;
    const { category, details, reporter_name, reporter_email, good_faith_confirmed } = req.body;
    if (!category || !details?.trim()) {
      return res.status(400).json({ success: false, error: 'Category and details are required' });
    }
    const profile = db.prepare('SELECT id, user_id, profile_type FROM profiles WHERE username = ? OR biz_slug = ?').get(slug, slug) as { id: number; user_id: number; profile_type: string } | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    db.prepare(`
      INSERT INTO visitor_reports (profile_id, reported_user_id, category, details, reporter_name, reporter_email, good_faith_confirmed, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(profile.id, profile.user_id, category, details.trim(), reporter_name ?? null, reporter_email ?? null, good_faith_confirmed ? 1 : 0);

    // Also insert into issue_reports so auto-scan can run
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const issueInsert = db.prepare(`
      INSERT INTO issue_reports
        (name, email, issue_type, subject, description, page_url,
         ip_address, reporter_ip, reported_user_id, reported_profile_id,
         report_reason, profile_type, reported_url, status, scan_status)
      VALUES (?, ?, 'profile_report', ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, 'new', 'pending')
    `).run(
      reporter_name ?? 'Anonymous',
      reporter_email ?? '',
      `Profile report: ${category}`,
      details.trim(),
      `/profile/${slug}`,
      ip, ip,
      profile.user_id,
      profile.id,
      category,
      profile.profile_type,
      `/profile/${slug}`,
    );
    const reportId = Number(issueInsert.lastInsertRowid);

    // Trigger auto-scan
    setImmediate(async () => {
      try {
        const { runScanPipeline } = await import('./lib/profile-scanner.js');
        const { writeAudit } = await import('./lib/audit.js');
        const { result, autoHidden } = await runScanPipeline(profile.id, profile.profile_type, reportId, 'auto_report');
        await writeAudit({
          actorId: 0, actorName: 'auto_scan', actorEmail: '', actorType: 'system',
          tenant: 'platform', authProvider: 'system',
          action: 'profile_auto_scanned',
          resourceType: 'profile', resourceId: String(profile.id),
          resourceLabel: slug,
          details: `Auto-scan via visitor report. Risk: ${result.riskLevel} (score ${result.riskScore}). Auto-hidden: ${autoHidden}.`,
          ipAddress: ip, result: 'success',
        });
      } catch (e) {
        console.error('[auto-scan visitor_report]', e);
        try { db.prepare(`UPDATE issue_reports SET scan_status = 'failed' WHERE id = ?`).run(reportId); } catch { /* ignore */ }
      }
    });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
app.get("/api/admin/visitor-reports", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT vr.*, p.username AS profile_slug, p.display_name AS profile_name,
             u.name AS reported_user_name, u.email AS reported_user_email
      FROM visitor_reports vr
      LEFT JOIN profiles p ON vr.profile_id = p.id
      LEFT JOIN users u ON vr.reported_user_id = u.id
      ORDER BY vr.created_at DESC LIMIT 100
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

// POST /api/admin/visitor-reports — admin manually creates a report (e.g. flagging an enquiry)
app.post("/api/admin/visitor-reports", requireAdminApi, requireAdminPin, async (req: Request, res: Response) => {
  try {
    const { profile_id, category, details, reporter_name, reporter_email, good_faith_confirmed } = req.body;
    if (!profile_id || !category || !details) {
      return res.status(400).json({ success: false, error: 'profile_id, category, and details are required' });
    }
    const result = db.prepare(`
      INSERT INTO visitor_reports (profile_id, reported_user_id, category, details, reporter_name, reporter_email, good_faith_confirmed, status)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 'pending')
    `).run(
      profile_id, category, details,
      reporter_name || 'Admin',
      reporter_email || 'admin@japrofilestudio.jagroupservices.co.uk',
      good_faith_confirmed ? 1 : 0,
    );
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});
app.patch("/api/admin/visitor-reports/:id", requireAdminApi, requireAdminPin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, action_taken, outcome, assigned_to } = req.body;
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const vals: unknown[] = [];
    if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
    if (admin_notes !== undefined) { sets.push('admin_notes = ?'); vals.push(admin_notes); }
    if (action_taken !== undefined) { sets.push('action_taken = ?'); vals.push(action_taken); }
    if (outcome !== undefined) { sets.push('outcome = ?'); vals.push(outcome); }
    if (assigned_to !== undefined) { sets.push('assigned_to = ?'); vals.push(assigned_to); }
    db.prepare(`UPDATE visitor_reports SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

// ── Email Signature Beta Access (admin-only) ───────────────────────────────
// Email Signature Beta — REMOVED. Feature is now available to all eligible users.
// app.get("/api/admin/users/:userId/email-signature-beta", ...); // REMOVED
// app.post("/api/admin/users/:userId/email-signature-beta", ...); // REMOVED
app.all("/api/admin/users/:userId/email-signature-beta", (_req, res) => res.status(410).json({ success: false, error: 'Email Signature Beta controls have been removed.' }));

// ── Customer: data requests & consent ─────────────────────────────────────
app.post("/api/me/data-requests", requireAuth, customerSubmitDataRequest);
app.get("/api/me/data-requests", requireAuth, customerGetDataRequests);
app.get("/api/me/consent", requireAuth, customerGetConsent);
app.patch("/api/me/consent", requireAuth, customerUpdateConsent);

// ── Customer: appearance preference ───────────────────────────────────────
import { getAppearance, saveAppearance } from './api/me/appearance';
app.get("/api/me/appearance", requireAuth, getAppearance);
app.post("/api/me/appearance", requireAuth, saveAppearance);

// ── Add-ons (admin) ───────────────────────────────────────────────────────
app.get("/api/admin/addons", requireAdminApi, requireAdminPin, listAddons);
app.post("/api/admin/addons", requireAdminApi, requireAdminPin, createAddon);
app.patch("/api/admin/addons/:id", requireAdminApi, requireAdminPin, updateAddon);
app.delete("/api/admin/addons/:id", requireAdminApi, requireAdminPin, deleteAddon);
app.get("/api/admin/addons/:id/customers", requireAdminApi, requireAdminPin, listAddonCustomers);
app.post("/api/admin/addons/assign", requireAdminApi, requireAdminPin, assignAddon);
app.delete("/api/admin/addons/assign/:userId/:addonId", requireAdminApi, requireAdminPin, removeAddonFromCustomer);
app.patch("/api/admin/addons/assign/:userId/:addonId", requireAdminApi, requireAdminPin, updateAddonAssignment);
app.get("/api/admin/addons/customer/:userId", requireAdminApi, requireAdminPin, getCustomerAddons);

// ── Admin trial & plan management ─────────────────────────────────────────
app.post("/api/admin/users/:userId/trial/extend", requireAdminApi, requireAdminPin, extendTrial);
app.post("/api/admin/users/:userId/trial/end", requireAdminApi, requireAdminPin, endTrial);
app.post("/api/admin/users/:userId/move-to-no-plan", requireAdminApi, requireAdminPin, moveToNoPlan);
app.post("/api/admin/users/:userId/move-to-free", requireAdminApi, requireAdminPin, moveToFree);
app.post("/api/admin/users/:userId/assign-plan", requireAdminApi, requireAdminPin, requireAdminPinHighRisk('assign_plan'), assignPlan);
app.post("/api/admin/users/:userId/remove-plan", requireAdminApi, requireAdminPin, removePlan);
app.patch("/api/admin/users/:userId/account-status", requireAdminApi, requireAdminPin, setAccountStatus);

// ── GDPR: instant self-service data export (JSON download) ────────────────
app.get("/api/me/data-export", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    // ── Account & consent ────────────────────────────────────────────────────
    const user = db.prepare(`
      SELECT id, email, name, role, created_at, updated_at, last_login_at,
             COALESCE(phone, '') AS phone,
             marketing_consent, marketing_consent_at,
             terms_consent, terms_consent_at,
             privacy_consent, privacy_consent_at,
             data_improve_consent, data_improve_consent_at,
             updates_consent, updates_consent_at,
             crm_consent, crm_consent_at,
             referral_consent, referral_consent_at,
             consent_version, consent_ip,
             COALESCE(is_paused, 0) AS is_paused,
             COALESCE(lifetime_access, 0) AS lifetime_access,
             COALESCE(trial_started_at, '') AS trial_started_at,
             p.name AS plan_name, p.slug AS plan_slug
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.id = ?
    `).get(userId) as Record<string, unknown> | undefined;

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // ── Profiles ─────────────────────────────────────────────────────────────
    const profiles = db.prepare(`
      SELECT id, display_name, job_title, company, bio, phone, email,
             website, address, is_published,
             COALESCE(profile_type, 'personal') AS profile_type,
             COALESCE(username, '') AS username,
             COALESCE(biz_slug, '') AS biz_slug,
             COALESCE(person_slug, '') AS person_slug,
             COALESCE(business_name, '') AS business_name,
             COALESCE(business_description, '') AS business_description,
             COALESCE(business_category, '') AS business_category,
             COALESCE(business_email, '') AS business_email,
             COALESCE(business_phone, '') AS business_phone,
             created_at, updated_at
      FROM profiles WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(userId) as Record<string, unknown>[];

    // ── Public profile URLs ───────────────────────────────────────────────────
    const public_profile_urls = profiles.map(p => {
      if (p.profile_type === 'business' && p.biz_slug) {
        return {
          profile_name: p.business_name || p.display_name,
          profile_type: 'business',
          biz_slug: p.biz_slug,
          public_url: `https://japrofilestudio.jagroupservices.co.uk/profile/${p.biz_slug}`,
          is_published: p.is_published,
        };
      }
      if (p.username) {
        return {
          profile_name: p.display_name,
          profile_type: 'personal',
          username: p.username,
          public_url: `https://japrofilestudio.jagroupservices.co.uk/profile/${p.username}`,
          is_published: p.is_published,
        };
      }
      return null;
    }).filter(Boolean);

    // ── Links ─────────────────────────────────────────────────────────────────
    const profile_links = profiles.length > 0
      ? db.prepare(
          `SELECT pl.label AS title, pl.url, pl.platform, pl.sort_order, pl.is_enabled, pl.created_at,
                  p.display_name AS profile_name
           FROM profile_links pl
           JOIN profiles p ON pl.profile_id = p.id
           WHERE pl.profile_id IN (${profiles.map(() => '?').join(',')})
           ORDER BY p.id, pl.sort_order`
        ).all(profiles.map(p => p.id)) as Record<string, unknown>[]
      : [];

    // ── Subscriptions ─────────────────────────────────────────────────────────
    const subscriptions = db.prepare(`
      SELECT s.id, s.status, s.billing_interval,
             s.current_period_start, s.current_period_end,
             COALESCE(s.cancel_at_period_end, 0) AS cancel_at_period_end,
             s.started_at AS created_at,
             pl.name AS plan_name
      FROM subscriptions s
      LEFT JOIN plans pl ON s.plan_id = pl.id
      WHERE s.user_id = ?
      ORDER BY s.started_at DESC
    `).all(userId) as Record<string, unknown>[];

    // ── Contact enquiries ─────────────────────────────────────────────────────
    let enquiries: Record<string, unknown>[] = [];
    try {
      enquiries = db.prepare(`
        SELECT ce.id, ce.sender_name, ce.sender_email, ce.message, ce.is_read, ce.created_at,
               p.display_name AS profile_name
        FROM contact_enquiries ce
        JOIN profiles p ON ce.profile_id = p.id
        WHERE ce.profile_id IN (SELECT id FROM profiles WHERE user_id = ?)
        ORDER BY ce.created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Reports submitted by user ─────────────────────────────────────────────
    let reports_submitted: Record<string, unknown>[] = [];
    try {
      reports_submitted = db.prepare(`
        SELECT id, report_type, description, status, created_at
        FROM issue_reports WHERE reporter_user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Support requests ──────────────────────────────────────────────────────
    let support_requests: Record<string, unknown>[] = [];
    try {
      support_requests = db.prepare(`
        SELECT id, category, subject, message, status, created_at, updated_at
        FROM support_requests WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Notifications ─────────────────────────────────────────────────────────
    let notifications: Record<string, unknown>[] = [];
    try {
      notifications = db.prepare(`
        SELECT id, type, title, body, is_read, created_at
        FROM notifications WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 200
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Data requests ─────────────────────────────────────────────────────────
    let data_requests: Record<string, unknown>[] = [];
    try {
      data_requests = db.prepare(`
        SELECT id, request_type, description, status, created_at, updated_at, completed_at
        FROM data_requests WHERE user_id = ? ORDER BY created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Closure requests ──────────────────────────────────────────────────────
    let closure_requests: Record<string, unknown>[] = [];
    try {
      closure_requests = db.prepare(`
        SELECT id, reason, status, created_at, updated_at
        FROM account_closure_requests WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Seat memberships ──────────────────────────────────────────────────────
    let seat_memberships: Record<string, unknown>[] = [];
    try {
      seat_memberships = db.prepare(`
        SELECT bs.role, bs.status, bs.created_at,
               p.business_name, p.display_name AS profile_display_name,
               owner.name AS owner_name
        FROM business_seats bs
        JOIN profiles p ON bs.profile_id = p.id
        JOIN users owner ON p.user_id = owner.id
        WHERE bs.user_id = ?
        ORDER BY bs.created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Referral & points ─────────────────────────────────────────────────────
    let referral_code: string | null = null;
    let points_balance = 0;
    let points_history: Record<string, unknown>[] = [];
    try {
      const rc = db.prepare('SELECT code FROM referral_codes WHERE user_id = ?').get(userId) as { code: string } | undefined;
      referral_code = rc?.code ?? null;
    } catch { /* table may not exist */ }
    try {
      const pb = db.prepare('SELECT balance FROM points_balances WHERE user_id = ?').get(userId) as { balance: number } | undefined;
      points_balance = pb?.balance ?? 0;
    } catch { /* table may not exist */ }
    try {
      points_history = db.prepare(
        'SELECT amount, reason, created_at FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
      ).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Email signature (Coming Soon — data stored) ───────────────────────────
    let email_signature_coming_soon: Record<string, unknown> | null = null;
    try {
      email_signature_coming_soon = db.prepare(
        'SELECT template_id, name, job_title, company, phone, email, website, created_at, updated_at FROM email_signatures WHERE user_id = ?'
      ).get(userId) as Record<string, unknown> | null ?? null;
    } catch { /* table may not exist */ }

    // ── Business card orders (Coming Soon — data stored) ─────────────────────
    let business_card_orders_coming_soon: Record<string, unknown>[] = [];
    try {
      business_card_orders_coming_soon = db.prepare(`
        SELECT bco.id, bco.status, bco.quantity, bco.finish, bco.sides,
               bco.created_at, bco.updated_at,
               p.display_name AS profile_name
        FROM business_card_orders bco
        LEFT JOIN profiles p ON bco.profile_id = p.id
        WHERE bco.user_id = ?
        ORDER BY bco.created_at DESC
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table may not exist */ }

    // ── Legacy data (removed features) ───────────────────────────────────────
    let legacy_card_messages: Record<string, unknown>[] = [];
    try {
      legacy_card_messages = db.prepare(`
        SELECT cm.id, cm.thread_id, cm.sender_type, cm.sender_name, cm.message, cm.created_at,
               p.display_name AS profile_name
        FROM card_messages cm
        LEFT JOIN profiles p ON cm.profile_id = p.id
        WHERE cm.profile_id IN (SELECT id FROM profiles WHERE user_id = ?)
        ORDER BY cm.created_at DESC LIMIT 200
      `).all(userId) as Record<string, unknown>[];
    } catch { /* table does not exist — expected */ }

    // ── Log the export ────────────────────────────────────────────────────────
    try {
      db.prepare(`INSERT INTO gdpr_export_log (user_id, ip_address) VALUES (?, ?)`).run(userId, req.ip ?? null);
    } catch { /* non-fatal */ }

    const exportData = {
      _meta: {
        export_generated_at: new Date().toISOString(),
        export_version: '2.0',
        account_id: userId,
        privacy_contact: 'privacy@jagroupservices.co.uk',
        note: 'This file contains all personal data held by Sousa Murray Profiles for your account under UK GDPR. Passwords, PINs, session tokens and internal secrets are never included.',
      },
      account: user,
      consent: {
        marketing_consent: user.marketing_consent, marketing_consent_at: user.marketing_consent_at,
        terms_consent: user.terms_consent, terms_consent_at: user.terms_consent_at,
        privacy_consent: user.privacy_consent, privacy_consent_at: user.privacy_consent_at,
        data_improve_consent: user.data_improve_consent, data_improve_consent_at: user.data_improve_consent_at,
        updates_consent: user.updates_consent, updates_consent_at: user.updates_consent_at,
        crm_consent: user.crm_consent, crm_consent_at: user.crm_consent_at,
        referral_consent: user.referral_consent, referral_consent_at: user.referral_consent_at,
        consent_version: user.consent_version, consent_ip: user.consent_ip,
      },
      subscriptions,
      personal_profiles: profiles.filter(p => p.profile_type === 'personal'),
      business_profiles: profiles.filter(p => p.profile_type === 'business'),
      public_profile_urls,
      profile_links,
      seat_memberships,
      enquiries,
      reports_submitted,
      support_requests,
      notifications,
      data_requests,
      closure_requests,
      referral: { code: referral_code, points_balance, points_history },
      email_signature_coming_soon,
      business_card_orders_coming_soon,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ja-profile-studio-data-export-${userId}-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('[data-export]', err);
    res.status(500).json({ success: false, error: 'Failed to generate data export' });
  }
});

// ── Account closure ────────────────────────────────────────────────────────
app.post("/api/account/closure-request", requireAuth, submitClosureRequest);
app.get("/api/account/closure-request", requireAuth, getClosureRequest);
app.delete("/api/account/closure-request", requireAuth, cancelClosureRequest);
app.get("/api/admin/closure-requests", requireAdminApi, adminListClosureRequests);
app.post("/api/admin/closure-requests/:id/confirm", requireAdminApi, adminConfirmClosure);
app.post("/api/admin/closure-requests/:id/reject", requireAdminApi, adminRejectClosure);

// ── Email Signature Generator ──────────────────────────────────────────────
import { getMySignature, upsertSignature, deleteSignature, logSignatureEvent } from "./api/signatures/index.js";
app.get("/api/signatures/me", requireAuth, getMySignature);
app.post("/api/signatures/me", requireAuth, upsertSignature);
app.put("/api/signatures/me", requireAuth, upsertSignature);
app.delete("/api/signatures/me", requireAuth, deleteSignature);
app.post("/api/signatures/me/audit", requireAuth, logSignatureEvent);

// ── Signature logo/photo image upload ─────────────────────────────────────
app.post("/api/signatures/upload-image", requireAuth, express.raw({ type: 'image/*', limit: '4mb' }), (req: Request, res: Response) => {
  try {
    const ext = (String(req.headers['content-type'] ?? 'image/png').split('/')[1] ?? 'png').replace(/[^a-z]/g, '');
    const slot = String(req.query.slot ?? 'logo').replace(/[^a-z0-9_-]/gi, '_');
    const userId = (req as import('./middleware/auth.js').AuthRequest).user?.id ?? 'anon';
    const filename = `sig_${slot}_${userId}_${Date.now()}.${ext}`;
    const uploadDir = '/shared-storage/public/assets/uploads/signatures';
    mkdirSync(uploadDir, { recursive: true });
    writeFileSync(`${uploadDir}/${filename}`, req.body as Buffer);
    res.json({ success: true, url: `/airo-assets/uploads/signatures/${filename}` });
  } catch (err) {
    console.error('[sig-upload]', err);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// Error middleware must be registered AFTER the routes it protects; Express
// only passes errors to middleware defined later in the stack.
app.use("/api", (err: unknown, req: Request, res: Response, _next: NextFunction) => {
	// Always respond JSON on /api so clients parsing response.json() don't
	// receive Express's default HTML error page for non-Error throws.
	console.error("ssr.api.error", {
		url: req.url,
		error: err instanceof Error ? err.stack : String(err),
	});
	res.status(500).json({ error: "Internal server error" });
});

function baseUrl(req: Request): string {
	const env = process.env.PUBLIC_URL || process.env.SITE_URL;
	if (env) return env.replace(/\/+$/, "");
	return `${req.protocol}://${req.hostname}`;
}

function escapeXml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
	);
}

app.get("/robots.txt", (req, res) => {
	const base = baseUrl(req);
	const body = [
		"# Sousa Murray Profiles — robots.txt",
		"# Public profile pages and marketing pages are indexable.",
		"# All admin, dashboard, auth, and internal pages are blocked.",
		"",
		"User-agent: *",
		"",
		"# Public pages — allow explicitly",
		"Allow: /$",
		"Allow: /profile/",
		"Allow: /legal/",
		"",
		"# Private / internal — block everything else",
		"Disallow: /admin/",
		"Disallow: /dashboard/",
		"Disallow: /api/",
		"Disallow: /conversation/",
		"Disallow: /login",
		"Disallow: /register",
		"Disallow: /logged-out",
		"Disallow: /invite/",
		"Disallow: /report-issue",
		"",
		`Sitemap: ${base}/sitemap.xml`,
		"",
	].join("\n");
	res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(body);
});

app.get("/sitemap.xml", async (req, res) => {
	const base = baseUrl(req);

	// Static routes from seo-routes.ts
	const staticUrls = seoRoutes
		.filter((r) => typeof r.path === "string" && r.path.startsWith("/"))
		.map((r) => {
			const loc = `${base}${r.path}`;
			const parts = [`    <loc>${escapeXml(loc)}</loc>`];
			if (r.lastmod) parts.push(`    <lastmod>${escapeXml(r.lastmod)}</lastmod>`);
			if (r.changefreq) parts.push(`    <changefreq>${r.changefreq}</changefreq>`);
			if (r.priority !== undefined)
				parts.push(`    <priority>${r.priority.toFixed(1)}</priority>`);
			return `  <url>\n${parts.join("\n")}\n  </url>`;
		});

	// Dynamic: public + indexable business pages
	let dynamicUrls: string[] = [];
	try {
		const bizProfiles = await db.prepare(`
			SELECT biz_slug, updated_at
			FROM profiles
			WHERE profile_type = 'business'
			  AND is_published = 1
			  AND allow_indexing = 1
			  AND biz_slug IS NOT NULL
			GROUP BY biz_slug
			ORDER BY biz_slug ASC
		`).all() as { biz_slug: string; updated_at: string | null }[];

		for (const p of bizProfiles) {
			const loc = `${base}/profile/${escapeXml(p.biz_slug)}`;
			const lastmod = p.updated_at ? p.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
			dynamicUrls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
		}

		// Dynamic: public + indexable personal profiles
		const personalProfiles = await db.prepare(`
			SELECT username, updated_at
			FROM profiles
			WHERE profile_type = 'personal'
			  AND is_published = 1
			  AND allow_indexing = 1
			  AND username IS NOT NULL
			ORDER BY username ASC
		`).all() as { username: string; updated_at: string | null }[];

		for (const p of personalProfiles) {
			const loc = `${base}/profile/${escapeXml(p.username)}`;
			const lastmod = p.updated_at ? p.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
			dynamicUrls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
		}
	} catch {
		// DB error — serve static-only sitemap
	}

	const allUrls = [...staticUrls, ...dynamicUrls].join("\n");
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls}\n</urlset>\n`;
	res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(body);
});

// One-time launch URL — no auth, the token IS the credential (opens in new tab)
// Uses /api/ prefix so the dev proxy passes it through to Express
app.get("/api/assisted-access/launch", redeemLaunchToken);

if (import.meta.env.PROD) {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const clientDir = join(__dirname, "client");

	app.use(
		express.static(clientDir, {
			index: false,
			setHeaders(res, filePath) {
				// Service worker: never cache (browser must always check for updates)
				// + Service-Worker-Allowed: / so it can claim the full site scope.
				if (filePath.endsWith('sw.js')) {
					res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
					res.set('Service-Worker-Allowed', '/');
					return;
				}
				res.set(
					"Cache-Control",
					filePath.includes("/assets/")
						? "public, max-age=31536000, immutable"
						: "no-cache",
				);
			},
		}),
	);

	app.use((_req, res, next) => {
		res.set("Cache-Control", "no-cache");
		next();
	});

	let template: string;
	try {
		template = readFileSync(join(clientDir, "index.html"), "utf-8");
	} catch (err) {
		console.error("ssr.template.load-failed", {
			path: join(clientDir, "index.html"),
			error: err instanceof Error ? err.message : String(err),
		});
		process.exit(1);
	}
	if (!template.includes("<!--app-head-->") || !template.includes("<!--app-html-->")) {
		// Fail fast at boot, same as a template load failure above: without
		// markers, every .replace() call on the render path is a no-op and we
		// would serve a shell with no <head> content and no rendered body on
		// every request. Preferring process.exit over a degraded mode ensures
		// an operator notices and fixes the build rather than serving broken
		// SEO-invisible pages indefinitely.
		console.error("ssr.template.markers-missing", {
			hasHead: template.includes("<!--app-head-->"),
			hasHtml: template.includes("<!--app-html-->"),
		});
		process.exit(1);
	}
	const fallbackShell = template
		.replace("<!--app-head-->", "")
		.replace("<!--app-html-->", "");

	// Resolve the SSR module once into a stable render function. A failed
	// load is unrecoverable at runtime - exiting lets the container
	// scheduler restart with a clean slate rather than leaving the server
	// to serve silent 503s indefinitely against a single startup log.
	type RenderResult = {
		html: string;
		head: string;
		status: number;
		redirect?: string;
	};
	let renderFn: ((url: string) => Promise<RenderResult>) | null = null;
	const SSR_MODULE_LOAD_TIMEOUT_MS = 30_000;
	const loadTimeout = setTimeout(() => {
		if (renderFn !== null) return;
		console.error("ssr.module.load-timeout", {
			timeoutMs: SSR_MODULE_LOAD_TIMEOUT_MS,
		});
		process.exit(1);
	}, SSR_MODULE_LOAD_TIMEOUT_MS);
	loadTimeout.unref();
	import("../entry-server").then(
		(mod) => {
			clearTimeout(loadTimeout);
			renderFn = mod.render;
		},
		(err) => {
			clearTimeout(loadTimeout);
			console.error("ssr.module.load-failed", {
				error: err instanceof Error ? err.stack : String(err),
			});
			process.exit(1);
		},
	);

	app.get(/.*/, async (req, res, next) => {
		if (req.method !== "GET") return next();
		if (req.path.startsWith("/api")) return next();
		if (extname(req.path)) return next();
		const sendFallback = () =>
			res
				.status(503)
				.set("Content-Type", "text/html; charset=utf-8")
				.set("Cache-Control", "no-store")
				.send(fallbackShell);
		if (renderFn === null) {
			// Module not yet resolved; fall back without logging to avoid startup
			// noise before the first render is even possible. A terminal load
			// failure (import reject or 30s timeout) process.exit(1)s from the
			// loader above, so this branch is only the brief warmup window.
			return sendFallback();
		}
		try {
			const result = await renderFn(req.url);
			if (result.redirect) {
				// Redirect thrown from a loader/action surfaces as a Response.
				// Forward it so the browser actually navigates to the new URL
				// instead of seeing an empty shell with a stale status.
				res.redirect(result.status, result.redirect);
				return;
			}
			if (!result.html) {
				// A non-redirect Response was thrown from a loader (e.g.
				// `throw new Response(null, { status: 404 })`). renderToString
				// produced no markup, so we have a real status but no body.
				// Log so the case is observable in ops dashboards, and mark
				// no-store so CDNs don't cache an empty page as a valid hit.
				// User-visible 404 / error pages should come from a route
				// errorElement, not from this fallback path.
				console.error("ssr.render.error-response", {
					url: req.url,
					status: result.status,
				});
				res
					.status(result.status)
					.set("Content-Type", "text/html; charset=utf-8")
					.set("Cache-Control", "no-store")
					.send(fallbackShell);
				return;
			}
			// Function replacements disable String.replace's $-special sequences
			// ($&, $', $`, $$) so user-authored titles / JSON-LD like
			// "Save $& today" insert literally instead of being interpolated.
			const nonce: string = res.locals.cspNonce ?? '';

			const out = template
				.replace(/<!--csp-nonce-->/g, nonce)
				.replace("<!--app-head-->", () => result.head)
				.replace("<!--app-html-->", () => result.html);
			res
				.status(result.status)
				.set("Content-Type", "text/html; charset=utf-8")
				.set("Cache-Control", "no-cache")
				.send(out);
		} catch (err) {
			// 503 surfaces the failure in CDN/monitoring without caching a broken
			// page as success. console.error (not warn) puts it at the right log
			// level for the observability pipeline to alert on.
			console.error("ssr.render.failed", {
				url: req.url,
				// Log the full stack — React's renderToString annotates it with
				// the failing component's call tree, which the message alone
				// discards.
				error: err instanceof Error ? err.stack : String(err),
			});
			sendFallback();
		}
	});

	const shutdown = async (signal: string) => {
		console.log(`Got ${signal}, shutting down gracefully...`);
		// Scope the ERR_MODULE_NOT_FOUND suppression to the import() only.
		// A closeConnection() failure that happens to carry the same code
		// (unlikely but possible for wrapped errors) must not be silently
		// swallowed - it indicates a real db-close failure worth logging.
		let mod: { closeConnection?: () => Promise<void> | void } | null = null;
		try {
			// Use an indirect dynamic import so Rollup cannot statically resolve
			// the specifier and attempt to bundle ./db/client.js (which only exists
			// at runtime inside the SSR bundle, not during the client build).
			const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<unknown>;
			mod = await dynamicImport('./db/client.js') as { closeConnection?: () => Promise<void> | void };
		} catch (error: unknown) {
			const code = (error as { code?: string } | null)?.code;
			if (code !== "ERR_MODULE_NOT_FOUND") {
				console.error("ssr.shutdown.db-import-failed", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		if (mod && typeof mod.closeConnection === "function") {
			try {
				await mod.closeConnection();
				console.log("Database connections closed");
			} catch (error: unknown) {
				console.error("ssr.shutdown.db-close-failed", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		process.exit(0);
	};

	(["SIGTERM", "SIGINT"] as const).forEach((signal) => {
		process.once(signal, () => {
			void shutdown(signal);
		});
	});

	const rawPort = process.env.PORT || "3000";
	const port = parseInt(rawPort, 10);
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		// parseInt("abc") returns NaN; passing that to app.listen throws
		// synchronously before the server.on("error") handler below can catch
		// it. Fail fast with an actionable log rather than a cryptic crash.
		console.error("ssr.server.invalid-port", { rawPort });
		process.exit(1);
	}
	const host = process.env.HOST || "0.0.0.0";

	const server = app.listen(port, host, () => {
		console.log(`Server listening on http://${host}:${port}`);
	});
	server.on("error", (err: NodeJS.ErrnoException) => {
		console.error("ssr.server.listen-failed", {
			port,
			host,
			code: err.code,
			error: err.message,
		});
		process.exit(1);
	});
}

export default app;

// ── Testable utilities ────────────────────────────────────────────────────────

/**
 * Replaces the SSR placeholder markers in an HTML template string.
 * Exported so unit tests can exercise the substitution logic in isolation.
 */
export function renderSsrDocument(
  template: string,
  result: { head: string; html: string },
  adsense: { scriptHtml: string },
): string {
  const headContent = adsense.scriptHtml
    ? `${result.head}\n${adsense.scriptHtml}`
    : result.head;
  return template
    .replace('<!--app-head-->', () => headContent)
    .replace('<!--app-html-->', () => result.html);
}

interface AdSenseConfig {
  publisherId: string | null;
  scriptHtml: string;
  adsTxt: string | null;
  appAdsTxt: string | null;
}

/**
 * Registers /ads.txt and /app-ads.txt routes on an Express app.
 * Exported so unit tests can exercise the route logic in isolation.
 */
export function registerAdSenseTextRoutes(
  expressApp: import('express').Express,
  config: AdSenseConfig,
): void {
  expressApp.get('/ads.txt', (_req, res) => {
    res.set('Content-Type', 'text/plain').set('Cache-Control', 'no-cache');
    if (config.adsTxt) return res.status(200).send(config.adsTxt);
    return res.status(404).send('');
  });
  expressApp.get('/app-ads.txt', (_req, res) => {
    res.set('Content-Type', 'text/plain').set('Cache-Control', 'no-cache');
    if (config.appAdsTxt) return res.status(200).send(config.appAdsTxt);
    return res.status(404).send('');
  });
}
