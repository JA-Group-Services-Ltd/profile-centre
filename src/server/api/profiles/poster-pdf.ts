/**
 * GET /api/profiles/:id/poster-pdf
 *
 * Generates an A4 profile poster as a PDF that opens inline in the browser.
 * NOT a business card — this is a full A4 display poster (portrait or landscape).
 * Users can save it from the browser's built-in PDF viewer; it is NOT sent as
 * an attachment / print dialog.
 *
 * Query params:
 *   template  = 1–4  (design style)
 *   orient    = portrait | landscape  (default: portrait)
 *
 * Wordmark ("Created with JA Profile Studio") appears on free/starter plans.
 * Removed automatically when the user's plan has remove_branding = 1.
 *
 * Templates:
 *   1 — Classic Professional  (white bg, navy header band, gold accent)
 *   2 — Bold Dark             (dark bg, blue accent, white text)
 *   3 — Minimal Clean         (white bg, thin rules, monochrome)
 *   4 — JA Branded            (brand blue header, white body)
 */

import type { Request, Response } from 'express';
import { PDFDocument, rgb, StandardFonts, type RGB, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import db from '../../db.js';

/** Replace characters outside WinAnsi (U+0000-U+00FF) with ASCII equivalents. */
function san(text: string): string {
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

// ── Colour helpers ─────────────────────────────────────────────────────────────

function hex(h: string): RGB {
  const s = h.replace('#', '');
  return rgb(parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255);
}

// ── Real QR code (scannable) ───────────────────────────────────────────────────

/**
 * Renders a real, scannable QR code into the PDF page using the `qrcode` library.
 * Generates a PNG data URL, embeds it as an image, and draws it at the given position.
 */
async function drawQr(
  pdfDoc: PDFDocument,
  page: PDFPage,
  url: string,
  x: number,
  y: number,   // top-left y in pdf-lib coords (y increases upward)
  size: number,
  _color: RGB,  // kept for API compat — QR is always black on white
  _bg?: RGB,
) {
  try {
    // Generate QR as PNG buffer (white background, black modules)
    const pngDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const base64 = pngDataUrl.replace(/^data:image\/png;base64,/, '');
    const pngBytes = Buffer.from(base64, 'base64');
    const img = await pdfDoc.embedPng(pngBytes);
    // pdf-lib y is bottom-left; y param here is the top of the QR box
    page.drawImage(img, { x, y: y - size, width: size, height: size });
  } catch (e) {
    console.error('[drawQr] Failed to embed QR:', e);
  }
}

// ── Text helpers ───────────────────────────────────────────────────────────────

type Font = Awaited<ReturnType<PDFDocument['embedFont']>>;

/** Truncate text to fit within maxWidth at given size */
function fit(text: string, font: Font, size: number, maxWidth: number): string {
  if (!text) return '';
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -1);
  return t === text ? text : t + '...';
}

/** Draw text with optional max-width truncation */
function txt(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: Font,
  color: RGB,
  maxWidth?: number,
) {
  if (!text) return;
  const safe = san(text);
  const t = maxWidth ? fit(safe, font, size, maxWidth) : safe;
  page.drawText(t, { x, y, size, font, color });
}

/** Draw centred text */
function ctxt(page: PDFPage, text: string, cx: number, y: number, size: number, font: Font, color: RGB, halfWidth: number) {
  if (!text) return;
  const safe = san(text);
  const w = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: cx - w / 2, y, size, font, color });
}

// ── Poster data ────────────────────────────────────────────────────────────────

interface PosterData {
  name: string;
  title: string;
  company: string;
  bio: string;
  email: string;
  phone: string;
  website: string;
  profileUrl: string;
  username: string;
  skills: string[];
  showWordmark: boolean;
}

// ── A4 dimensions (points at 72dpi) ───────────────────────────────────────────
// Portrait:  595.28 × 841.89 pt
// Landscape: 841.89 × 595.28 pt

const A4P = { w: 595.28, h: 841.89 } as const;  // portrait
const A4L = { w: 841.89, h: 595.28 } as const;  // landscape

const PAD = 48; // page margin

// ── TEMPLATE 1: Classic Professional — Portrait ────────────────────────────────

