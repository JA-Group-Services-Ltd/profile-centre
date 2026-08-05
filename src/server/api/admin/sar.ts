/**
 * Subject Access Request (SAR) — Admin API
 *
 * GET  /api/admin/sar/:userId/data   — full JSON dump of all data held
 * GET  /api/admin/sar/:userId/pdf    — streams a professional PDF document
 *
 * Both endpoints are admin-only (requireAdminApi middleware applied in entry.ts).
 * Every PDF carries a tamper-evident audit stamp per the JA Group Services security policy:
 *   - Admin full name, JA Group Services ID (entra_oid), verified email
 *   - Document reference number (SAR-{userId}-{timestamp})
 *   - Document version, organisation, exact generation timestamp
 *   - Unique HMAC-SHA256 verification code (keyed on doc ref + admin id + timestamp)
 *
 * SECTION MAP (matches PDF TOC):
 *  1.  Account Information
 *  2.  Consent & Privacy Preferences
 *  3.  Plan & Subscription History
 *  4.  Personal Profiles
 *  5.  Business Profiles
 *  6.  Public Profile URLs
 *  7.  Profile Links & QR Codes
 *  8.  Business Seat Memberships
 *  9.  Analytics Summary
 * 10.  Contact Enquiries Received
 * 11.  Reports & Moderation
 * 12.  Support Requests
 * 13.  Notifications & Service Messages
 * 14.  Billing & Plan History
 * 15.  Data Requests
 * 16.  Account Closure Requests
 * 17.  Security & Session Audit
 * 18.  Referral & Points
 * 19.  Email Signature (Coming Soon — data stored)
 * 20.  Business Card Orders (Coming Soon — data stored)
 * 21.  Legacy / Historical Data (removed features — for completeness only)
 */

import type { Request, Response } from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createHmac } from 'crypto';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

/** Replace characters outside WinAnsi (U+0000-U+00FF) with ASCII equivalents. */
function s(text: string): string {
  return String(text ?? '')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00ae/g, '(R)')
    .replace(/\u00a9/g, '(c)')
    .replace(/\u2713|\u2714/g, 'Y')
    .replace(/\u2717|\u2718/g, 'N')
    .replace(/\u2139/g, 'i')
    .replace(/\u26a0/g, '!')
    .replace(/[^\u0000-\u00ff]/g, '?');
}

// ─── Data collector ───────────────────────────────────────────────────────────

