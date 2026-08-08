import { requireAdmin } from "../../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../../_shared/http.js";
import { deleteAdminProfile, getAdminProfile } from "../../../_shared/admin-profile-operations.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { admin } = await requireAdmin(context.request, context.env.DB, context.env);
    const profileId = Number(context.params.id);
    if (!Number.isInteger(profileId) || profileId < 1) {
      return withRequestId(json({ success: false, error: "Profile not found.", code: "profile_not_found", requestId }, 404), requestId);
    }
    const method = context.request.method.toUpperCase();
    if (method === "GET") return withRequestId(json(await getAdminProfile(context.env.DB, profileId)), requestId);
    if (method === "DELETE") return withRequestId(json(await deleteAdminProfile(context.request, context.env.DB, admin, profileId)), requestId);
    return withRequestId(methodNotAllowed(["GET", "DELETE"], requestId), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
