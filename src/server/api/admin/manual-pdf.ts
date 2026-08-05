/**
 * GET /api/admin/manual/pdf?section=all|admin|user
 *
 * Generates a comprehensive PDF manual for Sousa Murray Profiles.
 * - section=admin  → Admin Manual only
 * - section=user   → User Dashboard Manual only
 * - section=all    → Full combined manual (default)
 *
 * Uses pdf-lib (pure JS, no native deps).
 */
import type { Request, Response } from 'express';
import { PDFDocument, StandardFonts, rgb, type RGB, type PDFPage, type PDFFont } from 'pdf-lib';

/**
 * Replace characters outside WinAnsi (latin-1 supplement, U+0000-U+00FF) with
 * safe ASCII equivalents so pdf-lib's StandardFonts never throw an encode error.
 */
function s(text: string): string {
  return text
    .replace(/\u2014/g, '-')   // em dash  —  -> -
    .replace(/\u2013/g, '-')   // en dash  –  -> -
    .replace(/\u2026/g, '...') // ellipsis …  -> ...
    .replace(/\u2192/g, '->')  // arrow    →  -> ->
    .replace(/\u2190/g, '<-')  // arrow    ←  -> <-
    .replace(/\u2018|\u2019/g, "'")  // curly single quotes
    .replace(/\u201c|\u201d/g, '"')  // curly double quotes
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00ae/g, '(R)')
    .replace(/\u00a9/g, '(c)')
    .replace(/\u2713|\u2714/g, 'Y')  // check marks
    .replace(/\u2717|\u2718/g, 'N')  // cross marks
    .replace(/\u2139/g, 'i')         // info  ℹ
    .replace(/\u26a0/g, '!')         // warning ⚠
    .replace(/[^\u0000-\u00ff]/g, '?'); // catch-all for anything else
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  navy:       rgb(0.118, 0.227, 0.373),   // #1e3a5f
  brand:      rgb(0.145, 0.380, 0.922),   // #2563eb
  accent:     rgb(0.376, 0.647, 0.980),   // #60a5fa
  gold:       rgb(0.788, 0.659, 0.298),   // #c9a84c
  white:      rgb(1, 1, 1),
  black:      rgb(0, 0, 0),
  dark:       rgb(0.118, 0.161, 0.231),   // #1e293b
  muted:      rgb(0.420, 0.447, 0.502),   // #6b7280
  light:      rgb(0.949, 0.953, 0.957),   // #f1f3f5
  border:     rgb(0.882, 0.894, 0.910),   // #e1e4e8
  green:      rgb(0.133, 0.545, 0.133),
  red:        rgb(0.800, 0.200, 0.200),
  amber:      rgb(0.800, 0.600, 0.100),
};

// ── Page setup ─────────────────────────────────────────────────────────────────
const A4W = 595.28;
const A4H = 841.89;
const MARGIN = 56;
const CONTENT_W = A4W - MARGIN * 2;

// ── Renderer state ─────────────────────────────────────────────────────────────
interface Ctx {
  doc: PDFDocument;
  pages: PDFPage[];
  fontB: PDFFont;
  fontR: PDFFont;
  fontI: PDFFont;
  fontBI: PDFFont;
  y: number;
  pageNum: number;
  toc: Array<{ title: string; page: number; level: number }>;
}

function newPage(ctx: Ctx): PDFPage {
  const page = ctx.doc.addPage([A4W, A4H]);
  ctx.pages.push(page);
  ctx.pageNum = ctx.pages.length;
  ctx.y = A4H - MARGIN;

  // Header rule
  page.drawLine({ start: { x: MARGIN, y: A4H - 36 }, end: { x: A4W - MARGIN, y: A4H - 36 }, thickness: 0.5, color: C.border });
  page.drawText(s('Sousa Murray Profiles - Platform Manual'), { x: MARGIN, y: A4H - 28, size: 7, font: ctx.fontR, color: C.muted });
  page.drawText(`Page ${ctx.pageNum}`, { x: A4W - MARGIN - 30, y: A4H - 28, size: 7, font: ctx.fontR, color: C.muted });

  // Footer rule
  page.drawLine({ start: { x: MARGIN, y: 36 }, end: { x: A4W - MARGIN, y: 36 }, thickness: 0.5, color: C.border });
  page.drawText(s('Confidential - JA Group Services Ltd'), { x: MARGIN, y: 24, size: 7, font: ctx.fontR, color: C.muted });
  page.drawText('japrofilestudio.jagroupservices.co.uk', { x: A4W - MARGIN - 120, y: 24, size: 7, font: ctx.fontR, color: C.muted });

  ctx.y = A4H - 56;
  return page;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < 56) newPage(ctx);
}

function currentPage(ctx: Ctx): PDFPage {
  return ctx.pages[ctx.pages.length - 1];
}

function drawText(ctx: Ctx, text: string, size: number, font: PDFFont, color: RGB, indent = 0, lineHeight?: number) {
  const lh = lineHeight ?? size * 1.5;
  const maxW = CONTENT_W - indent;
  // Word-wrap
  const words = s(text).split(' ');
  let line = '';
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  for (const l of lines) {
    ensureSpace(ctx, lh);
    currentPage(ctx).drawText(l, { x: MARGIN + indent, y: ctx.y, size, font, color });
    ctx.y -= lh;
  }
}

function drawH1(ctx: Ctx, text: string, isAdmin: boolean) {
  ensureSpace(ctx, 60);
  const page = currentPage(ctx);
  // Background band
  page.drawRectangle({ x: 0, y: ctx.y - 8, width: A4W, height: 44, color: isAdmin ? C.navy : C.brand });
  page.drawText(s(text), { x: MARGIN, y: ctx.y + 16, size: 22, font: ctx.fontB, color: C.white });
  ctx.toc.push({ title: text, page: ctx.pageNum, level: 1 });
  ctx.y -= 52;
}

function drawH2(ctx: Ctx, text: string) {
  ensureSpace(ctx, 40);
  ctx.y -= 8;
  const page = currentPage(ctx);
  page.drawRectangle({ x: MARGIN, y: ctx.y - 4, width: CONTENT_W, height: 26, color: C.light });
  page.drawRectangle({ x: MARGIN, y: ctx.y - 4, width: 4, height: 26, color: C.brand });
  page.drawText(s(text), { x: MARGIN + 12, y: ctx.y + 6, size: 13, font: ctx.fontB, color: C.dark });
  ctx.toc.push({ title: '  ' + text, page: ctx.pageNum, level: 2 });
  ctx.y -= 32;
}

function drawH3(ctx: Ctx, text: string) {
  ensureSpace(ctx, 28);
  ctx.y -= 4;
  currentPage(ctx).drawText(s(text), { x: MARGIN, y: ctx.y, size: 11, font: ctx.fontB, color: C.dark });
  ctx.y -= 18;
}

function drawPara(ctx: Ctx, text: string, indent = 0) {
  drawText(ctx, text, 9, ctx.fontR, C.dark, indent, 14);
  ctx.y -= 4;
}

function drawBullet(ctx: Ctx, text: string, indent = 0) {
  ensureSpace(ctx, 14);
  const bx = MARGIN + indent;
  currentPage(ctx).drawCircle({ x: bx + 4, y: ctx.y + 3, size: 2, color: C.brand });
  drawText(ctx, text, 9, ctx.fontR, C.dark, indent + 12, 14);
}

function drawNote(ctx: Ctx, text: string, type: 'info' | 'warning' | 'tip' = 'info') {
  const colors = { info: C.brand, warning: C.amber, tip: C.green };
  const labels = { info: 'i Note', warning: '! Important', tip: 'Y Tip' };
  ensureSpace(ctx, 36);
  ctx.y -= 4;
  const page = currentPage(ctx);
  const startY = ctx.y;
  // Estimate height
  const estLines = Math.ceil(text.length / 80) + 1;
  const boxH = estLines * 14 + 16;
  page.drawRectangle({ x: MARGIN, y: startY - boxH + 8, width: CONTENT_W, height: boxH, color: C.light, borderColor: colors[type], borderWidth: 0.5 });
  page.drawRectangle({ x: MARGIN, y: startY - boxH + 8, width: 3, height: boxH, color: colors[type] });
  page.drawText(labels[type], { x: MARGIN + 10, y: startY - 4, size: 8, font: ctx.fontB, color: colors[type] });
  ctx.y -= 16;
  drawText(ctx, text, 8.5, ctx.fontR, C.dark, 10, 13);
  ctx.y -= 8;
}

function drawTableRow(ctx: Ctx, cells: string[], widths: number[], isHeader: boolean) {
  ensureSpace(ctx, 20);
  const page = currentPage(ctx);
  const rowH = 18;
  let cx = MARGIN;
  if (isHeader) {
    page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: C.navy });
  } else {
    page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: C.white, borderColor: C.border, borderWidth: 0.3 });
  }
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i].slice(0, 50);
    page.drawText(s(cell), { x: cx + 4, y: ctx.y - 2, size: 8, font: isHeader ? ctx.fontB : ctx.fontR, color: isHeader ? C.white : C.dark });
    cx += widths[i];
  }
  ctx.y -= rowH;
}