function collectSarData(userId: number) {
  // ── 1. Account ──────────────────────────────────────────────────────────────
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role,
           COALESCE(u.phone, '') AS phone,
           COALESCE(u.stripe_customer_id, '') AS stripe_customer_id,
           COALESCE(u.entra_oid, '') AS entra_oid,
           COALESCE(u.user_number, '') AS user_number,
           u.created_at, u.last_login_at,
           COALESCE(u.is_paused, 0) AS is_paused,
           COALESCE(u.pause_reason, '') AS pause_reason,
           COALESCE(u.lifetime_access, 0) AS lifetime_access,
           COALESCE(u.trial_started_at, '') AS trial_started_at,
           p.name AS plan_name, p.slug AS plan_slug,
           p.price_monthly, p.price_yearly,
           p.max_profiles, p.max_links, p.max_seats
    FROM users u
    LEFT JOIN plans p ON u.plan_id = p.id
    WHERE u.id = ? AND u.role = 'user'
  `).get(userId) as Record<string, unknown> | undefined;

  if (!user) return null;

  // ── 2. Consent ──────────────────────────────────────────────────────────────
  const consent = db.prepare(`
    SELECT marketing_consent, marketing_consent_at,
           terms_consent, terms_consent_at,
           privacy_consent, privacy_consent_at,
           data_improve_consent, data_improve_consent_at,
           updates_consent, updates_consent_at,
           crm_consent, crm_consent_at,
           referral_consent, referral_consent_at,
           COALESCE(consent_ip, '') AS consent_ip,
           COALESCE(consent_version, '') AS consent_version
    FROM users WHERE id = ?
  `).get(userId) as Record<string, unknown>;

  // ── 3. Subscriptions ────────────────────────────────────────────────────────
  const subscriptions = db.prepare(`
    SELECT s.id, s.status, s.billing_interval,
           s.current_period_start, s.current_period_end,
           COALESCE(s.cancel_at_period_end, 0) AS cancel_at_period_end,
           COALESCE(s.stripe_subscription_id, '') AS stripe_subscription_id,
           s.started_at AS created_at,
           pl.name AS plan_name, pl.price_monthly, pl.price_yearly
    FROM subscriptions s
    LEFT JOIN plans pl ON s.plan_id = pl.id
    WHERE s.user_id = ?
    ORDER BY s.started_at DESC
  `).all(userId) as Record<string, unknown>[];

  // ── 4 & 5. Profiles (personal + business) ───────────────────────────────────
  const profiles = db.prepare(`
    SELECT id, display_name, bio, job_title, company,
           COALESCE(email, '') AS email,
           COALESCE(contact_email, '') AS contact_email,
           COALESCE(phone, '') AS phone,
           COALESCE(website, '') AS website,
           COALESCE(address, '') AS address,
           COALESCE(profile_type, 'personal') AS profile_type,
           COALESCE(business_name, '') AS business_name,
           COALESCE(business_description, '') AS business_description,
           COALESCE(business_category, '') AS business_category,
           COALESCE(business_email, '') AS business_email,
           COALESCE(business_phone, '') AS business_phone,
           COALESCE(username, '') AS username,
           COALESCE(biz_slug, '') AS biz_slug,
           COALESCE(person_slug, '') AS person_slug,
           COALESCE(is_published, 1) AS is_published,
           COALESCE(is_suspended, 0) AS is_suspended,
           COALESCE(is_verified, 0) AS is_verified,
           created_at, updated_at
    FROM profiles WHERE user_id = ?
    ORDER BY created_at ASC
  `).all(userId) as Record<string, unknown>[];

  const personalProfiles = profiles.filter(p => p.profile_type === 'personal');
  const businessProfiles = profiles.filter(p => p.profile_type === 'business');

  // ── 6. Public profile URLs ───────────────────────────────────────────────────
  const profileUrls = profiles
    .filter(p => p.username || p.biz_slug || p.person_slug)
    .map(p => ({
      profile_name: p.display_name,
      profile_type: p.profile_type,
      slug: p.biz_slug || p.person_slug || p.username,
      public_url: `https://japrofilestudio.jagroupservices.co.uk/profile/${p.biz_slug || p.person_slug || p.username}`,
      is_published: p.is_published,
    }));

  // ── 7. Links & QR codes ─────────────────────────────────────────────────────
  const links = db.prepare(`
    SELECT pl.label AS title, pl.url, pl.platform, pl.sort_order,
           pl.is_enabled, pl.created_at,
           p.display_name AS profile_name, p.profile_type
    FROM profile_links pl
    JOIN profiles p ON pl.profile_id = p.id
    WHERE p.user_id = ?
    ORDER BY p.id, pl.sort_order
  `).all(userId) as Record<string, unknown>[];

  // QR code records (if stored separately)
  let qrCodes: Record<string, unknown>[] = [];
  try {
    qrCodes = db.prepare(`
      SELECT qr.id, qr.format, qr.created_at, p.display_name AS profile_name
      FROM qr_codes qr
      JOIN profiles p ON qr.profile_id = p.id
      WHERE p.user_id = ?
      ORDER BY qr.created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 8. Seat memberships ─────────────────────────────────────────────────────
  let seatMemberships: Record<string, unknown>[] = [];
  try {
    seatMemberships = db.prepare(`
      SELECT bs.role, bs.status, bs.created_at,
             p.business_name, p.display_name AS profile_display_name,
             owner.name AS owner_name, owner.email AS owner_email
      FROM business_seats bs
      JOIN profiles p ON bs.profile_id = p.id
      JOIN users owner ON p.user_id = owner.id
      WHERE bs.user_id = ?
      ORDER BY bs.created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 9. Analytics (aggregated — no raw visitor IPs) ──────────────────────────
  let pageViewCount = 0;
  let linkClickCount = 0;
  try {
    const pv = db.prepare(
      'SELECT COUNT(*) as c FROM page_views pv JOIN profiles p ON pv.profile_id = p.id WHERE p.user_id = ?'
    ).get(userId) as { c: number } | undefined;
    pageViewCount = pv?.c ?? 0;
  } catch { /* table may not exist */ }
  try {
    const lc = db.prepare(
      'SELECT COUNT(*) as c FROM link_clicks lc JOIN profile_links pl ON lc.link_id = pl.id JOIN profiles p ON pl.profile_id = p.id WHERE p.user_id = ?'
    ).get(userId) as { c: number } | undefined;
    linkClickCount = lc?.c ?? 0;
  } catch { /* table may not exist */ }

  // ── 10. Contact enquiries received ──────────────────────────────────────────
  const enquiries = db.prepare(`
    SELECT ce.id, ce.sender_name AS visitor_name, ce.sender_email AS visitor_email,
           ce.message, ce.created_at, p.display_name AS profile_name
    FROM contact_enquiries ce
    JOIN profiles p ON ce.profile_id = p.id
    WHERE p.user_id = ?
    ORDER BY ce.created_at DESC
    LIMIT 100
  `).all(userId) as Record<string, unknown>[];

  // ── 11. Reports & moderation ─────────────────────────────────────────────────
  // Reports submitted BY this user
  let reportsByUser: Record<string, unknown>[] = [];
  try {
    reportsByUser = db.prepare(`
      SELECT id, report_type, description, status, created_at
      FROM issue_reports
      WHERE reporter_user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // Reports made ABOUT this user's profiles
  let reportsAboutUser: Record<string, unknown>[] = [];
  try {
    reportsAboutUser = db.prepare(`
      SELECT ir.id, ir.report_type, ir.status, ir.created_at,
             p.display_name AS profile_name
      FROM issue_reports ir
      JOIN profiles p ON ir.profile_id = p.id
      WHERE p.user_id = ?
      ORDER BY ir.created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 12. Support requests ─────────────────────────────────────────────────────
  let supportRequests: Record<string, unknown>[] = [];
  try {
    supportRequests = db.prepare(`
      SELECT id, category, subject, message, status, created_at, updated_at
      FROM support_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 13. Notifications & service messages ────────────────────────────────────
  let notifications: Record<string, unknown>[] = [];
  try {
    notifications = db.prepare(`
      SELECT id, type, title, body, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 14. Billing — invoices / payment events ──────────────────────────────────
  let invoices: Record<string, unknown>[] = [];
  try {
    invoices = db.prepare(`
      SELECT id, stripe_invoice_id, amount_due, amount_paid, currency,
             status, billing_reason, created_at
      FROM invoices
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 15. Data requests ────────────────────────────────────────────────────────
  const dataRequests = db.prepare(`
    SELECT id, request_type, description, status,
           completed_at, created_at, updated_at
    FROM data_requests WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as Record<string, unknown>[];

  // ── 16. Account closure requests ────────────────────────────────────────────
  let closureRequests: Record<string, unknown>[] = [];
  try {
    closureRequests = db.prepare(`
      SELECT id, reason, status, created_at, updated_at
      FROM account_closure_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 17. Security & session audit ────────────────────────────────────────────
  let auditEntries: Record<string, unknown>[] = [];
  try {
    auditEntries = db.prepare(`
      SELECT action, actor_type, details, ip_address, result, created_at
      FROM audit_log
      WHERE (actor_id = ? AND actor_type = 'user')
         OR (resource_id = ? AND resource_type = 'user')
      ORDER BY created_at DESC LIMIT 200
    `).all(userId, String(userId)) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 18. Referral & points ────────────────────────────────────────────────────
  let referralCode: string | null = null;
  let pointsBalance = 0;
  let pointsHistory: Record<string, unknown>[] = [];
  try {
    const rc = db.prepare('SELECT code FROM referral_codes WHERE user_id = ?').get(userId) as { code: string } | undefined;
    referralCode = rc?.code ?? null;
  } catch { /* table may not exist */ }
  try {
    const pb = db.prepare('SELECT balance FROM points_balances WHERE user_id = ?').get(userId) as { balance: number } | undefined;
    pointsBalance = pb?.balance ?? 0;
  } catch { /* table may not exist */ }
  try {
    pointsHistory = db.prepare(
      'SELECT amount, reason, created_at FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 19. Email signature (Coming Soon — data stored but feature not yet live) ─
  let emailSignature: Record<string, unknown> | null = null;
  try {
    emailSignature = db.prepare(
      'SELECT template_id, name, job_title, company, phone, email, website, created_at, updated_at FROM email_signatures WHERE user_id = ?'
    ).get(userId) as Record<string, unknown> | null ?? null;
  } catch { /* table may not exist */ }

  // ── 20. Business card orders (Coming Soon — data stored but feature not yet live) ─
  let businessCardOrders: Record<string, unknown>[] = [];
  try {
    businessCardOrders = db.prepare(`
      SELECT bco.id, bco.status, bco.quantity, bco.finish, bco.sides,
             bco.design_fee_amount, bco.design_fee_description, bco.design_fee_status,
             bco.created_at, bco.updated_at,
             p.display_name AS profile_name
      FROM business_card_orders bco
      LEFT JOIN profiles p ON bco.profile_id = p.id
      WHERE bco.user_id = ?
      ORDER BY bco.created_at DESC
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table may not exist */ }

  // ── 21. Legacy / historical data (removed features) ─────────────────────────
  // card_messages — visitor direct messaging was removed. Query defensively.
  let legacyCardMessages: Record<string, unknown>[] = [];
  try {
    legacyCardMessages = db.prepare(`
      SELECT cm.id, cm.thread_id, cm.sender_type, cm.sender_name,
             cm.message, cm.created_at,
             p.display_name AS profile_name
      FROM card_messages cm
      LEFT JOIN profiles p ON cm.profile_id = p.id
      WHERE cm.profile_id IN (SELECT id FROM profiles WHERE user_id = ?)
      ORDER BY cm.created_at DESC
      LIMIT 200
    `).all(userId) as Record<string, unknown>[];
  } catch { /* table does not exist — expected */ }

  return {
    _meta: {
      generated_at: new Date().toISOString(),
      export_version: '2.0',
      account_id: userId,
      privacy_contact: 'privacy@jagroupservices.co.uk',
      note: 'This document contains all personal data held by Sousa Murray Profiles under UK GDPR. It is provided in response to a Subject Access Request.',
    },
    account: user,
    consent,
    subscriptions,
    personal_profiles: personalProfiles,
    business_profiles: businessProfiles,
    public_profile_urls: profileUrls,
    links,
    qr_codes: qrCodes,
    seat_memberships: seatMemberships,
    analytics: { page_view_count: pageViewCount, link_click_count: linkClickCount },
    enquiries,
    reports_by_user: reportsByUser,
    reports_about_user: reportsAboutUser,
    support_requests: supportRequests,
    notifications,
    invoices,
    data_requests: dataRequests,
    closure_requests: closureRequests,
    audit_entries: auditEntries,
    referral: { code: referralCode, points_balance: pointsBalance, points_history: pointsHistory },
    email_signature_coming_soon: emailSignature,
    business_card_orders_coming_soon: businessCardOrders,
    legacy: {
      _note: 'These sections relate to features that have been removed from Sousa Murray Profiles. Data is included for completeness under UK GDPR but these features are no longer active.',
      card_messages: legacyCardMessages,
    },
  };
}

// ─── JSON data endpoint ───────────────────────────────────────────────────────

export async function sarGetData(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });
    const data = collectSarData(userId);
    if (!data) return res.status(404).json({ success: false, error: 'User not found' });

    const adminReq = req as import('../../middleware/auth.js').AuthRequest;
    const adminId    = adminReq.user?.id;
    const adminName  = adminReq.user?.name ?? 'Unknown Admin';
    const adminEmail = (adminReq.user as Record<string, unknown>)?.email as string ?? '';

    // Fetch admin's entra_oid for the audit record
    let adminOid = '';
    try {
      const ar = db.prepare('SELECT entra_oid FROM users WHERE id = ?').get(adminId) as { entra_oid?: string } | undefined;
      adminOid = ar?.entra_oid ?? '';
    } catch { /* non-fatal */ }

    await writeAudit({
      actorId: adminId, actorName: adminName, actorEmail: adminEmail, actorType: 'admin',
      tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'sar_data_exported',
      resourceType: 'user', resourceId: String(userId),
      resourceLabel: String(data.account?.email ?? ''),
      details: `SAR JSON data export generated for user ${userId} (${data.account?.email ?? ''}) by admin ${adminName} <${adminEmail}> JA-ID:${adminOid}`,
      ipAddress: req.ip, result: 'success',
    });

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function fmt(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(val)) {
      try {
        return new Date(val.replace(' ', 'T') + (val.includes('Z') ? '' : 'Z'))
          .toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
      } catch { return val; }
    }
    return val;
  }
  return JSON.stringify(val);
}

function yesNo(val: unknown): string { return val ? 'Yes' : 'No'; }

// Brand colours
const C_BRAND  = rgb(0.145, 0.388, 0.922); // #2563EB
const C_LEGACY = rgb(0.6,   0.4,   0.1);   // amber — legacy sections
const C_WHITE  = rgb(1, 1, 1);
const C_DARK   = rgb(0.1, 0.1, 0.1);
const C_GRAY   = rgb(0.45, 0.45, 0.45);
const C_LGRAY  = rgb(0.92, 0.92, 0.92);
const C_MGRAY  = rgb(0.75, 0.75, 0.75);
const C_STRIPE = rgb(0.97, 0.97, 0.97);

// ─── PDF generator ────────────────────────────────────────────────────────────

export async function sarGeneratePdf(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    let sarData: ReturnType<typeof collectSarData>;
    try {
      sarData = collectSarData(userId);
    } catch (collectErr) {
      const msg = collectErr instanceof Error ? `${collectErr.message}\n${collectErr.stack}` : String(collectErr);
      console.error('[SAR PDF] collectSarData failed:', msg);
      return res.status(500).json({ success: false, error: `Data collection failed: ${msg}` });
    }
    if (!sarData) return res.status(404).json({ success: false, error: 'User not found' });

    const d = sarData as NonNullable<ReturnType<typeof collectSarData>>;

    // ── Admin identity (full, for audit stamp) ────────────────────────────────
    const adminReq   = req as import('../../middleware/auth.js').AuthRequest;
    const adminId    = adminReq.user?.id ?? 0;
    const adminName  = adminReq.user?.name ?? 'Unknown Admin';
    const adminEmail = (adminReq.user as Record<string, unknown>)?.email as string ?? '';

    // Fetch admin's JA Group Services ID (Entra OID) from DB
    let adminJaId = '';
    try {
      const ar = db.prepare('SELECT entra_oid FROM users WHERE id = ?').get(adminId) as { entra_oid?: string } | undefined;
      adminJaId = ar?.entra_oid ?? '';
    } catch { /* non-fatal */ }

    // ── Document reference & verification code ────────────────────────────────
    const nowMs     = Date.now();
    const docRef    = `SAR-${userId}-${nowMs}`;
    const docVer    = '2.0';
    const docOrg    = 'JA Group Services Ltd';
    const generatedAt = new Date(nowMs).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    // HMAC-SHA256 verification code: keyed on SECRET + docRef + adminId + timestamp
    // This lets support staff verify the stamp is genuine without exposing the key.
    const hmacKey = process.env.SAR_HMAC_KEY ?? process.env.SESSION_SECRET ?? 'ja-sar-default-key';
    const verificationCode = createHmac('sha256', hmacKey)
      .update(`${docRef}|${adminId}|${adminEmail}|${nowMs}`)
      .digest('hex')
      .toUpperCase()
      .slice(0, 32); // 32 hex chars = 128-bit — compact but cryptographically strong

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const fontR  = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W   = 595.28; // A4
    const PAGE_H   = 841.89;
    const ML       = 45;
    const MR       = 45;
    const CONTENT_W = PAGE_W - ML - MR;
    const FOOTER_H  = 28;
    const HEADER_H  = 36;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - HEADER_H - 10;
    const pages: ReturnType<typeof pdfDoc.addPage>[] = [page];

    function newPage() {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      y = PAGE_H - HEADER_H - 10;
    }

    function ensureSpace(needed: number) {
      if (y - needed < FOOTER_H + 10) newPage();
    }

    // ── Chrome (header + footer on every page) ────────────────────────────────
    function drawChrome() {
      const total = pdfDoc.getPageCount();
      pdfDoc.getPages().forEach((pg, idx) => {
        // Header bar
        pg.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C_BRAND });
        pg.drawText('Sousa Murray Profiles - Subject Access Request', {
          x: ML, y: PAGE_H - HEADER_H + 11, size: 11, font: fontB, color: C_WHITE,
        });
        pg.drawText('CONFIDENTIAL', {
          x: PAGE_W - MR - 72, y: PAGE_H - HEADER_H + 11, size: 8, font: fontB, color: C_WHITE,
        });
        // Footer line
        pg.drawLine({ start: { x: ML, y: FOOTER_H }, end: { x: PAGE_W - MR, y: FOOTER_H }, thickness: 0.5, color: C_MGRAY });
        // Footer left: doc ref + admin identity
        pg.drawText(s(`Ref: ${docRef}  |  By: ${adminName}  <${adminEmail}>  |  JA-ID: ${adminJaId || 'N/A'}`), {
          x: ML, y: 18, size: 6.5, font: fontR, color: C_GRAY,
        });
        // Footer middle: generated timestamp
        pg.drawText(s(`Generated: ${generatedAt}`), {
          x: ML, y: 10, size: 6.5, font: fontR, color: C_GRAY,
        });
        // Footer right: page number
        pg.drawText(`Page ${idx + 1} of ${total}`, {
          x: PAGE_W - MR - 55, y: 10, size: 6.5, font: fontR, color: C_GRAY,
        });
        // Footer right: verification code (truncated for footer)
        pg.drawText(`VC: ${verificationCode.slice(0, 16)}...`, {
          x: PAGE_W - MR - 90, y: 18, size: 6.5, font: fontR, color: C_GRAY,
        });
      });
    }

    function gap(n = 8) { y -= n; }

    function sectionHeader(num: string, title: string, isLegacy = false) {
      ensureSpace(30);
      gap(10);
      const bg = isLegacy ? C_LEGACY : C_BRAND;
      page.drawRectangle({ x: ML, y: y - 4, width: CONTENT_W, height: 20, color: bg });
      page.drawText(s(`${num}.  ${title}`), { x: ML + 8, y: y + 2, size: 10, font: fontB, color: C_WHITE });
      y -= 24;
      gap(4);
    }

    function kv(label: string, value: string, shade = false) {
      ensureSpace(14);
      if (shade) page.drawRectangle({ x: ML, y: y - 3, width: CONTENT_W, height: 14, color: C_STRIPE });
      page.drawText(s(label), { x: ML + 4, y, size: 8, font: fontB, color: C_DARK });
      const maxChars = 80;
      const val = s(String(value ?? 'N/A')).slice(0, maxChars * 2);
      const lines: string[] = [];
      for (let i = 0; i < val.length; i += maxChars) lines.push(val.slice(i, i + maxChars));
      lines.forEach((ln, li) => {
        if (li > 0) { y -= 11; ensureSpace(11); }
        page.drawText(ln, { x: ML + 160, y, size: 8, font: fontR, color: C_DARK });
      });
      y -= 14;
    }

    function tableHeader(cols: string[], widths: number[]) {
      ensureSpace(16);
      page.drawRectangle({ x: ML, y: y - 3, width: CONTENT_W, height: 15, color: C_BRAND });
      let cx = ML + 4;
      cols.forEach((c, i) => {
        page.drawText(s(c).slice(0, 20), { x: cx, y, size: 7, font: fontB, color: C_WHITE });
        cx += widths[i];
      });
      y -= 16;
    }

    function tableRow(cells: string[], widths: number[], shade: boolean) {
      ensureSpace(14);
      if (shade) page.drawRectangle({ x: ML, y: y - 3, width: CONTENT_W, height: 14, color: C_STRIPE });
      let cx = ML + 4;
      cells.forEach((c, i) => {
        const maxC = Math.floor((widths[i] - 4) / 4.5);
        page.drawText(s(String(c ?? 'N/A')).slice(0, maxC), { x: cx, y, size: 7, font: fontR, color: C_DARK });
        cx += widths[i];
      });
      y -= 14;
    }

    function emptyState(msg = 'No data held.') {
      ensureSpace(14);
      page.drawText(s(msg), { x: ML + 8, y, size: 8, font: fontR, color: C_GRAY });
      y -= 14;
    }

    function profileSubHeader(label: string) {
      ensureSpace(20);
      page.drawRectangle({ x: ML, y: y - 2, width: CONTENT_W, height: 16, color: C_LGRAY });
      page.drawText(s(label), { x: ML + 6, y, size: 9, font: fontB, color: C_BRAND });
      y -= 18;
    }

    function infoBox(text: string) {
      ensureSpace(24);
      page.drawRectangle({ x: ML, y: y - 6, width: CONTENT_W, height: 20, color: rgb(0.95, 0.97, 1.0) });
      page.drawText(s(text).slice(0, 110), { x: ML + 6, y, size: 7.5, font: fontR, color: C_GRAY });
      y -= 24;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ══════════════════════════════════════════════════════════════════════════
    page.drawRectangle({ x: 0, y: PAGE_H - 200, width: PAGE_W, height: 200, color: C_BRAND });
    page.drawText('Subject Access Request', { x: ML, y: PAGE_H - 75, size: 26, font: fontB, color: C_WHITE });
    page.drawText('Personal Data Report', { x: ML, y: PAGE_H - 103, size: 14, font: fontR, color: rgb(0.8, 0.9, 1.0) });
    page.drawText('Sousa Murray Profiles - japrofilestudio.jagroupservices.co.uk', { x: ML, y: PAGE_H - 125, size: 9, font: fontR, color: rgb(0.8, 0.9, 1.0) });
    page.drawText(s(`Prepared for: ${fmt(d.account.name)} <${fmt(d.account.email)}>`), { x: ML, y: PAGE_H - 148, size: 9, font: fontR, color: C_WHITE });
    page.drawText(s(`Sousa Murray Profiles User Number: ${d.account.user_number ? String(d.account.user_number).replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4') : 'N/A'}`), { x: ML, y: PAGE_H - 162, size: 9, font: fontR, color: C_WHITE });
    page.drawText(s(`Generated: ${generatedAt}`), { x: ML, y: PAGE_H - 176, size: 9, font: fontR, color: C_WHITE });
    page.drawText(s(`Generated by: ${adminName}${adminEmail ? ` <${adminEmail}>` : ''}`), { x: ML, y: PAGE_H - 190, size: 9, font: fontR, color: rgb(0.8, 0.9, 1.0) });

    y = PAGE_H - 225;
    page.drawText('CONTENTS', { x: ML, y, size: 11, font: fontB, color: C_BRAND });
    y -= 18;

    const toc = [
      '1.   Account Information',
      '2.   Consent & Privacy Preferences',
      '3.   Plan & Subscription History',
      '4.   Personal Profiles',
      '5.   Business Profiles',
      '6.   Public Profile URLs',
      '7.   Profile Links & QR Codes',
      '8.   Business Seat Memberships',
      '9.   Analytics Summary',
      '10.  Contact Enquiries Received',
      '11.  Reports & Moderation',
      '12.  Support Requests',
      '13.  Notifications & Service Messages',
      '14.  Billing & Invoices',
      '15.  Data Requests',
      '16.  Account Closure Requests',
      '17.  Security & Session Audit',
      '18.  Referral & Points',
      '19.  Email Signature (Coming Soon - data stored)',
      '20.  Business Card Orders (Coming Soon - data stored)',
      '21.  Legacy / Historical Data (removed features)',
    ];
    toc.forEach((item, i) => {
      if (y < FOOTER_H + 20) { /* skip overflow on cover — TOC continues on next page */ return; }
      const isLegacy = i >= 20;
      page.drawText(s(item), { x: ML + 10, y, size: 8.5, font: fontR, color: isLegacy ? C_LEGACY : C_DARK });
      y -= 15;
    });

    y -= 10;
    page.drawLine({ start: { x: ML, y }, end: { x: PAGE_W - MR, y }, thickness: 0.5, color: C_MGRAY });
    y -= 14;
    page.drawText('This document contains personal data processed by Sousa Murray Profiles under UK GDPR.', { x: ML, y, size: 8, font: fontR, color: C_GRAY });
    y -= 12;
    page.drawText('It is provided in response to a Subject Access Request and must be handled confidentially.', { x: ML, y, size: 8, font: fontR, color: C_GRAY });
    y -= 12;
    page.drawText(`Privacy contact: privacy@jagroupservices.co.uk`, { x: ML, y, size: 8, font: fontR, color: C_GRAY });

    // ══════════════════════════════════════════════════════════════════════════
    // DATA SECTIONS
    // ══════════════════════════════════════════════════════════════════════════
    newPage();

    // ── SECURITY AUDIT STAMP ─────────────────────────────────────────────────
    // Per JA Group Services security policy: every PDF must carry a tamper-evident
    // audit stamp showing admin identity, JA Group Services ID, verified email,
    // document reference, version, organisation, timestamp, and verification code.
    ensureSpace(160);
    const stampY = y;
    page.drawRectangle({ x: ML, y: stampY - 140, width: CONTENT_W, height: 148, color: rgb(0.96, 0.98, 1.0) });
    page.drawRectangle({ x: ML, y: stampY - 140, width: 4, height: 148, color: C_BRAND });
    page.drawText('SECURITY AUDIT STAMP', { x: ML + 12, y: stampY - 8, size: 10, font: fontB, color: C_BRAND });
    page.drawText('This stamp is embedded in the PDF and cannot be removed through the normal platform interface.', {
      x: ML + 12, y: stampY - 22, size: 7.5, font: fontR, color: C_GRAY,
    });

    const stampRows: [string, string][] = [
      ['Document Reference',      docRef],
      ['Document Version',        docVer],
      ['Organisation',            docOrg],
      ['Generated At',            generatedAt],
      ['Generated By (Name)',     adminName],
      ['Generated By (Email)',    adminEmail || 'N/A'],
      ['JA Group Services ID',    adminJaId  || 'N/A'],
      ['Sousa Murray Profiles User Number', d.account.user_number ? String(d.account.user_number).replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4') : 'N/A'],
      ['Subject Account ID',      String(userId)],
      ['Subject Email',           fmt(d.account.email)],
      ['Verification Code',       verificationCode],
    ];
    let sy = stampY - 38;
    stampRows.forEach(([label, value], i) => {
      if (i % 2 === 0) page.drawRectangle({ x: ML + 8, y: sy - 3, width: CONTENT_W - 16, height: 13, color: C_STRIPE });
      page.drawText(s(label), { x: ML + 12, y: sy, size: 7.5, font: fontB, color: C_DARK });
      page.drawText(s(value).slice(0, 90), { x: ML + 160, y: sy, size: 7.5, font: fontR, color: C_DARK });
      sy -= 13;
    });
    y = stampY - 148;
    gap(12);

    // ── 1. Account Information ────────────────────────────────────────────────
    sectionHeader('1', 'Account Information');
    kv('Full Name',                    fmt(d.account.name),              false);
    kv('Email Address',                fmt(d.account.email),             true);
    kv('Phone',                        fmt(d.account.phone),             false);
    kv('Sousa Murray Profiles User Number', d.account.user_number ? String(d.account.user_number).replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4') : 'N/A', true);
    kv('Internal Account ID',          fmt(d.account.id),                false);
    kv('JA Group Services OID',        fmt(d.account.entra_oid),         true);
    kv('Stripe Customer ID',           fmt(d.account.stripe_customer_id),false);
    kv('Account Created',              fmt(d.account.created_at),        true);
    kv('Last Login',                   fmt(d.account.last_login_at),     false);
    kv('Account Status',               d.account.is_paused ? `Paused — ${fmt(d.account.pause_reason)}` : 'Active', true);
    kv('Lifetime Access',        yesNo(d.account.lifetime_access), true);
    kv('Trial Started',          fmt(d.account.trial_started_at),  false);
    kv('Current Plan',           fmt(d.account.plan_name),         true);

    // ── 2. Consent ────────────────────────────────────────────────────────────
    sectionHeader('2', 'Consent & Privacy Preferences');
    const c = d.consent;
    kv('Terms of Service',    `${yesNo(c.terms_consent)} — ${fmt(c.terms_consent_at)}`,           false);
    kv('Privacy Policy',      `${yesNo(c.privacy_consent)} — ${fmt(c.privacy_consent_at)}`,       true);
    kv('Marketing Emails',    `${yesNo(c.marketing_consent)} — ${fmt(c.marketing_consent_at)}`,   false);
    kv('Product Updates',     `${yesNo(c.updates_consent)} — ${fmt(c.updates_consent_at)}`,       true);
    kv('Data Improvement',    `${yesNo(c.data_improve_consent)} — ${fmt(c.data_improve_consent_at)}`, false);
    kv('CRM Communications',  `${yesNo(c.crm_consent)} — ${fmt(c.crm_consent_at)}`,               true);
    kv('Referral Programme',  `${yesNo(c.referral_consent)} — ${fmt(c.referral_consent_at)}`,     false);
    kv('Consent IP Address',  fmt(c.consent_ip),                                                   true);
    kv('Consent Version',     fmt(c.consent_version),                                              false);

    // ── 3. Plan & Subscription ────────────────────────────────────────────────
    sectionHeader('3', 'Plan & Subscription History');
    kv('Current Plan',   fmt(d.account.plan_name),    false);
    kv('Monthly Price',  d.account.price_monthly != null ? `£${d.account.price_monthly}` : '—', true);
    kv('Yearly Price',   d.account.price_yearly  != null ? `£${d.account.price_yearly}`  : '—', false);
    kv('Max Profiles',   fmt(d.account.max_profiles), true);
    kv('Max Links',      fmt(d.account.max_links),    false);
    kv('Max Seats',      fmt(d.account.max_seats),    true);
    gap(6);
    if (d.subscriptions.length === 0) {
      emptyState('No subscription records found.');
    } else {
      tableHeader(['Plan', 'Status', 'Billing', 'Period Start', 'Period End', 'Auto-Renew'], [90, 65, 55, 110, 110, 75]);
      d.subscriptions.forEach((s, i) => {
        tableRow([fmt(s.plan_name), fmt(s.status), fmt(s.billing_interval), fmt(s.current_period_start), fmt(s.current_period_end), yesNo(!s.cancel_at_period_end)], [90, 65, 55, 110, 110, 75], i % 2 === 0);
      });
    }

    // ── 4. Personal Profiles ──────────────────────────────────────────────────
    sectionHeader('4', 'Personal Profiles');
    if (d.personal_profiles.length === 0) {
      emptyState('No personal profiles found.');
    } else {
      d.personal_profiles.forEach((p, idx) => {
        profileSubHeader(`Personal Profile ${idx + 1}: ${fmt(p.display_name)}`);
        kv('Display Name', fmt(p.display_name), false);
        kv('Job Title',    fmt(p.job_title),    true);
        kv('Company',      fmt(p.company),      false);
        kv('Email',        fmt(p.email),        true);
        kv('Phone',        fmt(p.phone),        false);
        kv('Website',      fmt(p.website),      true);
        kv('Address',      fmt(p.address),      false);
        kv('Bio',          fmt(p.bio),          true);
        kv('Published',    yesNo(p.is_published), false);
        kv('Slug',         fmt(p.slug),         true);
        kv('Created',      fmt(p.created_at),   false);
        kv('Updated',      fmt(p.updated_at),   true);
        gap(6);
      });
    }

    // ── 5. Business Profiles ──────────────────────────────────────────────────
    sectionHeader('5', 'Business Profiles');
    if (d.business_profiles.length === 0) {
      emptyState('No business profiles found.');
    } else {
      d.business_profiles.forEach((p, idx) => {
        profileSubHeader(`Business Profile ${idx + 1}: ${fmt(p.business_name || p.display_name)}`);
        kv('Display Name',        fmt(p.display_name),         false);
        kv('Business Name',       fmt(p.business_name),        true);
        kv('Business Description',fmt(p.business_description), false);
        kv('Business Category',   fmt(p.business_category),    true);
        kv('Business Email',      fmt(p.business_email),       false);
        kv('Business Phone',      fmt(p.business_phone),       true);
        kv('Website',             fmt(p.website),              false);
        kv('Address',             fmt(p.address),              true);
        kv('Published',           yesNo(p.is_published),       false);
        kv('Slug',                fmt(p.slug),                 true);
        kv('Created',             fmt(p.created_at),           false);
        gap(6);
      });
    }

    // ── 6. Public Profile URLs ────────────────────────────────────────────────
    sectionHeader('6', 'Public Profile URLs');
    if (d.public_profile_urls.length === 0) {
      emptyState('No public profile URLs found.');
    } else {
      tableHeader(['Profile Name', 'Type', 'Slug', 'Public URL', 'Published'], [100, 60, 80, 195, 70]);
      d.public_profile_urls.forEach((u, i) => {
        tableRow([fmt(u.profile_name), fmt(u.profile_type), fmt(u.slug), fmt(u.public_url), yesNo(u.is_published)], [100, 60, 80, 195, 70], i % 2 === 0);
      });
    }

    // ── 7. Profile Links & QR Codes ───────────────────────────────────────────
    sectionHeader('7', 'Profile Links & QR Codes');
    if (d.links.length === 0) {
      emptyState('No profile links found.');
    } else {
      tableHeader(['Label', 'Platform', 'URL', 'Profile', 'Active', 'Added'], [75, 65, 165, 90, 45, 65]);
      d.links.forEach((l, i) => {
        tableRow([fmt(l.title), fmt(l.platform), fmt(l.url), fmt(l.profile_name), yesNo(l.is_enabled), fmt(l.created_at)], [75, 65, 165, 90, 45, 65], i % 2 === 0);
      });
    }
    gap(8);
    if (d.qr_codes.length === 0) {
      emptyState('No QR code records found (QR codes are generated on demand and may not be stored separately).');
    } else {
      tableHeader(['Profile', 'Format', 'Generated'], [200, 100, CONTENT_W - 300]);
      d.qr_codes.forEach((q, i) => {
        tableRow([fmt(q.profile_name), fmt(q.format), fmt(q.created_at)], [200, 100, CONTENT_W - 300], i % 2 === 0);
      });
    }

    // ── 8. Seat Memberships ───────────────────────────────────────────────────
    sectionHeader('8', 'Business Seat Memberships');
    if (d.seat_memberships.length === 0) {
      emptyState('Not a member of any business profiles.');
    } else {
      tableHeader(['Business', 'Owner', 'Owner Email', 'Role', 'Status', 'Joined'], [100, 80, 110, 60, 60, 95]);
      d.seat_memberships.forEach((s, i) => {
        tableRow([fmt(s.business_name), fmt(s.owner_name), fmt(s.owner_email), fmt(s.role), fmt(s.status), fmt(s.created_at)], [100, 80, 110, 60, 60, 95], i % 2 === 0);
      });
    }

    // ── 9. Analytics ──────────────────────────────────────────────────────────
    sectionHeader('9', 'Analytics Summary');
    infoBox('Aggregated counts only. Raw visitor IP addresses and individual session data are not included in this export.');
    kv('Total Profile Page Views', String(d.analytics.page_view_count), false);
    kv('Total Link Clicks',        String(d.analytics.link_click_count), true);

    // ── 10. Contact Enquiries ─────────────────────────────────────────────────
    sectionHeader('10', 'Contact Enquiries Received');
    if (d.enquiries.length === 0) {
      emptyState('No contact enquiries on file.');
    } else {
      tableHeader(['From Name', 'From Email', 'Profile', 'Message (preview)', 'Date'], [90, 120, 90, 130, 75]);
      d.enquiries.forEach((e, i) => {
        const preview = String(e.message ?? '').slice(0, 40) + (String(e.message ?? '').length > 40 ? '...' : '');
        tableRow([fmt(e.visitor_name), fmt(e.visitor_email), fmt(e.profile_name), preview, fmt(e.created_at)], [90, 120, 90, 130, 75], i % 2 === 0);
      });
    }

    // ── 11. Reports & Moderation ──────────────────────────────────────────────
    sectionHeader('11', 'Reports & Moderation');
    ensureSpace(14);
    page.drawText('Reports submitted by this user:', { x: ML + 4, y, size: 8, font: fontB, color: C_DARK }); y -= 14;
    if (d.reports_by_user.length === 0) {
      emptyState('No reports submitted by this user.');
    } else {
      tableHeader(['Type', 'Status', 'Description', 'Submitted'], [100, 80, 200, 125]);
      d.reports_by_user.forEach((r, i) => {
        tableRow([fmt(r.report_type), fmt(r.status), fmt(r.description), fmt(r.created_at)], [100, 80, 200, 125], i % 2 === 0);
      });
    }
    gap(8);
    ensureSpace(14);
    page.drawText('Reports made about this user\'s profiles:', { x: ML + 4, y, size: 8, font: fontB, color: C_DARK }); y -= 14;
    if (d.reports_about_user.length === 0) {
      emptyState('No reports made about this user\'s profiles.');
    } else {
      tableHeader(['Profile', 'Type', 'Status', 'Date'], [150, 120, 100, 135]);
      d.reports_about_user.forEach((r, i) => {
        tableRow([fmt(r.profile_name), fmt(r.report_type), fmt(r.status), fmt(r.created_at)], [150, 120, 100, 135], i % 2 === 0);
      });
    }

    // ── 12. Support Requests ──────────────────────────────────────────────────
    sectionHeader('12', 'Support Requests');
    if (d.support_requests.length === 0) {
      emptyState('No support requests on file.');
    } else {
      tableHeader(['Category', 'Subject', 'Status', 'Submitted', 'Updated'], [90, 150, 70, 110, 85]);
      d.support_requests.forEach((s, i) => {
        tableRow([fmt(s.category), fmt(s.subject), fmt(s.status), fmt(s.created_at), fmt(s.updated_at)], [90, 150, 70, 110, 85], i % 2 === 0);
      });
    }

    // ── 13. Notifications & Service Messages ──────────────────────────────────
    sectionHeader('13', 'Notifications & Service Messages');
    infoBox('Platform-to-user communications only. No visitor direct messages are included (that feature was removed).');
    if (d.notifications.length === 0) {
      emptyState('No notifications on file.');
    } else {
      tableHeader(['Type', 'Title', 'Read', 'Date'], [90, 230, 50, 135]);
      d.notifications.forEach((n, i) => {
        tableRow([fmt(n.type), fmt(n.title), yesNo(n.is_read), fmt(n.created_at)], [90, 230, 50, 135], i % 2 === 0);
      });
    }

    // ── 14. Billing & Invoices ────────────────────────────────────────────────
    sectionHeader('14', 'Billing & Invoices');
    if (d.invoices.length === 0) {
      emptyState('No invoice records found. Billing history may be available directly from Stripe.');
    } else {
      tableHeader(['Stripe Invoice ID', 'Amount Due', 'Amount Paid', 'Status', 'Date'], [150, 80, 80, 80, 115]);
      d.invoices.forEach((inv, i) => {
        const cur = String(inv.currency ?? 'gbp').toUpperCase();
        tableRow([fmt(inv.stripe_invoice_id), `${cur} ${fmt(inv.amount_due)}`, `${cur} ${fmt(inv.amount_paid)}`, fmt(inv.status), fmt(inv.created_at)], [150, 80, 80, 80, 115], i % 2 === 0);
      });
    }

    // ── 15. Data Requests ─────────────────────────────────────────────────────
    sectionHeader('15', 'Data Requests');
    if (d.data_requests.length === 0) {
      emptyState('No previous data requests on file.');
    } else {
      tableHeader(['Type', 'Status', 'Description', 'Submitted', 'Completed'], [90, 70, 140, 110, 95]);
      d.data_requests.forEach((dr, i) => {
        tableRow([fmt(dr.request_type), fmt(dr.status), fmt(dr.description), fmt(dr.created_at), fmt(dr.completed_at)], [90, 70, 140, 110, 95], i % 2 === 0);
      });
    }

    // ── 16. Account Closure Requests ─────────────────────────────────────────
    sectionHeader('16', 'Account Closure Requests');
    if (d.closure_requests.length === 0) {
      emptyState('No account closure requests on file.');
    } else {
      tableHeader(['Status', 'Reason', 'Submitted', 'Updated'], [80, 220, 120, 85]);
      d.closure_requests.forEach((cr, i) => {
        tableRow([fmt(cr.status), fmt(cr.reason), fmt(cr.created_at), fmt(cr.updated_at)], [80, 220, 120, 85], i % 2 === 0);
      });
    }

    // ── 17. Security & Session Audit ──────────────────────────────────────────
    sectionHeader('17', 'Security & Session Audit (last 200 events)');
    infoBox('Passwords, PINs, session tokens and secrets are never included in SAR exports.');
    if (d.audit_entries.length === 0) {
      emptyState('No audit log entries found.');
    } else {
      tableHeader(['Action', 'Actor', 'Details', 'IP', 'Result', 'Date'], [110, 55, 130, 80, 50, 80]);
      d.audit_entries.forEach((a, i) => {
        tableRow([fmt(a.action), fmt(a.actor_type), fmt(a.details), fmt(a.ip_address), fmt(a.result), fmt(a.created_at)], [110, 55, 130, 80, 50, 80], i % 2 === 0);
      });
    }

    // ── 18. Referral & Points ─────────────────────────────────────────────────
    sectionHeader('18', 'Referral & Points');
    kv('Referral Code',   d.referral.code ?? '—',              false);
    kv('Points Balance',  String(d.referral.points_balance),   true);
    if (d.referral.points_history.length > 0) {
      gap(6);
      tableHeader(['Amount', 'Reason', 'Date'], [70, 290, CONTENT_W - 360]);
      d.referral.points_history.forEach((pt, i) => {
        tableRow([fmt(pt.amount), fmt(pt.reason), fmt(pt.created_at)], [70, 290, CONTENT_W - 360], i % 2 === 0);
      });
    } else {
      emptyState('No points history found.');
    }

    // ── 19. Email Signature (Coming Soon) ─────────────────────────────────────
    sectionHeader('19', 'Email Signature (Coming Soon — data stored)');
    infoBox('Email Signature is not yet live. Data stored during setup is included below for completeness.');
    if (!d.email_signature_coming_soon) {
      emptyState('No email signature data stored.');
    } else {
      const es = d.email_signature_coming_soon;
      kv('Template',   fmt(es.template_id), false);
      kv('Name',       fmt(es.name),        true);
      kv('Job Title',  fmt(es.job_title),   false);
      kv('Company',    fmt(es.company),     true);
      kv('Phone',      fmt(es.phone),       false);
      kv('Email',      fmt(es.email),       true);
      kv('Website',    fmt(es.website),     false);
      kv('Created',    fmt(es.created_at),  true);
      kv('Updated',    fmt(es.updated_at),  false);
    }

    // ── 20. Business Card Orders (Coming Soon) ────────────────────────────────
    sectionHeader('20', 'Business Card Orders (Coming Soon — data stored)');
    infoBox('Business Cards are not yet live. Any order records below are stored data only — no orders have been fulfilled.');
    if (d.business_card_orders_coming_soon.length === 0) {
      emptyState('No business card order records found.');
    } else {
      tableHeader(['Profile', 'Status', 'Qty', 'Finish', 'Sides', 'Fee', 'Submitted'], [100, 80, 35, 60, 45, 55, 130]);
      d.business_card_orders_coming_soon.forEach((o, i) => {
        tableRow([fmt(o.profile_name), fmt(o.status), fmt(o.quantity), fmt(o.finish), fmt(o.sides), o.design_fee_amount ? `£${o.design_fee_amount}` : '—', fmt(o.created_at)], [100, 80, 35, 60, 45, 55, 130], i % 2 === 0);
      });
    }

    // ── 21. Legacy / Historical Data ──────────────────────────────────────────
    sectionHeader('21', 'Legacy / Historical Data (removed features)', true);
    infoBox('The following sections relate to features that have been removed from Sousa Murray Profiles.');
    infoBox('This data is included for completeness under UK GDPR. These features are no longer active.');

    gap(6);
    ensureSpace(14);
    page.drawText('Visitor Direct Messages (card_messages) - feature removed:', { x: ML + 4, y, size: 8, font: fontB, color: C_LEGACY }); y -= 14;
    if (d.legacy.card_messages.length === 0) {
      emptyState('No legacy direct message records found.');
    } else {
      tableHeader(['Profile', 'Sender Type', 'Sender Name', 'Message (preview)', 'Date'], [100, 70, 90, 145, 100]);
      d.legacy.card_messages.forEach((m, i) => {
        const preview = String(m.message ?? '').slice(0, 45) + (String(m.message ?? '').length > 45 ? '...' : '');
        tableRow([fmt(m.profile_name), fmt(m.sender_type), fmt(m.sender_name), preview, fmt(m.created_at)], [100, 70, 90, 145, 100], i % 2 === 0);
      });
    }

    gap(10);

    // ── Apply chrome ──────────────────────────────────────────────────────────
    drawChrome();

    // ── Serialise & send ──────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const safeName = String(d.account.name ?? 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SAR_${safeName}_${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(Buffer.from(pdfBytes));

    // Audit
    await writeAudit({
      actorId: adminId, actorName: adminName, actorEmail: adminEmail, actorType: 'admin',
      tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'sar_pdf_downloaded',
      resourceType: 'user', resourceId: String(userId),
      resourceLabel: fmt(d.account.email),
      details: `SAR PDF generated for ${fmt(d.account.name)} (user ${userId}) | Doc ref: ${docRef} | Admin: ${adminName} <${adminEmail}> JA-ID:${adminJaId} | VC:${verificationCode}`,
      ipAddress: req.ip, result: 'success',
    });

  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('[SAR PDF] error:', msg);
    if (!res.headersSent) res.status(500).json({ success: false, error: msg });
  }
}