async function t1Portrait(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4P;
  const navy = hex('#1e3a5f');
  const gold = hex('#c9a84c');
  const white = rgb(1, 1, 1);
  const grey = hex('#6b7280');
  const light = hex('#f8fafc');

  // Background
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: light });

  // Navy header band
  const headerH = 200;
  page.drawRectangle({ x: 0, y: h - headerH, width: w, height: headerH, color: navy });

  // Gold accent stripe at bottom of header
  page.drawRectangle({ x: 0, y: h - headerH - 4, width: w, height: 4, color: gold });

  // Name in header
  const nameSize = 32;
  const nameText = d.name || 'Your Name';
  const nameW = fb.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, { x: (w - nameW) / 2, y: h - 90, size: nameSize, font: fb, color: white });

  // Title
  if (d.title) {
    const titleW = fr.widthOfTextAtSize(d.title, 14);
    page.drawText(d.title, { x: (w - titleW) / 2, y: h - 118, size: 14, font: fr, color: gold });
  }

  // Company
  if (d.company) {
    const compW = fr.widthOfTextAtSize(d.company, 11);
    page.drawText(d.company, { x: (w - compW) / 2, y: h - 140, size: 11, font: fr, color: hex('#94a3b8') });
  }

  // Profile URL under company
  const urlText = d.profileUrl.replace('https://', '');
  const urlW = fr.widthOfTextAtSize(urlText, 9);
  page.drawText(urlText, { x: (w - urlW) / 2, y: h - 160, size: 9, font: fr, color: hex('#60a5fa') });

  // Body area
  let cy = h - headerH - 50;

  // Bio
  if (d.bio) {
    page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.5, color: hex('#e2e8f0') });
    const bioLines = wrapText(d.bio, fr, 11, w - PAD * 2 - 160);
    for (const line of bioLines.slice(0, 5)) {
      txt(page, line, PAD, cy, 11, fr, grey);
      cy -= 16;
    }
    cy -= 8;
  }

  // Skills chips
  if (d.skills.length > 0) {
    txt(page, 'Skills', PAD, cy, 10, fb, navy);
    cy -= 18;
    let sx = PAD;
    for (const skill of d.skills.slice(0, 10)) {
      const sw = fr.widthOfTextAtSize(skill, 9) + 16;
      if (sx + sw > w - PAD) { sx = PAD; cy -= 20; }
      page.drawRectangle({ x: sx, y: cy - 4, width: sw, height: 16, color: hex('#e0e7ff'), borderRadius: 4 });
      txt(page, skill, sx + 8, cy + 1, 9, fr, navy);
      sx += sw + 6;
    }
    cy -= 28;
  }

  // Contact section
  page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.5, color: hex('#e2e8f0') });
  txt(page, 'Contact', PAD, cy, 10, fb, navy);
  cy -= 18;
  const contacts = [
    d.email && `Email: ${d.email}`,
    d.phone && `Phone: ${d.phone}`,
    d.website && `Web: ${d.website}`,
  ].filter(Boolean) as string[];
  for (const c of contacts) {
    txt(page, c, PAD, cy, 10, fr, grey, w - PAD * 2 - 160);
    cy -= 15;
  }

  // QR code — right side, vertically centred in body
  const qrSize = 120;
  const qrX = w - PAD - qrSize;
  const qrY = h - headerH - 60;
  await drawQr(pdfDoc, page, d.profileUrl, qrX, qrY, qrSize, navy, white);
  const scanW = fr.widthOfTextAtSize('Scan to view profile', 8);
  page.drawText('Scan to view profile', { x: qrX + (qrSize - scanW) / 2, y: qrY - qrSize - 8, size: 8, font: fr, color: grey });

  // Wordmark footer
  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio · japrofilestudio.jagroupservices.co.uk';
    const wmW = fr.widthOfTextAtSize(wm, 7.5);
    page.drawText(wm, { x: (w - wmW) / 2, y: 20, size: 7.5, font: fr, color: hex('#94a3b8') });
  }
}

// ── TEMPLATE 1: Classic Professional — Landscape ──────────────────────────────

