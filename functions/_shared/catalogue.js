import { HttpError, readJson } from "./http.js";
import { writeAudit } from "./audit.js";

const CUSTOM_DOMAIN_PLAN_SLUGS = new Set(["professional", "business", "ultimate_business", "ultimate_plus"]);

const PLAN_FEATURES = {
  free: ["1 personal profile", "1 social link", "Public profile page", "QR code sharing"],
  starter: ["1 personal profile", "Up to 20 social links", "QR code download", "Contact form"],
  professional: ["Personal and organisation profiles", "Unlimited links", "Advanced analytics"],
  business: ["Organisation profile", "Team seats", "Priority support"],
};

function planHasCustomDomain(plan) {
  return CUSTOM_DOMAIN_PLAN_SLUGS.has(String(plan?.slug || "").trim().toLowerCase());
}

export async function getPlans(database, includeLifetime = false, includeInactive = false) {
  const conditions = [];
  if (!includeInactive) conditions.push("p.is_active = 1");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [plansResult, rulesResult, addonsResult] = await Promise.all([
    database.prepare(`
      SELECT p.* FROM plans p ${where}
      ORDER BY CASE WHEN p.has_lifetime = 1 THEN 9999 ELSE p.price_monthly END ASC, p.id ASC
    `).all(),
    database.prepare(`
      SELECT fpr.plan_id, pf.slug AS feature_slug, pf.name AS feature_name,
             pf.category AS feature_category, fpr.access_type
      FROM feature_plan_rules fpr
      JOIN platform_features pf ON pf.id = fpr.feature_id
      WHERE pf.status IN ('active', 'coming_soon') AND fpr.access_type != 'hidden'
      ORDER BY pf.sort_order ASC, pf.id ASC
    `).all(),
    database.prepare(`
      SELECT id, slug, name, description, price, billing_interval, is_active, is_visible, sort_order
      FROM addons WHERE is_active = 1 AND is_visible = 1 ORDER BY sort_order ASC, id ASC
    `).all(),
  ]);
  const rulesByPlan = new Map();
  for (const rule of rulesResult.results) {
    const bucket = rulesByPlan.get(Number(rule.plan_id)) ?? [];
    bucket.push(rule);
    rulesByPlan.set(Number(rule.plan_id), bucket);
  }
  const plans = plansResult.results
    .filter((plan) => includeLifetime || Number(plan.has_lifetime) !== 1)
    .map((plan) => {
      const rules = rulesByPlan.get(Number(plan.id)) ?? [];
      const core = PLAN_FEATURES[plan.slug] ?? [];
      return {
        ...plan,
        has_custom_domain: planHasCustomDomain(plan) ? 1 : 0,
        is_lifetime: Number(plan.has_lifetime) === 1,
        core_features: planHasCustomDomain(plan) && !core.includes("Custom domain")
          ? [...core, "Custom domain"]
          : core,
        included_features: rules.filter((rule) => rule.access_type === "included").map((rule) => rule.feature_name),
        coming_soon_features: rules.filter((rule) => rule.access_type === "coming_soon").map((rule) => rule.feature_name),
        addon_features: rules.filter((rule) => rule.access_type === "paid_addon").map((rule) => rule.feature_name),
        quote_features: rules.filter((rule) => rule.access_type === "quote_required").map((rule) => rule.feature_name),
      };
    });
  return { success: true, plans, data: plans, addons: addonsResult.results };
}

export async function getThemes(database, includeInactive = false) {
  const result = await database.prepare(`
    SELECT id, name, slug, description, primary_color, accent_color, background_color,
           text_color, is_free, is_active, category, font_heading, font_body, card_style,
           gradient, border_radius, button_style, layout, sort_order
    FROM themes ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY is_free DESC, sort_order ASC, id ASC
  `).all();
  return { success: true, data: result.results, themes: result.results };
}

export async function getPlatformFeatures(database) {
  const result = await database.prepare(`
    SELECT id, slug, name, description, category, status, sort_order, created_at, updated_at
    FROM platform_features ORDER BY sort_order ASC, id ASC
  `).all();
  return { success: true, data: result.results, features: result.results };
}

