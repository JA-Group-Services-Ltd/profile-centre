-- Sousa Murray Profiles — Custom Domain plan entitlement and pricing
-- Product decision:
--   Professional, Organisation, Ultimate Organisation and Ultimate Organisation+
--   include Custom Domains. Free and Starter do not.
-- Fixed monthly prices on eligible plans are increased once by £1.00.

PRAGMA foreign_keys = ON;

-- Keep the database capability flag aligned with the product decision.
UPDATE plans
SET has_custom_domain = CASE
  WHEN lower(trim(slug)) IN ('professional','business','ultimate_business','ultimate_plus') THEN 1
  WHEN lower(trim(name)) IN ('professional','organisation','ultimate organisation','ultimate organisation+') THEN 1
  ELSE 0
END;

-- Idempotent price migration. This guards against an operator accidentally
-- replaying the SQL file manually after it has already been applied.
UPDATE plans
SET price_monthly = ROUND(COALESCE(price_monthly, 0) + 1.00, 2)
WHERE COALESCE(price_monthly, 0) > 0
  AND (
    lower(trim(slug)) IN ('professional','business','ultimate_business','ultimate_plus')
    OR lower(trim(name)) IN ('professional','organisation','ultimate organisation','ultimate organisation+')
  )
  AND NOT EXISTS (
    SELECT 1 FROM app_settings WHERE key = 'custom_domain_plan_pricing_v1'
  );

INSERT OR IGNORE INTO app_settings (key, value, is_secret, updated_at)
VALUES ('custom_domain_plan_pricing_v1', 'applied', 0, CURRENT_TIMESTAMP);