async function t1Landscape(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4L;
  const navy = hex('#1e3a5f');
  const gold = hex('#c9a84c');
  const white = rgb(1, 1, 1);
  const grey = hex('#6b7280');
  const light = hex('#f8fafc');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: light });

  // Left navy panel (1/3 width)
  const panelW = 260;
  page.drawRectangle({ x: 0, y: 0, width: panelW, height: h, color: navy });
  page.drawRectangle({ x: panelW, y: 0, width: 4, height: h, color: gold });

  // Name in left panel
  const nameSize = 22;
  const nameLines = wrapText(d.name || 'Your Name', fb, nameSize, panelW - 40);
  let ny = h - 60;
  for (const line of nameLines) {
    page.drawText(line, { x: 20, y: ny, size: nameSize, font: fb, color: white });
    ny -= nameSize + 6;
  }

  if (d.title) txt(page, d.title, 20, ny - 4, 11, fr, gold, panelW - 40);
  if (d.company) txt(page, d.company, 20, ny - 22, 9, fr, hex('#94a3b8'), panelW - 40);

  // QR in left panel
  const qrSize = 100;
  await drawQr(pdfDoc, page, d.profileUrl, 20, 180, qrSize, white, navy);
  const scanW = fr.widthOfTextAtSize('Scan profile', 7);
  page.drawText('Scan profile', { x: 20 + (qrSize - scanW) / 2, y: 68, size: 7, font: fr, color: hex('#94a3b8') });

  // Contact in left panel
  const contacts = [d.email, d.phone, d.website].filter(Boolean);
  let cy2 = 55;
  for (const c of contacts.reverse()) {
    txt(page, c, 20, cy2, 7.5, fr, hex('#64748b'), panelW - 40);
    cy2 += 13;
  }

  // Right body
  const rx = panelW + 24;
  const rw = w - rx - PAD;
  let ry = h - 50;

  // Bio
  if (d.bio) {
    txt(page, 'About', rx, ry, 10, fb, navy);
    ry -= 18;
    const bioLines = wrapText(d.bio, fr, 10, rw);
    for (const line of bioLines.slice(0, 4)) {
      txt(page, line, rx, ry, 10, fr, grey);
      ry -= 15;
    }
    ry -= 10;
  }

  // Skills
  if (d.skills.length > 0) {
    page.drawLine({ start: { x: rx, y: ry + 10 }, end: { x: w - PAD, y: ry + 10 }, thickness: 0.4, color: hex('#e2e8f0') });
    txt(page, 'Skills', rx, ry - 4, 10, fb, navy);
    ry -= 22;
    let sx = rx;
    for (const skill of d.skills.slice(0, 8)) {
      const sw = fr.widthOfTextAtSize(skill, 8.5) + 14;
      if (sx + sw > w - PAD) { sx = rx; ry -= 20; }
      page.drawRectangle({ x: sx, y: ry - 4, width: sw, height: 15, color: hex('#e0e7ff'), borderRadius: 3 });
      txt(page, skill, sx + 7, ry + 1, 8.5, fr, navy);
      sx += sw + 5;
    }
    ry -= 28;
  }

  // Profile URL
  page.drawLine({ start: { x: rx, y: ry + 10 }, end: { x: w - PAD, y: ry + 10 }, thickness: 0.4, color: hex('#e2e8f0') });
  txt(page, d.profileUrl, rx, ry - 4, 9, fr, hex('#2563eb'), rw);

  // Wordmark
  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio';
    page.drawText(wm, { x: w - fr.widthOfTextAtSize(wm, 7) - 16, y: 14, size: 7, font: fr, color: hex('#94a3b8') });
  }
}

// ── TEMPLATE 2: Bold Dark — Portrait ──────────────────────────────────────────

async function t2Portrait(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4P;
  const dark = hex('#0f172a');
  const blue = hex('#3b82f6');
  const white = rgb(1, 1, 1);
  const muted = hex('#94a3b8');
  const slate = hex('#1e293b');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: dark });

  // Top accent bar
  page.drawRectangle({ x: 0, y: h - 6, width: w, height: 6, color: blue });

  // Large name
  const nameSize = 38;
  const nameText = d.name || 'Your Name';
  const nameW = fb.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, { x: (w - nameW) / 2, y: h - 80, size: nameSize, font: fb, color: white });

  // Title
  if (d.title) {
    const tw = fr.widthOfTextAtSize(d.title, 16);
    page.drawText(d.title, { x: (w - tw) / 2, y: h - 108, size: 16, font: fr, color: blue });
  }

  // Company
  if (d.company) {
    const cw = fr.widthOfTextAtSize(d.company, 11);
    page.drawText(d.company, { x: (w - cw) / 2, y: h - 130, size: 11, font: fr, color: muted });
  }

  // Divider
  page.drawLine({ start: { x: PAD, y: h - 150 }, end: { x: w - PAD, y: h - 150 }, thickness: 0.5, color: hex('#334155') });

  // Bio
  let cy = h - 180;
  if (d.bio) {
    const bioLines = wrapText(d.bio, fr, 11, w - PAD * 2 - 150);
    for (const line of bioLines.slice(0, 5)) {
      txt(page, line, PAD, cy, 11, fr, muted);
      cy -= 16;
    }
    cy -= 12;
  }

  // Skills
  if (d.skills.length > 0) {
    txt(page, 'Skills', PAD, cy, 10, fb, blue);
    cy -= 18;
    let sx = PAD;
    for (const skill of d.skills.slice(0, 10)) {
      const sw = fr.widthOfTextAtSize(skill, 9) + 16;
      if (sx + sw > w - PAD) { sx = PAD; cy -= 20; }
      page.drawRectangle({ x: sx, y: cy - 4, width: sw, height: 16, color: hex('#1e3a5f'), borderRadius: 4 });
      txt(page, skill, sx + 8, cy + 1, 9, fr, hex('#93c5fd'));
      sx += sw + 6;
    }
    cy -= 28;
  }

  // Contact
  page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.5, color: hex('#334155') });
  txt(page, 'Contact', PAD, cy, 10, fb, blue);
  cy -= 18;
  const contacts = [d.email && `Email: ${d.email}`, d.phone && `Phone: ${d.phone}`, d.website && `Web: ${d.website}`].filter(Boolean) as string[];
  for (const c of contacts) {
    txt(page, c, PAD, cy, 10, fr, muted, w - PAD * 2 - 150);
    cy -= 15;
  }

  // QR
  const qrSize = 120;
  const qrX = w - PAD - qrSize;
  const qrY = h - 180;
  await drawQr(pdfDoc, page, d.profileUrl, qrX, qrY, qrSize, white, slate);
  const scanW = fr.widthOfTextAtSize('Scan to view profile', 8);
  page.drawText('Scan to view profile', { x: qrX + (qrSize - scanW) / 2, y: qrY - qrSize - 8, size: 8, font: fr, color: muted });

  // Bottom accent
  page.drawRectangle({ x: 0, y: 0, width: w, height: 6, color: blue });

  // Wordmark
  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio · japrofilestudio.jagroupservices.co.uk';
    const wmW = fr.widthOfTextAtSize(wm, 7.5);
    page.drawText(wm, { x: (w - wmW) / 2, y: 14, size: 7.5, font: fr, color: hex('#475569') });
  }
}

