import { errorResponse, json, methodNotAllowed, withRequestId } from "../../../_shared/http.js";
import { recordLinkClick } from "../../../_shared/profile-interactions.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "POST") {
      return withRequestId(methodNotAllowed(["POST"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const linkId = Number(context.params.id);
    if (!Number.isInteger(linkId) || linkId < 1) {
      return withRequestId(json({ success: false, error: "Link not found.", code: "link_not_found", requestId }, 404), requestId);
    }
    const result = await recordLinkClick(context.request, context.env, linkId);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
