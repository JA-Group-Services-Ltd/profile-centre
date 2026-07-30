/**
 * POST /api/profiles/:username/report
 * Public endpoint — any visitor can report a personal or business profile.
 * Rate-limited by IP (reportLimiter middleware applied in entry.ts).
 * UK GDPR: IP stored for rate-limiting and legal compliance only.
 * Reporters are never connected to profile owners — no DM threads created.
 *
 * Stores report in issue_reports with:
 *   - profile_type (personal | business)
 *   - reported_url (full public URL)
 *   - reporter_ip, reporter_ua (for abuse detection, GDPR-compliant)
 *   - content_snapshot (public fields at time of report)
 *   - reported_user_id, reported_profile_id
 *   - report_reason
 */
import type { Request, Response } from 'express';
import db from '../../../db.js';
import { isValidEmail } from '../../../../lib/validate-email.js';
import { runScanPipeline } from '../../../lib/profile-scanner.js';
import { writeAudit } from '../../../lib/audit.js';

const REPORT_REASONS = [
  'spam_scam',
  'impersonation',
  'harassment_abuse',
  'illegal_content',
  'adult_unsafe_content',
  'misleading_information',
  'privacy_issue',
  'intellectual_property',
  'other',
] as const;

const REASON_LABELS: Record<string, string> = {
  spam_scam:               'Spam or scam',
  impersonation:           'Impersonation',
  harassment_abuse:        'Harassment or abuse',
  illegal_content:         'Illegal content',
  adult_unsafe_content:    'Adult or unsafe content',
  misleading_information:  'Misleading information',
  privacy_issue:           'Privacy issue',
  intellectual_property:   'Intellectual property issue',
  other:                   'Other',
};

const BASE_URL = 'https://japrofilestudio.jagroupservices.co.uk';

