import { beginOidc, completeOidc, logout } from "./_shared/auth.js";
import { errorResponse, methodNotAllowed, withRequestId } from "./_shared/http.js";
import { handleAdminPlanApiRequest } from "./_shared/admin-plan-routes.js";
import { handleCustomDomainApiRequest } from "./_shared/custom-domain-routes.js";
import { ensureCustomDomainPlanPolicy } from "./_shared/custom-domain-policy.js";
import { handleCurrentUserApiRequest } from "./_shared/current-user-route.js";
import { ensureHeadOfficeEventOutbox } from "./_shared/head-office-schema.js";
import { handleApiRequest } from "./_shared/router.js";

const AUTH_ROUTES = new Map([
  ["/auth/login", { action: "begin", flow: "customer", methods: ["GET"] }],
  ["/auth/callback", { action: "complete", flow: "customer", methods: ["GET"] }],
  ["/auth/logout", { action: "logout", flow: "customer", methods: ["GET", "POST"] }],
  ["/admin/auth/start", { action: "begin", flow: "admin", methods: ["GET"] }],
  ["/admin/auth/callback", { action: "complete", flow: "admin", methods: ["GET"] }],
  ["/admin/logout", { action: "logout", flow: "admin", methods: ["GET", "POST"] }],
]);

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    // Operational events are best-effort, but their local queue must exist before
    // any API action (profile saves, sign-ins, security actions, etc.) can emit one.
    // Pages deployments do not automatically run D1 migrations, so repair it here.
    if (context.env.DB) await ensureHeadOfficeEventOutbox(context.env.DB);

    // Keep plan entitlement flags and the approved one-time price update in D1 aligned
    // before either the public or Admin plan catalogue is read or changed.
    if (
      context.env.DB
      && (pathname === "/api/plans" || pathname === "/api/admin/plans" || pathname.startsWith("/api/admin/plans/"))
    ) {
      await ensureCustomDomainPlanPolicy(context.env.DB);
    }

    // Cloudflare is the production backend. Serve the same computed entitlement
    // contract the dashboard was originally built against instead of a raw users row.
    const currentUserResponse = await handleCurrentUserApiRequest(context);
    if (currentUserResponse) return currentUserResponse;

    const customDomainResponse = await handleCustomDomainApiRequest(context);
    if (customDomainResponse) return customDomainResponse;
    const adminPlanResponse = await handleAdminPlanApiRequest(context);
    if (adminPlanResponse) return adminPlanResponse;
    return handleApiRequest(context);
  }
  const route = AUTH_ROUTES.get(pathname);
  if (!route) return context.next();

  const requestId = crypto.randomUUID();
  if (!route.methods.includes(context.request.method.toUpperCase())) {
    return withRequestId(methodNotAllowed(route.methods, requestId), requestId);
  }
  try {
    let response;
    if (route.action === "begin") response = await beginOidc(context.request, context.env, route.flow);
    if (route.action === "complete") response = await completeOidc(context.request, context.env, route.flow);
    if (route.action === "logout") response = await logout(context.request, context.env, route.flow);
    return withRequestId(response, requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
