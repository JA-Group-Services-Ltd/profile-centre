import { type Request, type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { writeAudit } from '../../lib/audit.js';
import { getEffectiveUserAccess } from '../../lib/entitlement.js';

// ─── helpers ──────────────────────────────────────────────────────────────

/** Slugify a string for use in URLs */
export function slugify(str: string): string {
  return str.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Section visibility map — mirrors TYPE_CONFIG in dashboard/profile.tsx ────
// Only fields listed as `true` for a given personal_type are returned publicly.
// This ensures visitors only see what the profile type is designed to show.
type SectionKey =
  | 'headline' | 'pronouns' | 'location' | 'availability' | 'portfolioUrl'
  | 'skills' | 'languages' | 'awards' | 'certifications' | 'experience' | 'education'
  | 'socialChannels' | 'contentNiche' | 'collabRate' | 'contentFormats' | 'platforms'
  | 'speakingTopics' | 'coachingAreas' | 'volunteerCauses' | 'ministryRole'
  | 'publications' | 'gpa' | 'graduationYear' | 'internships' | 'clubs';

type SectionMap = Record<SectionKey, boolean>;

const TYPE_SECTIONS: Record<string, SectionMap> = {
  professional:    { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: false, skills: true,  languages: true,  awards: true,  certifications: true,  experience: true,  education: true,  socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  content_creator: { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: true,  skills: true,  languages: false, awards: true,  certifications: false, experience: false, education: false, socialChannels: true,  contentNiche: true,  collabRate: true,  contentFormats: true,  platforms: true,  speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  freelancer:      { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: true,  skills: true,  languages: true,  awards: true,  certifications: true,  experience: true,  education: false, socialChannels: false, contentNiche: false, collabRate: true,  contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  speaker:         { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: true,  skills: true,  languages: true,  awards: true,  certifications: true,  experience: true,  education: true,  socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: true,  coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: true,  gpa: false, graduationYear: false, internships: false, clubs: false },
  coach:           { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: false, skills: true,  languages: true,  awards: true,  certifications: true,  experience: true,  education: true,  socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: true,  volunteerCauses: false, ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  volunteer:       { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: false, skills: true,  languages: true,  awards: true,  certifications: false, experience: true,  education: false, socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: true,  ministryRole: false, publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  faith_leader:    { headline: true,  pronouns: true,  location: true,  availability: false, portfolioUrl: false, skills: false, languages: true,  awards: false, certifications: false, experience: true,  education: true,  socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: true,  publications: false, gpa: false, graduationYear: false, internships: false, clubs: false },
  consultant:      { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: true,  skills: true,  languages: true,  awards: true,  certifications: true,  experience: true,  education: true,  socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: true,  coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: true,  gpa: false, graduationYear: false, internships: false, clubs: false },
  student:         { headline: true,  pronouns: true,  location: true,  availability: true,  portfolioUrl: true,  skills: true,  languages: true,  awards: true,  certifications: true,  experience: false, education: true,  socialChannels: false, contentNiche: false, collabRate: false, contentFormats: false, platforms: false, speakingTopics: false, coachingAreas: false, volunteerCauses: false, ministryRole: false, publications: false, gpa: true,  graduationYear: true,  internships: true,  clubs: true  },
};

/** Returns the section visibility map for a given personal_type, defaulting to professional. */
function getSections(personalType: string): SectionMap {
  return TYPE_SECTIONS[personalType] ?? TYPE_SECTIONS['professional'];
}

/**
 * Safe column list for dashboard (authenticated owner) profile responses.
 * Never includes: public_pin_hash, is_suspended (admin-only), or any future
 * sensitive internal columns. Extend here when adding new profile columns.
 */
const DASHBOARD_PROFILE_COLS = `
  id, user_id, profile_type, username, biz_slug, person_slug,
  display_name, bio, bio_html, job_title, company, phone, email, website, address,
  show_phone, show_email, show_website, show_address, show_bio,
  avatar_url, cover_url, cover_image, profile_photo, logo_url,
  theme_id, layout_preset, colour_palette, custom_colour,
  button_style, photo_shape, personal_type,
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
  social_channels, content_niche, collab_rate, content_formats, platforms,
  speaking_topics, coaching_areas, volunteer_causes, ministry_role, publications,
  headline, pronouns, location_city, availability, portfolio_url,
  gpa, graduation_year, internships, clubs,
  team_directory_public, allow_indexing, seo_title, seo_description,
  is_verified, verified_at,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** Parse a JSON column safely; returns [] on failure. */
function parseJsonArray(raw: unknown): unknown[] {
  if (!raw) return [];
  try { return JSON.parse(raw as string) as unknown[]; } catch { return []; }
}

/** Return value only if the section is enabled AND the value is non-empty. */
function gated(sections: SectionMap, key: SectionKey, value: unknown): unknown {
  if (!sections[key]) return undefined; // section not shown for this type
  if (Array.isArray(value)) return value.length > 0 ? value : undefined;
  if (value === null || value === undefined || value === '') return undefined;
  return value;
}

/**
 * Build the public URL for a profile under the /profile/* scheme.
 *
 * Personal:      /profile/<username>
 * Business page: /profile/<biz_slug>
 */
export function profileUrl(profile: { profile_type: string; username?: string; biz_slug?: string }): string {
  if (profile.profile_type === 'business') {
    return `/profile/${profile.biz_slug}`;
  }
  return `/profile/${profile.username}`;
}

// GET /api/profiles/me
export async function getMyProfiles(req: AuthRequest, res: Response) {
  try {
    const profiles = await db.prepare(`
      SELECT ${DASHBOARD_PROFILE_COLS}
      FROM profiles
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(req.user!.id);
    console.log(`[getMyProfiles] userId=${req.user!.id} found=${(profiles as unknown[]).length} types=${(profiles as any[]).map((p: any) => `${p.id}:${p.profile_type}:${p.username}`).join(', ')}`);
    res.json({ success: true, data: profiles });
  } catch (err) {
    console.error('[getMyProfiles] error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
  }
}

// POST /api/profiles
export async function createProfile(req: AuthRequest, res: Response) {
  try {
    const { username, display_name, profile_type } = req.body;

    // ── Business profile creation ──────────────────────────────────────────
    // Business profiles are standalone pages (no linked person card).
    // The user's personal profile is managed separately under "My Profile".
    if (profile_type === 'business') {
      const {
        business_name, business_description, business_category,
        services, team_members, opening_hours, logo_url, cover_url,
        biz_slug: rawBizSlug,
      } = req.body;

      if (!business_name) {
        return res.status(400).json({ success: false, error: 'Business name is required' });
      }

      // Use the provided biz_slug if given, otherwise derive from business_name
      const bizSlug = rawBizSlug ? slugify(rawBizSlug) : slugify(business_name);

      if (!bizSlug) {
        return res.status(400).json({ success: false, error: 'Could not generate a valid URL slug from the business name' });
      }

      // Check plan limits — use max_org_profiles (explicit org slot limit per plan)
      const plan = await db.prepare('SELECT * FROM plans WHERE id = ?').get(req.user!.plan_id) as { max_profiles: number; max_org_profiles?: number; slug: string } | undefined;
      const bizCountRow = await db.prepare("SELECT COUNT(*) as c FROM profiles WHERE user_id = ? AND profile_type = 'business'").get(req.user!.id) as { c: number } | undefined;
      const bizCount = bizCountRow?.c ?? 0;
      // max_org_profiles is the canonical limit; fall back to (max_profiles - 1) for legacy rows
      const bizSlotLimit = plan
        ? (typeof (plan as any).max_org_profiles === 'number' && (plan as any).max_org_profiles > 0
            ? (plan as any).max_org_profiles
            : Math.max(0, plan.max_profiles - 1))
        : 0;
      if (bizSlotLimit === 0) {
        return res.status(403).json({ success: false, error: 'Your plan does not include an Organisation Profile. Upgrade to Professional or above.' });
      }
      if (bizCount >= bizSlotLimit) {
        // Frontend may be stale — return the existing business profile instead of a hard error
        const existingBiz = await db.prepare(
          "SELECT id FROM profiles WHERE user_id = ? AND profile_type = 'business' ORDER BY created_at ASC LIMIT 1"
        ).get(req.user!.id) as { id: number } | undefined;
        if (existingBiz) {
          const existingData = await db.prepare(`SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE id = ?`).get(existingBiz.id);
          return res.status(200).json({ success: true, data: existingData, already_exists: true });
        }
        return res.status(403).json({ success: false, error: `Your plan allows a maximum of ${bizSlotLimit} organisation profile(s). Upgrade to create more.` });
      }

      // Ensure the biz_slug is unique
      const existingSlug = await db.prepare('SELECT id FROM profiles WHERE biz_slug = ? AND profile_type = ?').get(bizSlug, 'business');
      if (existingSlug) return res.status(409).json({ success: false, error: 'A business profile with this URL already exists. Please choose a different slug.' });

      // Internal username = biz_slug (unique per business page)
      const internalUsername = `biz--${bizSlug}`;
      const existingUsername = await db.prepare('SELECT id FROM profiles WHERE username = ?').get(internalUsername);
      if (existingUsername) return res.status(409).json({ success: false, error: 'A business profile with this URL already exists.' });

      const result = await db.prepare(`
        INSERT INTO profiles (user_id, username, display_name, profile_type, url_prefix, biz_slug,
          business_name, business_description, business_category, services, team_members, opening_hours, logo_url, cover_url)
        VALUES (?, ?, ?, 'business', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user!.id, internalUsername, business_name, bizSlug,
        bizSlug, business_name,
        business_description || '', business_category || '',
        services ? JSON.stringify(services) : null,
        team_members ? JSON.stringify(team_members) : null,
        opening_hours || null, logo_url || null, cover_url || null,
      );

      const profile = await db.prepare(`SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE id = ?`).get(result.lastInsertRowid);
      return res.status(201).json({
        success: true,
        data: profile,
        business_url: `/profile/${bizSlug}`,
        team_url: `/profile/${bizSlug}/team`,
      });
    }

    // ── Personal profile creation (Free / Starter / Professional) ─────────
    if (!username) return res.status(400).json({ success: false, error: 'Username is required' });
    if (!/^[a-z0-9-]{3,30}$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username must be 3-30 characters, lowercase letters, numbers, and hyphens only' });
    }

    // Enforce one personal profile per user — no duplicates regardless of plan
    const existingPersonal = await db.prepare(
      "SELECT id FROM profiles WHERE user_id = ? AND (profile_type = 'personal' OR profile_type IS NULL)"
    ).get(req.user!.id) as { id: number } | undefined;
    if (existingPersonal) {
      // Return the existing profile so the frontend can switch to edit mode
      const existing = await db.prepare(`SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE id = ?`).get(existingPersonal.id);
      return res.status(200).json({ success: true, data: existing, already_exists: true });
    }

    // JA Group Services staff accounts are limited to 1 personal profile (already enforced above)
    // Plan-based limits are also satisfied since we only allow 1 personal profile total.

    const existing = await db.prepare('SELECT id FROM profiles WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ success: false, error: 'This username is already taken' });

    const result = await db.prepare(
      "INSERT INTO profiles (user_id, username, display_name, profile_type, url_prefix) VALUES (?, ?, ?, 'personal', 'profile')"
    ).run(req.user!.id, username, display_name || '');

    const profile = await db.prepare(`SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: profile, url: `/profile/${username}` });
  } catch (err) {
    console.error('[createProfile] error:', err);
    // Surface SQLite constraint errors clearly
    const msg = String(err);
    if (msg.includes('UNIQUE constraint failed: profiles.username')) {
      return res.status(409).json({ success: false, error: 'This username is already taken. Please choose a different one.' });
    }
    if (msg.includes('NOT NULL constraint failed')) {
      return res.status(400).json({ success: false, error: 'A required field is missing. Please check your username and try again.' });
    }
    res.status(500).json({ success: false, error: 'Failed to create profile. Please try again.' });
  }
}

// PUT /api/profiles/:id
export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    console.log(`[updateProfile] id=${id} userId=${req.user?.id} bodyKeys=${Object.keys(req.body || {}).join(',')}`);
    const profile = await db.prepare(`SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE id = ? AND user_id = ?`).get(id, req.user!.id);
    if (!profile) {
      console.log(`[updateProfile] 404 — profile id=${id} not found for user=${req.user?.id}`);
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const fields = ['display_name', 'job_title', 'company', 'bio', 'bio_html', 'phone', 'email', 'website', 'address',
      'profile_photo', 'is_published', 'show_phone', 'show_email', 'show_website', 'show_address', 'show_bio', 'theme_id',
      // SEO fields
      'allow_indexing', 'seo_title', 'seo_description',
      // Profile Type & Design fields
      'personal_type', 'layout_preset', 'colour_palette', 'custom_colour', 'button_style', 'photo_shape',
      // Extended personal profile fields
      'headline', 'skills', 'languages', 'education', 'experience',
      'portfolio_url', 'availability', 'pronouns', 'location_city', 'cover_image',
      // Extended JSON sections (personal)
      'awards', 'certifications',
      // Type-specific extended fields
      'social_channels', 'content_niche', 'speaking_topics', 'coaching_areas',
      'volunteer_causes', 'ministry_role', 'publications',
      // Creator extras
      'collab_rate', 'content_formats', 'platforms',
      // Student extras
      'gpa', 'graduation_year', 'internships', 'clubs',
      // ── New feature sections (personal + business profiles) ──────────────
      'whatsapp_url', 'whatsapp_label', 'whatsapp_enabled',
      'gallery', 'gallery_enabled',
      'menu_items', 'menu_enabled', 'menu_title',
      'pdf_attachments', 'pdf_enabled',
      'social_links', 'social_links_enabled',
      // Business address (personal profiles can also have a business address)
      'business_address',
      // Business profile fields (also updated via this endpoint for business profiles)
      'business_name', 'business_tagline', 'business_description', 'business_description_html',
      'business_category', 'business_type', 'business_email', 'business_phone', 'business_website',
      'logo_url', 'cover_url', 'cover_image', 'opening_hours', 'is_published',
      'team_directory_public', 'services', 'team_members', 'announcements',
      'faqs', 'testimonials', 'cta_buttons', 'payment_methods', 'featured_offer',
      'booking_link', 'map_embed', 'biz_slug', 'person_slug',
    ];
    
    // Handle username — only validate/check uniqueness when it is actually changing.
    // The frontend always sends username in the payload (via ...form spread), so we
    // must not treat a re-sent unchanged value as a change attempt.
    if (req.body.username !== undefined && req.body.username !== '') {
      const incomingUsername = String(req.body.username).trim();
      const currentUsername  = (profile as any).username ?? '';

      if (incomingUsername !== currentUsername) {
        // User is genuinely trying to change their username — validate and check uniqueness
        if (!/^[a-z0-9-]{3,30}$/.test(incomingUsername)) {
          return res.status(400).json({ success: false, error: 'Invalid username format (3–30 lowercase letters, numbers or hyphens)' });
        }
        const existing = await db.prepare('SELECT id FROM profiles WHERE username = ? AND id != ?').get(incomingUsername, id);
        if (existing) return res.status(409).json({ success: false, error: 'Username already taken' });
        req.body.username = incomingUsername;
        fields.push('username');
      }
      // If unchanged, silently drop it — no update needed, no error
    }

    // map_embed: validate before writing — must be a Google Maps embed URL or empty.
    // The public profile renders this as <iframe src={map_embed}> so a javascript: URI
    // or arbitrary HTML here would be a stored XSS vector.
    if (req.body.map_embed !== undefined) {
      const raw = String(req.body.map_embed ?? '').trim();
      if (raw && !raw.startsWith('https://www.google.com/maps/embed')) {
        return res.status(400).json({
          success: false,
          error: 'map_embed must be a Google Maps embed URL (https://www.google.com/maps/embed...)',
        });
      }
      // Normalise: store null for empty string
      req.body.map_embed = raw || null;
    }

    // ── Server-side feature gate enforcement ──────────────────────────────────
    // If the user's plan doesn't include a feature, strip the enable flag and
    // the data field from the update so they can never be turned on server-side.
    // We do NOT return a 403 here — we silently strip the gated fields so the
    // save still succeeds for the allowed fields. The UI should already hide
    // the controls, but this is the authoritative server-side enforcement.
    const access = getEffectiveUserAccess(req.user!.id);

    // Gallery
    if (!access.hasGallery) {
      delete req.body.gallery;
      delete req.body.gallery_enabled;
      req.body.gallery_enabled = 0;
    }
    // PDF attachments
    if (!access.hasPdf) {
      delete req.body.pdf_attachments;
      delete req.body.pdf_enabled;
      req.body.pdf_enabled = 0;
    }
    // WhatsApp
    if (!access.hasWhatsapp) {
      delete req.body.whatsapp_url;
      delete req.body.whatsapp_label;
      delete req.body.whatsapp_enabled;
      req.body.whatsapp_enabled = 0;
    }
    // Menu / price list
    if (!access.hasMenu) {
      delete req.body.menu_items;
      delete req.body.menu_enabled;
      delete req.body.menu_title;
      req.body.menu_enabled = 0;
    }
    // Contact / enquiry form
    if (!access.hasContactForm) {
      delete req.body.enquiry_enabled;
      req.body.enquiry_enabled = 0;
    }
    // Custom themes — strip theme_id changes (keep existing theme_id)
    if (!access.hasPremiumTemplates) {
      delete req.body.theme_id;
      delete req.body.colour_palette;
      delete req.body.custom_colour;
      delete req.body.button_style;
      delete req.body.layout_preset;
    }
    // Remove branding — strip the flag if not allowed (branding stays on)
    // (branding is controlled by the plan, not a profile field — no action needed here)

    const updates = fields.filter(f => req.body[f] !== undefined);
    if (updates.length === 0) {
      console.log(`[updateProfile] 400 — no fields to update. bodyKeys=${Object.keys(req.body || {}).join(',')}`);
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    console.log(`[updateProfile] updating fields: ${updates.join(', ')}`);
    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => req.body[f]);
    await db.prepare(`UPDATE profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
    const updated = await db.prepare(`SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE id = ?`).get(id);
    writeAudit({
      actorId: req.user!.id, actorName: req.user!.name, actorEmail: req.user!.email,
      actorType: 'user', tenant: 'customer_ciam', authProvider: 'microsoft_entra_external_id',
      action: 'update_profile', resourceType: 'profile', resourceId: String(id),
      resourceLabel: (updated as any)?.username ?? String(id),
      details: `Customer updated profile ${id}: fields [${updates.join(', ')}]`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(`[updateProfile] error:`, err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
}

// DELETE /api/profiles/:id
export async function deleteProfile(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const profile = await db.prepare('SELECT id, username, profile_type FROM profiles WHERE id = ? AND user_id = ?').get(id, req.user!.id);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    await db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    writeAudit({
      actorId: req.user!.id, actorName: req.user!.name, actorEmail: req.user!.email,
      actorType: 'user', tenant: 'customer_ciam', authProvider: 'microsoft_entra_external_id',
      action: 'delete_profile', resourceType: 'profile', resourceId: String(id),
      resourceLabel: (profile as any)?.username ?? String(id),
      details: `Customer deleted profile ${id}`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
}

// GET /api/profiles/:id/preview — owner-only preview (ignores is_published)
// Lets the profile owner view their own profile regardless of published state.
// Returns the same shape as the public endpoint so the same page component renders it.
export async function getProfilePreview(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const profile = await db.prepare(
      `SELECT ${DASHBOARD_PROFILE_COLS}, public_pin_hash FROM profiles WHERE id = ? AND user_id = ? AND profile_type = 'personal'`
    ).get(id, req.user!.id) as Record<string, unknown> | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    return await buildPublicProfileResponse(profile, req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load profile preview' });
  }
}

// GET /api/profiles/:username/public          — new scheme (username only)
// GET /api/profiles/:prefix/:username/public  — legacy plan-prefix scheme
export async function getPublicProfile(req: Request, res: Response) {
  try {
    const { prefix, username } = req.params as { prefix?: string; username?: string };

    const LEGACY_PREFIXES = new Set(['F', 'S', 'P', 'B']);

    // Two-param legacy route: /api/profiles/:prefix/:username/public
    if (prefix && username) {
      if (LEGACY_PREFIXES.has(prefix.toUpperCase()) && prefix.length === 1) {
        // Legacy prefix — look up by username only (prefix no longer stored)
      const profile = await db.prepare(
        `SELECT ${DASHBOARD_PROFILE_COLS}, public_pin_hash FROM profiles WHERE username = ? AND is_published = 1 AND profile_type = 'personal'`
      ).get(username) as Record<string, unknown> | undefined;
        if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
        return await buildPublicProfileResponse(profile, req, res);
      }
      // Not a legacy prefix — treat prefix as bizSlug, username as personSlug
      const profile = await db.prepare(
        `SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE biz_slug = ? AND person_slug = ? AND is_published = 1 AND profile_type = 'business'`
      ).get(prefix, username) as Record<string, unknown> | undefined;
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return await buildBusinessProfileResponse(profile, res);
    }

    // Single-param new scheme: /api/profiles/:username/public
    // prefix holds the username value (Express param name from route)
    const slug = prefix ?? username ?? '';
    const profile = await db.prepare(
      `SELECT ${DASHBOARD_PROFILE_COLS}, public_pin_hash FROM profiles WHERE username = ? AND is_published = 1 AND profile_type = 'personal'`
    ).get(slug) as Record<string, unknown> | undefined;

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    return await buildPublicProfileResponse(profile, req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
}

// GET /api/business/:bizSlug/:personSlug/public  — business profiles
export async function getPublicBusinessProfile(req: Request, res: Response) {
  try {
    const { bizSlug, personSlug } = req.params;

    const profile = await db.prepare(
      `SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE biz_slug = ? AND person_slug = ? AND is_published = 1 AND profile_type = 'business'`
    ).get(bizSlug, personSlug) as Record<string, unknown> | undefined;

    if (!profile) return res.status(404).json({ success: false, error: 'Business profile not found' });

    return await buildBusinessProfileResponse(profile, res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch business profile' });
  }
}

// GET /api/business/:bizSlug/public  — business landing page (no person slug)
export async function getPublicBusinessPage(req: Request, res: Response) {
  try {
    const { bizSlug } = req.params;

    // Find the owner's profile for this business (person_slug is the owner's slug)
    const profile = await db.prepare(
      `SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE biz_slug = ? AND is_published = 1 AND profile_type = 'business' ORDER BY id ASC LIMIT 1`
    ).get(bizSlug) as Record<string, unknown> | undefined;

    if (!profile) return res.status(404).json({ success: false, error: 'Business not found' });

    return await buildBusinessProfileResponse(profile, res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch business page' });
  }
}

// GET /api/business/:bizSlug/team  — team directory (respects team_directory_public lock)
export async function getPublicTeamDirectory(req: Request, res: Response) {
  try {
    const { bizSlug } = req.params;

    // Find the business profile
    const ownerProfile = await db.prepare(
      `SELECT ${DASHBOARD_PROFILE_COLS} FROM profiles WHERE biz_slug = ? AND profile_type = 'business' AND is_published = 1 ORDER BY id ASC LIMIT 1`
    ).get(bizSlug) as Record<string, unknown> | undefined;

    if (!ownerProfile) return res.status(404).json({ success: false, error: 'Business not found' });

    // Check if team directory is public
    if (!ownerProfile.team_directory_public) {
      return res.status(403).json({ success: false, error: 'Team directory is private', locked: true });
    }

    // Get all published business profiles for this biz_slug (all team members)
    const members = await db.prepare(`
      SELECT p.id, p.person_slug, p.display_name, p.job_title, p.profile_photo, p.bio,
             p.show_bio, p.biz_slug, p.business_name
      FROM profiles p
      WHERE p.biz_slug = ? AND p.profile_type = 'business' AND p.is_published = 1
      ORDER BY p.id ASC
    `).all(bizSlug) as Record<string, unknown>[];

    // Also include seat members who have their own profiles
    const seats = await db.prepare(`
      SELECT bs.name, bs.role, bs.email,
             u.name AS user_name
      FROM business_seats bs
      LEFT JOIN users u ON u.id = bs.user_id
      WHERE bs.profile_id = ? AND bs.status = 'active'
    `).all(ownerProfile.id as number) as Record<string, unknown>[];

    res.json({
      success: true,
      data: {
        business_name: ownerProfile.business_name,
        biz_slug: bizSlug,
        logo_url: ownerProfile.logo_url,
        cover_url: ownerProfile.cover_url,
        members: members.map(m => ({
          person_slug: m.person_slug,
          display_name: m.display_name,
          job_title: m.job_title,
          profile_photo: m.profile_photo,
          bio: m.show_bio ? m.bio : null,
          url: `/profile/${bizSlug}/${m.person_slug}`,
        })),
        seats: seats.map(s => ({
          name: s.user_name || s.name,
          role: s.role,
          profile_photo: null,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch team directory' });
  }
}

// PUT /api/business/:profileId/team-directory — toggle team directory public/private
export async function updateTeamDirectoryVisibility(req: AuthRequest, res: Response) {
  try {
    const { profileId } = req.params;
    const { team_directory_public } = req.body as { team_directory_public: boolean };

    const profile = await db.prepare(
      "SELECT id FROM profiles WHERE id = ? AND user_id = ? AND profile_type = 'business'"
    ).get(String(profileId), req.user!.id);

    if (!profile) return res.status(404).json({ success: false, error: 'Business profile not found' });

    db.prepare('UPDATE profiles SET team_directory_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(team_directory_public ? 1 : 0, String(profileId));

    res.json({ success: true, team_directory_public });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update team directory visibility' });
  }
}

// ─── shared helpers ────────────────────────────────────────────────────────

async function buildBusinessProfileResponse(profile: Record<string, unknown>, res: Response) {
  const user = await db.prepare('SELECT plan_id FROM users WHERE id = ?').get(profile.user_id as number) as { plan_id: number } | undefined;
  const plan = user ? await db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id) as Record<string, unknown> | undefined : undefined;
  const links = await db.prepare('SELECT * FROM profile_links WHERE profile_id = ? AND is_enabled = 1 ORDER BY sort_order ASC').all(profile.id as number);

  // Resolve theme — same as personal profiles
  const theme = profile.theme_id
    ? await db.prepare('SELECT * FROM themes WHERE id = ?').get(profile.theme_id as number) as Record<string, unknown> | undefined
    : null;

  return res.json({
    success: true,
    data: {
      id: profile.id,
      profile_type: 'business',
      biz_slug: profile.biz_slug,
      person_slug: profile.person_slug,
      business_name: profile.business_name,
      business_tagline: profile.business_tagline,
      display_name: profile.display_name,
      business_description: profile.business_description,
      business_category: profile.business_category,
      phone: profile.business_phone || (profile.show_phone ? profile.phone : null),
      email: profile.business_email || (profile.show_email ? profile.email : null),
      website: profile.business_website || (profile.show_website ? profile.website : null),
      address: profile.business_address || (profile.show_address ? profile.address : null),
      profile_photo: profile.profile_photo,
      logo_url: profile.logo_url,
      cover_url: profile.cover_url,
      opening_hours: profile.opening_hours,
      services:      profile.services      ? JSON.parse(profile.services as string)      : [],
      team_members:  profile.team_members  ? JSON.parse(profile.team_members as string)  : [],
      announcements: profile.announcements ? JSON.parse(profile.announcements as string) : [],
      social_links:  profile.social_links  ? JSON.parse(profile.social_links as string)  : [],
      // Extended JSON sections
      gallery:         profile.gallery         ? JSON.parse(profile.gallery as string)         : [],
      awards:          profile.awards          ? JSON.parse(profile.awards as string)          : [],
      faqs:            profile.faqs            ? JSON.parse(profile.faqs as string)            : [],
      certifications:  profile.certifications  ? JSON.parse(profile.certifications as string)  : [],
      testimonials:    profile.testimonials    ? JSON.parse(profile.testimonials as string)    : [],
      cta_buttons:     profile.cta_buttons     ? JSON.parse(profile.cta_buttons as string)     : [],
      payment_methods: profile.payment_methods ? JSON.parse(profile.payment_methods as string) : [],
      featured_offer:  profile.featured_offer  ? JSON.parse(profile.featured_offer as string)  : null,
      booking_link:    profile.booking_link    || null,
      map_embed:       profile.map_embed       || null,
      team_directory_public: profile.team_directory_public ?? 1,
      links,
      theme_id: profile.theme_id || null,
      theme: theme || null,
      // Computed URLs
      personal_url: `/profile/${profile.biz_slug}/${profile.person_slug}`,
      business_url: `/profile/${profile.biz_slug}`,
      team_url: `/profile/${profile.biz_slug}/team`,
      // SEO fields
      allow_indexing: profile.allow_indexing ?? 1,
      seo_title: profile.seo_title || null,
      seo_description: profile.seo_description || null,
      // Verification
      is_verified: !!profile.is_verified,
      verified_at: profile.verified_at || null,
      // Design / type fields
      business_type:  profile.business_type  || 'other',
      layout_preset:  profile.layout_preset  || 'classic',
      colour_palette: profile.colour_palette || 'brand',
      custom_colour:  profile.custom_colour  || '#2563eb',
      button_style:   profile.button_style   || 'rounded',
      plan: {
        has_contact_form: plan?.has_contact_form || 0,
        has_vcard_download: plan?.has_vcard_download || 0,
        remove_branding: plan?.remove_branding || 0,
      },
      enquiry_enabled: profile.enquiry_enabled ?? 1,
      // ── New feature sections (business profiles) ─────────────────────────
      whatsapp_url:     profile.whatsapp_url     || null,
      whatsapp_label:   profile.whatsapp_label   || null,
      whatsapp_enabled: profile.whatsapp_enabled ?? 0,
      gallery_enabled:  profile.gallery_enabled  ?? 0,
      menu_items:       profile.menu_items ? (() => { try { return JSON.parse(profile.menu_items as string); } catch { return []; } })() : [],
      menu_enabled:     profile.menu_enabled     ?? 0,
      menu_title:       profile.menu_title       || null,
      pdf_attachments:  profile.pdf_attachments ? (() => { try { return JSON.parse(profile.pdf_attachments as string); } catch { return []; } })() : [],
      pdf_enabled:      profile.pdf_enabled      ?? 0,
      social_links_enabled: profile.social_links_enabled ?? 1,
    },
  });
}

async function buildPublicProfileResponse(profile: Record<string, unknown>, req: Request, res: Response) {
  // ── Public PIN gate ────────────────────────────────────────────────────────
  // If the profile has a public PIN enabled, check whether this session has unlocked it.
  // If not unlocked, return a 403 with pin_required: true so the frontend shows the PIN gate.
  const pinEnabled = !!profile.public_pin_enabled && !!profile.public_pin_hash;
  if (pinEnabled) {
  const unlockedIds: number[] = ((req.session as unknown as Record<string, unknown>).unlockedPublicProfiles as number[]) ?? [];
    const isUnlocked = unlockedIds.includes(profile.id as number);
    if (!isUnlocked) {
      return res.status(403).json({
        success: false,
        pin_required: true,
        username: profile.username,
        display_name: profile.display_name,
        profile_photo: profile.profile_photo,
      });
    }
  }

  // ── Section visibility: only expose what this profile type shows ─────────────
  const personalType = (profile.personal_type as string) || 'professional';
  const sec = getSections(personalType);

  // ── Extended fields: parse JSON arrays once ───────────────────────────────
  const skills         = parseJsonArray(profile.skills);
  const languages      = parseJsonArray(profile.languages);
  const education      = parseJsonArray(profile.education);
  const experience     = parseJsonArray(profile.experience);
  const awards         = parseJsonArray(profile.awards);
  const certifications = parseJsonArray(profile.certifications);
  const socialChannels = parseJsonArray(profile.social_channels);
  const speakingTopics = parseJsonArray(profile.speaking_topics);
  const coachingAreas  = parseJsonArray(profile.coaching_areas);
  const volunteerCauses= parseJsonArray(profile.volunteer_causes);
  const publications   = parseJsonArray(profile.publications);
  const contentFormats = parseJsonArray(profile.content_formats);
  const platforms      = parseJsonArray(profile.platforms);
  const internships    = parseJsonArray(profile.internships);
  const clubs          = parseJsonArray(profile.clubs);

  // ── Build the public response — only include what the user chose to share ──
  // Rules:
  //   show_* flag = false  → field is null (user hid it in privacy settings)
  //   section not in type  → field omitted entirely (not relevant to this profile type)
  //   section in type but empty → field omitted (nothing to show)
  //   feature _enabled = 0 → section data omitted (user turned it off)
  const publicProfile: Record<string, unknown> = {
    // ── Always-public identity fields ────────────────────────────────────────
    id:           profile.id,
    username:     profile.username,
    display_name: profile.display_name,
    job_title:    profile.job_title   || null,
    company:      profile.company     || null,
    profile_photo:profile.profile_photo || null,
    theme_id:     profile.theme_id,
    profile_type: profile.profile_type || 'personal',
    personal_type: personalType,
    url_prefix:   'profile',
    profile_url:  `/profile/${profile.username}`,

    // ── Privacy-gated contact fields (show_* flags) ───────────────────────
    bio:     profile.show_bio     ? (profile.bio     || null) : null,
    bio_html:profile.show_bio     ? (profile.bio_html || null) : null,
    phone:   profile.show_phone   ? (profile.phone   || null) : null,
    email:   profile.show_email   ? (profile.email   || null) : null,
    website: profile.show_website ? (profile.website || null) : null,
    address: profile.show_address ? (profile.address || null) : null,

    // ── Feature toggles (needed by frontend to render/hide sections) ──────
    messaging_enabled:    profile.messaging_enabled    ?? 1,
    enquiry_enabled:      profile.enquiry_enabled      ?? 1,
    whatsapp_enabled:     profile.whatsapp_enabled     ?? 0,
    gallery_enabled:      profile.gallery_enabled      ?? 0,
    menu_enabled:         profile.menu_enabled         ?? 0,
    pdf_enabled:          profile.pdf_enabled          ?? 0,
    social_links_enabled: profile.social_links_enabled ?? 1,

    // ── Feature section data (only when enabled) ──────────────────────────
    whatsapp_url:    (profile.whatsapp_enabled  ? (profile.whatsapp_url   || null) : null),
    whatsapp_label:  (profile.whatsapp_enabled  ? (profile.whatsapp_label || null) : null),
    gallery:         (profile.gallery_enabled   ? (profile.gallery        || null) : null),
    menu_items:      (profile.menu_enabled      ? (profile.menu_items     || null) : null),
    menu_title:      (profile.menu_enabled      ? (profile.menu_title     || null) : null),
    pdf_attachments: (profile.pdf_enabled       ? (profile.pdf_attachments|| null) : null),
    social_links:    (profile.social_links_enabled ? (profile.social_links || null) : null),

    // ── Design / layout fields (always needed to render the card) ─────────
    layout_preset:  profile.layout_preset  || 'card',
    colour_palette: profile.colour_palette || 'brand',
    custom_colour:  profile.custom_colour  || '#2563eb',
    button_style:   profile.button_style   || 'rounded',
    photo_shape:    profile.photo_shape    || 'circle',
    cover_image:    profile.cover_image    || null,

    // ── Verification ──────────────────────────────────────────────────────
    is_verified: !!profile.is_verified,
    verified_at: profile.verified_at || null,

    // ── Public PIN status ─────────────────────────────────────────────────
    public_pin_enabled: pinEnabled,

    // ── SEO fields ────────────────────────────────────────────────────────
    allow_indexing:   profile.allow_indexing   ?? 0,
    seo_title:        profile.seo_title        || null,
    seo_description:  profile.seo_description  || null,

    // ── Business address ──────────────────────────────────────────────────
    business_address: profile.business_address || null,

    // ── Extended fields: gated by profile type section visibility ─────────
    // Each field is only included if:
    //   (a) the profile type's section map includes it, AND
    //   (b) the value is non-empty
    headline:         gated(sec, 'headline',       profile.headline      || null),
    pronouns:         gated(sec, 'pronouns',       profile.pronouns      || null),
    location_city:    gated(sec, 'location',       profile.location_city || null),
    availability:     gated(sec, 'availability',   profile.availability  || null),
    portfolio_url:    gated(sec, 'portfolioUrl',   profile.portfolio_url || null),
    skills:           gated(sec, 'skills',         skills),
    languages:        gated(sec, 'languages',      languages),
    awards:           gated(sec, 'awards',         awards),
    certifications:   gated(sec, 'certifications', certifications),
    experience:       gated(sec, 'experience',     experience),
    education:        gated(sec, 'education',      education),
    social_channels:  gated(sec, 'socialChannels', socialChannels),
    content_niche:    gated(sec, 'contentNiche',   profile.content_niche  || null),
    collab_rate:      gated(sec, 'collabRate',     profile.collab_rate    || null),
    content_formats:  gated(sec, 'contentFormats', contentFormats),
    platforms:        gated(sec, 'platforms',      platforms),
    speaking_topics:  gated(sec, 'speakingTopics', speakingTopics),
    coaching_areas:   gated(sec, 'coachingAreas',  coachingAreas),
    volunteer_causes: gated(sec, 'volunteerCauses',volunteerCauses),
    ministry_role:    gated(sec, 'ministryRole',   profile.ministry_role  || null),
    publications:     gated(sec, 'publications',   publications),
    gpa:              gated(sec, 'gpa',            profile.gpa            || null),
    graduation_year:  gated(sec, 'graduationYear', profile.graduation_year|| null),
    internships:      gated(sec, 'internships',    internships),
    clubs:            gated(sec, 'clubs',          clubs),
  };

  const user = await db.prepare('SELECT plan_id FROM users WHERE id = ?').get(profile.user_id as number) as { plan_id: number } | undefined;
  const plan = user ? await db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id) as Record<string, unknown> | undefined : undefined;

  publicProfile.plan = {
    has_contact_form: plan?.has_contact_form || 0,
    has_vcard_download: plan?.has_vcard_download || 0,
    remove_branding: plan?.remove_branding || 0,
    has_messaging: plan?.has_messaging || 0,
  };

  const theme = await db.prepare('SELECT * FROM themes WHERE id = ?').get(profile.theme_id as number);
  publicProfile.theme = theme;

  const links = await db.prepare('SELECT * FROM profile_links WHERE profile_id = ? AND is_enabled = 1 ORDER BY sort_order ASC').all(profile.id as number);
  publicProfile.links = links;

  // ── Custom site editor content — removed ──────────────────────────────────
  // The site editor has been removed. Custom HTML/CSS is no longer served.

  return res.json({ success: true, data: publicProfile });
}