// ── TEMPLATE 2: Bold Dark — Landscape ─────────────────────────────────────────

async function t2Landscape(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4L;
  const dark = hex('#0f172a');
  const blue = hex('#3b82f6');
  const white = rgb(1, 1, 1);
  const muted = hex('#94a3b8');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: dark });
  page.drawRectangle({ x: 0, y: h - 5, width: w, height: 5, color: blue });
  page.drawRectangle({ x: 0, y: 0, width: w, height: 5, color: blue });

  // Name — large, left-aligned
  const nameSize = 28;
  txt(page, d.name || 'Your Name', PAD, h - 60, nameSize, fb, white, w / 2 - PAD);
  if (d.title) txt(page, d.title, PAD, h - 88, 13, fr, blue, w / 2 - PAD);
  if (d.company) txt(page, d.company, PAD, h - 108, 10, fr, muted, w / 2 - PAD);

  // Vertical divider
  page.drawLine({ start: { x: w / 2, y: 30 }, end: { x: w / 2, y: h - 30 }, thickness: 0.5, color: hex('#334155') });

  // Left column — bio + skills
  let ly = h - 140;
  if (d.bio) {
    const bioLines = wrapText(d.bio, fr, 10, w / 2 - PAD * 1.5);
    for (const line of bioLines.slice(0, 4)) {
      txt(page, line, PAD, ly, 10, fr, muted);
      ly -= 15;
    }
    ly -= 10;
  }
  if (d.skills.length > 0) {
    txt(page, 'Skills', PAD, ly, 9, fb, blue);
    ly -= 16;
    let sx = PAD;
    for (const skill of d.skills.slice(0, 8)) {
      const sw = fr.widthOfTextAtSize(skill, 8) + 12;
      if (sx + sw > w / 2 - 20) { sx = PAD; ly -= 18; }
      page.drawRectangle({ x: sx, y: ly - 3, width: sw, height: 14, color: hex('#1e3a5f'), borderRadius: 3 });
      txt(page, skill, sx + 6, ly + 1, 8, fr, hex('#93c5fd'));
      sx += sw + 5;
    }
  }

  // Right column — QR + contact
  const rx = w / 2 + 24;
  const qrSize = 110;
  const qrY = h - 60;
  await drawQr(pdfDoc, page, d.profileUrl, rx, qrY, qrSize, white, dark);
  const scanW = fr.widthOfTextAtSize('Scan to view profile', 8);
  page.drawText('Scan to view profile', { x: rx + (qrSize - scanW) / 2, y: qrY - qrSize - 8, size: 8, font: fr, color: muted });

  let ry = qrY - qrSize - 30;
  const contacts = [d.email, d.phone, d.website].filter(Boolean);
  for (const c of contacts) {
    txt(page, c, rx, ry, 9, fr, muted, w - rx - PAD);
    ry -= 14;
  }

  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio';
    page.drawText(wm, { x: w - fr.widthOfTextAtSize(wm, 7) - 16, y: 14, size: 7, font: fr, color: hex('#475569') });
  }
}

// ── TEMPLATE 3: Minimal Clean — Portrait ──────────────────────────────────────

