import { errorResponse, json, methodNotAllowed, readJson, withRequestId } from "../../../_shared/http.js";
import { createProfileReport } from "../../../_shared/profile-interactions.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "POST") {
      return withRequestId(methodNotAllowed(["POST"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const body = await readJson(context.request, 16_384);
    const result = await createProfileReport(context.request, context.env, context.params.username, body);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
