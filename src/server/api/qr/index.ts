import { type Request, type Response } from 'express';
import QRCode from 'qrcode';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { profileUrl } from '../profiles/index.js';

export async function getQRCode(req: AuthRequest, res: Response) {
  try {
    const { profileId } = req.params;
    const profile = await db.prepare(
      'SELECT id, username, profile_type, biz_slug, person_slug FROM profiles WHERE id = ? AND user_id = ?'
    ).get(profileId, req.user!.id) as {
      username: string; profile_type: string; biz_slug?: string; person_slug?: string;
    } | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Use branding platform_url so QR codes always point to the correct live domain
    const brandingUrl = (await db.prepare("SELECT value FROM admin_settings WHERE key = 'platform_url'").get() as { value: string } | undefined)?.value;
    const baseUrl = (brandingUrl || process.env.PUBLIC_URL || process.env.SITE_URL || 'https://japrofilestudio.jagroupservices.co.uk').replace(/\/$/, '');

    // New URL scheme: /profile/username or /profile/bizslug/personslug
    const path = profileUrl(profile);
    const fullUrl = `${baseUrl}${path}`;

    const qrDataUrl = await QRCode.toDataURL(fullUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });

    res.json({ success: true, data: { qr_data_url: qrDataUrl, profile_url: fullUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
}

// Authenticated endpoint — generate QR for a specific profile including the
// business person-card URL (/profile/:bizSlug/:personSlug).
// GET /api/qr/:profileId/person — returns QR for the person-card URL
export async function getPersonCardQRCode(req: AuthRequest, res: Response) {
  try {
    const { profileId } = req.params;
    const profile = await db.prepare(
      'SELECT id, username, profile_type, biz_slug, person_slug FROM profiles WHERE id = ? AND user_id = ?'
    ).get(profileId, req.user!.id) as {
      username: string; profile_type: string; biz_slug?: string; person_slug?: string;
    } | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    if (profile.profile_type !== 'business' || !profile.biz_slug || !profile.person_slug) {
      return res.status(400).json({ success: false, error: 'No person-card URL for this profile' });
    }

    const brandingUrl = (await db.prepare("SELECT value FROM admin_settings WHERE key = 'platform_url'").get() as { value: string } | undefined)?.value;
    const baseUrl = (brandingUrl || 'https://japrofilestudio.jagroupservices.co.uk').replace(/\/$/, '');

    const path = `/profile/${profile.biz_slug}/${profile.person_slug}`;
    const fullUrl = `${baseUrl}${path}`;

    const qrDataUrl = await QRCode.toDataURL(fullUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });

    res.json({ success: true, data: { qr_data_url: qrDataUrl, profile_url: fullUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
}

// Public QR endpoint — generates QR for a public profile by username OR biz_slug (no auth required)
export async function getPublicQRCode(req: Request, res: Response) {
  try {
    const { username } = req.params;

    // Try username first, then biz_slug so business profiles work via their slug
    let profile = await db.prepare(
      "SELECT id, username, profile_type, biz_slug, person_slug FROM profiles WHERE username = ? AND is_published = 1"
    ).get(username) as {
      username: string; profile_type: string; biz_slug?: string; person_slug?: string;
    } | undefined;

    if (!profile) {
      profile = await db.prepare(
        "SELECT id, username, profile_type, biz_slug, person_slug FROM profiles WHERE biz_slug = ? AND is_published = 1"
      ).get(username) as typeof profile;
    }

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const brandingUrl = (await db.prepare("SELECT value FROM admin_settings WHERE key = 'platform_url'").get() as { value: string } | undefined)?.value;
    const baseUrl = (brandingUrl || 'https://japrofilestudio.jagroupservices.co.uk').replace(/\/$/, '');
    const path = profileUrl(profile);
    const fullUrl = `${baseUrl}${path}`;

    const qrDataUrl = await QRCode.toDataURL(fullUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });

    res.json({ success: true, data: { qr_data_url: qrDataUrl, profile_url: fullUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
}

