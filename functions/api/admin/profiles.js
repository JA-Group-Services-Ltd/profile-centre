import { requireAdmin } from "../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../_shared/http.js";
import { listAdminProfiles } from "../../_shared/admin-profile-operations.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    await requireAdmin(context.request, context.env.DB, context.env);
    const result = await listAdminProfiles(context.env.DB);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
