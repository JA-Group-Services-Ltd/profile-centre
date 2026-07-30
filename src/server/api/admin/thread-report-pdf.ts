/**
 * Admin — Thread Report PDF
 *
 * GET /api/admin/messages/:threadId/report-pdf
 *
 * Generates a professional PDF evidence report for a message thread,
 * suitable for submission to authorities. Includes all messages, sender
 * IP, timestamps, moderation history, and a legal declaration.
 */
import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

type AdminReq = Request & { user?: { id: number; name: string; email: string } };

function fmt(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    return new Date(val).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  return String(val);
}

export async function generateThreadReportPdf(req: AdminReq, res: Response) {
  try {
    const { threadId } = req.params;
    const admin = req.user;

    // Fetch thread
    const thread = db.prepare(`
      SELECT t.*,
             p.username AS profile_username, p.display_name AS profile_name,
             u.name AS owner_name, u.email AS owner_email, u.id AS owner_id
      FROM card_message_threads t
      JOIN profiles p ON t.profile_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE t.id = ?
    `).get(threadId) as Record<string, unknown> | undefined;

    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    // Fetch all messages
    const messages = db.prepare(`
      SELECT * FROM card_messages WHERE thread_id = ? ORDER BY created_at ASC
    `).all(threadId) as Record<string, unknown>[];

    // Fetch moderation actions for this thread
    const modActions = db.prepare(`
      SELECT * FROM moderation_actions WHERE target_id = ? ORDER BY created_at ASC
    `).all(String(threadId)) as Record<string, unknown>[];

    // Fetch IP block record if exists
    const ipBlock = thread.sender_ip
      ? db.prepare('SELECT * FROM blocked_ips WHERE ip_address = ?').get(String(thread.sender_ip)) as Record<string, unknown> | undefined
      : undefined;

    const reportRef = `RPT-${threadId}-${new Date().toISOString().slice(0, 10)}`;
    const generatedAt = new Date().toISOString();

    writeAudit({
      actorId: admin?.id ?? 0,
      actorName: admin?.name,
      actorEmail: admin?.email ?? 'unknown',
      actorType: 'admin',
      action: 'thread_report_pdf_generated',
      resourceType: 'message_thread',
      resourceId: String(threadId),
      details: `Evidence report PDF generated for thread ${threadId} from ${thread.sender_name}`,
      result: 'success',
    });

    // Log moderation action
    db.prepare(`
      INSERT INTO moderation_actions (admin_id, admin_name, action, target_type, target_id, notes)
      VALUES (?, ?, 'generate_report_pdf', 'thread', ?, ?)
    `).run(admin?.id ?? null, admin?.name ?? 'Admin', String(threadId), `Evidence report generated: ${reportRef}`);

    const filename = `Evidence_Report_Thread_${threadId}_${new Date().toISOString().slice(0, 10)}.pdf`;

    // ── Layout ────────────────────────────────────────────────────────────
    const MARGIN = 50;
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const FOOTER_Y = PAGE_H - 35;

    const NAVY    = '#0f172a';
    const RED     = '#dc2626';
    const RED_BG  = '#fef2f2';
    const AMBER   = '#d97706';
    const GREEN   = '#16a34a';
    const BLUE    = '#1d4ed8';
    const BLUE_LT = '#dbeafe';
    const WHITE   = '#ffffff';
    const GRAY_50 = '#f8fafc';
    const GRAY_100 = '#f1f5f9';
    const GRAY_200 = '#e2e8f0';
    const GRAY_400 = '#94a3b8';
    const GRAY_600 = '#475569';
    const GRAY_800 = '#1e293b';

    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, autoFirstPage: false });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    function drawChrome(pageIdx: number, total: number) {
      if (pageIdx === 0) return;
      doc.rect(0, 0, PAGE_W, 44).fill(NAVY);
      doc.fillColor(WHITE).fontSize(7).font('Helvetica-Bold')
        .text('JA SMART PROFILE — EVIDENCE REPORT', MARGIN, 12, { width: CONTENT_W / 2 });
      doc.fillColor(GRAY_400).fontSize(7).font('Helvetica')
        .text(`Ref: ${reportRef}  ·  CONFIDENTIAL`, MARGIN, 22, { width: CONTENT_W / 2 });
      doc.fillColor(GRAY_400).fontSize(7)
        .text(`Page ${pageIdx + 1} of ${total}`, MARGIN, 17, { width: CONTENT_W, align: 'right' });
      doc.rect(0, FOOTER_Y - 4, PAGE_W, 1).fill(GRAY_200);
      doc.fillColor(GRAY_400).fontSize(6.5).font('Helvetica')
        .text(
          `Generated ${fmt(generatedAt)}  ·  Prepared by ${admin?.name ?? 'Admin'}  ·  CONFIDENTIAL — FOR LAW ENFORCEMENT USE`,
          MARGIN, FOOTER_Y + 2, { width: CONTENT_W, align: 'center' }
        );
    }

    function ensureSpace(n: number) {
      if (doc.y + n > FOOTER_Y - 10) {
        doc.addPage({ size: 'A4', margin: 0 });
        doc.y = 60;
      }
    }

    function sectionBar(title: string, color = NAVY) {
      ensureSpace(32);
      doc.moveDown(0.3);
      const y = doc.y;
      doc.rect(MARGIN, y, 4, 22).fill(color);
      doc.rect(MARGIN + 4, y, CONTENT_W - 4, 22).fill(GRAY_100);
      doc.fillColor(color).fontSize(9.5).font('Helvetica-Bold')
        .text(title.toUpperCase(), MARGIN + 14, y + 6, { characterSpacing: 0.5 });
      doc.y = y + 26;
      doc.moveDown(0.2);
    }

    function kvRow(key: string, value: string, shade = false) {
      ensureSpace(20);
      const y = doc.y;
      const rowH = 18;
      doc.rect(MARGIN, y, CONTENT_W, rowH).fill(shade ? GRAY_50 : WHITE);
      doc.rect(MARGIN, y, 1, rowH).fill(GRAY_200);
      doc.rect(MARGIN + CONTENT_W - 1, y, 1, rowH).fill(GRAY_200);
      doc.rect(MARGIN, y + rowH - 1, CONTENT_W, 1).fill(GRAY_200);
      doc.rect(MARGIN + 170, y, 1, rowH).fill(GRAY_200);
      doc.fillColor(GRAY_600).fontSize(8).font('Helvetica').text(key, MARGIN + 8, y + 5, { width: 158 });
      doc.fillColor(GRAY_800).fontSize(8).font('Helvetica-Bold').text(value, MARGIN + 178, y + 5, { width: CONTENT_W - 186 });
      doc.y = y + rowH;
    }

    // ── COVER PAGE ────────────────────────────────────────────────────────
    doc.addPage({ size: 'A4', margin: 0 });

    // Red header band — signals this is an evidence/report document
    doc.rect(0, 0, PAGE_W, 280).fill(NAVY);
    doc.polygon([PAGE_W - 160, 0], [PAGE_W, 0], [PAGE_W, 280], [PAGE_W - 60, 280]).fill(RED + '33');

    // Warning badge
    doc.roundedRect(MARGIN, 48, 130, 22, 4).fill(RED + '33');
    doc.fillColor(RED).fontSize(8).font('Helvetica-Bold')
      .text('⚠  EVIDENCE DOCUMENT', MARGIN + 8, 55, { characterSpacing: 0.5 });

    doc.fillColor(GRAY_400).fontSize(9).font('Helvetica-Bold')
      .text('JA SMART PROFILE', MARGIN, 84, { characterSpacing: 2 });
    doc.fillColor(WHITE).fontSize(28).font('Helvetica-Bold').text('Message Thread', MARGIN, 104);
    doc.fillColor(WHITE).fontSize(28).font('Helvetica-Bold').text('Evidence Report', MARGIN, 138);
    doc.fillColor(GRAY_400).fontSize(10).font('Helvetica')
      .text('For submission to law enforcement or regulatory authorities', MARGIN, 178);

    doc.rect(MARGIN, 210, 80, 3).fill(RED);

    doc.fillColor(GRAY_400).fontSize(8).font('Helvetica-Bold').text('REPORT REFERENCE', MARGIN, 228, { characterSpacing: 1 });
    doc.fillColor(WHITE).fontSize(14).font('Helvetica-Bold').text(reportRef, MARGIN, 242);

    // Info card
    doc.rect(0, 280, PAGE_W, 220).fill(WHITE);

    const infoItems = [
      { label: 'Thread ID', value: String(threadId) },
      { label: 'Date Generated', value: fmt(generatedAt) },
      { label: 'Prepared By', value: `${admin?.name ?? 'Admin'} (${admin?.email ?? ''})` },
      { label: 'Sender Name', value: fmt(thread.sender_name) },
      { label: 'Sender Email', value: fmt(thread.sender_email) },
      { label: 'Sender IP Address', value: fmt(thread.sender_ip) },
      { label: 'Profile', value: `/${fmt(thread.profile_username)} — ${fmt(thread.profile_name)}` },
      { label: 'Profile Owner', value: `${fmt(thread.owner_name)} (${fmt(thread.owner_email)})` },
      { label: 'Thread Status', value: fmt(thread.status) },
      { label: 'Reported', value: thread.is_reported ? `Yes — ${fmt(thread.report_reason)}` : 'No' },
      { label: 'IP Blocked', value: ipBlock ? `Yes — ${fmt(ipBlock.reason)}` : 'No' },
      { label: 'Total Messages', value: String(messages.length) },
    ];

    const colW = CONTENT_W / 2;
    infoItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN + col * colW;
      const y = 296 + row * 38;
      doc.rect(x + (col === 0 ? 0 : 8), y, colW - 16, 30).fill(GRAY_50);
      doc.rect(x + (col === 0 ? 0 : 8), y, 3, 30).fill(col === 0 ? RED : NAVY);
      doc.fillColor(GRAY_400).fontSize(6.5).font('Helvetica-Bold')
        .text(item.label.toUpperCase(), x + (col === 0 ? 10 : 18), y + 5, { characterSpacing: 0.8 });
      doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold')
        .text(item.value, x + (col === 0 ? 10 : 18), y + 16, { width: colW - 30 });
    });

    // Legal notice
    doc.rect(MARGIN, 520, CONTENT_W, 80).fill(RED_BG);
    doc.rect(MARGIN, 520, 3, 80).fill(RED);
    doc.fillColor(RED).fontSize(8).font('Helvetica-Bold').text('IMPORTANT — LEGAL NOTICE', MARGIN + 12, 530);
    doc.fillColor(GRAY_600).fontSize(7.5).font('Helvetica')
      .text(
        'This document is an official evidence report generated by the JA Profile Studio platform. ' +
        'It contains a complete record of a message thread including all message content, sender identification data, ' +
        'IP address information, and moderation history. This document is intended for use by law enforcement agencies, ' +
        'regulatory bodies, or legal proceedings only. Unauthorised disclosure or use of this document may be unlawful. ' +
        'The platform operator confirms this data is accurate as of the generation timestamp above.',
        MARGIN + 12, 544, { width: CONTENT_W - 24 }
      );

    // Cover footer
    doc.rect(0, PAGE_H - 30, PAGE_W, 30).fill(NAVY);
    doc.fillColor(GRAY_400).fontSize(6.5).font('Helvetica')
      .text(`JA Profile Studio  ·  Evidence Report  ·  ${reportRef}  ·  CONFIDENTIAL`, MARGIN, PAGE_H - 18, { width: CONTENT_W, align: 'center' });

    // ── PAGE 2+ ───────────────────────────────────────────────────────────
    doc.addPage({ size: 'A4', margin: 0 });
    doc.y = 60;

    // ── 1. Thread Summary ─────────────────────────────────────────────────
    sectionBar('1. Thread Summary', NAVY);
    [
      ['Thread ID', String(threadId)],
      ['Report Reference', reportRef],
      ['Thread Created', fmt(thread.created_at)],
      ['Last Message', fmt(thread.last_message_at)],
      ['Status', fmt(thread.status)],
      ['Reported by Owner', thread.is_reported ? 'YES' : 'No'],
      ['Report Reason', fmt(thread.report_reason)],
      ['Reported At', fmt(thread.reported_at)],
      ['Auto-Flagged by System', thread.auto_flagged ? 'YES' : 'No'],
      ['System Flag Reason', fmt(thread.flag_reason)],
      ['Severity', fmt(thread.severity)],
    ].forEach(([k, v], i) => kvRow(k, v, i % 2 === 0));

    // ── 2. Sender Identification ──────────────────────────────────────────
    sectionBar('2. Sender Identification', RED);
    [
      ['Sender Name (self-reported)', fmt(thread.sender_name)],
      ['Sender Email (self-reported)', fmt(thread.sender_email)],
      ['Sender IP Address', fmt(thread.sender_ip)],
      ['IP Currently Blocked', ipBlock ? `YES — ${fmt(ipBlock.reason)}` : 'No'],
      ['IP Block Date', ipBlock ? fmt(ipBlock.created_at) : '—'],
      ['Visitor Verified', thread.visitor_verified ? 'Yes' : 'No'],
      ['Visitor Accepted by Owner', thread.visitor_accepted ? 'Yes' : 'No'],
    ].forEach(([k, v], i) => kvRow(k, v, i % 2 === 0));

    doc.moveDown(0.4);
    doc.rect(MARGIN, doc.y, CONTENT_W, 32).fill(RED_BG);
    doc.rect(MARGIN, doc.y, 3, 32).fill(RED);
    const noteY = doc.y;
    doc.fillColor(RED).fontSize(7.5).font('Helvetica-Bold').text('Note on IP Address', MARGIN + 12, noteY + 6);
    doc.fillColor(GRAY_600).fontSize(7.5).font('Helvetica')
      .text(
        'The IP address above was captured at the time the first message was sent. It may represent a VPN, proxy, or shared network. ' +
        'Law enforcement can request ISP records to identify the subscriber behind this IP at the recorded timestamp.',
        MARGIN + 12, noteY + 17, { width: CONTENT_W - 24 }
      );
    doc.y = noteY + 36;

    // ── 3. Profile & Owner ────────────────────────────────────────────────
    sectionBar('3. Profile & Owner Details', NAVY);
    [
      ['Profile Username', fmt(thread.profile_username)],
      ['Profile Display Name', fmt(thread.profile_name)],
      ['Profile Owner Name', fmt(thread.owner_name)],
      ['Profile Owner Email', fmt(thread.owner_email)],
      ['Profile Owner User ID', fmt(thread.owner_id)],
    ].forEach(([k, v], i) => kvRow(k, v, i % 2 === 0));

    // ── 4. Complete Message Transcript ────────────────────────────────────
    sectionBar('4. Complete Message Transcript', NAVY);
    doc.fillColor(GRAY_600).fontSize(8).font('Helvetica')
      .text(`${messages.length} message${messages.length !== 1 ? 's' : ''} in this thread — all content reproduced verbatim below.`, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.4);

    messages.forEach((msg, idx) => {
      ensureSpace(60);
      const isVisitor = String(msg.sender || msg.sender_type) === 'visitor';
      const bgColor = isVisitor ? RED_BG : BLUE_LT;
      const borderColor = isVisitor ? RED : BLUE;
      const labelColor = isVisitor ? RED : BLUE;

      // Estimate height needed
      const bodyText = String(msg.body ?? '');
      const estimatedLines = Math.ceil(bodyText.length / 80) + 1;
      const msgH = Math.max(50, estimatedLines * 12 + 30);

      ensureSpace(msgH);
      const y = doc.y;

      doc.rect(MARGIN, y, CONTENT_W, msgH).fill(bgColor);
      doc.rect(MARGIN, y, 3, msgH).fill(borderColor);

      // Header row
      doc.fillColor(labelColor).fontSize(8).font('Helvetica-Bold')
        .text(
          isVisitor
            ? `Visitor (${fmt(thread.sender_name)})`
            : `Profile Owner (${fmt(thread.owner_name)})`,
          MARGIN + 10, y + 7
        );
      doc.fillColor(GRAY_400).fontSize(7.5).font('Helvetica')
        .text(`Message ${idx + 1}  ·  ${fmt(msg.created_at)}`, MARGIN + 10, y + 18);

      // Body
      doc.fillColor(GRAY_800).fontSize(8.5).font('Helvetica')
        .text(bodyText, MARGIN + 10, y + 30, { width: CONTENT_W - 20 });

      doc.y = y + msgH + 4;
    });

    // ── 5. Moderation History ─────────────────────────────────────────────
    sectionBar('5. Moderation History', AMBER);
    if (modActions.length === 0) {
      ensureSpace(28);
      const y = doc.y;
      doc.rect(MARGIN, y, CONTENT_W, 24).fill(GRAY_50);
      doc.rect(MARGIN, y, CONTENT_W, 24).stroke(GRAY_200);
      doc.fillColor(GRAY_400).fontSize(8.5).font('Helvetica')
        .text('No moderation actions recorded for this thread.', MARGIN, y + 7, { width: CONTENT_W, align: 'center' });
      doc.y = y + 24;
    } else {
      // Table header
      const cols = ['Action', 'Admin', 'Notes', 'Date'];
      const widths = [120, 100, 180, CONTENT_W - 400];
      ensureSpace(22);
      let y = doc.y;
      doc.rect(MARGIN, y, CONTENT_W, 20).fill(NAVY);
      let x = MARGIN;
      cols.forEach((col, i) => {
        doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold')
          .text(col, x + 6, y + 6, { width: widths[i] - 10, lineBreak: false });
        x += widths[i];
      });
      doc.y = y + 20;

      modActions.forEach((a, i) => {
        ensureSpace(18);
        y = doc.y;
        doc.rect(MARGIN, y, CONTENT_W, 16).fill(i % 2 === 0 ? GRAY_50 : WHITE);
        doc.rect(MARGIN, y, CONTENT_W, 16).stroke(GRAY_200);
        x = MARGIN;
        [fmt(a.action), fmt(a.admin_name), fmt(a.notes), fmt(a.created_at)].forEach((val, ci) => {
          doc.fillColor(GRAY_800).fontSize(7.5).font('Helvetica')
            .text(val, x + 6, y + 4, { width: widths[ci] - 10, lineBreak: false, ellipsis: true });
          x += widths[ci];
        });
        doc.y = y + 16;
      });
    }

    // ── 6. Declaration ────────────────────────────────────────────────────
    sectionBar('6. Declaration of Accuracy', GREEN);
    ensureSpace(100);
    const declY = doc.y;
    doc.rect(MARGIN, declY, CONTENT_W, 90).fill(GRAY_50);
    doc.rect(MARGIN, declY, CONTENT_W, 90).stroke(GRAY_200);
    doc.fillColor(GRAY_800).fontSize(8.5).font('Helvetica')
      .text(
        `I, ${admin?.name ?? 'the undersigned administrator'}, confirm that this evidence report was generated directly from ` +
        `the JA Profile Studio platform database on ${fmt(generatedAt)}. ` +
        `The message content, sender information, IP address, and moderation records contained in this document ` +
        `are an accurate and complete reproduction of the data held by the platform at the time of generation. ` +
        `No content has been altered, redacted, or fabricated. This report was generated in response to a ` +
        `moderation concern and is provided in good faith for the purpose of law enforcement or legal proceedings.`,
        MARGIN + 16, declY + 12, { width: CONTENT_W - 32 }
      );
    doc.fillColor(GRAY_400).fontSize(7.5).font('Helvetica')
      .text(`Signed: ${admin?.name ?? 'Admin'}  ·  ${admin?.email ?? ''}  ·  ${fmt(generatedAt)}`, MARGIN + 16, declY + 72);
    doc.y = declY + 94;

    // ── Apply chrome ──────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawChrome(i, range.count);
    }

    doc.end();
  } catch (err) {
    console.error('[Thread Report PDF] error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: String(err) });
  }
}
