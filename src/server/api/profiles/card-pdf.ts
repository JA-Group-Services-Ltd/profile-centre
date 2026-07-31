/**
 * GET /api/profiles/:id/card-pdf?template=1&side=front
 *
 * Generates a print-ready PDF business card for a profile.
 * Templates: 1 = Classic Professional, 2 = Bold Dark, 3 = Minimal Clean, 4 = JA Branded
 * Uses pdf-lib (pure JS, no native deps).
 * QR code is generated using the `qrcode` library — fully scannable.
 */
import type { Request, Response } from 'express';
import { PDFDocument, rgb, StandardFonts, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';
import db from '../../db.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}


// ── Real QR code (scannable) ───────────────────────────────────────────────────

async function drawQr(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  url: string,
  x: number,
  y: number,
  size: number,
  _color: RGB = rgb(0, 0, 0),
  _bgColor?: RGB,
) {
  try {
    const pngDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const base64 = pngDataUrl.replace(/^data:image\/png;base64,/, '');
    const pngBytes = Buffer.from(base64, 'base64');
    const img = await pdfDoc.embedPng(pngBytes);
    page.drawImage(img, { x, y: y - size, width: size, height: size });
  } catch (e) {
    console.error('[drawQr card] Failed to embed QR:', e);
  }
}



// Draw a Code-128-style barcode (visual representation)
function drawBarcode(
  page: ReturnType<PDFDocument['addPage']>,
  data: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB = rgb(0, 0, 0),
) {
  // Generate bar widths from data hash
  const bars: number[] = [2]; // start guard
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    bars.push(1 + (code % 3));
    bars.push(1 + ((code >> 2) % 2));
    bars.push(1 + ((code >> 4) % 3));
    bars.push(1 + ((code >> 6) % 2));
  }
  bars.push(2, 3, 1); // stop guard

  const totalUnits = bars.reduce((a, b) => a + b, 0);
  const unitWidth = width / totalUnits;

  let cx = x;
  for (let i = 0; i < bars.length; i++) {
    const barWidth = bars[i] * unitWidth;
    if (i % 2 === 0) {
      // Dark bar
      page.drawRectangle({ x: cx, y, width: barWidth - 0.3, height, color });
    }
    cx += barWidth;
  }
}

// ── Card dimensions (85.6mm × 54mm = 242.6pt × 153.1pt at 72dpi) ──────────────
const CARD_W = 242.6;
const CARD_H = 153.1;
const BLEED = 8.5; // 3mm bleed on each side

// ── Template definitions ───────────────────────────────────────────────────────

interface CardData {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  profileUrl: string;
  username: string;
}

type TemplateFn = (
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  data: CardData,
  fontB: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontR: Awaited<ReturnType<PDFDocument['embedFont']>>,
) => Promise<void>;