async function t3Portrait(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4P;
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const grey = hex('#6b7280');
  const light = hex('#f9fafb');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: white });

  // Top rule
  page.drawLine({ start: { x: PAD, y: h - PAD }, end: { x: w - PAD, y: h - PAD }, thickness: 1.5, color: black });

  // Name
  const nameSize = 36;
  const nameText = d.name || 'Your Name';
  const nameW = fb.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, { x: (w - nameW) / 2, y: h - PAD - 50, size: nameSize, font: fb, color: black });

  // Thin rule under name
  page.drawLine({ start: { x: PAD + 60, y: h - PAD - 66 }, end: { x: w - PAD - 60, y: h - PAD - 66 }, thickness: 0.4, color: hex('#d1d5db') });

  // Title + company centred
  if (d.title) {
    const tw = fr.widthOfTextAtSize(d.title, 13);
    page.drawText(d.title, { x: (w - tw) / 2, y: h - PAD - 86, size: 13, font: fr, color: grey });
  }
  if (d.company) {
    const cw = fr.widthOfTextAtSize(d.company, 10);
    page.drawText(d.company, { x: (w - cw) / 2, y: h - PAD - 104, size: 10, font: fr, color: hex('#9ca3af') });
  }

  // Bio
  let cy = h - PAD - 140;
  if (d.bio) {
    const bioLines = wrapText(d.bio, fr, 11, w - PAD * 2 - 150);
    for (const line of bioLines.slice(0, 5)) {
      txt(page, line, PAD, cy, 11, fr, grey);
      cy -= 16;
    }
    cy -= 12;
  }

  // Skills
  if (d.skills.length > 0) {
    page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.4, color: hex('#e5e7eb') });
    txt(page, 'Skills', PAD, cy, 10, fb, black);
    cy -= 18;
    let sx = PAD;
    for (const skill of d.skills.slice(0, 10)) {
      const sw = fr.widthOfTextAtSize(skill, 9) + 16;
      if (sx + sw > w - PAD) { sx = PAD; cy -= 20; }
      page.drawRectangle({ x: sx, y: cy - 4, width: sw, height: 16, color: light, borderRadius: 4, borderColor: hex('#d1d5db'), borderWidth: 0.5 });
      txt(page, skill, sx + 8, cy + 1, 9, fr, grey);
      sx += sw + 6;
    }
    cy -= 28;
  }

  // Contact
  page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.4, color: hex('#e5e7eb') });
  const contacts = [d.email && `Email: ${d.email}`, d.phone && `Phone: ${d.phone}`, d.website && `Web: ${d.website}`].filter(Boolean) as string[];
  cy -= 4;
  for (const c of contacts) {
    txt(page, c, PAD, cy, 10, fr, grey, w - PAD * 2 - 150);
    cy -= 15;
  }

  // QR
  const qrSize = 110;
  const qrX = w - PAD - qrSize;
  const qrY = h - PAD - 140;
  await drawQr(pdfDoc, page, d.profileUrl, qrX, qrY, qrSize, black, white);
  const scanW = fr.widthOfTextAtSize('Scan to view profile', 8);
  page.drawText('Scan to view profile', { x: qrX + (qrSize - scanW) / 2, y: qrY - qrSize - 8, size: 8, font: fr, color: grey });

  // Bottom rule
  page.drawLine({ start: { x: PAD, y: PAD + (d.showWordmark ? 22 : 10) }, end: { x: w - PAD, y: PAD + (d.showWordmark ? 22 : 10) }, thickness: 1.5, color: black });

  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio · japrofilestudio.jagroupservices.co.uk';
    const wmW = fr.widthOfTextAtSize(wm, 7.5);
    page.drawText(wm, { x: (w - wmW) / 2, y: PAD, size: 7.5, font: fr, color: hex('#9ca3af') });
  }
}

// ── TEMPLATE 3: Minimal Clean — Landscape ─────────────────────────────────────

async function t3Landscape(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4L;
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const grey = hex('#6b7280');
  const light = hex('#f9fafb');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: white });
  page.drawLine({ start: { x: PAD, y: h - PAD }, end: { x: w - PAD, y: h - PAD }, thickness: 1.5, color: black });
  page.drawLine({ start: { x: PAD, y: PAD + (d.showWordmark ? 22 : 10) }, end: { x: w - PAD, y: PAD + (d.showWordmark ? 22 : 10) }, thickness: 1.5, color: black });

  // Name + title top-left
  txt(page, d.name || 'Your Name', PAD, h - PAD - 44, 28, fb, black, w / 2 - PAD);
  if (d.title) txt(page, d.title, PAD, h - PAD - 66, 12, fr, grey, w / 2 - PAD);
  if (d.company) txt(page, d.company, PAD, h - PAD - 84, 10, fr, hex('#9ca3af'), w / 2 - PAD);

  // Vertical divider
  page.drawLine({ start: { x: w / 2, y: PAD + 30 }, end: { x: w / 2, y: h - PAD - 10 }, thickness: 0.4, color: hex('#e5e7eb') });

  // Left — bio + skills
  let ly = h - PAD - 110;
  if (d.bio) {
    const bioLines = wrapText(d.bio, fr, 10, w / 2 - PAD * 1.5);
    for (const line of bioLines.slice(0, 4)) {
      txt(page, line, PAD, ly, 10, fr, grey);
      ly -= 15;
    }
    ly -= 8;
  }
  if (d.skills.length > 0) {
    txt(page, 'Skills', PAD, ly, 9, fb, black);
    ly -= 16;
    let sx = PAD;
    for (const skill of d.skills.slice(0, 8)) {
      const sw = fr.widthOfTextAtSize(skill, 8) + 12;
      if (sx + sw > w / 2 - 20) { sx = PAD; ly -= 18; }
      page.drawRectangle({ x: sx, y: ly - 3, width: sw, height: 14, color: light, borderRadius: 3, borderColor: hex('#d1d5db'), borderWidth: 0.5 });
      txt(page, skill, sx + 6, ly + 1, 8, fr, grey);
      sx += sw + 5;
    }
  }

  // Right — QR + contact
  const rx = w / 2 + 24;
  const qrSize = 100;
  const qrY = h - PAD - 50;
  await drawQr(pdfDoc, page, d.profileUrl, rx, qrY, qrSize, black, white);
  const scanW = fr.widthOfTextAtSize('Scan to view profile', 8);
  page.drawText('Scan to view profile', { x: rx + (qrSize - scanW) / 2, y: qrY - qrSize - 8, size: 8, font: fr, color: grey });

  let ry = qrY - qrSize - 28;
  const contacts = [d.email, d.phone, d.website].filter(Boolean);
  for (const c of contacts) {
    txt(page, c, rx, ry, 9, fr, grey, w - rx - PAD);
    ry -= 14;
  }

  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio · japrofilestudio.jagroupservices.co.uk';
    const wmW = fr.widthOfTextAtSize(wm, 7);
    page.drawText(wm, { x: (w - wmW) / 2, y: PAD + 2, size: 7, font: fr, color: hex('#9ca3af') });
  }
}

