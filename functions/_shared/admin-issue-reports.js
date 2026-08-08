import { HttpError } from "./http.js";
import { writeAudit } from "./audit.js";
import { ensureProfileInteractionSchema } from "./profile-interactions.js";

const STATUSES = new Set(["new", "in_review", "action_taken", "resolved", "dismissed", "escalated"]);

export async function listAdminIssueReports(database) {
  await ensureProfileInteractionSchema(database);
  const result = await database.prepare(`
    SELECT r.*,
           p.username AS reported_username,
           p.display_name AS reported_profile_name,
           p.is_published AS reported_profile_published,
           p.is_verified AS reported_profile_verified,
           u.name AS reported_user_name,
           u.email AS reported_user_email,
           u.customer_number AS reported_customer_number,
           u.account_status AS reported_user_status
    FROM issue_reports r
    LEFT JOIN profiles p ON p.id=r.reported_profile_id
    LEFT JOIN users u ON u.id=COALESCE(r.reported_user_id,p.user_id)
    ORDER BY
      CASE r.status WHEN 'new' THEN 0 WHEN 'escalated' THEN 1 WHEN 'in_review' THEN 2 WHEN 'action_taken' THEN 3 ELSE 4 END,
      datetime(r.created_at) DESC,
      r.id DESC
    LIMIT 2000
  `).all();
  return { success: true, data: result.results || [] };
}

export async function getAdminIssueReport(database, reportId) {
  await ensureProfileInteractionSchema(database);
  const report = await database.prepare(`
    SELECT r.*,p.username AS reported_username,p.display_name AS reported_profile_name,
           p.is_published AS reported_profile_published,p.is_verified AS reported_profile_verified,
           u.name AS reported_user_name,u.email AS reported_user_email,u.customer_number AS reported_customer_number,
           u.account_status AS reported_user_status
    FROM issue_reports r
    LEFT JOIN profiles p ON p.id=r.reported_profile_id
    LEFT JOIN users u ON u.id=COALESCE(r.reported_user_id,p.user_id)
    WHERE r.id=?1 LIMIT 1
  `).bind(reportId).first();
  if (!report) throw new HttpError(404, "Issue report not found.", "issue_report_not_found");
  return { success: true, data: report };
}

export async function updateAdminIssueReport(request, database, admin, reportId, body = {}) {
  await ensureProfileInteractionSchema(database);
  const current = await database.prepare("SELECT id,status FROM issue_reports WHERE id=?1 LIMIT 1").bind(reportId).first();
  if (!current) throw new HttpError(404, "Issue report not found.", "issue_report_not_found");
  const status = String(body.status || current.status || "new").trim().toLowerCase();
  if (!STATUSES.has(status)) throw new HttpError(400, "Unsupported issue report status.", "validation_error");
  const notes = body.resolution_notes == null ? null : String(body.resolution_notes).trim().slice(0, 5000);
  const assignedTo = body.assigned_to == null ? null : String(body.assigned_to).trim().slice(0, 200);
  await database.prepare(`
    UPDATE issue_reports SET status=?1,
      resolution_notes=COALESCE(?2,resolution_notes),
      assigned_to=COALESCE(?3,assigned_to),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?4
  `).bind(status, notes, assignedTo, reportId).run();
  await writeAudit(database, request, admin, "issue_report_update", "issue_report", `Updated issue report ${reportId} to ${status}`);
  return getAdminIssueReport(database, reportId);
}

export async function performIssueReportAction(request, database, admin, reportId, action) {
  const normalised = String(action || "").trim().toLowerCase();
  const map = {
    review: "in_review",
    investigate: "in_review",
    resolve: "resolved",
    dismiss: "dismissed",
    escalate: "escalated",
    action: "action_taken",
  };
  if (normalised === "scan") {
    const report = await getAdminIssueReport(database, reportId);
    const data = report.data;
    const signals = [];
    if (String(data.report_reason || "").includes("impersonation")) signals.push("Impersonation allegation requires identity review.");
    if (String(data.report_reason || "").includes("illegal")) signals.push("Potentially illegal-content allegation requires priority human review.");
    if (Number(data.reported_profile_published) === 0) signals.push("Reported profile is currently unpublished.");
    return {
      success: true,
      data: {
        status: "completed",
        scanner: "local-policy-triage",
        automatedDecision: false,
        findings: signals,
        message: signals.length
          ? "Local policy triage found items for human review."
          : "No additional deterministic risk signals were found. Human review is still required.",
      },
    };
  }
  const status = map[normalised];
  if (!status) throw new HttpError(400, "Unsupported issue report action.", "validation_error");
  return updateAdminIssueReport(request, database, admin, reportId, { status });
}

export async function deleteAdminIssueReport(request, database, admin, reportId) {
  const existing = await database.prepare("SELECT id FROM issue_reports WHERE id=?1 LIMIT 1").bind(reportId).first();
  if (!existing) throw new HttpError(404, "Issue report not found.", "issue_report_not_found");
  await writeAudit(database, request, admin, "issue_report_delete", "issue_report", `Deleted issue report ${reportId}`);
  await database.prepare("DELETE FROM issue_reports WHERE id=?1").bind(reportId).run();
  return { success: true };
}
