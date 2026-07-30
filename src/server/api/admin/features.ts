/**
 * Admin Feature Gate API
 * Manages platform_features, feature_plan_rules, customer_feature_overrides
 *
 * Routes (all require requireAdminApi):
 *   GET    /api/admin/features                    — list all features
 *   GET    /api/admin/features/:id                — get one feature with plan rules
 *   PUT    /api/admin/features/:id                — update feature settings
 *   PUT    /api/admin/features/:id/plan-rules     — set plan access rules
 *   GET    /api/admin/features/:id/overrides      — list customer overrides for a feature
 *   POST   /api/admin/features/:id/overrides      — set override for a customer
 *   DELETE /api/admin/features/:id/overrides/:userId — remove override
 *
 * Customer-facing:
 *   GET    /api/features/me                       — features visible to the authenticated user
 *   POST   /api/features/:slug/register-interest  — register interest in a coming-soon feature
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { notifyFeatureActivated, notifyFeatureRequest } from '../../lib/notifications.js';

// ── Admin: list all features ──────────────────────────────────────────────────
export function adminListFeatures(_req: Request, res: Response) {
  try {
    const features = db.prepare(`
      SELECT pf.*,
        (SELECT COUNT(*) FROM feature_plan_rules fpr WHERE fpr.feature_id = pf.id) AS plan_rule_count,
        (SELECT COUNT(*) FROM customer_feature_overrides cfo WHERE cfo.feature_id = pf.id) AS override_count,
        (SELECT COUNT(*) FROM feature_interest_registrations fir WHERE fir.feature_id = pf.id) AS interest_count
      FROM platform_features pf
      ORDER BY pf.sort_order ASC, pf.name ASC
    `).all();
    res.json({ success: true, data: features });
  } catch (err) {
    console.error('[admin/features] list error:', err);
    res.status(500).json({ success: false, error: 'Failed to list features' });
  }
}

// ── Admin: get one feature with plan rules ────────────────────────────────────
export function adminGetFeature(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const feature = db.prepare(`SELECT * FROM platform_features WHERE id = ?`).get(id) as any;
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });

    const planRules = db.prepare(`
      SELECT fpr.*, p.name AS plan_name, p.slug AS plan_slug
      FROM feature_plan_rules fpr
      JOIN plans p ON p.id = fpr.plan_id
      WHERE fpr.feature_id = ?
    `).all(id);

    const allPlans = db.prepare(`SELECT id, name, slug FROM plans ORDER BY price_monthly ASC`).all();

    res.json({ success: true, data: { feature, planRules, allPlans } });
  } catch (err) {
    console.error('[admin/features] get error:', err);
    res.status(500).json({ success: false, error: 'Failed to get feature' });
  }
}

// ── Admin: update feature settings ───────────────────────────────────────────
export function adminUpdateFeature(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const feature = db.prepare(`SELECT * FROM platform_features WHERE id = ?`).get(id) as any;
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });

    const {
      name, description, category, status, pricing_type,
      fixed_price, from_price, coming_soon_text,
      show_coming_soon, show_upgrade_prompt, require_admin_approval,
      allow_register_interest, dashboard_icon_visible, menu_visible,
      request_form_enabled, portal_comms_enabled, file_uploads_enabled,
      proof_download_enabled, final_file_enabled, sort_order,
    } = req.body;

    const validStatuses = ['hidden', 'coming_soon', 'active', 'inactive', 'disabled'];
    const validPricing = ['free', 'included', 'fixed', 'from', 'quote_required', 'manual', 'paid_addon'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    if (pricing_type && !validPricing.includes(pricing_type)) {
      return res.status(400).json({ success: false, error: 'Invalid pricing_type' });
    }

    db.prepare(`
      UPDATE platform_features SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        status = COALESCE(?, status),
        pricing_type = COALESCE(?, pricing_type),
        fixed_price = ?,
        from_price = ?,
        coming_soon_text = COALESCE(?, coming_soon_text),
        show_coming_soon = COALESCE(?, show_coming_soon),
        show_upgrade_prompt = COALESCE(?, show_upgrade_prompt),
        require_admin_approval = COALESCE(?, require_admin_approval),
        allow_register_interest = COALESCE(?, allow_register_interest),
        dashboard_icon_visible = COALESCE(?, dashboard_icon_visible),
        menu_visible = COALESCE(?, menu_visible),
        request_form_enabled = COALESCE(?, request_form_enabled),
        portal_comms_enabled = COALESCE(?, portal_comms_enabled),
        file_uploads_enabled = COALESCE(?, file_uploads_enabled),
        proof_download_enabled = COALESCE(?, proof_download_enabled),
        final_file_enabled = COALESCE(?, final_file_enabled),
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? null, description ?? null, category ?? null,
      status ?? null, pricing_type ?? null,
      fixed_price !== undefined ? fixed_price : feature.fixed_price,
      from_price !== undefined ? from_price : feature.from_price,
      coming_soon_text ?? null,
      show_coming_soon !== undefined ? (show_coming_soon ? 1 : 0) : null,
      show_upgrade_prompt !== undefined ? (show_upgrade_prompt ? 1 : 0) : null,
      require_admin_approval !== undefined ? (require_admin_approval ? 1 : 0) : null,
      allow_register_interest !== undefined ? (allow_register_interest ? 1 : 0) : null,
      dashboard_icon_visible !== undefined ? (dashboard_icon_visible ? 1 : 0) : null,
      menu_visible !== undefined ? (menu_visible ? 1 : 0) : null,
      request_form_enabled !== undefined ? (request_form_enabled ? 1 : 0) : null,
      portal_comms_enabled !== undefined ? (portal_comms_enabled ? 1 : 0) : null,
      file_uploads_enabled !== undefined ? (file_uploads_enabled ? 1 : 0) : null,
      proof_download_enabled !== undefined ? (proof_download_enabled ? 1 : 0) : null,
      final_file_enabled !== undefined ? (final_file_enabled ? 1 : 0) : null,
      sort_order ?? null,
      id,
    );

    // Audit log
    const admin = (req as any).adminUser;
    writeAudit({
      actorId: admin?.id ? Number(admin.id) : null,
      actorType: 'admin',
      actorName: admin?.name ?? 'Admin',
      action: 'feature_updated',
      resourceType: 'platform_feature',
      resourceId: String(id),
      details: `Feature "${feature.name}" updated. Status: ${status ?? feature.status}`,
      result: 'success',
    });

    const updated = db.prepare(`SELECT * FROM platform_features WHERE id = ?`).get(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[admin/features] update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update feature' });
  }
}

// ── Admin: set plan access rules for a feature ────────────────────────────────
export function adminSetFeaturePlanRules(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const feature = db.prepare(`SELECT * FROM platform_features WHERE id = ?`).get(id) as any;
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });

    // rules: [{ plan_id, access_type }]
    const { rules } = req.body as { rules: { plan_id: number; access_type: string }[] };
    if (!Array.isArray(rules)) return res.status(400).json({ success: false, error: 'rules must be an array' });

    const validAccess = ['hidden', 'coming_soon', 'included', 'paid_addon', 'quote_required', 'restricted'];
    const upsert = db.prepare(`
      INSERT INTO feature_plan_rules (feature_id, plan_id, access_type)
      VALUES (?, ?, ?)
      ON CONFLICT(feature_id, plan_id) DO UPDATE SET access_type = excluded.access_type
    `);
    const del = db.prepare(`DELETE FROM feature_plan_rules WHERE feature_id = ? AND plan_id = ?`);

    const upsertAll = db.transaction(() => {
      for (const rule of rules) {
        if (!validAccess.includes(rule.access_type)) continue;
        if (rule.access_type === 'hidden') {
          del.run(id, rule.plan_id);
        } else {
          upsert.run(id, rule.plan_id, rule.access_type);
        }
      }
    });
    upsertAll();

    const admin = (req as any).adminUser;
    writeAudit({
      actorId: admin?.id ? Number(admin.id) : null,
      actorType: 'admin',
      actorName: admin?.name ?? 'Admin',
      action: 'feature_plan_rules_updated',
      resourceType: 'platform_feature',
      resourceId: String(id),
      details: `Plan rules updated for feature "${feature.name}"`,
      result: 'success',
    });

    const planRules = db.prepare(`
      SELECT fpr.*, p.name AS plan_name, p.slug AS plan_slug
      FROM feature_plan_rules fpr
      JOIN plans p ON p.id = fpr.plan_id
      WHERE fpr.feature_id = ?
    `).all(id);
    res.json({ success: true, data: planRules });
  } catch (err) {
    console.error('[admin/features] plan rules error:', err);
    res.status(500).json({ success: false, error: 'Failed to set plan rules' });
  }
}

// ── Admin: list customer overrides for a feature ──────────────────────────────
export function adminListFeatureOverrides(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const overrides = db.prepare(`
      SELECT cfo.*, u.name AS user_name, u.email AS user_email
      FROM customer_feature_overrides cfo
      JOIN users u ON u.id = cfo.user_id
      WHERE cfo.feature_id = ?
      ORDER BY cfo.updated_at DESC
    `).all(id);
    res.json({ success: true, data: overrides });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list overrides' });
  }
}

// ── Admin: set customer override ──────────────────────────────────────────────
export function adminSetFeatureOverride(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { user_id, access_type, notes } = req.body;
    if (!user_id || !access_type) {
      return res.status(400).json({ success: false, error: 'user_id and access_type required' });
    }
    const validAccess = ['hidden', 'coming_soon', 'included', 'paid_addon', 'quote_required', 'restricted', 'active'];
    if (!validAccess.includes(access_type)) {
      return res.status(400).json({ success: false, error: 'Invalid access_type' });
    }

    const admin = (req as any).adminUser;
    db.prepare(`
      INSERT INTO customer_feature_overrides (user_id, feature_id, access_type, notes, set_by_admin_id, set_by_admin_name, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, feature_id) DO UPDATE SET
        access_type = excluded.access_type,
        notes = excluded.notes,
        set_by_admin_id = excluded.set_by_admin_id,
        set_by_admin_name = excluded.set_by_admin_name,
        updated_at = CURRENT_TIMESTAMP
    `).run(user_id, id, access_type, notes ?? null, admin?.id ?? null, admin?.name ?? null);

    const feature = db.prepare(`SELECT name FROM platform_features WHERE id = ?`).get(id) as any;
    writeAudit({
      actorId: admin?.id ? Number(admin.id) : null,
      actorType: 'admin',
      actorName: admin?.name ?? 'Admin',
      action: 'feature_override_set',
      resourceType: 'platform_feature',
      resourceId: String(id),
      details: `Override set for user ${user_id}: ${access_type} on feature "${feature?.name ?? id}"`,
      result: 'success',
    });

    // Notify customer if feature is being activated for them
    if (access_type === 'active' || access_type === 'included') {
      const targetUser = db.prepare(`SELECT email FROM users WHERE id = ?`).get(user_id) as any;
      if (targetUser?.email && feature?.name) {
        notifyFeatureActivated({
          userEmail: targetUser.email,
          featureName: feature.name,
          accessType: access_type,
        }).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[admin/features] override set error:', err);
    res.status(500).json({ success: false, error: 'Failed to set override' });
  }
}

// ── Admin: remove customer override ──────────────────────────────────────────
export function adminDeleteFeatureOverride(req: Request, res: Response) {
  try {
    const { id, userId } = req.params;
    db.prepare(`DELETE FROM customer_feature_overrides WHERE feature_id = ? AND user_id = ?`).run(id, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete override' });
  }
}

// ── Customer: get features visible to me ─────────────────────────────────────
export function getMyFeatures(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const planId = user.plan_id;

    // All active/coming-soon features
    const features = db.prepare(`
      SELECT pf.*,
        fpr.access_type AS plan_access,
        cfo.access_type AS override_access
      FROM platform_features pf
      LEFT JOIN feature_plan_rules fpr ON fpr.feature_id = pf.id AND fpr.plan_id = ?
      LEFT JOIN customer_feature_overrides cfo ON cfo.feature_id = pf.id AND cfo.user_id = ?
      ORDER BY pf.sort_order ASC
    `).all(planId ?? 0, user.id) as any[];

    // Resolve effective access for each feature
    const resolved = features.map(f => {
      // Customer override trumps everything
      const effectiveAccess = f.override_access ?? f.plan_access ?? 'hidden';
      const featureStatus = f.status as string;

      // Feature must be active or coming_soon globally
      if (featureStatus === 'hidden' || featureStatus === 'disabled' || featureStatus === 'inactive') {
        return null; // never show
      }

      // If coming_soon globally, only show if show_coming_soon is enabled
      if (featureStatus === 'coming_soon' && !f.show_coming_soon) {
        return null;
      }

      // Customer-level hidden or restricted
      if (effectiveAccess === 'hidden' || effectiveAccess === 'restricted') {
        return null;
      }

      // Plan doesn't have a rule and feature is active — hide unless override says otherwise
      if (!f.plan_access && !f.override_access) {
        // Show upgrade prompt if admin enabled it
        if (f.show_upgrade_prompt) {
          return { ...f, resolved_access: 'upgrade_prompt' };
        }
        return null;
      }

      return { ...f, resolved_access: effectiveAccess };
    }).filter(Boolean);

    res.json({ success: true, data: resolved });
  } catch (err) {
    console.error('[features/me] error:', err);
    res.status(500).json({ success: false, error: 'Failed to get features' });
  }
}

// ── Customer: check access to a single feature by slug ───────────────────────
export function checkFeatureAccess(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { slug } = req.params;
    const feature = db.prepare(`SELECT * FROM platform_features WHERE slug = ?`).get(slug) as any;
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });

    const planId = user.plan_id;
    const planRule = db.prepare(`
      SELECT access_type FROM feature_plan_rules WHERE feature_id = ? AND plan_id = ?
    `).get(feature.id, planId ?? 0) as any;
    const override = db.prepare(`
      SELECT access_type FROM customer_feature_overrides WHERE feature_id = ? AND user_id = ?
    `).get(feature.id, user.id) as any;

    const effectiveAccess = override?.access_type ?? planRule?.access_type ?? 'hidden';
    const featureStatus = feature.status as string;

    const blocked = featureStatus === 'hidden' || featureStatus === 'disabled' || featureStatus === 'inactive'
      || effectiveAccess === 'hidden' || effectiveAccess === 'restricted';

    res.json({
      success: true,
      data: {
        slug,
        feature_status: featureStatus,
        plan_access: planRule?.access_type ?? null,
        override_access: override?.access_type ?? null,
        effective_access: effectiveAccess,
        accessible: !blocked,
        require_admin_approval: !!feature.require_admin_approval,
        pricing_type: feature.pricing_type,
        fixed_price: feature.fixed_price,
        from_price: feature.from_price,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to check feature access' });
  }
}

// ── Customer: register interest ───────────────────────────────────────────────
export function registerFeatureInterest(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { slug } = req.params;
    const feature = db.prepare(`SELECT * FROM platform_features WHERE slug = ?`).get(slug) as any;
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });
    if (!feature.allow_register_interest) {
      return res.status(403).json({ success: false, error: 'Register interest is not enabled for this feature' });
    }

    const { notes } = req.body;
    db.prepare(`
      INSERT OR IGNORE INTO feature_interest_registrations (user_id, feature_id, notes)
      VALUES (?, ?, ?)
    `).run(user.id, feature.id, notes ?? null);

    // Notify admin
    notifyFeatureRequest({
      userName: user.name ?? user.email ?? 'Unknown',
      userEmail: user.email ?? '',
      featureName: feature.name,
      featureSlug: feature.slug,
      type: 'interest',
    }).catch(() => {});

    res.json({ success: true, message: 'Interest registered. Registering interest does not place an order, reserve availability or confirm pricing.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to register interest' });
  }
}

// ── Admin: list interest registrations for a feature ─────────────────────────
export function adminListFeatureInterest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const rows = db.prepare(`
      SELECT fir.*, u.name AS user_name, u.email AS user_email, p.name AS plan_name
      FROM feature_interest_registrations fir
      JOIN users u ON u.id = fir.user_id
      LEFT JOIN plans p ON p.id = u.plan_id
      WHERE fir.feature_id = ?
      ORDER BY fir.created_at DESC
    `).all(id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list interest registrations' });
  }
}