// ── TEMPLATE 4: JA Branded — Portrait ─────────────────────────────────────────

async function t4Portrait(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4P;
  const brand = hex('#2563eb');
  const dark = hex('#1e293b');
  const white = rgb(1, 1, 1);
  const muted = hex('#94a3b8');
  const accent = hex('#60a5fa');
  const light = hex('#f0f7ff');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: white });

  // Brand header
  const headerH = 220;
  page.drawRectangle({ x: 0, y: h - headerH, width: w, height: headerH, color: brand });

  // JA Profile Studio wordmark in header (always shown — this is the platform header, not the footer wordmark)
  txt(page, 'JA Profile Studio', PAD, h - 30, 11, fb, hex('#bfdbfe'));
  txt(page, 'japrofilestudio.jagroupservices.co.uk', PAD, h - 46, 8, fr, hex('#93c5fd'));

  // Name
  const nameSize = 30;
  const nameText = d.name || 'Your Name';
  const nameW = fb.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, { x: (w - nameW) / 2, y: h - 100, size: nameSize, font: fb, color: white });

  if (d.title) {
    const tw = fr.widthOfTextAtSize(d.title, 14);
    page.drawText(d.title, { x: (w - tw) / 2, y: h - 126, size: 14, font: fr, color: accent });
  }
  if (d.company) {
    const cw = fr.widthOfTextAtSize(d.company, 10);
    page.drawText(d.company, { x: (w - cw) / 2, y: h - 146, size: 10, font: fr, color: hex('#bfdbfe') });
  }

  // Profile URL
  const urlText = d.profileUrl.replace('https://', '');
  const urlW = fr.widthOfTextAtSize(urlText, 9);
  page.drawText(urlText, { x: (w - urlW) / 2, y: h - 166, size: 9, font: fr, color: hex('#93c5fd') });

  // Body
  let cy = h - headerH - 40;

  if (d.bio) {
    const bioLines = wrapText(d.bio, fr, 11, w - PAD * 2 - 150);
    for (const line of bioLines.slice(0, 5)) {
      txt(page, line, PAD, cy, 11, fr, dark);
      cy -= 16;
    }
    cy -= 12;
  }

  if (d.skills.length > 0) {
    page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.4, color: hex('#dbeafe') });
    txt(page, 'Skills', PAD, cy, 10, fb, brand);
    cy -= 18;
    let sx = PAD;
    for (const skill of d.skills.slice(0, 10)) {
      const sw = fr.widthOfTextAtSize(skill, 9) + 16;
      if (sx + sw > w - PAD) { sx = PAD; cy -= 20; }
      page.drawRectangle({ x: sx, y: cy - 4, width: sw, height: 16, color: light, borderRadius: 4 });
      txt(page, skill, sx + 8, cy + 1, 9, fr, brand);
      sx += sw + 6;
    }
    cy -= 28;
  }

  page.drawLine({ start: { x: PAD, y: cy + 14 }, end: { x: w - PAD, y: cy + 14 }, thickness: 0.4, color: hex('#dbeafe') });
  const contacts = [d.email && `Email: ${d.email}`, d.phone && `Phone: ${d.phone}`, d.website && `Web: ${d.website}`].filter(Boolean) as string[];
  cy -= 4;
  for (const c of contacts) {
    txt(page, c, PAD, cy, 10, fr, muted, w - PAD * 2 - 150);
    cy -= 15;
  }

  // QR
  const qrSize = 120;
  const qrX = w - PAD - qrSize;
  const qrY = h - headerH - 40;
  await drawQr(pdfDoc, page, d.profileUrl, qrX, qrY, qrSize, brand, white);
  const scanW = fr.widthOfTextAtSize('Scan to connect', 8);
  page.drawText('Scan to connect', { x: qrX + (qrSize - scanW) / 2, y: qrY - qrSize - 8, size: 8, font: fr, color: muted });

  // Footer wordmark (only for free/starter — this is the "Powered by" footer, not the header branding)
  if (d.showWordmark) {
    page.drawRectangle({ x: 0, y: 0, width: w, height: 28, color: hex('#eff6ff') });
    const wm = 'Created with JA Profile Studio · japrofilestudio.jagroupservices.co.uk';
    const wmW = fr.widthOfTextAtSize(wm, 7.5);
    page.drawText(wm, { x: (w - wmW) / 2, y: 9, size: 7.5, font: fr, color: brand });
  }
}

