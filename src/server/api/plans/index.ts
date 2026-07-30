/**
 * Plans API
 *
 * GET /api/plans          — public: only returns plans with is_public = 1
 * GET /api/admin/plans    — admin: returns all plans (handled in admin/index.ts)
 * PATCH /api/admin/plans/:id/visibility — toggle is_public (admin only)
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';

/** Per-plan feature bullets shown on the public pricing page */
const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    '1 personal profile',
    '1 social link',
    'Public profile page',
    'QR code sharing',
  ],
  starter: [
    '1 personal profile',
    'Up to 20 social links',
    'QR code download',
    'Contact form & WhatsApp button',
    'Gallery & PDF attachments',
    'Custom themes',
  ],
  professional: [
    '1 personal + 1 organisation profile',
    'Unlimited social links',
    'Advanced analytics',
    'vCard download',
    'Remove JA branding',
    'Priority support',
  ],
  business: [
    '1 personal + 1 organisation profile',
    'Everything in Professional',
    'Organisation seats & directory (up to 20)',
    'Multi-seat management',
    'Priority support',
    'Dedicated account support',
  ],
  ultimate_business: [
    '1 personal + 4 organisation profiles',
    'Everything in Organisation',
    'Up to 4 separate organisation brands',
    'Full organisation seat management (up to 20)',
    'Dedicated account manager',
    'Priority support',
    'Highest priority support',
  ],
  ultimate_plus: [
    '1 personal + up to 9 organisation profiles',
    'Everything in Ultimate Organisation',
    'Up to 40 team seats across all profiles',
    'Dedicated account manager',
    'Highest priority support — guaranteed response',
    'Custom onboarding & setup assistance',
    'Bespoke feature requests considered',
    'White-glove profile design service',
  ],
};

/** Public endpoint — only returns plans explicitly marked as public by admin */
export async function getPlans(_req: Request, res: Response) {
  try {
    const rows = db.prepare(
      `SELECT * FROM plans WHERE is_active = 1 AND is_public = 1
       ORDER BY
         CASE WHEN slug = 'ultimate_plus' THEN 9999 ELSE 0 END ASC,
         CASE WHEN has_lifetime = 1 THEN 9998 ELSE 0 END ASC,
         price_monthly ASC`
    ).all() as Record<string, unknown>[];

    // Inject core_features per slug (not stored in DB)
    const plans = rows.map(p => ({
      ...p,
      core_features: PLAN_FEATURES[(p.slug as string)] ?? [],
    }));

    res.json({ success: true, plans, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
}
