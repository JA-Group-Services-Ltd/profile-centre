import { requireAdmin, requireUser } from "./auth.js";
import { errorResponse, json, methodNotAllowed, readJson, withRequestId } from "./http.js";
import {
  createCustomerCustomDomain,
  disconnectAdminCustomDomain,
  disconnectCustomerCustomDomain,
  listAdminUserCustomDomains,
  listCustomerCustomDomains,
  refreshAdminCustomDomain,
  refreshCustomerCustomDomain,
  resolvePublicCustomDomain,
} from "./custom-domains.js";

const CUSTOMER_ITEM = /^\/api\/custom-domains\/(\d+)$/;
const CUSTOMER_CHECK = /^\/api\/custom-domains\/(\d+)\/check$/;
const ADMIN_LIST = /^\/api\/admin\/users\/(\d+)\/custom-domains$/;
const ADMIN_ITEM = /^\/api\/admin\/users\/(\d+)\/custom-domains\/(\d+)$/;
const ADMIN_CHECK = /^\/api\/admin\/users\/(\d+)\/custom-domains\/(\d+)\/check$/;

function handled(pathname) {
  return pathname === "/api/custom-domains"
    || pathname === "/api/custom-domains/resolve"
    || CUSTOMER_ITEM.test(pathname)
    || CUSTOMER_CHECK.test(pathname)
    || ADMIN_LIST.test(pathname)
    || ADMIN_ITEM.test(pathname)
    || ADMIN_CHECK.test(pathname);
}

async function dispatch(context, requestId) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const method = context.request.method.toUpperCase();
  const database = context.env.DB;

  if (!database) return json({ success: false, error: "D1 binding DB is not configured." }, 503);

  // Public, read-only resolver used by the custom-domain root experience.
  // It returns only routing identifiers for active/published profiles.
  if (pathname === "/api/custom-domains/resolve") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await resolvePublicCustomDomain(database, url.searchParams.get("hostname") ?? ""));
  }

  if (pathname === "/api/custom-domains") {
    const { user } = await requireUser(context.request, database, context.env);
    if (method === "GET") return json(await listCustomerCustomDomains(database, user.id));
    if (method === "POST") {
      return json(await createCustomerCustomDomain(context, user, await readJson(context.request, 16_384)), 201);
    }
    return methodNotAllowed(["GET", "POST"], requestId);
  }

  const customerCheck = pathname.match(CUSTOMER_CHECK);
  if (customerCheck) {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    const { user } = await requireUser(context.request, database, context.env);
    return json(await refreshCustomerCustomDomain(context, user, customerCheck[1]));
  }

  const customerItem = pathname.match(CUSTOMER_ITEM);
  if (customerItem) {
    if (method !== "DELETE") return methodNotAllowed(["DELETE"], requestId);
    const { user } = await requireUser(context.request, database, context.env);
    return json(await disconnectCustomerCustomDomain(context, user, customerItem[1]));
  }

  const adminList = pathname.match(ADMIN_LIST);
  if (adminList) {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    await requireAdmin(context.request, database);
    return json(await listAdminUserCustomDomains(database, adminList[1]));
  }

  const adminCheck = pathname.match(ADMIN_CHECK);
  if (adminCheck) {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    const { user: admin } = await requireAdmin(context.request, database);
    return json(await refreshAdminCustomDomain(context, admin, adminCheck[1], adminCheck[2]));
  }

  const adminItem = pathname.match(ADMIN_ITEM);
  if (adminItem) {
    if (method !== "DELETE") return methodNotAllowed(["DELETE"], requestId);
    const { user: admin } = await requireAdmin(context.request, database);
    const body = await readJson(context.request, 16_384).catch(() => ({}));
    return json(await disconnectAdminCustomDomain(context, admin, adminItem[1], adminItem[2], body?.reason ?? ""));
  }

  return null;
}

export async function handleCustomDomainApiRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (!handled(pathname)) return null;
  const requestId = crypto.randomUUID();
  try {
    const response = await dispatch(context, requestId);
    return response ? withRequestId(response, requestId) : null;
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
