import { requireAdmin } from "../../../../_shared/auth.js";
import { errorResponse, json, methodNotAllowed, readJson, withRequestId } from "../../../../_shared/http.js";
import { performIssueReportAction, updateAdminIssueReport } from "../../../../_shared/admin-issue-reports.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (!["POST", "PATCH"].includes(context.request.method.toUpperCase())) {
      return withRequestId(methodNotAllowed(["POST", "PATCH"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");
    const { admin } = await requireAdmin(context.request, context.env.DB, context.env);
    const reportId = Number(context.params.id);
    if (!Number.isInteger(reportId) || reportId < 1) {
      return withRequestId(json({ success: false, error: "Issue report not found.", code: "issue_report_not_found", requestId }, 404), requestId);
    }
    const body = await readJson(context.request, 8_192);
    const action = String(body.action || "").trim().toLowerCase();
    if (action === "assign") {
      const result = await updateAdminIssueReport(context.request, context.env.DB, admin, reportId, {
        assigned_to: body.assigned_to ?? body.assignee ?? body.assignedTo,
        status: body.status || "in_review",
      });
      return withRequestId(json(result), requestId);
    }
    if (action === "status") {
      const result = await updateAdminIssueReport(context.request, context.env.DB, admin, reportId, body);
      return withRequestId(json(result), requestId);
    }
    const result = await performIssueReportAction(context.request, context.env.DB, admin, reportId, action);
    return withRequestId(json(result), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