// ── Template 1: Classic Professional (white, navy accent) ─────────────────────
const template1: TemplateFn = async (pdfDoc, page, data, fontB, fontR) => {
  const W = CARD_W + BLEED * 2;
  const H = CARD_H + BLEED * 2;
  const navy = hexToRgb('#1e3a5f');
  const gold  = hexToRgb('#c9a84c');
  const white = rgb(1, 1, 1);
  const grey  = hexToRgb('#6b7280');

  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white });

  // Left accent bar
  page.drawRectangle({ x: BLEED, y: BLEED, width: 4, height: CARD_H, color: navy });

  // Gold top rule
  page.drawRectangle({ x: BLEED, y: BLEED + CARD_H - 3, width: CARD_W, height: 3, color: gold });

  // Name
  page.drawText(data.name || 'Your Name', { x: BLEED + 16, y: BLEED + CARD_H - 28, size: 16, font: fontB, color: navy });

  // Title
  if (data.title) {
    page.drawText(data.title, { x: BLEED + 16, y: BLEED + CARD_H - 44, size: 9, font: fontR, color: gold });
  }

  // Company
  if (data.company) {
    page.drawText(data.company, { x: BLEED + 16, y: BLEED + CARD_H - 56, size: 8, font: fontR, color: grey });
  }

  // Divider
  page.drawLine({ start: { x: BLEED + 16, y: BLEED + 68 }, end: { x: BLEED + 140, y: BLEED + 68 }, thickness: 0.5, color: hexToRgb('#e5e7eb') });

  // Contact details
  let cy = BLEED + 58;
  const contactItems = [
    data.email,
    data.phone,
    data.website || data.profileUrl,
  ].filter(Boolean);
  for (const item of contactItems) {
    page.drawText(item.slice(0, 38), { x: BLEED + 16, y: cy, size: 7.5, font: fontR, color: grey });
    cy -= 12;
  }

  // QR code
  await drawQr(pdfDoc, page, data.profileUrl, BLEED + CARD_W - 68, BLEED + 68, 58, navy, white);

  // QR label
  page.drawText('Scan to view profile', { x: BLEED + CARD_W - 68, y: BLEED + 6, size: 5.5, font: fontR, color: grey });

  // Barcode at bottom
  drawBarcode(page, data.username || data.profileUrl, BLEED + 16, BLEED + 8, 120, 10, navy);

  // Crop marks
  const cm = 6;
  const cmColor = hexToRgb('#cccccc');
  // TL
  page.drawLine({ start: { x: 0, y: H - BLEED }, end: { x: cm, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: H }, end: { x: BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  // TR
  page.drawLine({ start: { x: W - cm, y: H - BLEED }, end: { x: W, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: H }, end: { x: W - BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  // BL
  page.drawLine({ start: { x: 0, y: BLEED }, end: { x: cm, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: 0 }, end: { x: BLEED, y: cm }, thickness: 0.3, color: cmColor });
  // BR
  page.drawLine({ start: { x: W - cm, y: BLEED }, end: { x: W, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: 0 }, end: { x: W - BLEED, y: cm }, thickness: 0.3, color: cmColor });
};

// ── Template 2: Bold Dark (dark bg, white text, blue accent) ──────────────────
const template2: TemplateFn = async (pdfDoc, page, data, fontB, fontR) => {
  const W = CARD_W + BLEED * 2;
  const H = CARD_H + BLEED * 2;
  const dark  = hexToRgb('#0f172a');
  const blue  = hexToRgb('#3b82f6');
  const white = rgb(1, 1, 1);
  const muted = hexToRgb('#94a3b8');

  // Dark background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });

  // Blue accent strip (bottom)
  page.drawRectangle({ x: BLEED, y: BLEED, width: CARD_W, height: 4, color: blue });

  // Blue top corner accent
  page.drawRectangle({ x: BLEED, y: BLEED + CARD_H - 4, width: CARD_W, height: 4, color: blue });

  // Name
  page.drawText(data.name || 'Your Name', { x: BLEED + 14, y: BLEED + CARD_H - 30, size: 17, font: fontB, color: white });

  // Title
  if (data.title) {
    page.drawText(data.title, { x: BLEED + 14, y: BLEED + CARD_H - 46, size: 9, font: fontR, color: blue });
  }

  // Company
  if (data.company) {
    page.drawText(data.company, { x: BLEED + 14, y: BLEED + CARD_H - 58, size: 8, font: fontR, color: muted });
  }

  // Contact
  let cy = BLEED + 62;
  const items = [data.email, data.phone, data.website || data.profileUrl].filter(Boolean);
  for (const item of items) {
    page.drawText(item.slice(0, 36), { x: BLEED + 14, y: cy, size: 7.5, font: fontR, color: muted });
    cy -= 12;
  }

  // QR code (white on dark)
  await drawQr(pdfDoc, page, data.profileUrl, BLEED + CARD_W - 66, BLEED + 14, 56, white, dark);
  page.drawText('Scan profile', { x: BLEED + CARD_W - 66, y: BLEED + 8, size: 5.5, font: fontR, color: muted });

  // Barcode
  drawBarcode(page, data.username || data.profileUrl, BLEED + 14, BLEED + 10, 110, 8, blue);

  // Crop marks
  const cm = 6;
  const cmColor = hexToRgb('#334155');
  page.drawLine({ start: { x: 0, y: H - BLEED }, end: { x: cm, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: H }, end: { x: BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - cm, y: H - BLEED }, end: { x: W, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: H }, end: { x: W - BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: 0, y: BLEED }, end: { x: cm, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: 0 }, end: { x: BLEED, y: cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - cm, y: BLEED }, end: { x: W, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: 0 }, end: { x: W - BLEED, y: cm }, thickness: 0.3, color: cmColor });
};

// ── Template 3: Minimal Clean (white, thin lines, monochrome) ─────────────────
const template3: TemplateFn = async (pdfDoc, page, data, fontB, fontR) => {
  const W = CARD_W + BLEED * 2;
  const H = CARD_H + BLEED * 2;
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const light = hexToRgb('#f3f4f6');
  const grey  = hexToRgb('#6b7280');

  // White background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white });

  // Thin top border
  page.drawLine({ start: { x: BLEED, y: BLEED + CARD_H }, end: { x: BLEED + CARD_W, y: BLEED + CARD_H }, thickness: 1, color: black });
  // Thin bottom border
  page.drawLine({ start: { x: BLEED, y: BLEED }, end: { x: BLEED + CARD_W, y: BLEED }, thickness: 1, color: black });

  // Name — large, centred
  const nameText = data.name || 'Your Name';
  const nameW = fontB.widthOfTextAtSize(nameText, 18);
  page.drawText(nameText, { x: BLEED + (CARD_W - nameW) / 2, y: BLEED + CARD_H - 32, size: 18, font: fontB, color: black });

  // Title — centred
  if (data.title) {
    const titleW = fontR.widthOfTextAtSize(data.title, 9);
    page.drawText(data.title, { x: BLEED + (CARD_W - titleW) / 2, y: BLEED + CARD_H - 46, size: 9, font: fontR, color: grey });
  }

  // Thin divider
  page.drawLine({ start: { x: BLEED + 60, y: BLEED + 80 }, end: { x: BLEED + CARD_W - 60, y: BLEED + 80 }, thickness: 0.4, color: hexToRgb('#d1d5db') });

  // Contact — centred
  const items = [data.email, data.phone, data.website || data.profileUrl].filter(Boolean);
  let cy = BLEED + 72;
  for (const item of items) {
    const tw = fontR.widthOfTextAtSize(item.slice(0, 36), 7.5);
    page.drawText(item.slice(0, 36), { x: BLEED + (CARD_W - tw) / 2, y: cy, size: 7.5, font: fontR, color: grey });
    cy -= 12;
  }

  // QR code — bottom right
  await drawQr(pdfDoc, page, data.profileUrl, BLEED + CARD_W - 52, BLEED + 52, 44, black, white);
  page.drawText('Scan', { x: BLEED + CARD_W - 52 + 14, y: BLEED + 5, size: 5.5, font: fontR, color: grey });

  // Barcode — bottom left
  drawBarcode(page, data.username || data.profileUrl, BLEED + 12, BLEED + 10, 100, 8, black);

  // Crop marks
  const cm = 6;
  const cmColor = hexToRgb('#d1d5db');
  page.drawLine({ start: { x: 0, y: H - BLEED }, end: { x: cm, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: H }, end: { x: BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - cm, y: H - BLEED }, end: { x: W, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: H }, end: { x: W - BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: 0, y: BLEED }, end: { x: cm, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: 0 }, end: { x: BLEED, y: cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - cm, y: BLEED }, end: { x: W, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: 0 }, end: { x: W - BLEED, y: cm }, thickness: 0.3, color: cmColor });
};

// ── Template 4: JA Branded (Profile Centre brand colours) ───────────────────
const template4: TemplateFn = async (pdfDoc, page, data, fontB, fontR) => {
  const W = CARD_W + BLEED * 2;
  const H = CARD_H + BLEED * 2;
  const brand  = hexToRgb('#2563eb');  // JA primary blue
  const dark   = hexToRgb('#1e293b');
  const white  = rgb(1, 1, 1);
  const muted  = hexToRgb('#94a3b8');
  const accent = hexToRgb('#60a5fa');

  // White background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white });

  // Brand header band
  page.drawRectangle({ x: BLEED, y: BLEED + CARD_H - 38, width: CARD_W, height: 38, color: brand });

  // Profile Centre wordmark in header
  page.drawText('Profile Centre', { x: BLEED + 12, y: BLEED + CARD_H - 22, size: 10, font: fontB, color: white });
  page.drawText('japrofilestudio.jagroupservices.co.uk', { x: BLEED + 12, y: BLEED + CARD_H - 34, size: 6, font: fontR, color: accent });

  // Name
  page.drawText(data.name || 'Your Name', { x: BLEED + 12, y: BLEED + CARD_H - 58, size: 15, font: fontB, color: dark });

  // Title
  if (data.title) {
    page.drawText(data.title, { x: BLEED + 12, y: BLEED + CARD_H - 72, size: 8.5, font: fontR, color: brand });
  }

  // Company
  if (data.company) {
    page.drawText(data.company, { x: BLEED + 12, y: BLEED + CARD_H - 84, size: 8, font: fontR, color: muted });
  }

  // Thin divider
  page.drawLine({ start: { x: BLEED + 12, y: BLEED + 60 }, end: { x: BLEED + 150, y: BLEED + 60 }, thickness: 0.4, color: hexToRgb('#e2e8f0') });

  // Contact
  let cy = BLEED + 52;
  const items = [data.email, data.phone, data.website || data.profileUrl].filter(Boolean);
  for (const item of items) {
    page.drawText(item.slice(0, 36), { x: BLEED + 12, y: cy, size: 7.5, font: fontR, color: muted });
    cy -= 12;
  }

  // QR code
  await drawQr(pdfDoc, page, data.profileUrl, BLEED + CARD_W - 64, BLEED + 12, 54, brand, white);
  page.drawText('Scan to connect', { x: BLEED + CARD_W - 64, y: BLEED + 6, size: 5.5, font: fontR, color: muted });

  // Barcode
  drawBarcode(page, data.username || data.profileUrl, BLEED + 12, BLEED + 8, 115, 9, brand);

  // Crop marks
  const cm = 6;
  const cmColor = hexToRgb('#cbd5e1');
  page.drawLine({ start: { x: 0, y: H - BLEED }, end: { x: cm, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: H }, end: { x: BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - cm, y: H - BLEED }, end: { x: W, y: H - BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: H }, end: { x: W - BLEED, y: H - cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: 0, y: BLEED }, end: { x: cm, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: BLEED, y: 0 }, end: { x: BLEED, y: cm }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - cm, y: BLEED }, end: { x: W, y: BLEED }, thickness: 0.3, color: cmColor });
  page.drawLine({ start: { x: W - BLEED, y: 0 }, end: { x: W - BLEED, y: cm }, thickness: 0.3, color: cmColor });
};

const TEMPLATES: Record<string, TemplateFn> = {
  '1': template1,
  '2': template2,
  '3': template3,
  '4': template4,
};

const TEMPLATE_NAMES: Record<string, string> = {
  '1': 'Classic Professional',
  '2': 'Bold Dark',
  '3': 'Minimal Clean',
  '4': 'JA Branded',
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function profileCardPdf(req: Request, res: Response) {
  const { id } = req.params;
  const templateId = String(req.query.template ?? '1');

  if (!TEMPLATES[templateId]) {
    return res.status(400).json({ error: 'Invalid template. Use 1, 2, 3, or 4.' });
  }

  // Fetch profile
  const profile = db.prepare(`
    SELECT p.*, u.email as user_email, u.name as user_name
    FROM profiles p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ? AND p.is_published = 1
  `).get(id) as any;

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found or not published' });
  }

  const BASE_URL = 'https://japrofilestudio.jagroupservices.co.uk';
  const profileUrl = `${BASE_URL}/${profile.username || profile.biz_slug || id}`;

  const cardData: CardData = {
    name:       profile.display_name || profile.business_name || profile.user_name || 'Your Name',
    title:      profile.job_title || profile.business_type || '',
    company:    profile.company_name || profile.business_name || '',
    email:      profile.contact_email || profile.user_email || '',
    phone:      profile.phone || '',
    website:    profile.website || '',
    profileUrl,
    username:   profile.username || profile.biz_slug || String(id),
  };

  // Build PDF — A4 sheet with card centred (for easy printing)
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${cardData.name} — Business Card (${TEMPLATE_NAMES[templateId]})`);
  pdfDoc.setAuthor('Profile Centre');
  pdfDoc.setSubject('Print-ready business card');
  pdfDoc.setCreator('Profile Centre — japrofilestudio.jagroupservices.co.uk');

  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = CARD_W + BLEED * 2;
  const H = CARD_H + BLEED * 2;

  // Page 1: Card front (card size + bleed)
  const frontPage = pdfDoc.addPage([W, H]);
  await TEMPLATES[templateId](pdfDoc, frontPage, cardData, fontB, fontR);

  // Page 2: A4 print sheet — card centred with print instructions
  const A4W = 595.28;
  const A4H = 841.89;
  const sheetPage = pdfDoc.addPage([A4W, A4H]);
  const cx = (A4W - W) / 2;
  const cy = (A4H - H) / 2 + 40;

  // Instructions header
  sheetPage.drawText('Profile Centre — Print-Ready Business Card', {
    x: 50, y: A4H - 50, size: 13, font: fontB, color: hexToRgb('#1e293b'),
  });
  sheetPage.drawText(`Template: ${TEMPLATE_NAMES[templateId]}  ·  Card size: 85.6 × 54mm  ·  Includes 3mm bleed`, {
    x: 50, y: A4H - 66, size: 8, font: fontR, color: hexToRgb('#6b7280'),
  });
  sheetPage.drawText(`Profile: ${profileUrl}`, {
    x: 50, y: A4H - 78, size: 8, font: fontR, color: hexToRgb('#2563eb'),
  });
  sheetPage.drawLine({ start: { x: 50, y: A4H - 86 }, end: { x: A4W - 50, y: A4H - 86 }, thickness: 0.5, color: hexToRgb('#e2e8f0') });

  // Draw card on sheet
  await TEMPLATES[templateId](pdfDoc, sheetPage, cardData, fontB, fontR);
  // Translate — pdf-lib doesn't support transforms, so we re-draw at offset
  // (The card is already drawn at 0,0 — for the sheet we need to offset)
  // We draw a border around where the card would be
  sheetPage.drawRectangle({
    x: cx - 1, y: cy - 1, width: W + 2, height: H + 2,
    borderColor: hexToRgb('#94a3b8'), borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });
  // Re-render card at offset position using a second page approach
  // (pdf-lib limitation: we embed page 1 as XObject)
  const [embeddedCard] = await pdfDoc.embedPages([frontPage]);
  sheetPage.drawPage(embeddedCard, { x: cx, y: cy, width: W, height: H });

  // Print instructions at bottom
  const instrY = cy - 30;
  sheetPage.drawText('Print instructions:', { x: 50, y: instrY, size: 8, font: fontB, color: hexToRgb('#374151') });
  sheetPage.drawText('1. Print at 100% scale (do not scale to fit). 2. Cut along the crop marks. 3. The bleed area (3mm border) will be trimmed off.', {
    x: 50, y: instrY - 14, size: 7.5, font: fontR, color: hexToRgb('#6b7280'),
  });
  sheetPage.drawText('4. For best results, use 350gsm silk or gloss card stock. 5. QR code links to your live Profile Centre.', {
    x: 50, y: instrY - 26, size: 7.5, font: fontR, color: hexToRgb('#6b7280'),
  });

  // Footer
  sheetPage.drawText(`Generated by Profile Centre · japrofilestudio.jagroupservices.co.uk · ${new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}`, {
    x: 50, y: 30, size: 7, font: fontR, color: hexToRgb('#9ca3af'),
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `${(cardData.name || 'card').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-card-t${templateId}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
}
