import { requireUser } from "../../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, readJson, withRequestId } from "../../../_shared/http.js";
import { setPublicProfileEnquiry } from "../../../_shared/public-profile-pin.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "PATCH") {
      return withRequestId(methodNotAllowed(["PATCH"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { user } = await requireUser(context.request, context.env.DB, context.env);
    const profileId = Number(context.params.id);
    if (!Number.isInteger(profileId) || profileId < 1) {
      return withRequestId(json({ success: false, error: "Profile not found.", code: "profile_not_found", requestId }, 404), requestId);
    }
    const body = await readJson(context.request, 8_192);
    const result = await setPublicProfileEnquiry(context.env.DB, user, profileId, body.enabled);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
