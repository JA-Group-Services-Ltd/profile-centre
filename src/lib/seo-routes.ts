/**
 * Auto-synced registry of publicly-crawlable routes. Consumed by the
 * /sitemap.xml handler in src/server/entry.ts.
 *
 * DO NOT add or remove paths by hand. Static paths are mirrored here from
 * src/routes.tsx automatically whenever that file is edited (any manual
 * path edit would be overwritten on the next routes.tsx change). For sync
 * to pick up a route, its `path` must be a literal string starting with "/";
 * template literals and identifier refs are skipped, and dynamic-param routes
 * like "/products/:id" are excluded.
 *
 * The only fields safe to hand-edit are the per-entry metadata below, after a
 * sync:
 * - `priority` (0.0–1.0): Home = 1.0, main sections = 0.8, deep pages = 0.5.
 * - `changefreq` and `lastmod`.
 */

export interface SeoRoute {
  path: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
  lastmod?: string;
}

export const seoRoutes: SeoRoute[] = [
  { path: "/", changefreq: "weekly", priority: 1.0, lastmod: "2026-07-07" },
  { path: "/login", changefreq: "monthly", priority: 0.8 },
  { path: "/register", changefreq: "monthly", priority: 0.8 },
  { path: "/logged-out", changefreq: "monthly", priority: 0.8 },
  { path: "/admin/logged-out", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/login", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard", changefreq: "monthly", priority: 0.8 },
  { path: "/dashboard/overview", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/profile", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/links", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/qr-code", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/poster", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/enquiries", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/analytics", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/themes", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/billing", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/settings", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/security", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/account", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/organisation-profile", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/organisation-seats", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/business-profile", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/business-seats", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/data-requests", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/account-closure", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/email-signature", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/seat-invites", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/service-communications", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/notification-preferences", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/notifications", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/help-centre", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/support-tickets", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/business-cards", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/site-editor", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/whatsapp", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/gallery", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/menu", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/pdf-attachments", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/social-links", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/messages", changefreq: "monthly", priority: 0.5 },
  { path: "/dashboard/demo", changefreq: "monthly", priority: 0.5 },
  { path: "/admin", changefreq: "monthly", priority: 0.8 },
  { path: "/admin/users", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/profiles", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/enquiries", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/plans", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/analytics", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/audit", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/settings", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/notifications", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/verify-customer", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/legal", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/homepage", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/authority-report", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/support-requests", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/issue-reports", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/crm", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/data-requests", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/closure-requests", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/admin-accounts", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/business-cards", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/features", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/assisted-access", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/compose-email", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/addons", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/messaging", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/affiliates", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/referrals", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/partner-enquiries", changefreq: "monthly", priority: 0.5 },
  { path: "/legal", changefreq: "monthly", priority: 0.5, lastmod: "2026-07-07" },
  { path: "/legal/privacy", changefreq: "monthly", priority: 0.5, lastmod: "2026-07-07" },
  { path: "/legal/terms", changefreq: "monthly", priority: 0.5, lastmod: "2026-07-07" },
  { path: "/legal/cookies", changefreq: "monthly", priority: 0.4, lastmod: "2026-07-07" },
  { path: "/legal/acceptable-use", changefreq: "monthly", priority: 0.4, lastmod: "2026-07-07" },
  { path: "/legal/refunds", changefreq: "monthly", priority: 0.4, lastmod: "2026-07-07" },
  { path: "/legal/complaints", changefreq: "monthly", priority: 0.4, lastmod: "2026-07-07" },
  { path: "/legal/accessibility", changefreq: "monthly", priority: 0.4, lastmod: "2026-07-07" },
  { path: "/legal/service-status", changefreq: "daily", priority: 0.5, lastmod: "2026-07-07" },
  { path: "/status", changefreq: "monthly", priority: 0.8 },
  { path: "/legal/eligibility", changefreq: "monthly", priority: 0.5 },
  { path: "/legal/data-retention", changefreq: "monthly", priority: 0.5 },
  { path: "/legal/reporting", changefreq: "monthly", priority: 0.5 },
  { path: "/legal/reporting-moderation", changefreq: "monthly", priority: 0.5 },
  { path: "/legal/security", changefreq: "monthly", priority: 0.5 },
  { path: "/legal/data-rights", changefreq: "monthly", priority: 0.5 },
  { path: "/support", changefreq: "monthly", priority: 0.8 },
  { path: "/report-issue", changefreq: "monthly", priority: 0.8 },
  { path: "/help", changefreq: "weekly", priority: 0.8, lastmod: "2026-07-07" },
  { path: "/services", changefreq: "monthly", priority: 0.7, lastmod: "2026-07-07" },
  { path: "/partners", changefreq: "monthly", priority: 0.8 },
  { path: "/affiliates", changefreq: "monthly", priority: 0.8 },
  { path: "/partner-enquiries", changefreq: "monthly", priority: 0.8 },
  { path: "/partnership", changefreq: "monthly", priority: 0.8 },
  { path: "/become-a-partner", changefreq: "monthly", priority: 0.8 },
  { path: "/coming-soon", changefreq: "monthly", priority: 0.8 },
  { path: "/team-directory", changefreq: "monthly", priority: 0.8 },
  { path: "/services/ja-profile-studio", changefreq: "monthly", priority: 0.5 },
];
