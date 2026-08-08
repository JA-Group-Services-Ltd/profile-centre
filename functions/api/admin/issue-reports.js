import { requireAdmin } from "../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, withRequestId } from "../../_shared/http.js";
import { listAdminIssueReports } from "../../_shared/admin-issue-reports.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    await requireAdmin(context.request, context.env.DB, context.env);
    return withRequestId(json(await listAdminIssueReports(context.env.DB)), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
