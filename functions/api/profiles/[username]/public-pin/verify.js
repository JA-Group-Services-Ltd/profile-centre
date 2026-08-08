import { errorResponse, json, methodNotAllowed, readJson, withRequestId } from "../../../../_shared/http.js";
import { verifyPublicProfilePin } from "../../../../_shared/public-profile-pin.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "POST") {
      return withRequestId(methodNotAllowed(["POST"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const body = await readJson(context.request, 8_192);
    const result = await verifyPublicProfilePin(
      context.request,
      context.env.DB,
      context.params.username,
      body.pin,
    );
    const headers = result.cookie ? { "set-cookie": result.cookie } : {};
    return withRequestId(json({ success: true, verified: true }, 200, headers), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
