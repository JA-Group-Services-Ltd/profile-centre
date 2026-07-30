/**
 * Email Signature Generator — API
 * GET    /api/signatures/me          — get current user's signature
 * POST   /api/signatures/me          — create / upsert signature
 * PUT    /api/signatures/me          — update signature
 * DELETE /api/signatures/me          — delete signature
 * POST   /api/signatures/me/audit    — log copy/download events
 */
import { type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { writeAudit } from '../../lib/audit.js';
import { getEffectiveUserAccess } from '../../lib/entitlement.js';

// ── Ensure table exists ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS email_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL DEFAULT 'corp-h-light',
    name TEXT,
    job_title TEXT,
    company TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    profile_url TEXT,
    photo_url TEXT,
    logo_url TEXT,
    social_links TEXT DEFAULT '[]',
    show_name INTEGER DEFAULT 1,
    show_job_title INTEGER DEFAULT 1,
    show_company INTEGER DEFAULT 1,
    show_phone INTEGER DEFAULT 1,
    show_email INTEGER DEFAULT 1,
    show_website INTEGER DEFAULT 1,
    show_qr INTEGER DEFAULT 1,
    show_social INTEGER DEFAULT 1,
    show_photo INTEGER DEFAULT 1,
    show_logo INTEGER DEFAULT 0,
    accent_color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { db.exec('CREATE INDEX IF NOT EXISTS idx_email_signatures_user ON email_signatures (user_id)'); } catch { /* exists */ }
// Ensure UNIQUE constraint exists on user_id — handles tables created before the constraint was added
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_email_signatures_user_unique ON email_signatures (user_id)');
} catch { /* already exists or table has it */ }

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Only allow http/https/mailto/tel
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  // Prepend https if looks like a domain
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return '';
}

function sanitizeText(val: unknown): string {
  if (typeof val !== 'string') return '';
  // Strip any HTML tags
  return val.replace(/<[^>]*>/g, '').slice(0, 500);
}

function parseSocialLinks(raw: unknown): Array<{ platform: string; url: string; label?: string }> {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is { platform: string; url: string } =>
        s && typeof s.platform === 'string' && typeof s.url === 'string'
      )
      .map(s => ({ platform: s.platform.slice(0, 50), url: sanitizeUrl(s.url), label: (s as { label?: string }).label }))
      .filter(s => s.url);
  } catch {
    return [];
  }
}

