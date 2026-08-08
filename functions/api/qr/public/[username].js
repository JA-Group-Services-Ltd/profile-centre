import { errorResponse, json, methodNotAllowed, withRequestId } from "../../../_shared/http.js";
import { createPublicProfileQr } from "../../../_shared/profile-interactions.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const result = await createPublicProfileQr(context.request, context.env, context.params.username);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
