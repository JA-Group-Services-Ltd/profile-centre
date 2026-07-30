/**
 * Email Signature HTML Renderer
 *
 * Produces email-safe HTML using:
 * - Table-based layout (Outlook/Gmail compatible)
 * - Inline CSS only (no external stylesheets)
 * - No scripts
 * - No unsupported CSS
 * - Hosted image URLs (no base64 blobs in email)
 */

import { getTemplateById, SIGNATURE_TEMPLATES, type SignatureTemplate } from './signature-templates.js';

export interface SignatureData {
  template_id: string;
  name?: string | null;
  job_title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  profile_url?: string | null;
  photo_url?: string | null;
  logo_url?: string | null;
  social_links?: Array<{ platform: string; url: string; label?: string }>;
  show_name?: number | boolean;
  show_job_title?: number | boolean;
  show_company?: number | boolean;
  show_phone?: number | boolean;
  show_email?: number | boolean;
  show_website?: number | boolean;
  show_qr?: number | boolean;
  show_social?: number | boolean;
  show_photo?: number | boolean;
  show_logo?: number | boolean;
  accent_color?: string | null;
  /** QR code data URL or hosted URL */
  qr_url?: string | null;
  /** Optional branding text appended for free-plan users */
  branding_text?: string | null;
}

const on = (v: number | boolean | undefined | null) => v === 1 || v === true;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const t = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t;
  return '';
}

// ── Social platform helpers ────────────────────────────────────────────────────

const SOCIAL_COLORS: Record<string, string> = {
  linkedin:  '#0A66C2',
  facebook:  '#1877F2',
  instagram: '#E4405F',
  twitter:   '#000000',
  x:         '#000000',
  tiktok:    '#000000',
  youtube:   '#FF0000',
  whatsapp:  '#25D366',
  website:   '#6B7280',
  email:     '#6B7280',
  phone:     '#6B7280',
};

const SOCIAL_LABELS: Record<string, string> = {
  linkedin:  'LinkedIn',
  facebook:  'Facebook',
  instagram: 'Instagram',
  twitter:   'X / Twitter',
  x:         'X',
  tiktok:    'TikTok',
  youtube:   'YouTube',
  whatsapp:  'WhatsApp',
  website:   'Website',
  email:     'Email',
  phone:     'Phone',
};

function socialButtonsHtml(
  links: Array<{ platform: string; url: string; label?: string }>,
  accentColor: string,
  style: 'pill' | 'text' = 'pill',
): string {
  if (!links.length) return '';
  const buttons = links.map(l => {
    const color = SOCIAL_COLORS[l.platform.toLowerCase()] ?? accentColor;
    const label = l.label || SOCIAL_LABELS[l.platform.toLowerCase()] || l.platform;
    const url = safeUrl(l.url);
    if (!url) return '';
    if (style === 'text') {
      return `<a href="${esc(url)}" style="color:${color};text-decoration:none;font-size:11px;margin-right:10px;">${esc(label)}</a>`;
    }
    return `<a href="${esc(url)}" style="display:inline-block;background-color:${color};color:#ffffff;font-size:10px;font-weight:600;padding:4px 10px;border-radius:3px;text-decoration:none;margin-right:4px;margin-bottom:4px;font-family:Arial,sans-serif;">${esc(label)}</a>`;
  }).filter(Boolean);
  return buttons.join('');
}

function contactRow(icon: string, value: string, href: string, color: string): string {
  return `<tr>
    <td style="padding:1px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555555;">
      <a href="${esc(href)}" style="color:#555555;text-decoration:none;">
        <span style="color:${color};font-weight:bold;margin-right:4px;">${icon}</span>${esc(value)}
      </a>
    </td>
  </tr>`;
}

// ── Main renderer ──────────────────────────────────────────────────────────────