const ALLOWED_TEMPLATE_IDS = new Set([
  // ── New template IDs (current system) ──
  // Corporate
  'corp-h-light','corp-h-dark','corp-v-light','corp-c-light','corp-card-light','corp-split-dark','corp-b-light','corp-b-dark',
  // Modern
  'mod-h-light','mod-h-dark','mod-v-light','mod-card-light','mod-split-light','mod-c-dark','mod-b-gradient',
  // Minimal
  'min-h-light','min-h-dark','min-v-light','min-c-light','min-card-light',
  // Creative
  'cre-h-light','cre-h-dark','cre-v-gradient','cre-card-light','cre-split-dark','cre-b-gradient',
  // Luxury
  'lux-h-light','lux-h-dark','lux-v-light','lux-card-light','lux-split-dark','lux-b-light',
  // Tech
  'tec-h-light','tec-h-dark','tec-v-light','tec-card-light','tec-split-dark','tec-b-gradient',
  // Healthcare
  'hea-h-light','hea-h-dark','hea-v-light','hea-card-light','hea-c-light',
  // Legal
  'leg-h-light','leg-h-dark','leg-v-light','leg-card-light','leg-c-light',
  // Real Estate
  'rea-h-light','rea-h-dark','rea-v-light','rea-card-light','rea-split-dark',
  // Education
  'edu-h-light','edu-h-dark','edu-v-light','edu-card-light','edu-c-light',
  // Small Biz
  'sml-h-light','sml-h-dark','sml-v-light','sml-card-light',
  // Freelancer
  'fre-h-light','fre-h-dark','fre-v-gradient','fre-card-light',
  // Consultant
  'con-h-light','con-h-dark','con-v-light','con-card-light',
  // Sales
  'sal-h-light','sal-h-dark','sal-v-light','sal-card-light',
  // Executive
  'exe-h-light','exe-h-dark','exe-v-light','exe-card-light',
  // Personal
  'per-h-light','per-h-dark','per-v-gradient','per-card-light','per-split-dark','per-c-light',
  // ── Legacy IDs (kept for backwards compatibility with existing DB rows) ──
  'corporate-01','corporate-02','corporate-03','corporate-04','corporate-05','corporate-06',
  'modern-01','modern-02','modern-03','modern-04','modern-05','modern-06',
  'minimal-01','minimal-02','minimal-03','minimal-04','minimal-05','minimal-06',
  'creative-01','creative-02','creative-03','creative-04','creative-05','creative-06',
  'luxury-01','luxury-02','luxury-03','luxury-04','luxury-05','luxury-06',
  'tech-01','tech-02','tech-03','tech-04','tech-05','tech-06',
  'healthcare-01','healthcare-02','healthcare-03','healthcare-04','healthcare-05','healthcare-06',
  'legal-01','legal-02','legal-03','legal-04','legal-05','legal-06',
  'realestate-01','realestate-02','realestate-03','realestate-04','realestate-05','realestate-06',
  'education-01','education-02','education-03','education-04','education-05','education-06',
  'smallbiz-01','smallbiz-02','smallbiz-03','smallbiz-04',
  'freelancer-01','freelancer-02','freelancer-03','freelancer-04',
  'consultant-01','consultant-02','consultant-03','consultant-04',
  'sales-01','sales-02','sales-03','sales-04',
  'executive-01','executive-02','executive-03','executive-04',
  'personal-01','personal-02','personal-03','personal-04',
]);

// ── Ensure signature_by column exists (idempotent) ───────────────────────────
try { db.exec('ALTER TABLE email_signatures ADD COLUMN signature_by TEXT'); } catch { /* already exists */ }

// ── Feature access guard ──────────────────────────────────────────────────────
// Email Signature is available to all Starter+ and Lifetime plan users.
// Uses the central entitlement helper — single source of truth.
function checkEmailSignatureAccess(userId: number): { allowed: boolean; reason: string } {
  // Global flag — admin can disable entirely
  const flagRow = db.prepare("SELECT value FROM admin_settings WHERE key = 'feature_email_signature'")
    .get() as { value: string } | undefined;
  const globalEnabled = (flagRow?.value ?? '1') === '1';
  if (!globalEnabled) {
    return { allowed: false, reason: 'Email Signature is not currently available.' };
  }
  const access = getEffectiveUserAccess(userId);
  if (access.hasEmailSignature) return { allowed: true, reason: '' };
  return { allowed: false, reason: 'Email Signature is available on Starter, Professional, Organisation, and Lifetime plans. Upgrade to access this feature.' };
}

