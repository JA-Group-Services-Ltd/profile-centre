-- Sousa Murray Profiles — Custom Domain product policy
--
-- Runtime code also enforces this policy before public/admin plan catalogue reads,
-- so production remains correct even when application deployment happens before a
-- manually scheduled D1 migration run.
--
-- Custom Domain entitlement:
--   Professional, Organisation, Ultimate Organisation and Ultimate Organisation+
-- Free and Starter remain excluded.

PRAGMA foreign_keys = ON;

UPDATE plans
SET has_custom_domain = CASE
  WHEN lower(trim(slug)) IN ('professional','business','ultimate_business','ultimate_plus') THEN 1
  WHEN lower(trim(name)) IN ('professional','organisation','ultimate organisation','ultimate organisation+') THEN 1
  ELSE 0
END;

-- Apply the approved monthly price update once. A zero price represents a plan
-- without a fixed self-service monthly price and is deliberately left unchanged.
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

-- The permanent runtime schema upgrader in functions/_shared/custom-domains.js
-- safely adds Cloudflare-specific columns to the existing custom_domains table.
-- These indexes use legacy columns that already exist in the production schema.
DROP INDEX IF EXISTS idx_custom_domains_domain;
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_active_domain
  ON custom_domains(lower(domain)) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_active_profile
  ON custom_domains(profile_id) WHERE profile_id IS NOT NULL AND removed_at IS NULL;
