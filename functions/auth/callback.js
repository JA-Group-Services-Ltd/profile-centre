import { completeOidc } from "../_shared/auth.js";
import { errorResponse, withRequestId } from "../_shared/http.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    return withRequestId(await completeOidc(context.request, context.env, "customer"), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}

