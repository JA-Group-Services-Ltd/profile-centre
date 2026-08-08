-- Sousa Murray Profiles — Cloudflare for SaaS custom-domain support
-- Keeps the existing custom_domains table and extends it with Cloudflare identifiers
-- and validation state. Historical disconnected rows are retained for auditability.

ALTER TABLE custom_domains ADD COLUMN cloudflare_hostname_id TEXT;
ALTER TABLE custom_domains ADD COLUMN cloudflare_route_id TEXT;
ALTER TABLE custom_domains ADD COLUMN cname_target TEXT;
ALTER TABLE custom_domains ADD COLUMN ownership_verification_json TEXT;
ALTER TABLE custom_domains ADD COLUMN ssl_validation_json TEXT;
ALTER TABLE custom_domains ADD COLUMN last_checked_at DATETIME;

-- The legacy unique index prevented a disconnected hostname from ever being used again.
DROP INDEX IF EXISTS idx_custom_domains_domain;

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_active_domain
  ON custom_domains(lower(domain))
  WHERE removed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_active_profile
  ON custom_domains(profile_id)
  WHERE profile_id IS NOT NULL AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_custom_domains_cloudflare_hostname
  ON custom_domains(cloudflare_hostname_id);