export function renderSignatureHtml(data: SignatureData): string {
  // Resolve template — fall back to first available template if ID is unknown
  // (handles legacy IDs like 'corporate-01' stored in the DB before the template
  //  system was updated)
  const template: SignatureTemplate =
    getTemplateById(data.template_id) ??
    getTemplateById('corp-h-light') ??
    SIGNATURE_TEMPLATES[0];

  if (!template) {
    // Absolute last resort — should never happen unless the templates array is empty
    return '<p style="font-family:Arial,sans-serif;font-size:12px;color:#555;">Email signature unavailable.</p>';
  }

  const accent = data.accent_color || '#3B82F6';
  const social = (data.social_links ?? []).filter(s => safeUrl(s.url));

  let html: string;
  switch (template.layout) {
    case 'horizontal':  html = renderHorizontal(data, template, accent, social); break;
    case 'vertical':    html = renderVertical(data, template, accent, social); break;
    case 'compact':     html = renderCompact(data, template, accent, social); break;
    case 'banner':      html = renderBanner(data, template, accent, social); break;
    case 'card':        html = renderCard(data, template, accent, social); break;
    case 'split':       html = renderSplit(data, template, accent, social); break;
    default:            html = renderHorizontal(data, template, accent, social); break;
  }

  // Append free-plan branding if set
  if (data.branding_text) {
    html += `\n<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin-top:4px;">
  <tr><td style="padding:4px 0;text-align:left;">
    <span style="font-size:10px;color:#9ca3af;">${esc(data.branding_text)}</span>
  </td></tr>
</table>`;
  }

  return html;
}

