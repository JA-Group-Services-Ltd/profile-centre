import { logout } from "../_shared/auth.js";
import { errorResponse, withRequestId } from "../_shared/http.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    return withRequestId(await logout(context.request, context.env, "customer"), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}