// ── TEMPLATE 4: JA Branded — Landscape ────────────────────────────────────────

async function t4Landscape(pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) {
  const { w, h } = A4L;
  const brand = hex('#2563eb');
  const dark = hex('#1e293b');
  const white = rgb(1, 1, 1);
  const muted = hex('#94a3b8');
  const accent = hex('#60a5fa');
  const light = hex('#f0f7ff');

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: white });

  // Left brand panel
  const panelW = 240;
  page.drawRectangle({ x: 0, y: 0, width: panelW, height: h, color: brand });

  // Platform header in panel
  txt(page, 'JA Profile Studio', 16, h - 28, 10, fb, hex('#bfdbfe'), panelW - 32);

  // Name in panel
  const nameLines = wrapText(d.name || 'Your Name', fb, 20, panelW - 32);
  let ny = h - 60;
  for (const line of nameLines) {
    page.drawText(line, { x: 16, y: ny, size: 20, font: fb, color: white });
    ny -= 26;
  }
  if (d.title) txt(page, d.title, 16, ny - 4, 10, fr, accent, panelW - 32);
  if (d.company) txt(page, d.company, 16, ny - 20, 9, fr, hex('#bfdbfe'), panelW - 32);

  // QR in panel
  const qrSize = 90;
  await drawQr(pdfDoc, page, d.profileUrl, 16, 170, qrSize, white, brand);
  const scanW = fr.widthOfTextAtSize('Scan profile', 7);
  page.drawText('Scan profile', { x: 16 + (qrSize - scanW) / 2, y: 68, size: 7, font: fr, color: hex('#bfdbfe') });

  // Contact in panel
  const contacts = [d.email, d.phone, d.website].filter(Boolean);
  let cy2 = 55;
  for (const c of contacts.reverse()) {
    txt(page, c, 16, cy2, 7, fr, hex('#93c5fd'), panelW - 32);
    cy2 += 12;
  }

  // Right body
  const rx = panelW + 24;
  const rw = w - rx - PAD;
  let ry = h - 50;

  if (d.bio) {
    const bioLines = wrapText(d.bio, fr, 10, rw);
    for (const line of bioLines.slice(0, 4)) {
      txt(page, line, rx, ry, 10, fr, dark);
      ry -= 15;
    }
    ry -= 10;
  }

  if (d.skills.length > 0) {
    page.drawLine({ start: { x: rx, y: ry + 10 }, end: { x: w - PAD, y: ry + 10 }, thickness: 0.4, color: hex('#dbeafe') });
    txt(page, 'Skills', rx, ry - 4, 9, fb, brand);
    ry -= 20;
    let sx = rx;
    for (const skill of d.skills.slice(0, 8)) {
      const sw = fr.widthOfTextAtSize(skill, 8) + 12;
      if (sx + sw > w - PAD) { sx = rx; ry -= 18; }
      page.drawRectangle({ x: sx, y: ry - 3, width: sw, height: 14, color: light, borderRadius: 3 });
      txt(page, skill, sx + 6, ry + 1, 8, fr, brand);
      sx += sw + 5;
    }
    ry -= 26;
  }

  page.drawLine({ start: { x: rx, y: ry + 10 }, end: { x: w - PAD, y: ry + 10 }, thickness: 0.4, color: hex('#dbeafe') });
  txt(page, d.profileUrl, rx, ry - 4, 9, fr, brand, rw);

  if (d.showWordmark) {
    const wm = 'Created with JA Profile Studio';
    page.drawText(wm, { x: w - fr.widthOfTextAtSize(wm, 7) - 16, y: 12, size: 7, font: fr, color: brand });
  }
}

// ── Text wrapping ──────────────────────────────────────────────────────────────