function drawDivider(ctx: Ctx) {
  ensureSpace(ctx, 16);
  ctx.y -= 8;
  currentPage(ctx).drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: A4W - MARGIN, y: ctx.y }, thickness: 0.4, color: C.border });
  ctx.y -= 8;
}

function drawPageBreak(ctx: Ctx) {
  newPage(ctx);
}

// ── Cover page ─────────────────────────────────────────────────────────────────
function buildCover(ctx: Ctx, section: string) {
  const page = currentPage(ctx);

  // Full-page navy background
  page.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: C.navy });

  // Gold accent bar
  page.drawRectangle({ x: 0, y: A4H - 8, width: A4W, height: 8, color: C.gold });
  page.drawRectangle({ x: 0, y: 0, width: A4W, height: 8, color: C.gold });

  // Brand mark
  page.drawRectangle({ x: MARGIN, y: A4H - 80, width: 48, height: 48, color: C.brand, borderColor: C.accent, borderWidth: 1 });
  page.drawText('JA', { x: MARGIN + 12, y: A4H - 52, size: 22, font: ctx.fontB, color: C.white });

  // Title
  const titleY = A4H / 2 + 80;
  page.drawText('Sousa Murray Profiles', { x: MARGIN, y: titleY, size: 32, font: ctx.fontB, color: C.white });
  page.drawText('Platform Manual', { x: MARGIN, y: titleY - 42, size: 24, font: ctx.fontR, color: C.accent });

  const subtitle = section === 'admin' ? 'Administrator Guide'
    : section === 'user' ? 'User Dashboard Guide'
    : 'Complete Platform Reference';
  page.drawText(subtitle, { x: MARGIN, y: titleY - 76, size: 14, font: ctx.fontI, color: C.gold });

  // Divider
  page.drawLine({ start: { x: MARGIN, y: titleY - 96 }, end: { x: A4W - MARGIN, y: titleY - 96 }, thickness: 1, color: C.gold });

  // Meta
  const metaY = titleY - 120;
  page.drawText('Operated by: JA Group Services Ltd', { x: MARGIN, y: metaY, size: 10, font: ctx.fontR, color: C.accent });
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: MARGIN, y: metaY - 16, size: 10, font: ctx.fontR, color: C.accent });
  page.drawText('Version: 3.0', { x: MARGIN, y: metaY - 32, size: 10, font: ctx.fontR, color: C.accent });
  page.drawText('japrofilestudio.jagroupservices.co.uk', { x: MARGIN, y: metaY - 48, size: 10, font: ctx.fontR, color: C.accent });

  // Confidentiality notice
  page.drawText('CONFIDENTIAL - For internal use only. Do not distribute externally.', { x: MARGIN, y: 60, size: 8, font: ctx.fontI, color: C.muted });
}

// ── TOC page ───────────────────────────────────────────────────────────────────
function buildTocPage(ctx: Ctx) {
  newPage(ctx);
  const page = currentPage(ctx);
  page.drawText('Table of Contents', { x: MARGIN, y: ctx.y, size: 20, font: ctx.fontB, color: C.navy });
  ctx.y -= 32;
  // TOC entries will be filled after all pages are built
  // We store a reference to the page index for post-processing
  (ctx as any)._tocPageIdx = ctx.pages.length - 1;
  (ctx as any)._tocStartY = ctx.y;
}

