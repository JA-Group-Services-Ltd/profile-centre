import { beginOidc, completeOidc, logout } from "./_shared/auth.js";
import { errorResponse, methodNotAllowed, withRequestId } from "./_shared/http.js";
import { handleAdminPlanApiRequest } from "./_shared/admin-plan-routes.js";
import { handleCustomDomainApiRequest } from "./_shared/custom-domain-routes.js";
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
