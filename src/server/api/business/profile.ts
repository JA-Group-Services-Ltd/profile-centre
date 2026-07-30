/**
 * Business Profile CRUD
 * GET  /api/business/:profileId          — owner OR authorised seat member (any role)
 * PUT  /api/business/:profileId          — owner OR seat member with canEditProfile permission
 */
import { type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { getActiveSeatWorkspaces, getRolePermissions } from '../../lib/entitlement.js';

// ─── Access helpers ────────────────────────────────────────────────────────

function ownsBusinessProfile(userId: number, profileId: string): boolean {
  const p = db.prepare(
    "SELECT id FROM profiles WHERE id = ? AND user_id = ? AND profile_type = 'business'"
  ).get(profileId, userId);
  return !!p;
}

/**
 * Returns the seat role for this user on this profile, or null if not a seat member.
 * Only returns a role if the business owner still has an active Business plan.
 */
function getSeatRole(userId: number, profileId: string): string | null {
  const workspaces = getActiveSeatWorkspaces(userId);
  const ws = workspaces.find(w => String(w.profileId) === profileId);
  return ws?.role ?? null;
}

function parseJsonCols(profile: Record<string, unknown>) {
  const parseArr = (v: unknown) => {
    if (!v) return [];
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
    return Array.isArray(v) ? v : [];
  };
  const parseObj = (v: unknown) => {
    if (!v) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return typeof v === 'object' ? v : null;
  };
  return {
    ...profile,
    services:        parseArr(profile.services),
    team_members:    parseArr(profile.team_members),
    announcements:   parseArr(profile.announcements),
    social_links:    parseArr(profile.social_links),
    gallery:         parseArr(profile.gallery),
    awards:          parseArr(profile.awards),
    faqs:            parseArr(profile.faqs),
    certifications:  parseArr(profile.certifications),
    testimonials:    parseArr(profile.testimonials),
    cta_buttons:     parseArr(profile.cta_buttons),
    payment_methods: parseArr(profile.payment_methods),
    featured_offer:  parseObj(profile.featured_offer),
    // Feature section JSON fields — must be parsed so dashboard gets arrays, not strings
    menu_items:      parseArr(profile.menu_items),
    pdf_attachments: parseArr(profile.pdf_attachments),
  };
}

/**
 * Safe column list for business profile dashboard responses.
 * Excludes: public_pin_hash, is_suspended (admin-only moderation flag).
 */
const BIZ_PROFILE_COLS = `
  id, user_id, profile_type, username, biz_slug, person_slug,
  display_name, bio, bio_html, job_title, company, phone, email, website, address,
  show_phone, show_email, show_website, show_address, show_bio,
  avatar_url, cover_url, cover_image, profile_photo, logo_url,
  theme_id, layout_preset, colour_palette, custom_colour, button_style,
  is_published, public_pin_enabled, messaging_enabled, enquiry_enabled,
  whatsapp_url, whatsapp_label, whatsapp_enabled,
  gallery, gallery_enabled,
  menu_items, menu_enabled, menu_title,
  pdf_attachments, pdf_enabled,
  social_links, social_links_enabled,
  business_name, business_tagline, business_description, business_description_html,
  business_category, business_type, business_email, business_phone, business_website,
  business_address, opening_hours, booking_link, map_embed,
  services, team_members, announcements, faqs, testimonials,
  cta_buttons, payment_methods, featured_offer, awards, certifications,
  team_directory_public, allow_indexing, seo_title, seo_description,
  is_verified, verified_at,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();



export async function getBusinessProfile(req: AuthRequest, res: Response) {
  const profileId = String(req.params.profileId);
  const userId = req.user!.id;

  const isOwner = ownsBusinessProfile(userId, profileId);
  const seatRole = isOwner ? null : getSeatRole(userId, profileId);

  // Allow owner OR any active seat member (all roles can view)
  if (!isOwner && !seatRole) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const profile = db.prepare(`SELECT ${BIZ_PROFILE_COLS} FROM profiles WHERE id = ?`).get(profileId) as Record<string, unknown> | undefined;
  if (!profile) return res.status(404).json({ success: false, error: 'Not found' });

  return res.json({ success: true, data: parseJsonCols(profile) });
}

// ─── PUT /api/business/:profileId ─────────────────────────────────────────

export async function updateBusinessProfile(req: AuthRequest, res: Response) {
  try {
  const profileId = String(req.params.profileId);
  const userId = req.user!.id;
  console.log(`[updateBusinessProfile] profileId=${profileId} userId=${userId} bodyKeys=${Object.keys(req.body || {}).join(',')}`);

  const isOwner = ownsBusinessProfile(userId, profileId);
  const seatRole = isOwner ? null : getSeatRole(userId, profileId);

  if (!isOwner && !seatRole) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  // Seat users must have canEditProfile permission
  if (!isOwner && seatRole) {
    const perms = getRolePermissions(seatRole);
    if (!perms.canEditProfile) {
      return res.status(403).json({
        success: false,
        error: `Your role (${seatRole}) does not have permission to edit this business profile.`,
      });
    }
  }

  const SCALAR_FIELDS = [
    'business_name', 'business_description', 'business_description_html', 'business_tagline', 'business_category',
    'business_email', 'business_phone', 'business_website', 'business_address',
    'opening_hours', 'logo_url', 'cover_url', 'profile_photo',
    'display_name', 'is_published',
    // SEO fields
    'allow_indexing', 'seo_title', 'seo_description',
    // Business Type & Design fields
    'business_type', 'layout_preset', 'colour_palette', 'custom_colour', 'button_style',
    // Extended scalar fields
    'booking_link', 'map_embed',
    // Feature toggles & scalars
    'whatsapp_url', 'whatsapp_label', 'whatsapp_enabled',
    'menu_enabled', 'menu_title',
    'pdf_enabled',
    'social_links_enabled', 'gallery_enabled',
    'team_directory_public',
  ];
  const JSON_FIELDS = [
    'services', 'team_members', 'announcements', 'social_links',
    // Extended JSON section fields
    'gallery', 'awards', 'faqs', 'certifications',
    'testimonials', 'cta_buttons', 'payment_methods', 'featured_offer',
    // Feature JSON fields
    'menu_items', 'pdf_attachments',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const f of SCALAR_FIELDS) {
    if (req.body[f] !== undefined) {
      // map_embed: only accept a bare Google Maps embed URL (not raw HTML)
      // The public profile page renders this as <iframe src={map_embed}> so we
      // must ensure it can never be a javascript: URI or arbitrary HTML.
      if (f === 'map_embed') {
        const raw = String(req.body[f] ?? '').trim();
        if (raw && !raw.startsWith('https://www.google.com/maps/embed')) {
          return res.status(400).json({
            success: false,
            error: 'map_embed must be a Google Maps embed URL (https://www.google.com/maps/embed...)',
          });
        }
        updates.push(`${f} = ?`);
        values.push(raw || null);
        continue;
      }
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  for (const f of JSON_FIELDS) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(JSON.stringify(req.body[f]));
    }
  }

  if (updates.length === 0) {
    console.log(`[updateBusinessProfile] 400 — no fields to update. bodyKeys=${Object.keys(req.body || {}).join(',')}`);
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  console.log(`[updateBusinessProfile] profileId=${profileId} updating: ${updates.join(', ')}`);
  db.prepare(`UPDATE profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, profileId);

  const updated = db.prepare(`SELECT ${BIZ_PROFILE_COLS} FROM profiles WHERE id = ?`).get(profileId) as Record<string, unknown>;
  console.log(`[updateBusinessProfile] success profileId=${profileId}`);
  return res.json({ success: true, data: parseJsonCols(updated) });
  } catch (err) {
    console.error(`[updateBusinessProfile] error:`, err);
    return (res as Response).status(500).json({ success: false, error: 'Failed to update business profile' });
  }
}