export default async function handler(req: Request, res: Response) {
  const { username } = req.params;
  const {
    reporter_name,
    reporter_email,
    reason,
    details,
  } = req.body as {
    reporter_name?: string;
    reporter_email?: string;
    reason?: string;
    details?: string;
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!reporter_name?.trim())
    return res.status(400).json({ error: 'Your name is required.' });
  if (!reporter_email?.trim() || !isValidEmail(reporter_email.trim()))
    return res.status(400).json({ error: 'A valid email address is required.' });
  if (!reason || !REPORT_REASONS.includes(reason as typeof REPORT_REASONS[number]))
    return res.status(400).json({ error: 'Please select a reason for your report.' });
  if (!details?.trim() || details.trim().length < 10)
    return res.status(400).json({ error: 'Please provide more detail (at least 10 characters).' });
  if (details.trim().length > 2000)
    return res.status(400).json({ error: 'Details must be 2000 characters or fewer.' });

  // ── Resolve profile (personal or business) ─────────────────────────────────
  // Try personal profile first (username match), then business profile (biz_slug match)
  let profile: {
    id: number;
    display_name: string;
    user_id: number;
    profile_type: string;
    owner_email: string;
    username: string | null;
    biz_slug: string | null;
  } | undefined;

  profile = db.prepare(`
    SELECT p.id, p.display_name, p.user_id, p.profile_type,
           COALESCE(u.email, '') AS owner_email,
           p.username, p.biz_slug
    FROM profiles p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.username = ? AND p.profile_type = 'personal'
    LIMIT 1
  `).get(username) as typeof profile;

  if (!profile) {
    // Try business profile by biz_slug
    profile = db.prepare(`
      SELECT p.id, p.display_name, p.user_id, p.profile_type,
             COALESCE(u.email, '') AS owner_email,
             p.username, p.biz_slug
      FROM profiles p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.biz_slug = ? AND p.profile_type = 'business'
      LIMIT 1
    `).get(username) as typeof profile;
  }

  if (!profile) return res.status(404).json({ error: 'Profile not found.' });

  // ── IP / UA extraction ─────────────────────────────────────────────────────
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  const ua = String(req.headers['user-agent'] || '').slice(0, 500);

  // ── Rate limit: max 5 reports from same IP per 24h ─────────────────────────
  // (reportLimiter middleware also applies, this is a secondary DB-level check)
  const recentCount = (db.prepare(`
    SELECT COUNT(*) AS cnt FROM issue_reports
    WHERE (ip_address = ? OR reporter_ip = ?) AND issue_type = 'profile_report'
    AND created_at > datetime('now', '-24 hours')
  `).get(ip, ip) as { cnt: number }).cnt;

  if (recentCount >= 5) {
    return res.status(429).json({ error: 'You have submitted too many reports recently. Please try again later.' });
  }

  // ── Content snapshot (public-facing fields only) ───────────────────────────
  let contentSnapshot = '';
  try {
    const snap = db.prepare(`
      SELECT display_name, bio, profile_type, username, biz_slug, business_name
      FROM profiles WHERE id = ? LIMIT 1
    `).get(profile.id) as Record<string, unknown> | undefined;
    if (snap) {
      contentSnapshot = JSON.stringify({
        username: snap.username,
        biz_slug: snap.biz_slug,
        display_name: snap.display_name,
        business_name: snap.business_name,
        bio: snap.bio,
        profile_type: snap.profile_type,
        snapshot_at: new Date().toISOString(),
      });
    }
  } catch { /* non-critical */ }

  // ── Build reported URL ─────────────────────────────────────────────────────
  const reportedUrl = profile.profile_type === 'business' && profile.biz_slug
    ? `${BASE_URL}/profile/${profile.biz_slug}`
    : `${BASE_URL}/profile/${profile.username ?? username}`;

  const reasonLabel = REASON_LABELS[reason] || reason;
  const profileLabel = profile.profile_type === 'business'
    ? `business profile @${profile.biz_slug ?? username}`
    : `personal profile @${profile.username ?? username}`;

  const subject = `Profile report: ${profileLabel} — ${reasonLabel}`;
  const description = [
    `Reported: ${profileLabel} (${profile.display_name})`,
    `Profile type: ${profile.profile_type}`,
    `Profile URL: ${reportedUrl}`,
    `Reported user ID: ${profile.user_id}`,
    `Reported profile ID: ${profile.id}`,
    `Reason: ${reasonLabel}`,
    '',
    'Details provided by reporter:',
    details.trim(),
    '',
    contentSnapshot ? `Content snapshot: ${contentSnapshot}` : '',
  ].filter(Boolean).join('\n');

  // ── Insert into issue_reports ──────────────────────────────────────────────
  const insertResult = db.prepare(`
    INSERT INTO issue_reports
      (name, email, issue_type, subject, description, page_url,
       ip_address, user_agent, reporter_ip, reporter_ua,
       reported_user_id, reported_profile_id, content_snapshot,
       report_reason, profile_type, reported_url, status, scan_status)
    VALUES (?, ?, 'profile_report', ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, 'new', 'pending')
  `).run(
    reporter_name.trim(),
    reporter_email.trim().toLowerCase(),
    subject,
    description,
    reportedUrl,
    ip, ua, ip, ua,
    profile.user_id,
    profile.id,
    contentSnapshot,
    reason,
    profile.profile_type,
    reportedUrl,
  );

  const reportId = Number(insertResult.lastInsertRowid);

  // ── Trigger auto-scan (non-blocking — fire and forget, errors are logged) ──
  setImmediate(async () => {
    try {
      const { result, autoHidden } = await runScanPipeline(
        profile.id,
        profile.profile_type,
        reportId,
        'auto_report',
      );

      // Audit log the scan
      await writeAudit({
        actorId: 0, actorName: 'auto_scan', actorEmail: '', actorType: 'system',
        tenant: 'platform', authProvider: 'system',
        action: 'profile_auto_scanned',
        resourceType: 'profile', resourceId: String(profile.id),
        resourceLabel: profile.username ?? profile.biz_slug ?? String(profile.id),
        details: `Auto-scan triggered by report #${reportId}. Risk: ${result.riskLevel} (score ${result.riskScore}). Categories: ${result.issueCategories.join(', ') || 'none'}. Auto-hidden: ${autoHidden}.`,
        ipAddress: ip, result: 'success',
      });

      if (autoHidden) {
        await writeAudit({
          actorId: 0, actorName: 'auto_scan', actorEmail: '', actorType: 'system',
          tenant: 'platform', authProvider: 'system',
          action: 'profile_auto_hidden_critical_risk',
          resourceType: 'profile', resourceId: String(profile.id),
          resourceLabel: profile.username ?? profile.biz_slug ?? String(profile.id),
          details: `Profile auto-hidden due to CRITICAL risk scan result from report #${reportId}. Pending admin review.`,
          ipAddress: ip, result: 'success',
        });
      }
    } catch (err) {
      console.error('[auto-scan] Failed for profile', profile.id, 'report', reportId, err);
      // Mark scan as failed so admin knows
      try {
        db.prepare(`
          UPDATE issue_reports SET scan_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(reportId);
      } catch { /* ignore secondary failure */ }
    }
  });

  return res.status(201).json({ success: true });
}
