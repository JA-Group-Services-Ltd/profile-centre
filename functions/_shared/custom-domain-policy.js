const CUSTOM_DOMAIN_PLAN_SLUGS = new Set([
  "professional",
  "business",
  "ultimate_business",
  "ultimate_plus",
]);

const CUSTOM_DOMAIN_PLAN_NAMES = new Set([
  "professional",
  "organisation",
  "ultimate organisation",
  "ultimate organisation+",
]);

export function normalisePlanKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function planAllowsCustomDomain(row) {
  const slug = normalisePlanKey(row?.plan_slug ?? row?.slug);
  const name = String(row?.plan_name ?? row?.name ?? "").trim().toLowerCase();
  return CUSTOM_DOMAIN_PLAN_SLUGS.has(slug) || CUSTOM_DOMAIN_PLAN_NAMES.has(name);
}

/**
 * Keeps the D1 plan catalogue aligned with the approved Custom Domain product policy.
 *
 * The feature flag is enforced on every call. The price uplift is guarded by an
 * app_settings marker and executed in a D1 batch, so concurrent first requests cannot
 * apply it more than once. Zero/custom-quote prices are left untouched.
 */
export async function ensureCustomDomainPlanPolicy(database) {
  if (!database?.prepare) return;

  await database.prepare(`
    UPDATE plans
    SET has_custom_domain = CASE
      WHEN lower(trim(slug)) IN ('professional','business','ultimate_business','ultimate_plus') THEN 1
      WHEN lower(trim(name)) IN ('professional','organisation','ultimate organisation','ultimate organisation+') THEN 1
      ELSE 0
    END
  `).run();

  const marker = await database.prepare(`
    SELECT value FROM app_settings WHERE key='custom_domain_plan_pricing_v1' LIMIT 1
  `).first();
  if (marker?.value === 'applied') return;

  const priceUpdate = database.prepare(`
    UPDATE plans
    SET price_monthly = ROUND(COALESCE(price_monthly, 0) + 1.00, 2)
    WHERE COALESCE(price_monthly, 0) > 0
      AND (
        lower(trim(slug)) IN ('professional','business','ultimate_business','ultimate_plus')
        OR lower(trim(name)) IN ('professional','organisation','ultimate organisation','ultimate organisation+')
      )
      AND NOT EXISTS (
        SELECT 1 FROM app_settings WHERE key='custom_domain_plan_pricing_v1'
      )
  `);
  const markerInsert = database.prepare(`
    INSERT OR IGNORE INTO app_settings (key,value,is_secret,updated_at)
    VALUES ('custom_domain_plan_pricing_v1','applied',0,CURRENT_TIMESTAMP)
  `);

  if (typeof database.batch === 'function') {
    await database.batch([priceUpdate, markerInsert]);
  } else {
    // Production D1 exposes batch(); this fallback keeps lightweight test adapters usable.
    await priceUpdate.run();
    await markerInsert.run();
  }
}
