import { requireAdmin } from "../../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../../_shared/http.js";
import { saveLegalPolicy } from "../../../_shared/legal-policies.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    const method = context.request.method.toUpperCase();
    if (!["PUT", "PATCH"].includes(method)) {
      return withRequestId(methodNotAllowed(["PUT", "PATCH"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { user: admin } = await requireAdmin(context.request, context.env.DB);
    const data = await saveLegalPolicy(context.request, context.env.DB, admin, context.params.key);
    return withRequestId(json({ success: true, data }), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
