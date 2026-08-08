import { requireAdmin } from "./auth.js";
import { issueAdminPinChallenge } from "./admin-pin-challenge.js";
import { grantLifetime, getLifetimeLog, revokeLifetime } from "./admin-lifetime.js";
import {
  assignPlan,
  endTrial,
  extendTrial,
  listSubscriptions,
  moveToFree,
  moveToNoPlan,
  setAccountStatus,
  togglePlanPublic,
} from "./admin-plan-actions.js";
import { optionalJson, positiveInteger } from "./admin-plan-utils.js";
import { errorResponse, HttpError, json, methodNotAllowed, readJson, withRequestId } from "./http.js";

const USER_ROUTE = /^\/api\/admin\/users\/(\d+)\/(lifetime|lifetime-log|trial\/extend|trial\/end|move-to-no-plan|move-to-free|assign-plan|remove-plan|account-status)$/;
const TOGGLE_ROUTE = /^\/api\/admin\/plans\/(\d+)\/toggle-public$/;

function isHandled(pathname) {
  return pathname === "/api/admin/pin/challenge"
    || pathname === "/api/admin/subscriptions"
    || USER_ROUTE.test(pathname)
    || TOGGLE_ROUTE.test(pathname);
}

async function dispatch(context, requestId) {
  const pathname = new URL(context.request.url).pathname;
  if (!isHandled(pathname)) return null;
  if (!context.env.DB) throw new HttpError(503, "D1 binding DB is not configured.", "database_not_configured");

  const { session, user: admin } = await requireAdmin(context.request, context.env.DB);
  const method = context.request.method.toUpperCase();

  if (pathname === "/api/admin/pin/challenge") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    const body = await readJson(context.request, 16_384);
    return json(await issueAdminPinChallenge(context.request, context.env.DB, session, admin, body));
  }

  if (pathname === "/api/admin/subscriptions") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await listSubscriptions(context.env.DB));
  }

  const toggleMatch = pathname.match(TOGGLE_ROUTE);
  if (toggleMatch) {
    if (!["PUT", "PATCH"].includes(method)) return methodNotAllowed(["PUT", "PATCH"], requestId);
    return json(await togglePlanPublic(
      context,
      admin,
      positiveInteger(toggleMatch[1], "plan ID"),
      await optionalJson(context.request),
    ));
  }

  const match = pathname.match(USER_ROUTE);
  if (!match) return null;
  const userId = positiveInteger(match[1], "user ID");
  const action = match[2];

  if (action === "lifetime-log") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getLifetimeLog(context.env.DB, userId));
  }

  const body = await optionalJson(context.request);
  if (action === "lifetime") {
    if (method === "POST") return json(await grantLifetime(context, admin, userId, body));
    if (method === "DELETE") return json(await revokeLifetime(context, admin, userId, body));
    return methodNotAllowed(["POST", "DELETE"], requestId);
  }
  if (action === "assign-plan") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    return json(await assignPlan(context, admin, userId, body));
  }
  if (action === "move-to-free") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    return json(await moveToFree(context, admin, userId, body));
  }
  if (action === "move-to-no-plan") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    return json(await moveToNoPlan(context, admin, userId, body));
  }
  if (action === "remove-plan") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    return json(await moveToNoPlan(context, admin, userId, body, "admin_removed_plan"));
  }
  if (action === "trial/extend") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    return json(await extendTrial(context, admin, userId, body));
  }
  if (action === "trial/end") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    return json(await endTrial(context, admin, userId, body));
  }
  if (action === "account-status") {
    if (method !== "PATCH") return methodNotAllowed(["PATCH"], requestId);
    return json(await setAccountStatus(context, admin, userId, body));
  }

  return null;
}

export async function handleAdminPlanApiRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (!isHandled(pathname)) return null;
  const requestId = crypto.randomUUID();
  try {
    const response = await dispatch(context, requestId);
    return response ? withRequestId(response, requestId) : null;
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
