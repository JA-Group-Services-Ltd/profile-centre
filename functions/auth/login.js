import { beginOidc } from "../_shared/auth.js";
import { errorResponse, withRequestId } from "../_shared/http.js";

export async function onRequestGet(context) {
  const requestId = crypto.randomUUID();
  try {
    return withRequestId(await beginOidc(context.request, context.env, "customer"), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}

