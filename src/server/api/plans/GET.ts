/**
 * GET /api/plans
 *
 * Single source of truth for plan data used by:
 *  - Homepage pricing section
 *  - Customer dashboard Plans & Billing page
 *  - Admin portal
 *
 * Returns all active plans with:
 *  - Core capability fields (max_profiles, max_links, etc.)
 *  - Stripe price IDs for checkout
 *  - Feature lists derived from feature_plan_rules (included / coming_soon / quote_required / paid_addon)
 *
 * Lifetime plan is always sorted last regardless of price.
 * Custom Domain is never shown as included — it is always a paid add-on.
 */
import type { Request, Response } from 'express';
import db from '../../db.js';

interface PlanRow {
  id: number;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  max_profiles: number;
  max_org_profiles: number;
  max_links: number;
  max_seats: number;
  max_themes: number;
  has_qr_download: number;
  has_contact_form: number;
  has_advanced_analytics: number;
  has_vcard_download: number;
  has_custom_themes: number;
  remove_branding: number;
  has_messaging: number;
  has_lifetime: number;
  is_active: number;
  stripe_product_id: string | null;
  stripe_price_monthly: string | null;
  stripe_price_yearly: string | null;
  stripe_price_lifetime: string | null;
}

interface FeatureRuleRow {
  plan_id: number;
  feature_slug: string;
  feature_name: string;
  feature_category: string;
  access_type: string;
}