function fillToc(ctx: Ctx) {
  const tocPageIdx = (ctx as any)._tocPageIdx as number;
  if (tocPageIdx === undefined) return;
  const page = ctx.pages[tocPageIdx];
  let y = (ctx as any)._tocStartY as number;
  const dotFont = ctx.fontR;

  for (const entry of ctx.toc) {
    if (y < 60) break; // overflow protection
    const indent = entry.level === 1 ? 0 : 16;
    const size = entry.level === 1 ? 10 : 9;
    const font = entry.level === 1 ? ctx.fontB : ctx.fontR;
    const color = entry.level === 1 ? C.dark : C.muted;

    const titleText = entry.title.trim();
    const pageText = String(entry.page);
    const titleW = font.widthOfTextAtSize(titleText, size);
    const pageW = dotFont.widthOfTextAtSize(pageText, size);
    const dotsW = CONTENT_W - indent - titleW - pageW - 8;

    page.drawText(titleText, { x: MARGIN + indent, y, size, font, color });
    // Dots
    if (dotsW > 0) {
      const dot = '.';
      const dotW = dotFont.widthOfTextAtSize(dot, size);
      const numDots = Math.floor(dotsW / dotW);
      page.drawText(dot.repeat(Math.max(0, numDots)), { x: MARGIN + indent + titleW + 4, y, size: size - 1, font: dotFont, color: C.border });
    }
    page.drawText(pageText, { x: A4W - MARGIN - pageW, y, size, font: dotFont, color: C.brand });
    y -= entry.level === 1 ? 16 : 13;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ADMIN MANUAL SECTIONS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildAdminManual(ctx: Ctx) {
  // ── 1. Admin Overview ──────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '1. Admin Portal Overview', true);
  drawPara(ctx, 'The Sousa Murray Profiles Admin Portal is accessible at /admin. It is protected by two layers of authentication: JA Group Services ID (Microsoft Entra OIDC) and a secondary PIN gate. Only authorised JA Group Services staff may access the admin portal.');
  drawNote(ctx, 'Admin access requires: (1) Microsoft Entra login via JA Group Services ID, and (2) a 4-8 digit PIN. After 10 failed PIN attempts, the account is locked. The rate limiter blocks after 15 attempts per 15 minutes (IP-based). Admins can self-unlock from Security Settings.', 'warning');

  drawH2(ctx, '1.1 Admin Navigation');
  drawPara(ctx, 'The admin sidebar provides access to all management areas:');
  drawBullet(ctx, 'Dashboard — Platform overview, stats, quick actions, settings summary');
  drawBullet(ctx, 'Users & CRM — Unified user list + full CRM detail per user (plan, billing, notes, audit, SAR, features, controls)');
  drawBullet(ctx, 'Profiles — Profile management, publish/unpublish, verification');
  drawBullet(ctx, 'Analytics — Platform-wide analytics and usage stats');
  drawBullet(ctx, 'Communications — Compose broadcast email');
  drawBullet(ctx, 'Plans — Subscription plan management');
  drawBullet(ctx, 'Business Cards — Printed card order management');
  drawBullet(ctx, 'Features — Feature flag management per plan/user');
  drawBullet(ctx, 'Legal — Policy document editor');
  drawBullet(ctx, 'Settings — Platform settings, email, DNS, security, manual download');
  drawBullet(ctx, 'Audit Log — Full audit trail of all admin actions');
  drawBullet(ctx, 'Data Requests — SAR and data export requests');
  drawBullet(ctx, 'Support Requests — Customer support tickets');
  drawBullet(ctx, 'Issue Reports — User-submitted issue reports');
  drawBullet(ctx, 'Closure Requests — Account closure requests');
  drawBullet(ctx, 'Admin Accounts — Manage admin user accounts');

  drawH2(ctx, '1.2 PIN Security System');
  drawPara(ctx, 'The admin PIN gate provides a second layer of security beyond OIDC authentication.');
  drawTableRow(ctx, ['Action', 'PIN Required', 'Challenge Token Required'], [220, 120, 140], true);
  drawTableRow(ctx, ['View dashboard, users, profiles', 'Standard PIN', 'No'], [220, 120, 140], false);
  drawTableRow(ctx, ['Edit user plans, features', 'Standard PIN', 'No'], [220, 120, 140], false);
  drawTableRow(ctx, ['SAR / data export', 'High-risk PIN', 'Yes (5-min token)'], [220, 120, 140], false);
  drawTableRow(ctx, ['Delete / suspend account', 'High-risk PIN', 'Yes (5-min token)'], [220, 120, 140], false);
  drawTableRow(ctx, ['Legal policy changes', 'High-risk PIN', 'Yes (5-min token)'], [220, 120, 140], false);
  drawTableRow(ctx, ['Compose broadcast email', 'High-risk PIN', 'Yes (5-min token)'], [220, 120, 140], false);
  drawTableRow(ctx, ['Assisted access', 'High-risk PIN', 'Yes (5-min token)'], [220, 120, 140], false);
  drawTableRow(ctx, ['Authority/Incident Report', 'High-risk PIN', 'Yes (5-min token)'], [220, 120, 140], false);
  ctx.y -= 8;
  drawNote(ctx, 'PIN sessions expire after 15 minutes of inactivity. A heartbeat keeps the session alive while you are actively working. High-risk actions require re-entering the PIN each time to generate a one-time challenge token. Admins can clear their own DB lockout from Security Settings.', 'warning');

  // ── 2. User Management ─────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '2. User Management', true);

  drawH2(ctx, '2.1 Users & CRM (/admin/users)');
  drawPara(ctx, 'The Users & CRM page is the single unified view for all customer management. The top section is a searchable, filterable table of all registered accounts. Clicking a user opens their full CRM detail inline.');
  drawBullet(ctx, 'Search: real-time search by name or email');
  drawBullet(ctx, 'Filter: by plan (Free, Starter, Professional, Organisation, Ultimate Organisation, Ultimate Organisation+, Lifetime)');
  drawBullet(ctx, 'Status indicators: subscription status, last login, account status, profile count');
  drawBullet(ctx, 'Quick actions: edit plan, grant/revoke lifetime access, pause/resume, delete, open CRM detail');
  drawNote(ctx, 'All user queries use role != "admin" to ensure admin accounts are never shown in customer lists.', 'info');

  drawH2(ctx, '2.2 CRM Detail (/admin/users/:userId)');
  drawPara(ctx, 'The CRM detail page provides deep management capabilities for each customer. Tabs:');
  drawBullet(ctx, 'Overview — account details, plan, last login, registration date');
  drawBullet(ctx, 'Consent — marketing consent, GDPR consent history');
  drawBullet(ctx, 'Billing — subscription status, Stripe customer ID, lifetime access');
  drawBullet(ctx, 'Data Requests — SAR and deletion requests');
  drawBullet(ctx, 'SAR — generate Subject Access Request PDF (requires high-risk PIN)');
  drawBullet(ctx, 'Support — support tickets raised by this user');
  drawBullet(ctx, 'Issues — issue reports involving this user');
  drawBullet(ctx, 'Complaints — complaints raised by or about this user');
  drawBullet(ctx, 'Features — per-user feature overrides (e.g. email signature beta)');
  drawBullet(ctx, 'Audit — full history of admin actions on this account');
  drawBullet(ctx, 'Controls — block/unblock, pause/resume, assisted access');
  drawNote(ctx, 'Account deletion is irreversible. Always confirm with the user before proceeding. This action requires a high-risk PIN challenge token.', 'warning');

  drawH2(ctx, '2.3 Admin Accounts (/admin/admin-accounts)');
  drawPara(ctx, 'Manage admin user accounts. Only existing admins can create new admin accounts. Admin accounts use Microsoft Entra OIDC and cannot be created via the standard registration flow.');

  // ── 3. Profile Management ──────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '3. Profile Management', true);

  drawH2(ctx, '3.1 Profiles (/admin/profiles)');
  drawPara(ctx, 'The Profiles page lists all profiles on the platform. You can search, filter by type (personal/business), and manage publication status.');
  drawBullet(ctx, 'Search: by display name, username, or business name');
  drawBullet(ctx, 'Filter: by profile type, published status, plan');
  drawBullet(ctx, 'Publish / unpublish: toggle public visibility');
  drawBullet(ctx, 'Verify: mark a profile as verified (adds verification badge)');
  drawBullet(ctx, 'View: open the public profile in a new tab');
  drawBullet(ctx, 'Preview: view profile as it appears to the public');

  drawH2(ctx, '3.2 Profile Types');
  drawPara(ctx, 'Sousa Murray Profiles supports 14 profile types, each with type-specific sections:');
  const profileTypes = [
    ['professional', 'Full set: skills, experience, education, certifications, awards'],
    ['freelancer', 'Full set + portfolio links'],
    ['content_creator', 'Social channels, content niche, skills/tools, awards -- no work experience'],
    ['student', 'Education focus, skills, projects'],
    ['job_seeker', 'CV-style: experience, education, skills, target roles'],
    ['creative', 'Portfolio, creative disciplines, awards'],
    ['athlete', 'Sport, achievements, team affiliations'],
    ['nonprofit', 'Causes, skills, languages, awards'],
    ['faith', 'Ministry description, theological education, languages -- no pronouns'],
    ['personal_brand', 'Full set + speaking topics, coaching areas'],
    ['volunteer_charity', 'Causes, skills, languages, awards'],
    ['faith_ministry', 'Ministry role, theological education, languages'],
    ['nonprofit_ngo', 'Organisation mission, causes, team'],
    ['other', 'General purpose -- all sections available'],
  ];
  drawTableRow(ctx, ['Profile Type', 'Key Sections'], [160, 320], true);
  for (const [type, desc] of profileTypes) {
    drawTableRow(ctx, [type, desc], [160, 320], false);
  }
  ctx.y -= 8;

  drawH2(ctx, '3.3 Profile Moderation');
  drawPara(ctx, 'When a profile is reported by a user, the admin receives a notification. The moderation workflow:');
  drawBullet(ctx, 'Step 1: Review the report in Admin -> Issue Reports');
  drawBullet(ctx, 'Step 2: Automated risk scan runs on submission (critical risk = auto-hidden)');
  drawBullet(ctx, 'Step 3: Admin reviews profile content against Acceptable Use Policy');
  drawBullet(ctx, 'Step 4: Take action: warn, unpublish, suspend, or dismiss');
  drawBullet(ctx, 'Step 5: Notify reporter of outcome (where possible)');

  // ── 4. Communications ──────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '4. Communications', true);

  drawH2(ctx, '4.1 Enquiries (/admin/enquiries)');
  drawPara(ctx, 'The Enquiries page shows all contact form submissions sent by visitors through public profile pages. This is a one-way channel: visitors can send enquiries, but cannot receive replies through the platform. Admins can view, mark as read, flag as abuse, and delete enquiries.');
  drawBullet(ctx, 'View all enquiries across all profiles');
  drawBullet(ctx, 'Mark enquiries as read');
  drawBullet(ctx, 'Flag as abuse: creates a report in Reports & Moderation queue');
  drawBullet(ctx, 'Delete enquiries that violate policy');
  drawBullet(ctx, 'Auto-refresh every 30 seconds');
  drawNote(ctx, 'Direct user-to-user messaging has been removed from the platform. Visitors can only submit enquiries (one-way contact forms). Staff-to-user communication is handled via Compose Email only.', 'warning');

  drawH2(ctx, '4.2 Compose Email (/admin/compose-email) -- Staff-to-User Messaging');
  drawPara(ctx, 'Compose Email is the ONLY channel for staff-to-user communication. Direct in-platform messaging has been removed. All staff emails are sent via the Airo email gateway, which enforces TLS encryption in transit and uses the platform canonical sender identity.');
  drawBullet(ctx, 'Target: single user (by email), plan group, or all users');
  drawBullet(ctx, 'Template: uses the adminBroadcastEmail branded template (white card, navy header)');
  drawBullet(ctx, 'From: noreply@japrofilestudio.jagroupservices.co.uk (set by Airo gateway -- do not override)');
  drawBullet(ctx, 'Reply-To: contact@jagroupservices.co.uk');
  drawBullet(ctx, 'Encryption: all email is sent over TLS via the Airo gateway (127.0.0.1:2525)');
  drawBullet(ctx, 'Authentication: SPF, DKIM (selector: airo), and DMARC records protect sender identity');
  drawBullet(ctx, 'Audit: every send is logged in the audit trail with timestamp, target, and admin identity');
  drawBullet(ctx, 'Partial failures: logged with failed addresses; successful sends are not retried');
  drawBullet(ctx, 'High-risk gate: requires active Admin PIN challenge token before sending');
  drawNote(ctx, 'Never set a "from" field on sendEmail calls -- the Airo gateway uses the canonical sender automatically. Setting a custom from will be silently ignored or cause delivery failure.', 'warning');
  drawNote(ctx, 'To contact a specific user from the CRM, open their user record (/admin/users/:id), go to the Enquiries tab, and click "Compose Email to [user]". This pre-fills their email address in the Compose Email form.', 'info');

  drawH2(ctx, '4.3 Notifications (/admin/notifications)');
  drawPara(ctx, 'Configure and test platform notification settings. Admin alerts are sent to admin@jagroupservices.co.uk.');
  drawBullet(ctx, 'Test notification: fire a test email to verify the email gateway');
  drawBullet(ctx, 'Notification categories: ESSENTIAL (always sent), and 7 optional categories');
  drawBullet(ctx, 'Security alerts are ESSENTIAL and cannot be disabled');

  // ── 5. Analytics ───────────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '5. Analytics & Reporting', true);

  drawH2(ctx, '5.1 Platform Analytics (/admin/analytics)');
  drawPara(ctx, 'Platform-wide analytics showing:');
  drawBullet(ctx, 'Total users, profiles, and active sessions');
  drawBullet(ctx, 'Profile views and link clicks (platform total)');
  drawBullet(ctx, 'New registrations over time');
  drawBullet(ctx, 'Plan distribution (Free vs paid)');
  drawBullet(ctx, 'Top profiles by view count');

  drawH2(ctx, '5.2 Audit Log (/admin/audit)');
  drawPara(ctx, 'The audit log records every admin action on the platform. It is immutable and cannot be edited.');
  drawBullet(ctx, 'Filter by: actor type, resource type, action, result, date range');
  drawBullet(ctx, 'Search: by actor name, email, or resource label');
  drawBullet(ctx, 'Export: download as CSV');
  drawBullet(ctx, 'Retention: 12 months');
  drawNote(ctx, 'The audit log is the authoritative record of all admin activity. It is used for compliance, security investigations, and dispute resolution.', 'info');

  drawH2(ctx, '5.3 Subject Access Requests (/admin/data-requests)');
  drawPara(ctx, 'Handle GDPR Subject Access Requests (SARs) from users.');
  drawBullet(ctx, 'View all pending and completed SAR requests');
  drawBullet(ctx, 'Generate SAR PDF: 21 sections of user data, HMAC-SHA256 tamper-evident stamp');
  drawBullet(ctx, 'SAR PDF never exposes passwords, PINs, or hashes');
  drawBullet(ctx, 'Requires high-risk PIN challenge token');
  drawBullet(ctx, 'Response deadline: 30 days from request');

  // ── 6. Plans & Billing ─────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '6. Plans & Billing', true);

  drawH2(ctx, '6.1 Plans (/admin/plans)');
  drawPara(ctx, 'Manage subscription plans available on the platform. Current plans (DB slugs in brackets):');
  drawBullet(ctx, 'Free [free] -- always free, 1 personal profile, 1 link, basic themes, no org profile');
  drawBullet(ctx, 'Starter [starter] -- 30-day free trial, 1 personal profile, 20 links, all Starter features');
  drawBullet(ctx, 'Professional [professional] -- 1 personal + 1 org profile, unlimited links, advanced analytics, remove branding');
  drawBullet(ctx, 'Organisation [business] -- 1 personal + 1 org profile, up to 20 seats');
  drawBullet(ctx, 'Ultimate Organisation [ultimate_business] -- 1 personal + 4 org profiles, up to 20 seats');
  drawBullet(ctx, 'Ultimate Organisation+ [ultimate_plus] -- 1 personal + 10 org profiles, 40 seats, contact-us only (no Stripe price)');
  drawBullet(ctx, 'Lifetime [lifetime] -- one-time payment, permanent access equivalent to Ultimate Organisation');
  drawNote(ctx, 'DB slugs never change -- only the display name column changes. ultimate_plus has no Stripe price and is contact-us only. The is_public toggle controls homepage visibility instantly.', 'info');

  drawH2(ctx, '6.2 Plan Features');
  drawTableRow(ctx, ['Feature', 'Free', 'Starter', 'Pro', 'Org', 'Ult.Org', 'Ult.Org+'], [130, 42, 48, 42, 42, 52, 52], true);
  drawTableRow(ctx, ['Personal profile', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Org profiles (max)', '0', '0', '1', '1', '4', '10'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Team seats (max)', '1', '1', '1', '20', '20', '40'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Links Manager', '1 link', '20', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['WhatsApp Button', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Gallery', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Menu / Price List', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['PDF Attachments', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Social Links', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['QR code (share)', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['QR code (download)', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Profile Poster PDF', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Email Signature', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Contact Enquiries', '--', 'Y', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Analytics', '--', 'Basic', 'Full', 'Full', 'Full', 'Full'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Remove branding', '--', '--', 'Y', 'Y', 'Y', 'Y'], [130, 42, 48, 42, 42, 52, 52], false);
  drawTableRow(ctx, ['Business Cards', 'Add-on', 'Add-on', 'Add-on', 'Add-on', 'Add-on', 'Add-on'], [130, 42, 48, 42, 42, 52, 52], false);
  ctx.y -= 8;
  drawNote(ctx, 'Business Cards are a separate paid service and are NOT included in any plan. They are ordered and paid for separately via admin-issued Stripe payment links. The "Organisation" plan DB slug is "business" for legacy reasons -- the display name is "Organisation".', 'warning');

  drawH2(ctx, '6.3 Stripe Integration');
  drawPara(ctx, 'Billing is processed via Stripe. The admin can view subscription status, manage billing, and handle disputes.');
  drawBullet(ctx, 'Stripe webhook: /api/stripe/webhook -- handles subscription events');
  drawBullet(ctx, 'Checkout: /api/billing/checkout -- creates Stripe checkout session');
  drawBullet(ctx, 'Cancel: /api/billing/cancel -- cancels subscription at period end');
  drawBullet(ctx, 'ultimate_plus has no Stripe price -- it is a contact-us plan only');
  drawNote(ctx, 'Never share Stripe secret keys. Keys are stored as server-side secrets and never exposed to the frontend.', 'warning');

  // ── 7. Business Cards ──────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '7. Business Cards', true);

  drawH2(ctx, '7.1 Printed Card Orders (/admin/business-cards)');
  drawPara(ctx, 'Business Cards are a separate paid service. They are NOT included in any subscription plan. Users request cards from their dashboard; admin reviews, approves, and issues a Stripe payment link before production begins.');
  drawBullet(ctx, 'View all orders with status (pending, design review, awaiting payment, in production, dispatched, delivered)');
  drawBullet(ctx, 'Review uploaded designs or custom design requests');
  drawBullet(ctx, 'For custom designs: approve the request, then issue a Stripe payment link at the confirmed rate (currently GBP 15/hour for design work)');
  drawBullet(ctx, 'Update order status as it progresses through production');
  drawBullet(ctx, 'View design proof and order details including optional add-ons (lamination, foil, spot UV, embossing, QR code, rush delivery, eco stock, thick stock)');
  drawBullet(ctx, 'Handle refund requests per the Refund Policy');
  drawBullet(ctx, 'Contact customer about their order via the Communications tab');
  drawNote(ctx, 'Never accept payment outside of an official Stripe payment link or invoice issued through the admin portal. Do not accept bank transfers, cash, or third-party payment links for business card orders.', 'warning');

  drawH2(ctx, '7.2 Profile Poster PDF');
  drawPara(ctx, 'Users can generate an A4 Profile Poster PDF from their dashboard. The poster is designed for digital sharing (email attachment, presentations, websites) -- it is NOT a print-ready business card and does not include crop marks or bleed. Four templates are available:');
  drawTableRow(ctx, ['Template', 'Style', 'Colours'], [80, 200, 200], true);
  drawTableRow(ctx, ['1', 'Classic Professional', 'White background, navy header, gold accent'], [80, 200, 200], false);
  drawTableRow(ctx, ['2', 'Bold Dark', 'Dark background, blue accents, white text'], [80, 200, 200], false);
  drawTableRow(ctx, ['3', 'Minimal Clean', 'White background, thin rules, monochrome'], [80, 200, 200], false);
  drawTableRow(ctx, ['4', 'JA Branded', 'Sousa Murray Profiles brand colours with blue header'], [80, 200, 200], false);
  ctx.y -= 8;
  drawPara(ctx, 'Each poster includes: name, job title, company, bio (up to 300 chars), skills (up to 12), email, phone, website, and a scannable QR code linking to the live profile. Portrait and landscape orientations are both supported.');
  drawPara(ctx, 'Wordmark: "Created with Sousa Murray Profiles" footer appears on Starter plan posters. Removed automatically on Professional, Organisation, Ultimate Organisation, Ultimate Organisation+, and Lifetime plans.');
  drawNote(ctx, 'Poster PDF endpoint: GET /api/profiles/:id/poster-pdf?template=1-4&orientation=portrait|landscape. Plan-gated: Starter and above. Profile must be published.', 'info');
  drawNote(ctx, 'This feature is the Profile Poster -- NOT a business card. Do not describe it as a card, print-ready file, or physical product. It is a digital A4 sharing document.', 'warning');

  // ── 8. Legal Management ────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '8. Legal Policy Management', true);

  drawH2(ctx, '8.1 Legal Editor (/admin/legal)');
  drawPara(ctx, 'The legal editor allows admins to view and update all platform legal documents. Changes require a high-risk PIN challenge token.');
  drawBullet(ctx, 'View all 12 policy documents');
  drawBullet(ctx, 'Edit content (Markdown format)');
  drawBullet(ctx, 'Update version number and effective date');
  drawBullet(ctx, 'Publish / unpublish individual policies');
  drawBullet(ctx, 'Changes are audit-logged');

  drawH2(ctx, '8.2 Policy Documents');
  drawTableRow(ctx, ['Policy', 'URL', 'Key'], [160, 160, 120], true);
  const policies = [
    ['Terms of Service', '/legal/terms', 'terms'],
    ['Privacy Policy', '/legal/privacy', 'privacy'],
    ['Cookie Policy', '/legal/cookies', 'cookies'],
    ['Acceptable Use Policy', '/legal/acceptable-use', 'acceptable_use'],
    ['Refund Policy', '/legal/refunds', 'refunds'],
    ['Complaints Policy', '/legal/complaints', 'complaints'],
    ['Accessibility Statement', '/legal/accessibility', 'accessibility'],
    ['Eligibility Policy', '/legal/eligibility', 'eligibility'],
    ['Data Retention Policy', '/legal/data-retention', 'data_retention'],
    ['Reporting & Moderation', '/legal/reporting', 'reporting'],
    ['Security Policy', '/legal/security', 'security'],
    ['Data Subject Rights', '/legal/data-rights', 'data_rights'],
  ];
  for (const [title, url, key] of policies) {
    drawTableRow(ctx, [title, url, key], [160, 160, 120], false);
  }
  ctx.y -= 8;
  drawNote(ctx, 'Privacy Policy is the single source of truth for data retention periods and data subject rights. Data Retention and Data Subject Rights pages display their own dedicated policy documents -- they do not duplicate the Privacy Policy.', 'info');

  drawH2(ctx, '8.3 Consent Version Management');
  drawPara(ctx, 'When Terms of Service or Privacy Policy are updated to a new version and published, the platform automatically bumps the required_consent_version. All users will be prompted to re-acknowledge the updated policies on their next dashboard visit.');

  // ── 9. Settings ────────────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '9. Platform Settings', true);

  drawH2(ctx, '9.1 Settings (/admin/settings)');
  drawPara(ctx, 'The settings page covers all platform configuration. It is divided into sections:');
  drawBullet(ctx, 'General: platform name, support email, contact details');
  drawBullet(ctx, 'Email: gateway configuration, DNS status, DKIM/SPF/DMARC');
  drawBullet(ctx, 'Security: PIN policy, session timeout, IP blocking');
  drawBullet(ctx, 'Branding: platform colours, logo, favicon');
  drawBullet(ctx, 'Features: global feature flags');
  drawBullet(ctx, 'Billing: Stripe configuration');
  drawBullet(ctx, 'Maintenance mode: put the platform into maintenance mode');
  drawBullet(ctx, 'Platform Manual: download Admin Guide, User Guide, or Full Manual as PDF');

  drawH2(ctx, '9.2 Email Configuration');
  drawPara(ctx, 'Email is sent via the Airo gateway on 127.0.0.1:2525.');
  drawTableRow(ctx, ['Setting', 'Value'], [200, 280], true);
  drawTableRow(ctx, ['From address', 'noreply@japrofilestudio.jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Reply-To address', 'contact@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Admin alerts', 'admin@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Gateway host', '127.0.0.1:2525'], [200, 280], false);
  ctx.y -= 8;
  drawNote(ctx, 'DNS records required: SPF (TXT), DKIM (TXT, selector: airo), DMARC (TXT). Contact Airo support for the DKIM public key (p= value). After adding DNS records, click Re-check DNS in Admin -> Settings -> Email.', 'warning');

  drawH2(ctx, '9.3 Assisted Access');
  drawPara(ctx, 'Assisted access allows an admin to log in as a user to help them with their account. This requires:');
  drawBullet(ctx, 'User consent (recorded in the database)');
  drawBullet(ctx, 'High-risk PIN challenge token');
  drawBullet(ctx, 'All actions taken during assisted access are audit-logged');
  drawBullet(ctx, 'Session is clearly marked as assisted access in the dashboard banner');
  drawNote(ctx, 'Assisted access must never be used without explicit user consent. All activity is logged and attributable.', 'warning');

  // ── 10. Security & Compliance ──────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '10. Security & Compliance', true);

  drawH2(ctx, '10.1 Security Architecture');
  drawBullet(ctx, 'Authentication: Microsoft Entra OIDC (admin) + local sessions (customers)');
  drawBullet(ctx, 'Admin PIN: bcrypt-hashed (rounds=12), DB lockout after 10 attempts, rate limiter after 15 attempts/15 min (IP-based)');
  drawBullet(ctx, 'PIN session cache: 15 minutes; heartbeat keeps alive during active work');
  drawBullet(ctx, 'Challenge tokens: in-memory, one-time-use, 5-min TTL');
  drawBullet(ctx, 'Self-service unlock: Security Settings shows orange banner + "Clear lockout" button');
  drawBullet(ctx, 'Session: express-session with signed cookies');
  drawBullet(ctx, 'Rate limiting: all API endpoints');
  drawBullet(ctx, 'CSRF protection: all state-changing operations');
  drawBullet(ctx, 'CSP: nonce-based strict policy');
  drawBullet(ctx, 'Security headers: HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy');

  drawH2(ctx, '10.2 Data Protection');
  drawBullet(ctx, 'UK GDPR compliant');
  drawBullet(ctx, 'Data Controller: JA Group Services Ltd');
  drawBullet(ctx, 'DPO contact: privacy@jagroupservices.co.uk');
  drawBullet(ctx, 'SAR response time: 30 days');
  drawBullet(ctx, 'Breach notification: ICO within 72 hours (where required)');
  drawBullet(ctx, 'Data retention: see Data Retention Policy');

  drawH2(ctx, '10.3 Incident Response');
  drawPara(ctx, 'In the event of a security incident:');
  drawBullet(ctx, 'Step 1: Identify and contain the incident');
  drawBullet(ctx, 'Step 2: Assess the scope and impact');
  drawBullet(ctx, 'Step 3: Notify affected users if personal data is at risk');
  drawBullet(ctx, 'Step 4: Notify ICO within 72 hours if required');
  drawBullet(ctx, 'Step 5: Document the incident and remediation steps');
  drawBullet(ctx, 'Step 6: Review and update security measures');
  drawNote(ctx, 'Security vulnerabilities should be reported to security@jagroupservices.co.uk. Do not disclose publicly until resolved.', 'warning');

  drawH2(ctx, '10.4 Authority & Incident Report Generator');
  drawPara(ctx, 'The Authority & Incident Report tool (/admin/authority-report) generates a formal PDF report for internal incidents, authority requests, or legal disclosures. It is separate from the SAR Export tool.');
  drawPara(ctx, 'Report types available:');
  drawBullet(ctx, 'Internal incident report');
  drawBullet(ctx, 'Profile report summary');
  drawBullet(ctx, 'User report summary');
  drawBullet(ctx, 'Abuse/safety report');
  drawBullet(ctx, 'Fraud/security report');
  drawBullet(ctx, 'Police/authority request report');
  drawBullet(ctx, 'Court/legal request report');
  drawBullet(ctx, 'Safeguarding concern report');
  drawBullet(ctx, 'Data disclosure decision record');
  drawPara(ctx, 'Security requirements: Microsoft OIDC admin login + Admin PIN + high-risk challenge token. Every generation is audit-logged with admin name, report type, sections selected, and reason.');
  drawNote(ctx, 'COMPLIANCE: Only disclose personal data where JA Group Services Ltd has a lawful basis and the disclosure is necessary and proportionate. If unsure, seek legal/data protection advice before disclosure. This system documents the decision -- it does not make it.', 'warning');

  // ── 11. API Reference ──────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '11. API Reference (Admin)', true);

  drawH2(ctx, '11.1 Admin Endpoints');
  drawPara(ctx, 'All admin API endpoints are prefixed with /api/admin/ and require admin authentication + PIN.');
  drawTableRow(ctx, ['Method', 'Endpoint', 'Description'], [60, 220, 200], true);
  const adminEndpoints = [
    ['GET', '/api/admin/users', 'List all users (paginated)'],
    ['GET', '/api/admin/crm/users', 'CRM user list with filters'],
    ['GET', '/api/admin/crm/users/:id', 'Full user CRM record'],
    ['PUT', '/api/admin/users/:id/plan', 'Change user plan'],
    ['POST', '/api/admin/users/:id/pause', 'Pause/unpause account'],
    ['DELETE', '/api/admin/users/:id', 'Delete account (high-risk)'],
    ['GET', '/api/admin/profiles', 'List all profiles'],
    ['PUT', '/api/admin/profiles/:id/publish', 'Publish/unpublish profile'],
    ['POST', '/api/admin/profiles/:id/verify', 'Verify profile'],
    ['GET', '/api/admin/legal', 'Get all legal policies'],
    ['PUT', '/api/admin/legal/:key', 'Update legal policy (high-risk)'],
    ['GET', '/api/admin/sar/:userId/data', 'Get SAR data (high-risk)'],
    ['GET', '/api/admin/sar/:userId/pdf', 'Download SAR PDF (high-risk)'],
    ['POST', '/api/admin/authority-report/generate', 'Generate Authority/Incident Report PDF (high-risk)'],
    ['POST', '/api/admin/email/compose', 'Send broadcast email (high-risk)'],
    ['GET', '/api/admin/email/status', 'Email gateway status'],
    ['GET', '/api/admin/pin/status', 'Admin PIN session status'],
    ['POST', '/api/admin/pin/verify', 'Verify admin PIN'],
    ['POST', '/api/admin/pin/challenge', 'Get high-risk challenge token'],
    ['POST', '/api/admin/pin/heartbeat', 'Keep PIN session alive'],
    ['GET', '/api/admin/audit', 'Get audit log'],
    ['GET', '/api/admin/analytics', 'Platform analytics'],
    ['GET', '/api/admin/settings', 'Get platform settings'],
    ['PUT', '/api/admin/settings', 'Update platform settings'],
    ['GET', '/api/admin/manual/pdf', 'Download this manual'],
  ];
  for (const [method, endpoint, desc] of adminEndpoints) {
    drawTableRow(ctx, [method, endpoint, desc], [60, 220, 200], false);
  }
  ctx.y -= 8;

  drawH2(ctx, '11.2 Auth & User Endpoints');
  drawTableRow(ctx, ['Method', 'Endpoint', 'Description'], [60, 220, 200], true);
  const authEndpoints = [
    ['GET', '/api/auth/me', 'Current user session (includes max_org_profiles)'],
    ['POST', '/api/auth/logout', 'Log out current session'],
    ['GET', '/api/billing/checkout', 'Create Stripe checkout session'],
    ['POST', '/api/billing/cancel', 'Cancel subscription at period end'],
    ['POST', '/api/signatures/me', 'Upsert email signature data'],
    ['POST', '/api/signatures/logo-upload', 'Upload signature logo (image/*, 4MB max)'],
    ['POST', '/api/support/request', 'Submit support ticket'],
    ['GET', '/api/analytics/:profileId', 'Profile analytics (auth, ?days=30|60|90|365)'],
  ];
  for (const [method, endpoint, desc] of authEndpoints) {
    drawTableRow(ctx, [method, endpoint, desc], [60, 220, 200], false);
  }
  ctx.y -= 8;

  drawH2(ctx, '11.3 Public Endpoints');
  drawTableRow(ctx, ['Method', 'Endpoint', 'Description'], [60, 220, 200], true);
  const publicEndpoints = [
    ['GET', '/api/status', 'Live service status (public)'],
    ['GET', '/api/health', 'Health check'],
    ['GET', '/api/plans', 'Available plans (includes max_org_profiles, max_seats)'],
    ['GET', '/api/legal/:key', 'Get published legal policy'],
    ['GET', '/api/profiles/:username', 'Get public profile'],
    ['GET', '/api/qr/:id', 'Get QR code for profile'],
    ['GET', '/api/profiles/:id/poster-pdf', 'Download Profile Poster PDF (A4, digital sharing)'],
    ['POST', '/api/profiles/report', 'Report a profile'],
    ['POST', '/api/report-issue', 'Submit issue report'],
    ['POST', '/api/enquiries/:username', 'Submit contact enquiry (rate-limited, spam-scanned)'],
  ];
  for (const [method, endpoint, desc] of publicEndpoints) {
    drawTableRow(ctx, [method, endpoint, desc], [60, 220, 200], false);
  }
  ctx.y -= 8;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── USER DASHBOARD MANUAL ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function buildUserManual(ctx: Ctx) {
  // ── 1. Getting Started ─────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '1. Getting Started', false);
  drawPara(ctx, 'Sousa Murray Profiles is a digital business card and professional profile platform. This guide covers everything you need to know to set up and manage your account.');
  drawNote(ctx, 'Sousa Murray Profiles is available to UK-based users aged 18 and over. You authenticate via JA Group Services ID — no separate password is needed.', 'info');

  drawH2(ctx, '1.1 Creating Your Account');
  drawBullet(ctx, 'Visit japrofilestudio.jagroupservices.co.uk');
  drawBullet(ctx, 'Click "Sign in" and authenticate via JA Group Services ID');
  drawBullet(ctx, 'On first login, you will be prompted to accept the Terms of Service and Privacy Policy');
  drawBullet(ctx, 'You will be taken to your dashboard to create your first profile');

  drawH2(ctx, '1.2 Dashboard Overview (/dashboard/overview)');
  drawPara(ctx, 'Your dashboard is your control centre. From here you can:');
  drawBullet(ctx, 'See your profile views and link clicks at a glance');
  drawBullet(ctx, 'Access all dashboard sections from the sidebar');
  drawBullet(ctx, 'View your current plan and upgrade');
  drawBullet(ctx, 'See recent notifications and messages');
  drawBullet(ctx, 'Quick-copy your profile link');

  // ── 2. Profile Management ──────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '2. Profile Management', false);

  drawH2(ctx, '2.1 Creating a Profile (/dashboard/profile)');
  drawPara(ctx, 'Your Personal Profile is your digital business card. It can be used by professionals, business owners, freelancers, and anyone who wants a digital card. To create or edit your profile:');
  drawBullet(ctx, 'Go to Dashboard -> Personal Profile');
  drawBullet(ctx, 'Choose your profile type (14 types available -- see below)');
  drawBullet(ctx, 'Fill in your details: name, job title, company, bio, contact info');
  drawBullet(ctx, 'Add a Business Address if you are a professional or business owner');
  drawBullet(ctx, 'Add links: website, social media, portfolio, etc.');
  drawBullet(ctx, 'Upload a profile photo');
  drawBullet(ctx, 'Add skills, experience, education (depending on profile type)');
  drawBullet(ctx, 'Choose a theme and customise appearance');
  drawBullet(ctx, 'Publish your profile to make it publicly accessible');

  drawH2(ctx, '2.2 Profile Types');
  drawPara(ctx, 'Choose the profile type that best describes you. Each type shows only the most relevant sections:');
  drawBullet(ctx, 'Professional / Freelancer — Full set: skills, experience, education, certifications, awards');
  drawBullet(ctx, 'Content Creator — Social channels, content niche, skills/tools, awards');
  drawBullet(ctx, 'Student — Education focus, skills, projects');
  drawBullet(ctx, 'Job Seeker — CV-style: experience, education, skills, target roles');
  drawBullet(ctx, 'Creative — Portfolio, creative disciplines, awards');
  drawBullet(ctx, 'Athlete — Sport, achievements, team affiliations');
  drawBullet(ctx, 'Faith / Ministry — Ministry description, theological education, languages');
  drawBullet(ctx, 'Volunteer / Nonprofit — Causes, skills, languages, awards');
  drawBullet(ctx, 'Personal Brand — Full set + speaking topics, coaching areas');
  drawBullet(ctx, 'Other — General purpose, all sections available');

  drawH2(ctx, '2.3 Publishing Your Profile');
  drawPara(ctx, 'Your profile is private until you publish it. To publish:');
  drawBullet(ctx, 'Go to Dashboard -> Personal Profile');
  drawBullet(ctx, 'Click the "Publish" toggle at the top of the page');
  drawBullet(ctx, 'Your profile is now live at japrofilestudio.jagroupservices.co.uk/[username]');
  drawNote(ctx, 'You can unpublish your profile at any time to make it private again. Unpublishing does not delete your data.', 'tip');

  drawH2(ctx, '2.4 Profile URL and Username');
  drawPara(ctx, 'Your profile URL is based on your username. You can set your username in Dashboard -> Personal Profile -> Settings. Usernames must be unique across the platform.');
  drawNote(ctx, 'Once set, changing your username will change your profile URL. Update any links or QR codes you have shared.', 'warning');

  // ── 3. Business Profile ────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '3. Business Profile (Professional & Business Plans)', false);

  drawH2(ctx, '3.1 Creating a Business Profile (/dashboard/business-profile)');
  drawPara(ctx, 'Business profiles are available on Professional and Business plans. A business profile creates a dedicated landing page for your organisation.');
  drawBullet(ctx, 'Go to Dashboard -> Business Profile');
  drawBullet(ctx, 'Enter your business name, description, and contact details');
  drawBullet(ctx, 'Add your business logo and cover image');
  drawBullet(ctx, 'Add services, team members, and social links');
  drawBullet(ctx, 'Add optional sections: WhatsApp Button, Menu/Price List, PDF Attachments');
  drawBullet(ctx, 'Publish your business profile');

  drawH2(ctx, '3.2 Team Seats (Business Plan)');
  drawPara(ctx, 'Business plan accounts can invite team members to create their own profiles under the business umbrella.');
  drawBullet(ctx, 'Go to Dashboard -> Business Seats');
  drawBullet(ctx, 'Click "Invite team member" and enter their email');
  drawBullet(ctx, 'They will receive an invitation email with a link to join');
  drawBullet(ctx, 'Team members appear on your business profile page');
  drawBullet(ctx, 'You can manage and remove team members at any time');

  // ── 4. New Features (Starter+) ────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '4. New Features (Starter and Above)', false);

  drawH2(ctx, '4.1 WhatsApp Button (/dashboard/whatsapp)');
  drawPara(ctx, 'Add a WhatsApp click-to-chat button to your public profile. Available on Starter and higher plans.');
  drawBullet(ctx, 'Go to Dashboard -> WhatsApp Button');
  drawBullet(ctx, 'Toggle "Show WhatsApp button on profile" to On');
  drawBullet(ctx, 'Enter your WhatsApp link: https://wa.me/[country code][number]');
  drawBullet(ctx, 'Example for a UK number: https://wa.me/447700123456');
  drawBullet(ctx, 'Optionally enter a custom button label');
  drawBullet(ctx, 'Click Save');
  drawNote(ctx, 'Use the Quick Link Builder: type your phone number (with country code, no +) to auto-format the link.', 'tip');

  drawH2(ctx, '4.2 Gallery (/dashboard/gallery)');
  drawPara(ctx, 'Showcase your work, products, or portfolio images on your public profile. Available on Starter and higher plans.');
  drawBullet(ctx, 'Go to Dashboard -> Gallery');
  drawBullet(ctx, 'Toggle "Show gallery on profile" to On');
  drawBullet(ctx, 'Click "Add image" and enter an image URL or upload from your device (max 5MB)');
  drawBullet(ctx, 'Add a caption and alt text for each image');
  drawBullet(ctx, 'Click "Save gallery"');

  drawH2(ctx, '4.3 Menu / Price List (/dashboard/menu)');
  drawPara(ctx, 'Display a menu, price list, or service catalogue on your public profile. Available on Starter and higher plans.');
  drawBullet(ctx, 'Go to Dashboard -> Menu / Price List');
  drawBullet(ctx, 'Toggle "Show menu on profile" to On');
  drawBullet(ctx, 'Set a section title (e.g. "Our Menu", "Price List", "Services")');
  drawBullet(ctx, 'Click "Add item" and enter name, price, category, and description');
  drawBullet(ctx, 'Items with the same category are grouped into sections');
  drawBullet(ctx, 'Click "Save menu"');

  drawH2(ctx, '4.4 PDF Attachments (/dashboard/pdf-attachments)');
  drawPara(ctx, 'Attach downloadable PDFs to your profile. Available on Starter and higher plans.');
  drawBullet(ctx, 'Go to Dashboard -> PDF Attachments');
  drawBullet(ctx, 'Toggle "Show PDF attachments on profile" to On');
  drawBullet(ctx, 'Click "Add PDF" and enter a label and PDF URL');
  drawBullet(ctx, 'Host PDFs on Google Drive, Dropbox, or your own website');
  drawBullet(ctx, 'Make sure the PDF is set to public access before adding the link');
  drawBullet(ctx, 'Click "Save attachments"');

  drawH2(ctx, '4.5 Social Links Setup (/dashboard/social-links)');
  drawPara(ctx, 'Add branded social media icon links to your profile. Available on Starter and higher plans.');
  drawBullet(ctx, 'Go to Dashboard -> Social Links Setup');
  drawBullet(ctx, 'Toggle "Show social links on profile" to On');
  drawBullet(ctx, 'Click "Add social platform" and select the platform');
  drawBullet(ctx, 'Enter your profile URL and optionally a custom label');
  drawBullet(ctx, 'Supported: Instagram, Facebook, X/Twitter, LinkedIn, TikTok, YouTube, GitHub, and more');
  drawBullet(ctx, 'Click "Save social links"');

  // ── 5. QR Codes & Profile Poster ──────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '5. QR Codes & Profile Poster PDF', false);

  drawH2(ctx, '5.1 QR Codes (/dashboard/qr-code)');
  drawPara(ctx, 'QR codes are available on Starter and higher plans. Your QR code links directly to your live profile.');
  drawBullet(ctx, 'Go to Dashboard -> QR Codes');
  drawBullet(ctx, 'View your QR code for each profile');
  drawBullet(ctx, 'Copy your profile link');
  drawBullet(ctx, 'Download QR code as PNG (Professional and Business plans)');
  drawBullet(ctx, 'Generate a Profile Poster PDF (Starter and higher) -- see section 5.2');

  drawH2(ctx, '5.2 Profile Poster PDF (/dashboard/poster)');
  drawPara(ctx, 'Generate an A4 PDF poster of your profile for digital sharing. Available on Starter and higher plans. This is NOT a print-ready business card — it is designed for digital use: email attachments, presentations, and websites.');
  drawBullet(ctx, 'Go to Dashboard -> Profile Poster');
  drawBullet(ctx, 'Choose orientation: Portrait (tall, like a flyer) or Landscape (wide, like a display board)');
  drawBullet(ctx, 'Select one of 4 design templates');
  drawBullet(ctx, 'Click "Open Poster PDF" — the PDF opens in a new browser tab');
  drawBullet(ctx, 'Save with Ctrl+S (Windows) or Cmd+S (Mac)');
  drawPara(ctx, 'The 4 poster templates are:');
  drawBullet(ctx, 'Template 1 — Classic Professional: white background, navy header, gold accent');
  drawBullet(ctx, 'Template 2 — Bold Dark: dark background, blue accents, white text');
  drawBullet(ctx, 'Template 3 — Minimal Clean: white background, thin rules, monochrome');
  drawBullet(ctx, 'Template 4 — JA Branded: Sousa Murray Profiles brand colours with blue header');
  drawPara(ctx, 'Each poster includes: name, job title, company, bio, skills, email, phone, website, and a scannable QR code. On Starter plans a "Created with Sousa Murray Profiles" wordmark appears; this is removed on Professional, Business, and Lifetime plans.');
  drawNote(ctx, 'The Profile Poster is for digital sharing only. It does not include crop marks, bleed, or print specifications. For physical printed cards, use Dashboard -> Business Cards.', 'info');

  drawH2(ctx, '4.3 Printed Business Cards (/dashboard/business-cards)');
  drawPara(ctx, 'Order professionally printed business cards linked to your digital profile.');
  drawBullet(ctx, 'Go to Dashboard → Business Cards');
  drawBullet(ctx, 'Choose a design template');
  drawBullet(ctx, 'Customise with your details');
  drawBullet(ctx, 'Review and approve the proof');
  drawBullet(ctx, 'Place your order');
  drawNote(ctx, 'Once you approve the proof and the order goes to print, it cannot be cancelled or refunded. Review carefully before approving.', 'warning');

  // ── 5. Email Signature ─────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '6. Email Signature Builder', false);

  drawH2(ctx, '5.1 Creating an Email Signature (/dashboard/email-signature)');
  drawPara(ctx, 'Build a branded email signature that links to your Sousa Murray Profiles. Available on Starter and higher plans.');
  drawBullet(ctx, 'Go to Dashboard → Email Signature');
  drawBullet(ctx, 'Choose a signature template');
  drawBullet(ctx, 'Customise with your name, title, company, contact details');
  drawBullet(ctx, 'Add your profile link and social icons');
  drawBullet(ctx, 'Copy the HTML signature to paste into your email client');
  drawNote(ctx, 'The signature includes a link to your live Sousa Murray Profiles. Keep your profile published for the link to work.', 'tip');

  // ── 6. Analytics ───────────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '7. Analytics', false);

  drawH2(ctx, '6.1 Profile Analytics (/dashboard/analytics)');
  drawPara(ctx, 'Track how your profile is performing. Analytics are available on Starter and higher plans.');
  drawBullet(ctx, 'Profile views: total and over time');
  drawBullet(ctx, 'Link clicks: which links are clicked most');
  drawBullet(ctx, 'Visitor locations: where your visitors are from');
  drawBullet(ctx, 'Device breakdown: mobile vs desktop');
  drawBullet(ctx, 'Referrer data: how visitors found your profile');
  drawNote(ctx, 'Analytics data is retained for 24 months. IP addresses are anonymised after 30 days.', 'info');

  // ── 7. Enquiries ──────────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '8. Contact Enquiries', false);

  drawH2(ctx, '7.1 Enquiries (/dashboard/enquiries)');
  drawPara(ctx, 'Enquiries are one-way contact form submissions from visitors to your public profile. Visitors can send you a message; you reply to them by email outside the platform. There is no in-platform direct messaging or user-to-user chat.');
  drawBullet(ctx, 'View all enquiries with sender name, email, and message');
  drawBullet(ctx, 'Mark enquiries as read');
  drawBullet(ctx, 'Reply to the sender via your email client (Reply via Email button)');
  drawBullet(ctx, 'Enable or disable the contact form on your public profile');
  drawBullet(ctx, 'Receive email notifications for new enquiries (if enabled in notification preferences)');
  drawNote(ctx, 'Direct user-to-user messaging is not available on this platform. Enquiries are the only way visitors can contact you through your profile. All submissions are rate-limited and spam-scanned automatically.', 'info');

  // ── 8. Account Settings ────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '9. Account Settings', false);

  drawH2(ctx, '8.1 Account (/dashboard/account)');
  drawBullet(ctx, 'Update your display name and contact email');
  drawBullet(ctx, 'Manage notification preferences');
  drawBullet(ctx, 'View your current plan');
  drawBullet(ctx, 'Close your account');

  drawH2(ctx, '8.2 Security Settings (/dashboard/security-settings)');
  drawBullet(ctx, 'Set a profile PIN to protect your profile from unauthorised editing');
  drawBullet(ctx, 'View active sessions and sign out of other devices');
  drawBullet(ctx, 'View security event log');

  drawH2(ctx, '8.3 Notification Preferences (/dashboard/notification-preferences)');
  drawPara(ctx, 'Control which email notifications you receive. Categories:');
  drawBullet(ctx, 'ESSENTIAL (cannot be disabled): security alerts, account notices');
  drawBullet(ctx, 'Profile activity: new views, link clicks');
  drawBullet(ctx, 'Messages: new messages and enquiries');
  drawBullet(ctx, 'Billing: payment receipts, plan changes');
  drawBullet(ctx, 'Marketing: product updates, tips (opt-in)');
  drawBullet(ctx, 'Platform updates: new features, maintenance notices');

  drawH2(ctx, '8.4 Billing (/dashboard/billing)');
  drawBullet(ctx, 'View your current plan and billing history');
  drawBullet(ctx, 'Upgrade or downgrade your plan');
  drawBullet(ctx, 'Update payment method (via Stripe)');
  drawBullet(ctx, 'Cancel subscription');
  drawBullet(ctx, 'View invoices');

  drawH2(ctx, '8.5 Point of Sale (/dashboard/pos)');
  drawPara(ctx, 'The Point of Sale (POS) feature lets you create a secure Stripe Checkout payment link for any custom amount and description. Use it to collect one-off payments from clients or customers without needing a separate invoicing tool.');
  drawBullet(ctx, 'Enter the amount (minimum 50p), description, and optional customer details');
  drawBullet(ctx, 'Click "Create Payment Link" — you are redirected to Stripe Checkout');
  drawBullet(ctx, 'The customer enters their card details on the Stripe-hosted page');
  drawBullet(ctx, 'Stripe handles all card processing — no card data is stored on this platform');
  drawBullet(ctx, 'Transaction history is shown on the POS page with status (pending, paid, expired, cancelled)');
  drawBullet(ctx, 'Each transaction is logged with amount, description, customer name/email, and your reference');
  drawNote(ctx, 'Payment status updates are processed by Stripe webhooks. Allow a few minutes for the status to update after a payment is made. The POS feature requires Stripe to be configured in Admin -> Settings -> Billing.', 'info');
  drawNote(ctx, 'The POS is for one-off custom payments only. For subscription billing, use Plans & Billing. For printed business card orders, use Business Cards.', 'tip');

  // ── 9. Data & Privacy ──────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '9. Data & Privacy', false);

  drawH2(ctx, '9.1 Data Requests (/dashboard/data-requests)');
  drawPara(ctx, 'Exercise your UK GDPR rights directly from your dashboard. All requests are reviewed by the Sousa Murray Profiles team and responded to within 30 days.');
  drawBullet(ctx, 'Subject Access Request (SAR): request a copy of all your data — our team will prepare a verified PDF');
  drawBullet(ctx, 'Correct inaccurate data: ask us to fix incorrect information');
  drawBullet(ctx, 'Delete My Data: request permanent deletion of your account and data');
  drawBullet(ctx, 'Withdraw consent: withdraw previously given consent for data processing');
  drawBullet(ctx, 'Change marketing preferences: update your communication preferences');
  drawNote(ctx, 'Data is not available for instant self-service download. All access requests are processed by the team to ensure identity verification and compliance with UK GDPR. Response time: up to 30 days.', 'info');

  drawH2(ctx, '9.2 Service Communications (/dashboard/service-communications)');
  drawPara(ctx, 'Manage your communication preferences and consent records.');
  drawBullet(ctx, 'View your consent history');
  drawBullet(ctx, 'Update marketing consent');
  drawBullet(ctx, 'View which communications you are subscribed to');

  // ── 10. Help & Support ─────────────────────────────────────────────────────
  drawPageBreak(ctx);
  drawH1(ctx, '10. Help & Support', false);

  drawH2(ctx, '10.1 Help Centre (/dashboard/help-centre)');
  drawPara(ctx, 'The in-app help centre contains articles covering all platform features. Search for help or browse by category.');

  drawH2(ctx, '10.2 Support (/support)');
  drawPara(ctx, 'Submit a support request if you cannot find the answer in the help centre.');
  drawBullet(ctx, 'Describe your issue clearly');
  drawBullet(ctx, 'Include your account email and any relevant screenshots');
  drawBullet(ctx, 'We aim to respond within 5 business days');

  drawH2(ctx, '10.3 Report an Issue (/report-issue)');
  drawPara(ctx, 'Report a technical issue or bug with the platform. Include:');
  drawBullet(ctx, 'What you were trying to do');
  drawBullet(ctx, 'What happened instead');
  drawBullet(ctx, 'Steps to reproduce the issue');
  drawBullet(ctx, 'Your browser and device type');

  drawH2(ctx, '10.4 Contact Details');
  drawTableRow(ctx, ['Department', 'Email'], [200, 280], true);
  drawTableRow(ctx, ['General support', 'support@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Billing', 'billing@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Privacy / data protection', 'privacy@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Legal', 'legal@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Security', 'security@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Abuse / moderation', 'abuse@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Complaints', 'complaints@jagroupservices.co.uk'], [200, 280], false);
  drawTableRow(ctx, ['Accessibility', 'accessibility@jagroupservices.co.uk'], [200, 280], false);
  ctx.y -= 8;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function getManualPdf(req: Request, res: Response) {
  try {
  const section = String(req.query.section ?? 'all');
  if (!['all', 'admin', 'user'].includes(section)) {
    return res.status(400).json({ error: 'Invalid section. Use all, admin, or user.' });
  }

  const doc = await PDFDocument.create();
  doc.setTitle('Sousa Murray Profiles - Platform Manual');
  doc.setAuthor('JA Group Services Ltd');
  doc.setSubject(section === 'admin' ? 'Administrator Guide' : section === 'user' ? 'User Dashboard Guide' : 'Complete Platform Reference');
  doc.setCreator('Sousa Murray Profiles - japrofilestudio.jagroupservices.co.uk');
  doc.setKeywords(['Sousa Murray Profiles', 'manual', 'admin', 'user guide', 'JA Group Services']);

  const fontB  = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontR  = await doc.embedFont(StandardFonts.Helvetica);
  const fontI  = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontBI = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  // First page (cover)
  const coverPage = doc.addPage([A4W, A4H]);

  const ctx: Ctx = {
    doc,
    pages: [coverPage],
    fontB, fontR, fontI, fontBI,
    y: A4H - MARGIN,
    pageNum: 1,
    toc: [],
  };

  // Cover
  buildCover(ctx, section);

  // TOC placeholder
  buildTocPage(ctx);

  // Content
  if (section === 'admin' || section === 'all') {
    if (section === 'all') {
      // Section divider for admin
      newPage(ctx);
      const p = currentPage(ctx);
      p.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: C.navy });
      p.drawRectangle({ x: 0, y: A4H - 8, width: A4W, height: 8, color: C.gold });
      p.drawRectangle({ x: 0, y: 0, width: A4W, height: 8, color: C.gold });
      p.drawText('PART A', { x: MARGIN, y: A4H / 2 + 40, size: 14, font: fontR, color: C.accent });
      p.drawText('Administrator Guide', { x: MARGIN, y: A4H / 2, size: 28, font: fontB, color: C.white });
      p.drawText('For JA Group Services Ltd staff only', { x: MARGIN, y: A4H / 2 - 36, size: 12, font: fontI, color: C.gold });
    }
    buildAdminManual(ctx);
  }

  if (section === 'user' || section === 'all') {
    if (section === 'all') {
      // Section divider for user
      newPage(ctx);
      const p = currentPage(ctx);
      p.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: C.brand });
      p.drawRectangle({ x: 0, y: A4H - 8, width: A4W, height: 8, color: C.gold });
      p.drawRectangle({ x: 0, y: 0, width: A4W, height: 8, color: C.gold });
      p.drawText('PART B', { x: MARGIN, y: A4H / 2 + 40, size: 14, font: fontR, color: C.accent });
      p.drawText('User Dashboard Guide', { x: MARGIN, y: A4H / 2, size: 28, font: fontB, color: C.white });
      p.drawText('For Sousa Murray Profiles users', { x: MARGIN, y: A4H / 2 - 36, size: 12, font: fontI, color: C.gold });
    }
    buildUserManual(ctx);
  }

  // Fill TOC now that all pages are built
  fillToc(ctx);

  const pdfBytes = await doc.save();
  const sectionLabel = section === 'admin' ? 'admin-guide' : section === 'user' ? 'user-guide' : 'full-manual';
  const filename = `ja-profile-studio-${sectionLabel}-${new Date().toISOString().split('T')[0]}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('[Manual PDF] Generation failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF generation failed', detail: String(err) });
    }
  }
}
