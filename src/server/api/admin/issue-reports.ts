/**
 * Admin — Issue Reports API
 * GET  /api/admin/issue-reports        — list all (with profile owner details for profile_report type)
 * PATCH /api/admin/issue-reports/:id   — update status / notes
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';

export async function getIssueReports(_req: Request, res: Response) {
  // Fetch all issue reports, joining profile and user info for profile_report types
  const rows = db.prepare(`
    SELECT
      ir.id,
      ir.name,
      ir.email,
      ir.issue_type,
      ir.subject,
      ir.description,
      ir.page_url,
      ir.status,
      ir.admin_notes,
      ir.created_at,
      ir.updated_at,
      ir.reported_user_id,
      ir.reported_profile_id,
      ir.report_reason,
      ir.ip_address,
      ir.reporter_ip,
      ir.profile_type,
      ir.reported_url,
      ir.content_snapshot,
      -- Auto-scan fields
      ir.scan_status,
      ir.scan_risk_level,
      ir.scan_summary,
      ir.scan_completed_at,
      ir.scan_id,
      ir.scan_override_risk,
      ir.scan_override_by,
      ir.scan_reviewed,
      ir.scan_reviewed_by,
      ir.scan_internal_notes,
      -- Profile owner details (for profile_report type)
      p.username          AS profile_username,
      p.biz_slug          AS profile_biz_slug,
      p.display_name      AS profile_display_name,
      p.profile_type      AS profile_profile_type,
      p.is_suspended      AS profile_is_suspended,
      p.is_hidden         AS profile_is_hidden,
      p.suspension_reason AS profile_suspension_reason,
      u.email             AS profile_owner_email,
      u.name              AS profile_owner_name
    FROM issue_reports ir
    LEFT JOIN profiles p ON ir.reported_profile_id = p.id
    LEFT JOIN users u    ON ir.reported_user_id = u.id
    ORDER BY
      CASE ir.status WHEN 'new' THEN 0 WHEN 'open' THEN 1 WHEN 'reviewing' THEN 2 WHEN 'in_progress' THEN 3 ELSE 4 END,
      ir.created_at DESC
  `).all();

  return res.json({ success: true, data: rows });
}

export async function updateIssueReport(req: Request, res: Response) {
  const { id } = req.params;
  const { status, admin_notes } = req.body as { status?: string; admin_notes?: string };

  const allowed = ['new', 'open', 'reviewing', 'in_progress', 'action_taken', 'resolved', 'dismissed', 'closed'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  // Only overwrite admin_notes when it is explicitly provided (not undefined)
  // This prevents accidental null-wipe when only status is being updated
  if (admin_notes !== undefined) {
    db.prepare(`
      UPDATE issue_reports
      SET status = COALESCE(?, status),
          admin_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status ?? null, admin_notes, id);
  } else {
    db.prepare(`
      UPDATE issue_reports
      SET status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status ?? null, id);
  }

  return res.json({ success: true });
}