export async function getFeaturePlanRules(database) {
  const result = await database.prepare(`
    SELECT fpr.id, fpr.feature_id, fpr.plan_id, fpr.access_type,
           pf.slug AS feature_slug, pf.name AS feature_name, p.slug AS plan_slug, p.name AS plan_name
    FROM feature_plan_rules fpr
    JOIN platform_features pf ON pf.id = fpr.feature_id
    JOIN plans p ON p.id = fpr.plan_id
    ORDER BY pf.sort_order ASC, p.id ASC
  `).all();
  return { success: true, data: result.results, rules: result.results };
}

export async function getLegalPolicies(database) {
  const result = await database.prepare(`
    SELECT id, key, title, content, version, is_active, last_updated
    FROM legal_policies WHERE is_active = 1 ORDER BY id ASC
  `).all();
  return { success: true, data: result.results, policies: result.results };
}

export async function getPublicSettings(database) {
  const result = await database.prepare(`
    SELECT key, value FROM admin_settings
    WHERE key IN (
      'site_name', 'site_tagline', 'platform_name', 'platform_tagline',
      'platform_description', 'platform_url', 'master_brand_name', 'master_brand_url',
      'support_email', 'legal_company_name', 'legal_company_number'
    )
    ORDER BY key ASC
  `).all();
  return {
    success: true,
    data: Object.fromEntries(result.results.map((row) => [row.key, row.value])),
  };
}

const PLAN_MUTABLE = [
  "name", "slug", "price_monthly", "price_yearly", "max_profiles", "max_org_profiles",
  "max_links", "max_seats", "max_themes", "has_qr_download", "has_contact_form",
  "has_advanced_analytics", "has_vcard_download", "has_custom_themes",
  "has_profile_link_customisation", "remove_branding", "has_messaging", "has_lifetime",
  "is_active", "is_public", "stripe_product_id", "stripe_price_monthly",
  "stripe_price_yearly", "stripe_price_lifetime",
];

function mutableEntries(body, fields) {
  return fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
    .map((field) => [field, typeof body[field] === "boolean" ? Number(body[field]) : body[field]]);
}

export async function createPlan(request, database, admin) {
  const body = await readJson(request);
  const entries = mutableEntries(body, PLAN_MUTABLE);
  if (!entries.some(([field]) => field === "name") || !entries.some(([field]) => field === "slug")) {
    throw new HttpError(400, "Plan name and slug are required.", "validation_error");
  }
  const columns = entries.map(([field]) => `"${field}"`);
  const placeholders = entries.map((_, index) => `?${index + 1}`);
  const result = await database.prepare(`
    INSERT INTO plans (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *
  `).bind(...entries.map(([, value]) => value)).first();
  await writeAudit(database, request, admin, "create", "plan", `Created plan ${result.id}`);
  return { success: true, data: result };
}

export async function updatePlan(request, database, admin, id) {
  const body = await readJson(request);
  const entries = mutableEntries(body, PLAN_MUTABLE);
  if (!entries.length) throw new HttpError(400, "No supported plan fields supplied.", "validation_error");
  const assignments = entries.map(([field], index) => `"${field}" = ?${index + 1}`);
  const result = await database.prepare(`
    UPDATE plans SET ${assignments.join(", ")} WHERE id = ?${entries.length + 1} RETURNING *
  `).bind(...entries.map(([, value]) => value), id).first();
  if (!result) throw new HttpError(404, "Plan not found.", "plan_not_found");
  await writeAudit(database, request, admin, "update", "plan", `Updated plan ${id}`);
  return { success: true, data: result };
}

export async function deactivatePlan(request, database, admin, id) {
  const result = await database.prepare(`
    UPDATE plans SET is_active = 0 WHERE id = ?1 RETURNING id
  `).bind(id).first();
  if (!result) throw new HttpError(404, "Plan not found.", "plan_not_found");
  await writeAudit(database, request, admin, "deactivate", "plan", `Deactivated plan ${id}`);
  return { success: true };
}
