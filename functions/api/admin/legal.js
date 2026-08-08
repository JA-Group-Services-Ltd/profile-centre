import { requireAdmin } from "../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../_shared/http.js";
import { getLegalPolicyAdminCollection } from "../../_shared/legal-policies.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    await requireAdmin(context.request, context.env.DB);
    const data = await getLegalPolicyAdminCollection(context.env.DB);
    return withRequestId(json({ success: true, data }), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
