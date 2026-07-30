/**
 * Admin — Profile Scan API
 *
 * POST /api/admin/scans/:reportId/rescan   — manually re-run scan for a report
 * GET  /api/admin/scans/:reportId          — get full scan detail for a report
 * POST /api/admin/scans/:scanId/override   — override risk level + add notes
 * POST /api/admin/scans/:scanId/dismiss    — dismiss as false positive
 * POST /api/admin/scans/:scanId/review     — mark as reviewed
 *
 * All endpoints are admin-only (requireAdminApi applied in entry.ts).
 * Scan results are internal — never exposed to reporters or profile owners.
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { runScanPipeline } from '../../lib/profile-scanner.js';
import { writeAudit } from '../../lib/audit.js';

type AuthRequest = import('../../middleware/auth.js').AuthRequest;

function getAdmin(req: Request) {
  const r = req as AuthRequest;
  return {
    id:    r.user?.id ?? 0,
    name:  r.user?.name ?? 'Unknown Admin',
    email: (r.user as Record<string, unknown>)?.email as string ?? '',
  };
}

// ─── GET /api/admin/scans/:reportId ──────────────────────────────────────────

export async function getScanForReport(req: Request, res: Response) {
  const reportId = parseInt(String(req.params.reportId), 10);
  if (isNaN(reportId)) return res.status(400).json({ success: false, error: 'Invalid report ID' });

  const report = db.prepare(`
    SELECT ir.*,
           p.username AS profile_username, p.biz_slug AS profile_biz_slug,
           p.display_name AS profile_display_name, p.profile_type AS profile_profile_type,
           p.is_suspended, p.is_hidden
    FROM issue_reports ir
    LEFT JOIN profiles p ON ir.reported_profile_id = p.id
    WHERE ir.id = ?
  `).get(reportId) as Record<string, unknown> | undefined;

  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

  // Get latest scan for this report
  const scan = db.prepare(`
    SELECT * FROM profile_scans WHERE report_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(reportId) as Record<string, unknown> | undefined;

  // Get all scans for this profile (history)
  const scanHistory = report.reported_profile_id
    ? db.prepare(`
        SELECT id, risk_level, risk_score, summary, triggered_by, auto_hidden, created_at
        FROM profile_scans WHERE profile_id = ? ORDER BY created_at DESC LIMIT 10
      `).all(report.reported_profile_id as number)
    : [];

  return res.json({
    success: true,
    report,
    scan: scan ? {
      ...scan,
      issue_categories: tryParseJson(scan.issue_categories as string, []),
      evidence: tryParseJson(scan.evidence as string, []),
    } : null,
    scanHistory,
  });
}

// ─── POST /api/admin/scans/:reportId/rescan ───────────────────────────────────

export async function rescanReport(req: Request, res: Response) {
  const reportId = parseInt(String(req.params.reportId), 10);
  if (isNaN(reportId)) return res.status(400).json({ success: false, error: 'Invalid report ID' });

  const admin = getAdmin(req);

  const report = db.prepare(`
    SELECT id, reported_profile_id, profile_type FROM issue_reports WHERE id = ?
  `).get(reportId) as { id: number; reported_profile_id: number | null; profile_type: string | null } | undefined;

  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  if (!report.reported_profile_id) return res.status(400).json({ success: false, error: 'No profile linked to this report' });

  // Mark scan as pending
  db.prepare(`
    UPDATE issue_reports SET scan_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(reportId);

  try {
    const { result, scanId, autoHidden } = await runScanPipeline(
      report.reported_profile_id,
      report.profile_type ?? 'personal',
      reportId,
      'admin_manual',
    );

    await writeAudit({
      actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
      tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'profile_manual_rescan',
      resourceType: 'profile', resourceId: String(report.reported_profile_id),
      resourceLabel: String(report.reported_profile_id),
      details: `Manual rescan by ${admin.name} for report #${reportId}. Risk: ${result.riskLevel} (score ${result.riskScore}). Auto-hidden: ${autoHidden}.`,
      ipAddress: req.ip, result: 'success',
    });

    // Fetch the saved scan
    const scan = db.prepare('SELECT * FROM profile_scans WHERE id = ?').get(scanId) as Record<string, unknown>;

    return res.json({
      success: true,
      scan: {
        ...scan,
        issue_categories: tryParseJson(scan.issue_categories as string, []),
        evidence: tryParseJson(scan.evidence as string, []),
      },
      autoHidden,
    });
  } catch (err) {
    db.prepare(`
      UPDATE issue_reports SET scan_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(reportId);
    console.error('[rescan] Failed for report', reportId, err);
    return res.status(500).json({ success: false, error: 'Scan failed. Check server logs.' });
  }
}

// ─── POST /api/admin/scans/:scanId/override ───────────────────────────────────

export async function overrideScanRisk(req: Request, res: Response) {
  const scanId = parseInt(String(req.params.scanId), 10);
  if (isNaN(scanId)) return res.status(400).json({ success: false, error: 'Invalid scan ID' });

  const admin = getAdmin(req);
  const { risk_level, internal_notes } = req.body as { risk_level?: string; internal_notes?: string };

  const validLevels = ['low', 'medium', 'high', 'critical'];
  if (!risk_level || !validLevels.includes(risk_level)) {
    return res.status(400).json({ success: false, error: 'risk_level must be one of: low, medium, high, critical' });
  }

  const scan = db.prepare('SELECT id, report_id FROM profile_scans WHERE id = ?').get(scanId) as
    { id: number; report_id: number | null } | undefined;
  if (!scan) return res.status(404).json({ success: false, error: 'Scan not found' });

  // Update scan override
  db.prepare(`
    UPDATE profile_scans SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(scanId);

  // Update report override columns
  if (scan.report_id) {
    db.prepare(`
      UPDATE issue_reports
      SET scan_override_risk = ?,
          scan_override_by = ?,
          scan_override_at = CURRENT_TIMESTAMP,
          scan_internal_notes = COALESCE(?, scan_internal_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(risk_level, admin.name, internal_notes ?? null, scan.report_id);
  }

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'scan_risk_overridden',
    resourceType: 'profile_scan', resourceId: String(scanId),
    resourceLabel: String(scanId),
    details: `Scan #${scanId} risk overridden to "${risk_level}" by ${admin.name}. Notes: ${internal_notes || 'none'}`,
    ipAddress: req.ip, result: 'success',
  });

  return res.json({ success: true });
}

// ─── POST /api/admin/scans/:scanId/dismiss ────────────────────────────────────

export async function dismissScan(req: Request, res: Response) {
  const scanId = parseInt(String(req.params.scanId), 10);
  if (isNaN(scanId)) return res.status(400).json({ success: false, error: 'Invalid scan ID' });

  const admin = getAdmin(req);
  const { internal_notes } = req.body as { internal_notes?: string };

  const scan = db.prepare('SELECT id, report_id FROM profile_scans WHERE id = ?').get(scanId) as
    { id: number; report_id: number | null } | undefined;
  if (!scan) return res.status(404).json({ success: false, error: 'Scan not found' });

  if (scan.report_id) {
    db.prepare(`
      UPDATE issue_reports
      SET scan_override_risk = 'dismissed',
          scan_override_by = ?,
          scan_override_at = CURRENT_TIMESTAMP,
          scan_reviewed = 1,
          scan_reviewed_by = ?,
          scan_reviewed_at = CURRENT_TIMESTAMP,
          scan_internal_notes = COALESCE(?, scan_internal_notes),
          status = CASE WHEN status = 'new' THEN 'dismissed' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(admin.name, admin.name, internal_notes ?? null, scan.report_id);
  }

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'scan_dismissed_false_positive',
    resourceType: 'profile_scan', resourceId: String(scanId),
    resourceLabel: String(scanId),
    details: `Scan #${scanId} dismissed as false positive by ${admin.name}. Notes: ${internal_notes || 'none'}`,
    ipAddress: req.ip, result: 'success',
  });

  return res.json({ success: true });
}

// ─── POST /api/admin/scans/:scanId/review ─────────────────────────────────────

export async function markScanReviewed(req: Request, res: Response) {
  const scanId = parseInt(String(req.params.scanId), 10);
  if (isNaN(scanId)) return res.status(400).json({ success: false, error: 'Invalid scan ID' });

  const admin = getAdmin(req);
  const { internal_notes } = req.body as { internal_notes?: string };

  const scan = db.prepare('SELECT id, report_id FROM profile_scans WHERE id = ?').get(scanId) as
    { id: number; report_id: number | null } | undefined;
  if (!scan) return res.status(404).json({ success: false, error: 'Scan not found' });

  if (scan.report_id) {
    db.prepare(`
      UPDATE issue_reports
      SET scan_reviewed = 1,
          scan_reviewed_by = ?,
          scan_reviewed_at = CURRENT_TIMESTAMP,
          scan_internal_notes = COALESCE(?, scan_internal_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(admin.name, internal_notes ?? null, scan.report_id);
  }

  await writeAudit({
    actorId: admin.id, actorName: admin.name, actorEmail: admin.email, actorType: 'admin',
    tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
    action: 'scan_marked_reviewed',
    resourceType: 'profile_scan', resourceId: String(scanId),
    resourceLabel: String(scanId),
    details: `Scan #${scanId} marked as reviewed by ${admin.name}. Notes: ${internal_notes || 'none'}`,
    ipAddress: req.ip, result: 'success',
  });

  return res.json({ success: true });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function tryParseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}
