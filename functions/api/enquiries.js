import { requireUser } from "../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../_shared/http.js";
import { listCustomerEnquiries } from "../_shared/profile-interactions.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { user } = await requireUser(context.request, context.env.DB, context.env);
    const result = await listCustomerEnquiries(context.env.DB, user);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