// GET /api/signatures/me
export async function getMySignature(req: AuthRequest, res: Response) {
  try {
    const access = checkEmailSignatureAccess(req.user!.id);
    if (!access.allowed) return res.status(403).json({ success: false, error: access.reason });

    const row = await db.prepare('SELECT * FROM email_signatures WHERE user_id = ?').get(req.user!.id) as Record<string, unknown> | undefined;
    if (!row) return res.json({ success: true, data: null });
    return res.json({
      success: true,
      data: { ...row, social_links: parseSocialLinks(row.social_links) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch signature' });
  }
}

// POST /api/signatures/me  (create or upsert)
export async function upsertSignature(req: AuthRequest, res: Response) {
  try {
    const access = checkEmailSignatureAccess(req.user!.id);
    if (!access.allowed) return res.status(403).json({ success: false, error: access.reason });

    const body = req.body as Record<string, unknown>;
    const templateId = typeof body.template_id === 'string' && ALLOWED_TEMPLATE_IDS.has(body.template_id)
      ? body.template_id : 'corp-h-light';

    const socialLinks = parseSocialLinks(body.social_links);
    const accentColor = typeof body.accent_color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(body.accent_color)
      ? body.accent_color : '#3B82F6';

    const existing = await db.prepare('SELECT id FROM email_signatures WHERE user_id = ?').get(req.user!.id);
    const isNew = !existing;

    const signatureBy = typeof body.signature_by === 'string' ? body.signature_by.trim().slice(0, 120) : null;

    await db.prepare(`
      INSERT INTO email_signatures
        (user_id, template_id, name, job_title, company, phone, email, website, profile_url,
         photo_url, logo_url, social_links,
         show_name, show_job_title, show_company, show_phone, show_email, show_website,
         show_qr, show_social, show_photo, show_logo, accent_color, signature_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        template_id = excluded.template_id,
        name = excluded.name,
        job_title = excluded.job_title,
        company = excluded.company,
        phone = excluded.phone,
        email = excluded.email,
        website = excluded.website,
        profile_url = excluded.profile_url,
        photo_url = excluded.photo_url,
        logo_url = excluded.logo_url,
        social_links = excluded.social_links,
        show_name = excluded.show_name,
        show_job_title = excluded.show_job_title,
        show_company = excluded.show_company,
        show_phone = excluded.show_phone,
        show_email = excluded.show_email,
        show_website = excluded.show_website,
        show_qr = excluded.show_qr,
        show_social = excluded.show_social,
        show_photo = excluded.show_photo,
        show_logo = excluded.show_logo,
        accent_color = excluded.accent_color,
        signature_by = excluded.signature_by,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user!.id,
      templateId,
      sanitizeText(body.name),
      sanitizeText(body.job_title),
      sanitizeText(body.company),
      sanitizeText(body.phone),
      sanitizeText(body.email),
      sanitizeUrl(body.website as string),
      sanitizeUrl(body.profile_url as string),
      sanitizeUrl(body.photo_url as string),
      sanitizeUrl(body.logo_url as string),
      JSON.stringify(socialLinks),
      body.show_name ? 1 : 0,
      body.show_job_title ? 1 : 0,
      body.show_company ? 1 : 0,
      body.show_phone ? 1 : 0,
      body.show_email ? 1 : 0,
      body.show_website ? 1 : 0,
      body.show_qr ? 1 : 0,
      body.show_social ? 1 : 0,
      body.show_photo ? 1 : 0,
      body.show_logo ? 1 : 0,
      accentColor,
      signatureBy || null,
    );

    await writeAudit({
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorType: 'user',
      action: isNew ? 'signature.create' : 'signature.update',
      resourceType: 'email_signature',
      resourceLabel: sanitizeText(body.name) || req.user!.name,
    });

    const row = await db.prepare('SELECT * FROM email_signatures WHERE user_id = ?').get(req.user!.id) as Record<string, unknown>;
    res.json({ success: true, data: { ...row, social_links: parseSocialLinks(row.social_links) } });
  } catch (err) {
    console.error('[signatures] upsert error:', err);
    res.status(500).json({ success: false, error: 'Failed to save signature' });
  }
}

// DELETE /api/signatures/me
export async function deleteSignature(req: AuthRequest, res: Response) {
  try {
    const access = checkEmailSignatureAccess(req.user!.id);
    if (!access.allowed) return res.status(403).json({ success: false, error: access.reason });

    await db.prepare('DELETE FROM email_signatures WHERE user_id = ?').run(req.user!.id);
    await writeAudit({
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorType: 'user',
      action: 'signature.delete',
      resourceType: 'email_signature',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete signature' });
  }
}

// POST /api/signatures/me/audit  — log copy/download events
export async function logSignatureEvent(req: AuthRequest, res: Response) {
  try {
    const access = checkEmailSignatureAccess(req.user!.id);
    if (!access.allowed) return res.status(403).json({ success: false, error: access.reason });

    const { event } = req.body as { event: string };
    const allowed = ['signature.copy_html', 'signature.download_html', 'signature.copy_text', 'signature.change_template'];
    if (!allowed.includes(event)) return res.status(400).json({ success: false, error: 'Invalid event' });
    await writeAudit({
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorType: 'user',
      action: event,
      resourceType: 'email_signature',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to log event' });
  }
}