// ── Layout: Horizontal ────────────────────────────────────────────────────────
function renderHorizontal(
  d: SignatureData,
  t: SignatureTemplate,
  accent: string,
  social: Array<{ platform: string; url: string; label?: string }>,
): string {
  const isDark = t.colorScheme === 'dark';
  const bg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#e0e0e0' : '#333333';
  const barColor = t.accentBar === 'left' ? accent : 'transparent';

  const photoHtml = on(d.show_photo) && d.photo_url
    ? `<td style="padding-right:16px;vertical-align:top;">
        <img src="${esc(d.photo_url)}" alt="${esc(d.name ?? '')}" width="72" height="72"
          style="width:72px;height:72px;border-radius:${t.photoShape === 'circle' ? '50%' : '4px'};object-fit:cover;display:block;" />
      </td>` : '';

  const logoHtml = on(d.show_logo) && d.logo_url
    ? `<img src="${esc(d.logo_url)}" alt="Logo" height="36" style="height:36px;max-width:120px;display:block;margin-bottom:6px;" />` : '';

  const qrHtml = on(d.show_qr) && d.qr_url
    ? `<td style="padding-left:16px;vertical-align:top;">
        <a href="${esc(safeUrl(d.profile_url))}">
          <img src="${esc(d.qr_url)}" alt="QR Code" width="72" height="72"
            style="width:72px;height:72px;display:block;" />
        </a>
      </td>` : '';

  const contacts: string[] = [];
  if (on(d.show_phone) && d.phone)   contacts.push(contactRow('📞', d.phone,   `tel:${d.phone}`,           accent));
  if (on(d.show_email) && d.email)   contacts.push(contactRow('✉', d.email,   `mailto:${d.email}`,        accent));
  if (on(d.show_website) && d.website) contacts.push(contactRow('🌐', d.website, safeUrl(d.website) || '#', accent));

  const socialHtml = on(d.show_social) && social.length
    ? `<tr><td style="padding-top:6px;">${socialButtonsHtml(social, accent)}</td></tr>` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="background-color:${bg};font-family:Arial,Helvetica,sans-serif;max-width:560px;">
  <tr>
    ${t.accentBar === 'left' ? `<td style="width:4px;background-color:${barColor};"></td>` : ''}
    <td style="padding:16px 20px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${photoHtml}
          <td style="vertical-align:top;">
            ${logoHtml}
            ${on(d.show_name) && d.name ? `<div style="font-size:16px;font-weight:700;color:${accent};margin-bottom:2px;">${esc(d.name)}</div>` : ''}
            ${on(d.show_job_title) && d.job_title ? `<div style="font-size:12px;color:${textColor};margin-bottom:1px;">${esc(d.job_title)}</div>` : ''}
            ${on(d.show_company) && d.company ? `<div style="font-size:12px;color:${textColor};margin-bottom:8px;font-weight:600;">${esc(d.company)}</div>` : ''}
            <table cellpadding="0" cellspacing="0" border="0">
              ${contacts.join('')}
              ${socialHtml}
            </table>
          </td>
          ${qrHtml}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ── Layout: Vertical ──────────────────────────────────────────────────────────
function renderVertical(
  d: SignatureData,
  t: SignatureTemplate,
  accent: string,
  social: Array<{ platform: string; url: string; label?: string }>,
): string {
  const isDark = t.colorScheme === 'dark';
  const bg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#e0e0e0' : '#555555';

  const photoHtml = on(d.show_photo) && d.photo_url
    ? `<tr><td align="center" style="padding-bottom:10px;">
        <img src="${esc(d.photo_url)}" alt="${esc(d.name ?? '')}" width="80" height="80"
          style="width:80px;height:80px;border-radius:${t.photoShape === 'circle' ? '50%' : '4px'};object-fit:cover;display:block;" />
      </td></tr>` : '';

  const qrHtml = on(d.show_qr) && d.qr_url
    ? `<tr><td align="center" style="padding-top:10px;">
        <a href="${esc(safeUrl(d.profile_url))}">
          <img src="${esc(d.qr_url)}" alt="QR Code" width="72" height="72"
            style="width:72px;height:72px;display:block;margin:0 auto;" />
        </a>
      </td></tr>` : '';

  const contacts: string[] = [];
  if (on(d.show_phone) && d.phone)     contacts.push(`<div style="font-size:12px;color:${textColor};margin-bottom:3px;">📞 <a href="tel:${esc(d.phone)}" style="color:${textColor};text-decoration:none;">${esc(d.phone)}</a></div>`);
  if (on(d.show_email) && d.email)     contacts.push(`<div style="font-size:12px;color:${textColor};margin-bottom:3px;">✉ <a href="mailto:${esc(d.email)}" style="color:${textColor};text-decoration:none;">${esc(d.email)}</a></div>`);
  if (on(d.show_website) && d.website) contacts.push(`<div style="font-size:12px;color:${textColor};margin-bottom:3px;">🌐 <a href="${esc(safeUrl(d.website))}" style="color:${textColor};text-decoration:none;">${esc(d.website)}</a></div>`);

  const socialHtml = on(d.show_social) && social.length
    ? `<tr><td align="center" style="padding-top:8px;">${socialButtonsHtml(social, accent)}</td></tr>` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="background-color:${bg};font-family:Arial,Helvetica,sans-serif;max-width:300px;text-align:center;">
  <tr><td style="padding:20px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${photoHtml}
      ${on(d.show_name) && d.name ? `<tr><td align="center"><div style="font-size:17px;font-weight:700;color:${accent};">${esc(d.name)}</div></td></tr>` : ''}
      ${on(d.show_job_title) && d.job_title ? `<tr><td align="center"><div style="font-size:12px;color:${textColor};margin-top:2px;">${esc(d.job_title)}</div></td></tr>` : ''}
      ${on(d.show_company) && d.company ? `<tr><td align="center"><div style="font-size:12px;font-weight:600;color:${textColor};margin-top:1px;margin-bottom:10px;">${esc(d.company)}</div></td></tr>` : ''}
      <tr><td align="center" style="padding-top:4px;">${contacts.join('')}</td></tr>
      ${qrHtml}
      ${socialHtml}
    </table>
  </td></tr>
</table>`;
}

// ── Layout: Compact ───────────────────────────────────────────────────────────
function renderCompact(
  d: SignatureData,
  t: SignatureTemplate,
  accent: string,
  social: Array<{ platform: string; url: string; label?: string }>,
): string {
  const textColor = '#555555';
  const sep = `<span style="color:#cccccc;margin:0 6px;">|</span>`;

  const parts: string[] = [];
  if (on(d.show_name) && d.name)         parts.push(`<span style="font-weight:700;color:${accent};font-size:13px;">${esc(d.name)}</span>`);
  if (on(d.show_job_title) && d.job_title) parts.push(`<span style="color:${textColor};font-size:12px;">${esc(d.job_title)}</span>`);
  if (on(d.show_company) && d.company)   parts.push(`<span style="color:${textColor};font-size:12px;font-weight:600;">${esc(d.company)}</span>`);

  const contactParts: string[] = [];
  if (on(d.show_phone) && d.phone)     contactParts.push(`<a href="tel:${esc(d.phone)}" style="color:${textColor};text-decoration:none;font-size:12px;">📞 ${esc(d.phone)}</a>`);
  if (on(d.show_email) && d.email)     contactParts.push(`<a href="mailto:${esc(d.email)}" style="color:${textColor};text-decoration:none;font-size:12px;">✉ ${esc(d.email)}</a>`);
  if (on(d.show_website) && d.website) contactParts.push(`<a href="${esc(safeUrl(d.website))}" style="color:${accent};text-decoration:none;font-size:12px;">🌐 ${esc(d.website)}</a>`);

  const socialHtml = on(d.show_social) && social.length
    ? `<div style="margin-top:6px;">${socialButtonsHtml(social, accent, 'text')}</div>` : '';

  const barStyle = t.accentBar === 'left'
    ? `border-left:3px solid ${accent};padding-left:10px;` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;">
  <tr><td style="${barStyle}padding:10px 0;">
    <div style="margin-bottom:4px;">${parts.join(sep)}</div>
    <div style="margin-bottom:2px;">${contactParts.join(sep)}</div>
    ${socialHtml}
  </td></tr>
</table>`;
}

// ── Layout: Banner ────────────────────────────────────────────────────────────
function renderBanner(
  d: SignatureData,
  t: SignatureTemplate,
  accent: string,
  social: Array<{ platform: string; url: string; label?: string }>,
): string {
  const headerBg = t.colorScheme === 'gradient'
    ? `background:linear-gradient(135deg,${accent},${accent}cc);`
    : t.colorScheme === 'dark' ? 'background-color:#1a1a2e;' : `background-color:${accent};`;
  const headerText = '#ffffff';
  const bodyBg = '#ffffff';
  const bodyText = '#555555';

  const photoHtml = on(d.show_photo) && d.photo_url
    ? `<img src="${esc(d.photo_url)}" alt="${esc(d.name ?? '')}" width="56" height="56"
        style="width:56px;height:56px;border-radius:${t.photoShape === 'circle' ? '50%' : '4px'};object-fit:cover;border:2px solid rgba(255,255,255,0.5);margin-right:12px;vertical-align:middle;" />` : '';

  const qrHtml = on(d.show_qr) && d.qr_url
    ? `<td style="padding-left:16px;vertical-align:middle;">
        <a href="${esc(safeUrl(d.profile_url))}">
          <img src="${esc(d.qr_url)}" alt="QR Code" width="64" height="64"
            style="width:64px;height:64px;display:block;" />
        </a>
      </td>` : '';

  const contacts: string[] = [];
  if (on(d.show_phone) && d.phone)     contacts.push(`<a href="tel:${esc(d.phone)}" style="color:${bodyText};text-decoration:none;font-size:12px;margin-right:14px;">📞 ${esc(d.phone)}</a>`);
  if (on(d.show_email) && d.email)     contacts.push(`<a href="mailto:${esc(d.email)}" style="color:${bodyText};text-decoration:none;font-size:12px;margin-right:14px;">✉ ${esc(d.email)}</a>`);
  if (on(d.show_website) && d.website) contacts.push(`<a href="${esc(safeUrl(d.website))}" style="color:${accent};text-decoration:none;font-size:12px;margin-right:14px;">🌐 ${esc(d.website)}</a>`);

  const socialHtml = on(d.show_social) && social.length
    ? `<tr><td style="padding:8px 16px 12px;">${socialButtonsHtml(social, accent)}</td></tr>` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;border:1px solid #e5e7eb;">
  <tr>
    <td style="${headerBg}padding:14px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">
            ${photoHtml}
            ${on(d.show_name) && d.name ? `<span style="font-size:17px;font-weight:700;color:${headerText};vertical-align:middle;">${esc(d.name)}</span>` : ''}
            ${on(d.show_job_title) && d.job_title ? `<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">${esc(d.job_title)}${on(d.show_company) && d.company ? ` &mdash; ${esc(d.company)}` : ''}</div>` : ''}
          </td>
          ${qrHtml}
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="background-color:${bodyBg};padding:10px 16px 4px;">
      ${contacts.join('')}
    </td>
  </tr>
  ${socialHtml}
</table>`;
}

// ── Layout: Card ──────────────────────────────────────────────────────────────
function renderCard(
  d: SignatureData,
  t: SignatureTemplate,
  accent: string,
  social: Array<{ platform: string; url: string; label?: string }>,
): string {
  const bg = t.colorScheme === 'dark' ? '#16213e' : '#ffffff';
  const textColor = t.colorScheme === 'dark' ? '#e0e0e0' : '#555555';
  const nameColor = t.colorScheme === 'dark' ? '#ffffff' : accent;
  const border = t.colorScheme === 'dark' ? 'none' : `1px solid #e5e7eb`;
  const shadow = t.colorScheme === 'dark' ? '' : 'box-shadow:0 2px 8px rgba(0,0,0,0.08);';

  const photoHtml = on(d.show_photo) && d.photo_url
    ? `<td style="padding-right:14px;vertical-align:top;">
        <img src="${esc(d.photo_url)}" alt="${esc(d.name ?? '')}" width="68" height="68"
          style="width:68px;height:68px;border-radius:${t.photoShape === 'circle' ? '50%' : '6px'};object-fit:cover;display:block;border:2px solid ${accent};" />
      </td>` : '';

  const qrHtml = on(d.show_qr) && d.qr_url
    ? `<tr><td style="padding-top:10px;">
        <a href="${esc(safeUrl(d.profile_url))}">
          <img src="${esc(d.qr_url)}" alt="QR Code" width="64" height="64"
            style="width:64px;height:64px;display:block;" />
        </a>
      </td></tr>` : '';

  const contacts: string[] = [];
  if (on(d.show_phone) && d.phone)     contacts.push(`<div style="font-size:12px;color:${textColor};margin-bottom:3px;"><a href="tel:${esc(d.phone)}" style="color:${textColor};text-decoration:none;">📞 ${esc(d.phone)}</a></div>`);
  if (on(d.show_email) && d.email)     contacts.push(`<div style="font-size:12px;color:${textColor};margin-bottom:3px;"><a href="mailto:${esc(d.email)}" style="color:${textColor};text-decoration:none;">✉ ${esc(d.email)}</a></div>`);
  if (on(d.show_website) && d.website) contacts.push(`<div style="font-size:12px;color:${textColor};margin-bottom:3px;"><a href="${esc(safeUrl(d.website))}" style="color:${accent};text-decoration:none;">🌐 ${esc(d.website)}</a></div>`);

  const socialHtml = on(d.show_social) && social.length
    ? `<div style="margin-top:8px;">${socialButtonsHtml(social, accent)}</div>` : '';

  const logoHtml = on(d.show_logo) && d.logo_url
    ? `<img src="${esc(d.logo_url)}" alt="Logo" height="30" style="height:30px;max-width:100px;display:block;margin-bottom:8px;" />` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;background-color:${bg};border:${border};border-radius:8px;${shadow}">
  <tr>
    <td style="padding:16px 18px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${photoHtml}
          <td style="vertical-align:top;">
            ${logoHtml}
            ${on(d.show_name) && d.name ? `<div style="font-size:16px;font-weight:700;color:${nameColor};margin-bottom:2px;">${esc(d.name)}</div>` : ''}
            ${on(d.show_job_title) && d.job_title ? `<div style="font-size:12px;color:${textColor};margin-bottom:1px;">${esc(d.job_title)}</div>` : ''}
            ${on(d.show_company) && d.company ? `<div style="font-size:12px;font-weight:600;color:${textColor};margin-bottom:8px;">${esc(d.company)}</div>` : ''}
            ${contacts.join('')}
            ${socialHtml}
          </td>
        </tr>
        ${qrHtml}
      </table>
    </td>
  </tr>
</table>`;
}

// ── Layout: Split ─────────────────────────────────────────────────────────────
function renderSplit(
  d: SignatureData,
  t: SignatureTemplate,
  accent: string,
  social: Array<{ platform: string; url: string; label?: string }>,
): string {
  const isDark = t.colorScheme === 'dark';
  const leftBg = isDark ? '#1a1a2e' : accent;
  const leftText = '#ffffff';
  const rightBg = '#ffffff';
  const rightText = '#555555';

  const photoHtml = on(d.show_photo) && d.photo_url
    ? `<div style="margin-bottom:10px;">
        <img src="${esc(d.photo_url)}" alt="${esc(d.name ?? '')}" width="72" height="72"
          style="width:72px;height:72px;border-radius:${t.photoShape === 'circle' ? '50%' : '4px'};object-fit:cover;border:2px solid rgba(255,255,255,0.5);" />
      </div>` : '';

  const qrHtml = on(d.show_qr) && d.qr_url
    ? `<div style="margin-top:10px;">
        <a href="${esc(safeUrl(d.profile_url))}">
          <img src="${esc(d.qr_url)}" alt="QR Code" width="64" height="64"
            style="width:64px;height:64px;display:block;" />
        </a>
      </div>` : '';

  const contacts: string[] = [];
  if (on(d.show_phone) && d.phone)     contacts.push(`<div style="font-size:12px;color:${rightText};margin-bottom:4px;"><a href="tel:${esc(d.phone)}" style="color:${rightText};text-decoration:none;">📞 ${esc(d.phone)}</a></div>`);
  if (on(d.show_email) && d.email)     contacts.push(`<div style="font-size:12px;color:${rightText};margin-bottom:4px;"><a href="mailto:${esc(d.email)}" style="color:${rightText};text-decoration:none;">✉ ${esc(d.email)}</a></div>`);
  if (on(d.show_website) && d.website) contacts.push(`<div style="font-size:12px;color:${rightText};margin-bottom:4px;"><a href="${esc(safeUrl(d.website))}" style="color:${accent};text-decoration:none;">🌐 ${esc(d.website)}</a></div>`);

  const socialHtml = on(d.show_social) && social.length
    ? `<div style="margin-top:8px;">${socialButtonsHtml(social, accent)}</div>` : '';

  const logoHtml = on(d.show_logo) && d.logo_url
    ? `<img src="${esc(d.logo_url)}" alt="Logo" height="28" style="height:28px;max-width:100px;display:block;margin-bottom:8px;" />` : '';

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;">
  <tr>
    <td style="background-color:${leftBg};padding:18px 16px;vertical-align:top;width:160px;">
      ${photoHtml}
      ${on(d.show_name) && d.name ? `<div style="font-size:15px;font-weight:700;color:${leftText};margin-bottom:3px;">${esc(d.name)}</div>` : ''}
      ${on(d.show_job_title) && d.job_title ? `<div style="font-size:11px;color:rgba(255,255,255,0.85);margin-bottom:2px;">${esc(d.job_title)}</div>` : ''}
      ${on(d.show_company) && d.company ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);">${esc(d.company)}</div>` : ''}
      ${qrHtml}
    </td>
    <td style="background-color:${rightBg};padding:18px 16px;vertical-align:top;">
      ${logoHtml}
      ${contacts.join('')}
      ${socialHtml}
    </td>
  </tr>
</table>`;
}

// ── Plain text renderer ────────────────────────────────────────────────────────

export function renderSignaturePlainText(data: SignatureData): string {
  const lines: string[] = [];
  if (on(data.show_name) && data.name)           lines.push(data.name);
  if (on(data.show_job_title) && data.job_title) lines.push(data.job_title);
  if (on(data.show_company) && data.company)     lines.push(data.company);
  lines.push('');
  if (on(data.show_phone) && data.phone)         lines.push(`Phone: ${data.phone}`);
  if (on(data.show_email) && data.email)         lines.push(`Email: ${data.email}`);
  if (on(data.show_website) && data.website)     lines.push(`Web: ${data.website}`);
  if (on(data.show_qr) && data.profile_url)      lines.push(`Profile: ${data.profile_url}`);
  const social = (data.social_links ?? []).filter(s => safeUrl(s.url));
  if (on(data.show_social) && social.length) {
    lines.push('');
    for (const s of social) {
      const label = SOCIAL_LABELS[s.platform.toLowerCase()] ?? s.platform;
      lines.push(`${label}: ${s.url}`);
    }
  }
  return lines.join('\n');
}
