import { requireUser } from "./auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "./http.js";
import { getCurrentUserAccess } from "./current-user-access.js";

export async function handleCurrentUserApiRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname !== "/api/auth/me") return null;

  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) {
      return withRequestId(json({ success: false, error: "D1 binding DB is not configured." }, 503), requestId);
    }

    const { session, user } = await requireUser(context.request, context.env.DB, context.env);
    const current = await getCurrentUserAccess(context.env.DB, user.id, session?.data ?? {});
    if (!current) {
      return withRequestId(json({ success: false, error: "User not found." }, 401), requestId);
    }
    return withRequestId(json({ success: true, data: { user: current } }), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
