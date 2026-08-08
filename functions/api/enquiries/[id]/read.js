import { requireUser } from "../../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../../_shared/http.js";
import { markCustomerEnquiryRead } from "../../../_shared/profile-interactions.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "POST") {
      return withRequestId(methodNotAllowed(["POST"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { user } = await requireUser(context.request, context.env.DB, context.env);
    const enquiryId = Number(context.params.id);
    if (!Number.isInteger(enquiryId) || enquiryId < 1) {
      return withRequestId(json({ success: false, error: "Enquiry not found.", code: "enquiry_not_found", requestId }, 404), requestId);
    }
    const result = await markCustomerEnquiryRead(context.env.DB, user, enquiryId);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
