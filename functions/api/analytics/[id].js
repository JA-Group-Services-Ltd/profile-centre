import { requireUser } from "../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../_shared/http.js";
import { getProfileAnalytics } from "../../_shared/profile-interactions.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { user } = await requireUser(context.request, context.env.DB, context.env);
    const profileId = Number(context.params.id);
    if (!Number.isInteger(profileId) || profileId < 1) {
      return withRequestId(json({ success: false, error: "Profile not found.", code: "profile_not_found", requestId }, 404), requestId);
    }
    const days = Number(new URL(context.request.url).searchParams.get("days") || 30);
    const result = await getProfileAnalytics(context.env.DB, user, profileId, days);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
