import { requireAdmin } from "../../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, readJson, withRequestId } from "../../../_shared/http.js";
import { deleteAdminIssueReport, getAdminIssueReport, updateAdminIssueReport } from "../../../_shared/admin-issue-reports.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { admin } = await requireAdmin(context.request, context.env.DB, context.env);
    const reportId = Number(context.params.id);
    if (!Number.isInteger(reportId) || reportId < 1) {
      return withRequestId(json({ success: false, error: "Issue report not found.", code: "issue_report_not_found", requestId }, 404), requestId);
    }
    const method = context.request.method.toUpperCase();
    if (method === "GET") return withRequestId(json(await getAdminIssueReport(context.env.DB, reportId)), requestId);
    if (["PATCH", "PUT"].includes(method)) {
      const body = await readJson(context.request, 16_384);
      return withRequestId(json(await updateAdminIssueReport(context.request, context.env.DB, admin, reportId, body)), requestId);
    }
    if (method === "DELETE") return withRequestId(json(await deleteAdminIssueReport(context.request, context.env.DB, admin, reportId)), requestId);
    return withRequestId(methodNotAllowed(["GET", "PATCH", "PUT", "DELETE"], requestId), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