export default function getPlans(req: Request, res: Response) {
  try {
    // Sort: free first, then paid by price, lifetime always last
    const plans = db.prepare(`
      SELECT id, name, slug, price_monthly, price_yearly,
             max_profiles, COALESCE(max_org_profiles, 0) AS max_org_profiles,
             max_links, max_seats,
             COALESCE(max_themes, -1) AS max_themes,
             has_qr_download, has_contact_form, has_advanced_analytics,
             has_vcard_download, has_custom_themes, remove_branding,
             has_messaging, has_lifetime, is_active,
             stripe_product_id, stripe_price_monthly, stripe_price_yearly,
             stripe_price_lifetime
      FROM plans
      WHERE is_active = 1
      ORDER BY
        CASE WHEN has_lifetime = 1 THEN 9999 ELSE price_monthly END ASC,
        id ASC
    `).all() as PlanRow[];

    // Load all feature_plan_rules for active plans
    const featureRules = db.prepare(`
      SELECT fpr.plan_id, pf.slug AS feature_slug, pf.name AS feature_name,
             pf.category AS feature_category, fpr.access_type
      FROM feature_plan_rules fpr
      JOIN platform_features pf ON fpr.feature_id = pf.id
      WHERE pf.status IN ('active', 'coming_soon')
        AND fpr.access_type != 'hidden'
      ORDER BY pf.sort_order ASC
    `).all() as FeatureRuleRow[];

    // Load all active visible add-ons
    const addons = db.prepare(`
      SELECT id, slug, name, description, price, billing_interval, is_active, is_visible, sort_order
      FROM addons
      WHERE is_active = 1 AND is_visible = 1
      ORDER BY sort_order ASC
    `).all();

    // Group feature rules by plan_id
    const rulesByPlan = new Map<number, FeatureRuleRow[]>();
    for (const rule of featureRules) {
      if (!rulesByPlan.has(rule.plan_id)) rulesByPlan.set(rule.plan_id, []);
      rulesByPlan.get(rule.plan_id)!.push(rule);
    }

    const result = plans.map(plan => {
      const rules = rulesByPlan.get(plan.id) ?? [];

      // ── Core capabilities (always derived from plan columns — ground truth) ──
      const coreFeatures: string[] = [];

      // Profile allowance — describe personal + org slots accurately
      const orgSlots = plan.max_org_profiles ?? 0;
      if (plan.max_profiles === 999) {
        coreFeatures.push('Unlimited profile pages');
      } else if (orgSlots >= 10) {
        coreFeatures.push('1 personal profile + 10 organisation profiles');
      } else if (orgSlots === 4) {
        coreFeatures.push('1 personal profile + 4 organisation profiles');
      } else if (orgSlots === 1) {
        coreFeatures.push('1 personal profile + 1 organisation profile');
      } else {
        // Free / Starter — personal only
        coreFeatures.push('1 personal profile');
      }

      if (plan.max_links === 999) coreFeatures.push('Unlimited links');
      else if (plan.max_links > 1) coreFeatures.push(`Up to ${plan.max_links} links`);
      else coreFeatures.push('1 link');

      if (plan.has_qr_download) coreFeatures.push('QR code download');
      else coreFeatures.push('QR code sharing');

      if (plan.has_vcard_download) coreFeatures.push('vCard / contact download');
      if (plan.has_contact_form) coreFeatures.push('Contact enquiry form');
      // has_messaging intentionally omitted — messaging is not a public plan feature

      if (plan.has_custom_themes) {
        coreFeatures.push(plan.max_themes === -1 ? 'All premium themes unlocked' : 'Custom profile themes');
      }

      if (plan.has_advanced_analytics) coreFeatures.push('Advanced analytics');
      if (plan.remove_branding) coreFeatures.push('Remove JA branding');

      if (plan.max_seats && plan.max_seats > 1 && plan.slug !== 'professional') {
        coreFeatures.push(plan.max_seats === 999 ? 'Unlimited team seats' : `Up to ${plan.max_seats} team seats`);
      }

      if (plan.has_lifetime) coreFeatures.push('Lifetime access — discretionary status granted by JA Group Services Ltd');

      // ── Feature rule buckets ──
      const includedFeatures   = rules.filter(r => r.access_type === 'included').map(r => r.feature_name);
      const comingSoonFeatures = rules.filter(r => r.access_type === 'coming_soon').map(r => r.feature_name);
      const addonFeatures      = rules.filter(r => r.access_type === 'paid_addon').map(r => r.feature_name);
      const quoteFeatures      = rules.filter(r => r.access_type === 'quote_required').map(r => r.feature_name);

      return {
        id:                    plan.id,
        name:                  plan.name,
        slug:                  plan.slug,
        price_monthly:         plan.price_monthly,
        price_yearly:          plan.price_yearly,
        is_lifetime:           plan.has_lifetime === 1,
        // Raw capability columns (needed by billing page)
        max_profiles:          plan.max_profiles,
        max_org_profiles:      plan.max_org_profiles,
        max_links:             plan.max_links,
        max_seats:             plan.max_seats,
        max_themes:            plan.max_themes,
        has_qr_download:       plan.has_qr_download,
        has_contact_form:      plan.has_contact_form,
        has_advanced_analytics: plan.has_advanced_analytics,
        has_vcard_download:    plan.has_vcard_download,
        has_custom_themes:     plan.has_custom_themes,
        remove_branding:       plan.remove_branding,
        has_messaging:         plan.has_messaging,
        has_lifetime:          plan.has_lifetime,
        // Stripe IDs (needed by billing page checkout)
        stripe_product_id:     plan.stripe_product_id ?? null,
        stripe_price_monthly:  plan.stripe_price_monthly ?? null,
        stripe_price_yearly:   plan.stripe_price_yearly ?? null,
        stripe_price_lifetime: plan.stripe_price_lifetime ?? null,
        // Feature lists
        core_features:         coreFeatures,
        included_features:     includedFeatures,
        coming_soon_features:  comingSoonFeatures,
        addon_features:        addonFeatures,
        quote_features:        quoteFeatures,
      };
    });

    // ?include_lifetime=1 is an internal-only flag used by the admin billing panel.
    // Public-facing endpoints (pricing page, homepage) never pass this flag, so
    // lifetime plans are hidden from all public views.
    const includeLifetime = req.query.include_lifetime === '1';
    const publicResult = includeLifetime
      ? result
      : result.filter((p: { is_lifetime: boolean }) => !p.is_lifetime);

    res.json({ success: true, plans: publicResult, addons });
  } catch (err) {
    console.error('[GET /api/plans]', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}