function wrapText(text: string, font: Font, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Template registry ──────────────────────────────────────────────────────────

type TemplateFn = (pdfDoc: PDFDocument, page: PDFPage, d: PosterData, fb: Font, fr: Font) => Promise<void>;

const TEMPLATES: Record<string, { portrait: TemplateFn; landscape: TemplateFn; name: string }> = {
  '1': { portrait: t1Portrait, landscape: t1Landscape, name: 'Classic Professional' },
  '2': { portrait: t2Portrait, landscape: t2Landscape, name: 'Bold Dark' },
  '3': { portrait: t3Portrait, landscape: t3Landscape, name: 'Minimal Clean' },
  '4': { portrait: t4Portrait, landscape: t4Landscape, name: 'JA Branded' },
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function profilePosterPdf(req: Request, res: Response) {
  try {
  const { id } = req.params;
  const templateId = String(req.query.template ?? '1');
  const orient = String(req.query.orient ?? 'portrait') as 'portrait' | 'landscape';

  if (!TEMPLATES[templateId]) {
    return res.status(400).json({ error: 'Invalid template. Use 1, 2, 3, or 4.' });
  }
  if (orient !== 'portrait' && orient !== 'landscape') {
    return res.status(400).json({ error: 'orient must be portrait or landscape' });
  }

  // ── Plan gate: Poster PDF requires Starter or higher ──────────────────────
  // Check the session user's plan — free plan cannot access this endpoint.
  const sessionUserId = (req.session as any)?.userId;
  if (sessionUserId) {
    const planCheck = db.prepare(`
      SELECT pl.slug FROM users u
      LEFT JOIN plans pl ON pl.id = u.plan_id
      WHERE u.id = ?
    `).get(sessionUserId) as { slug: string } | undefined;
    const planSlug = planCheck?.slug ?? 'free';
    if (planSlug === 'free' || !planSlug) {
      return res.status(403).json({
        error: 'Plan upgrade required',
        message: 'Profile Poster PDF is available on Starter and higher plans. Upgrade to access this feature.',
        upgradeUrl: '/dashboard/billing',
      });
    }
  }

  // Fetch profile + plan
  const profile = db.prepare(`
    SELECT p.*, u.email AS user_email, u.name AS user_name,
           pl.remove_branding, pl.name AS plan_name, pl.slug AS plan_slug
    FROM profiles p
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN plans pl ON pl.id = u.plan_id
    WHERE p.id = ? AND p.is_published = 1
  `).get(id) as any;

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found or not published' });
  }

  const BASE_URL = (
    (db.prepare("SELECT value FROM admin_settings WHERE key = 'platform_url'").get() as { value: string } | undefined)?.value ||
    'https://japrofilestudio.jagroupservices.co.uk'
  ).replace(/\/$/, '');

  // Build the correct public profile path — matches the live routing scheme:
  //   Personal:  /profile/<username>
  //   Business:  /profile/<biz_slug>
  const profilePath = profile.profile_type === 'business'
    ? `/profile/${profile.biz_slug || profile.username || id}`
    : `/profile/${profile.username || id}`;
  const profileUrl = `${BASE_URL}${profilePath}`;

  // Parse skills from JSON or comma-separated
  let skills: string[] = [];
  try {
    const raw = profile.skills;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      skills = Array.isArray(parsed) ? parsed.map((s: any) => (typeof s === 'string' ? s : s.name || '')).filter(Boolean) : [];
    }
  } catch { /* ignore */ }

  // Bio — try extended_sections.bio first, then bio column
  let bio = '';
  try {
    const ext = profile.extended_sections ? JSON.parse(profile.extended_sections) : {};
    bio = ext.bio || profile.bio || profile.headline || '';
  } catch { bio = profile.bio || profile.headline || ''; }

  const isBusiness = profile.profile_type === 'business';

  const posterData: PosterData = {
    name:        isBusiness
                   ? (profile.business_name || profile.display_name || profile.user_name || 'Your Business')
                   : (profile.display_name || profile.user_name || 'Your Name'),
    title:       isBusiness ? (profile.business_category || '') : (profile.job_title || ''),
    company:     isBusiness ? '' : (profile.company_name || ''),
    bio:         bio.slice(0, 300),
    email:       profile.contact_email || profile.user_email || '',
    phone:       profile.phone || '',
    website:     profile.website || '',
    profileUrl,
    username:    profile.username || profile.biz_slug || String(id),
    skills:      skills.slice(0, 12),
    // Wordmark shown when plan does NOT have remove_branding
    showWordmark: !profile.remove_branding,
  };

  const tmpl = TEMPLATES[templateId];
  const dims = orient === 'portrait' ? [A4P.w, A4P.h] : [A4L.w, A4L.h];

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${posterData.name} - Profile Poster (${tmpl.name})`);
  pdfDoc.setAuthor('JA Profile Studio');
  pdfDoc.setSubject('A4 profile poster');
  pdfDoc.setCreator('JA Profile Studio - japrofilestudio.jagroupservices.co.uk');

  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage(dims as [number, number]);

  if (orient === 'portrait') {
    await tmpl.portrait(pdfDoc, page, posterData, fontB, fontR);
  } else {
    await tmpl.landscape(pdfDoc, page, posterData, fontB, fontR);
  }

  const pdfBytes = await pdfDoc.save();
  const slug = (posterData.name || 'poster').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `${slug}-poster-t${templateId}-${orient}.pdf`;

  // Open inline in browser — NOT as a download attachment
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBytes.length);
  res.setHeader('Cache-Control', 'no-store');
  res.end(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('[Poster PDF] Generation failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF generation failed', detail: String(err) });
    }
  }
}
