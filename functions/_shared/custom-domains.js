import { HttpError } from "./http.js";
import { writeAudit } from "./audit.js";
import {
  cloudflareSaasConfig,
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostname,
  restartCustomHostnameValidation,
} from "./cloudflare-saas.js";

const RESERVED_SUFFIXES = [
  ".jagroupservices.co.uk",
  ".pages.dev",
  ".workers.dev",
];

const UK_SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "ac.uk", "gov.uk", "sch.uk",
]);

// Product decision: Custom Domains are available only on these four tiers.
// This is enforced server-side even if a plan record is edited incorrectly later.
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

function asInt(value, label = "ID") {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) {
    throw new HttpError(400, `${label} must be a positive integer.`, "validation_error");
  }
  return result;
}

function serialise(value) {
  return value == null ? null : JSON.stringify(value);
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalisePlan(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function planAllowsCustomDomain(row) {
  const slug = normalisePlan(row?.plan_slug ?? row?.slug);
  const name = String(row?.plan_name ?? row?.name ?? "").trim().toLowerCase();
  return CUSTOM_DOMAIN_PLAN_SLUGS.has(slug) || CUSTOM_DOMAIN_PLAN_NAMES.has(name);
}

export function normaliseCustomHostname(input) {
  let value = String(input ?? "").trim().toLowerCase();
  if (!value) throw new HttpError(400, "Enter a custom domain.", "custom_domain_required");

  if (value.includes("://")) {
    try { value = new URL(value).hostname.toLowerCase(); }
    catch { throw new HttpError(400, "Enter only a valid hostname, such as profile.example.co.uk.", "custom_domain_invalid"); }
  }
  value = value.split("/")[0].split(":")[0].replace(/\.$/, "");

  if (value.length > 253 || value.includes("*") || !value.includes(".")) {
    throw new HttpError(400, "Enter a valid subdomain, such as profile.example.co.uk.", "custom_domain_invalid");
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value === "localhost") {
    throw new HttpError(400, "IP addresses and local hostnames cannot be connected.", "custom_domain_invalid");
  }
  if (!value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new HttpError(400, "The custom domain contains invalid characters.", "custom_domain_invalid");
  }
  if (value === "jagroupservices.co.uk" || RESERVED_SUFFIXES.some((suffix) => value.endsWith(suffix))) {
    throw new HttpError(400, "JA Group Services and Cloudflare platform hostnames cannot be claimed as customer domains.", "custom_domain_reserved");
  }

  // V1 deliberately supports customer subdomains. Root/apex domains need provider-specific
  // CNAME flattening or Cloudflare Apex Proxying and are not offered by this workflow.
  const labels = value.split(".");
  const lastTwo = labels.slice(-2).join(".");
  if (labels.length < 3 || (UK_SECOND_LEVEL_SUFFIXES.has(lastTwo) && labels.length < 4)) {
    throw new HttpError(
      400,
      "Use a subdomain such as profile.example.com or profile.example.co.uk. Root domains are not supported yet.",
      "custom_domain_subdomain_required",
    );
  }
  return value;
}

async function tableColumns(database, table) {
  try {
    const result = await database.prepare(`PRAGMA table_info(${table})`).all();
    return new Set((result.results ?? []).map((row) => row.name));
  } catch {
    return new Set();
  }
}

async function addColumnIfMissing(database, columns, name, definition) {
  if (columns.has(name)) return;
  try {
    await database.prepare(`ALTER TABLE custom_domains ADD COLUMN ${name} ${definition}`).run();
    columns.add(name);
  } catch (error) {
    if (!String(error?.message ?? error).toLowerCase().includes("duplicate column")) throw error;
  }
}

export async function ensureCustomDomainSchema(database) {
  let columns = await tableColumns(database, "custom_domains");
  if (columns.size === 0) {
    await database.prepare(`
      CREATE TABLE IF NOT EXISTS custom_domains (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        profile_id INTEGER,
        domain TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_connected',
        dns_status TEXT DEFAULT 'pending',
        ssl_status TEXT DEFAULT 'pending',
        dns_verified_at DATETIME,
        ssl_activated_at DATETIME,
        activated_at DATETIME,
        failure_reason TEXT,
        suspended_at DATETIME,
        suspended_by TEXT,
        removed_at DATETIME,
        removed_by TEXT,
        admin_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        connection_method TEXT DEFAULT NULL,
        manual_approval_reason TEXT DEFAULT NULL,
        cloudflare_hostname_id TEXT,
        cloudflare_route_id TEXT,
        cname_target TEXT,
        ownership_verification_json TEXT,
        ssl_validation_json TEXT,
        last_checked_at DATETIME,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();
    columns = await tableColumns(database, "custom_domains");
  }

  await addColumnIfMissing(database, columns, "cloudflare_hostname_id", "TEXT");
  await addColumnIfMissing(database, columns, "cloudflare_route_id", "TEXT");
  await addColumnIfMissing(database, columns, "cname_target", "TEXT");
  await addColumnIfMissing(database, columns, "ownership_verification_json", "TEXT");
  await addColumnIfMissing(database, columns, "ssl_validation_json", "TEXT");
  await addColumnIfMissing(database, columns, "last_checked_at", "DATETIME");

  // Keep history, but allow a disconnected hostname to be reconnected later.
  await database.prepare("DROP INDEX IF EXISTS idx_custom_domains_domain").run();
  await database.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_active_domain
    ON custom_domains(lower(domain)) WHERE removed_at IS NULL
  `).run();
  await database.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_active_profile
    ON custom_domains(profile_id) WHERE profile_id IS NOT NULL AND removed_at IS NULL
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_custom_domains_cloudflare_hostname
    ON custom_domains(cloudflare_hostname_id)
  `).run();
}

async function entitlement(database, userId) {
  const row = await database.prepare(`
    SELECT u.id, u.plan_id, u.lifetime_access,
           p.name AS plan_name, p.slug AS plan_slug,
           COALESCE(p.has_custom_domain, 0) AS has_custom_domain
    FROM users u
    LEFT JOIN plans p ON p.id = u.plan_id
    WHERE u.id = ?1 LIMIT 1
  `).bind(userId).first();
  if (!row) throw new HttpError(404, "Customer account not found.", "user_not_found");
  return {
    allowed: planAllowsCustomDomain(row),
    plan_id: row.plan_id ?? null,
    plan_name: row.plan_name ?? null,
    plan_slug: row.plan_slug ?? null,
    configured_flag: Number(row.has_custom_domain ?? 0) === 1,
    lifetime_access: Number(row.lifetime_access ?? 0),
  };
}

function publicDomainRow(row) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    profile_id: row.profile_id == null ? null : Number(row.profile_id),
    domain: row.domain,
    status: row.status,
    dns_status: row.dns_status,
    ssl_status: row.ssl_status,
    cname_target: row.cname_target,
    ownership_verification: parseJson(row.ownership_verification_json),
    ssl_validation: parseJson(row.ssl_validation_json, []),
    failure_reason: row.failure_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    activated_at: row.activated_at,
    last_checked_at: row.last_checked_at,
    removed_at: row.removed_at,
    profile_name: row.profile_name ?? row.display_name ?? null,
    profile_username: row.profile_username ?? row.username ?? null,
    profile_type: row.profile_type ?? null,
    biz_slug: row.biz_slug ?? null,
    person_slug: row.person_slug ?? null,
  };
}

async function domainRow(database, id) {
  return database.prepare(`
    SELECT cd.*, p.display_name AS profile_name, p.username AS profile_username,
           p.profile_type, p.biz_slug, p.person_slug
    FROM custom_domains cd
    LEFT JOIN profiles p ON p.id = cd.profile_id
    WHERE cd.id = ?1 LIMIT 1
  `).bind(id).first();
}

async function updateFromSnapshot(database, id, snapshot) {
  const failure = snapshot.validation_errors?.length ? snapshot.validation_errors.join("; ") : null;
  const ready = snapshot.ready ? 1 : 0;
  await database.prepare(`
    UPDATE custom_domains
    SET status = ?1,
        dns_status = ?2,
        ssl_status = ?3,
        cname_target = COALESCE(?4, cname_target),
        ownership_verification_json = ?5,
        ssl_validation_json = ?6,
        failure_reason = ?7,
        cloudflare_hostname_id = COALESCE(?8, cloudflare_hostname_id),
        dns_verified_at = CASE WHEN ?9 = 1 THEN COALESCE(dns_verified_at, CURRENT_TIMESTAMP) ELSE dns_verified_at END,
        ssl_activated_at = CASE WHEN ?9 = 1 THEN COALESCE(ssl_activated_at, CURRENT_TIMESTAMP) ELSE ssl_activated_at END,
        activated_at = CASE WHEN ?9 = 1 THEN COALESCE(activated_at, CURRENT_TIMESTAMP) ELSE activated_at END,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?10
  `).bind(
    ready ? "active" : "pending",
    snapshot.hostname_status,
    snapshot.ssl_status,
    snapshot.cname_target,
    serialise(snapshot.ownership_verification),
    serialise(snapshot.ssl_validation),
    failure,
    snapshot.cloudflare_hostname_id,
    ready,
    id,
  ).run();
  return publicDomainRow(await domainRow(database, id));
}

async function provision(database, env, row) {
  let hostnameId = row.cloudflare_hostname_id;
  try {
    let snapshot;
    if (hostnameId) {
      snapshot = await getCustomHostname(env, hostnameId);
    } else {
      snapshot = await createCustomHostname(env, row.domain);
      hostnameId = snapshot.cloudflare_hostname_id;
    }
    return updateFromSnapshot(database, row.id, snapshot);
  } catch (error) {
    await database.prepare(`
      UPDATE custom_domains
      SET status='failed', failure_reason=?1,
          cloudflare_hostname_id=COALESCE(?2,cloudflare_hostname_id),
          last_checked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE id=?3
    `).bind(String(error?.message ?? "Cloudflare provisioning failed."), hostnameId, row.id).run();
    throw error;
  }
}

export async function listCustomerCustomDomains(database, userId) {
  await ensureCustomDomainSchema(database);
  const [access, domains, profiles] = await Promise.all([
    entitlement(database, userId),
    database.prepare(`
      SELECT cd.*, p.display_name AS profile_name, p.username AS profile_username,
             p.profile_type, p.biz_slug, p.person_slug
      FROM custom_domains cd
      LEFT JOIN profiles p ON p.id=cd.profile_id
      WHERE cd.user_id=?1 AND cd.removed_at IS NULL
      ORDER BY cd.created_at DESC, cd.id DESC
    `).bind(userId).all(),
    database.prepare(`
      SELECT id, username, display_name, profile_type, biz_slug, person_slug, is_published
      FROM profiles WHERE user_id=?1 ORDER BY updated_at DESC, id DESC
    `).bind(userId).all(),
  ]);
  return {
    success: true,
    data: (domains.results ?? []).map(publicDomainRow),
    profiles: profiles.results ?? [],
    entitlement: access,
  };
}

export async function createCustomerCustomDomain(context, user, body) {
  const database = context.env.DB;
  await ensureCustomDomainSchema(database);
  const access = await entitlement(database, user.id);
  if (!access.allowed) {
    throw new HttpError(
      403,
      "Custom Domains are available on Professional, Organisation, Ultimate Organisation and Ultimate Organisation+ plans.",
      "custom_domain_not_in_plan",
    );
  }

  // Fail before touching D1 if Cloudflare has not been configured yet.
  const config = cloudflareSaasConfig(context.env);
  const profileId = asInt(body?.profile_id, "Profile ID");
  const hostname = normaliseCustomHostname(body?.hostname ?? body?.domain);

  const profile = await database.prepare(`
    SELECT id, user_id, username, display_name, profile_type, biz_slug, person_slug
    FROM profiles WHERE id=?1 AND user_id=?2 LIMIT 1
  `).bind(profileId, user.id).first();
  if (!profile) throw new HttpError(404, "That profile does not belong to this account.", "profile_not_found");

  const existingDomain = await database.prepare(`
    SELECT id,user_id FROM custom_domains
    WHERE lower(domain)=lower(?1) AND removed_at IS NULL LIMIT 1
  `).bind(hostname).first();
  if (existingDomain) {
    throw new HttpError(409, "That custom domain is already connected to a Sousa Murray Profile.", "custom_domain_in_use");
  }
  const existingProfile = await database.prepare(`
    SELECT id,domain FROM custom_domains
    WHERE profile_id=?1 AND removed_at IS NULL LIMIT 1
  `).bind(profileId).first();
  if (existingProfile) {
    throw new HttpError(409, `This profile already uses ${existingProfile.domain}. Disconnect it first.`, "profile_custom_domain_exists");
  }

  let created;
  try {
    created = await database.prepare(`
      INSERT INTO custom_domains
        (user_id,profile_id,domain,status,dns_status,ssl_status,cname_target,connection_method,created_at,updated_at)
      VALUES (?1,?2,?3,'provisioning','pending','pending',?4,'cloudflare_saas',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *
    `).bind(user.id, profileId, hostname, config.cnameTarget).first();
  } catch (error) {
    if (String(error?.message ?? error).toLowerCase().includes("unique")) {
      throw new HttpError(409, "That custom domain or profile already has an active connection.", "custom_domain_in_use");
    }
    throw error;
  }

  const result = await provision(database, context.env, created);
  await writeAudit(
    database,
    context.request,
    user,
    "custom_domain_created",
    "custom_domain",
    JSON.stringify({ custom_domain_id: result.id, hostname, profile_id: profileId }),
  );
  return { success: true, data: result, entitlement: access };
}

async function ownedDomain(database, id, userId = null) {
  const row = await domainRow(database, asInt(id, "Custom domain ID"));
  if (!row || row.removed_at || (userId != null && Number(row.user_id) !== Number(userId))) {
    throw new HttpError(404, "Custom domain not found.", "custom_domain_not_found");
  }
  return row;
}

export async function refreshCustomerCustomDomain(context, user, id) {
  const database = context.env.DB;
  await ensureCustomDomainSchema(database);
  const access = await entitlement(database, user.id);
  if (!access.allowed) {
    throw new HttpError(403, "Your current plan no longer includes Custom Domains.", "custom_domain_not_in_plan");
  }
  const row = await ownedDomain(database, id, user.id);

  if (!row.cloudflare_hostname_id || row.status === "failed") {
    const data = await provision(database, context.env, row);
    await writeAudit(database, context.request, user, "custom_domain_retried", "custom_domain", JSON.stringify({ custom_domain_id: data.id, hostname: data.domain }));
    return { success: true, data };
  }

  let snapshot = await getCustomHostname(context.env, row.cloudflare_hostname_id);
  if (!snapshot.ready) {
    snapshot = await restartCustomHostnameValidation(context.env, row.cloudflare_hostname_id);
  }
  const data = await updateFromSnapshot(database, row.id, snapshot);
  await writeAudit(database, context.request, user, data.status === "active" ? "custom_domain_verified" : "custom_domain_checked", "custom_domain", JSON.stringify({ custom_domain_id: data.id, hostname: data.domain, status: data.status, ssl_status: data.ssl_status }));
  return { success: true, data };
}

async function removeCloudflareResources(env, row) {
  await deleteCustomHostname(env, row.cloudflare_hostname_id);
}

export async function disconnectCustomerCustomDomain(context, user, id) {
  const database = context.env.DB;
  await ensureCustomDomainSchema(database);
  const row = await ownedDomain(database, id, user.id);
  await removeCloudflareResources(context.env, row);
  await database.prepare(`
    UPDATE custom_domains
    SET status='removed', removed_at=CURRENT_TIMESTAMP, removed_by=?1,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=?2
  `).bind(user.email || String(user.id), row.id).run();
  await writeAudit(database, context.request, user, "custom_domain_disconnected", "custom_domain", JSON.stringify({ custom_domain_id: row.id, hostname: row.domain, profile_id: row.profile_id }));
  return { success: true };
}

export async function resolvePublicCustomDomain(database, hostnameInput) {
  await ensureCustomDomainSchema(database);
  let hostname;
  try { hostname = normaliseCustomHostname(hostnameInput); }
  catch { throw new HttpError(404, "Custom domain not found.", "custom_domain_not_found"); }

  const row = await database.prepare(`
    SELECT cd.id,cd.domain,cd.status,cd.ssl_status,p.id AS profile_id,p.username,
           p.display_name,p.profile_type,p.biz_slug,p.person_slug,p.is_published,
           p.is_suspended,p.is_hidden,pl.slug AS plan_slug,pl.name AS plan_name
    FROM custom_domains cd
    JOIN profiles p ON p.id=cd.profile_id
    JOIN users u ON u.id=p.user_id
    LEFT JOIN plans pl ON pl.id=u.plan_id
    WHERE lower(cd.domain)=lower(?1)
      AND cd.removed_at IS NULL
      AND cd.status='active'
      AND cd.dns_status='active'
      AND cd.ssl_status='active'
      AND p.is_published=1
      AND COALESCE(p.is_suspended,0)=0
      AND COALESCE(p.is_hidden,0)=0
    LIMIT 1
  `).bind(hostname).first();
  if (!row || !planAllowsCustomDomain(row)) {
    throw new HttpError(404, "This custom domain is not active.", "custom_domain_not_active");
  }

  let kind = "personal";
  let publicPath = `/profile/${encodeURIComponent(row.username)}`;
  if (row.profile_type === "business") {
    kind = row.person_slug ? "business_person" : "business";
    const biz = row.biz_slug || row.username;
    publicPath = row.person_slug
      ? `/profile/${encodeURIComponent(biz)}/${encodeURIComponent(row.person_slug)}`
      : `/profile/${encodeURIComponent(biz)}`;
  }

  return {
    success: true,
    data: {
      hostname: row.domain,
      profile_id: Number(row.profile_id),
      kind,
      username: row.username,
      biz_slug: row.biz_slug,
      person_slug: row.person_slug,
      public_path: publicPath,
    },
  };
}

export async function listAdminUserCustomDomains(database, userId) {
  await ensureCustomDomainSchema(database);
  const id = asInt(userId, "User ID");
  const access = await entitlement(database, id);
  const result = await database.prepare(`
    SELECT cd.*, p.display_name AS profile_name, p.username AS profile_username,
           p.profile_type,p.biz_slug,p.person_slug
    FROM custom_domains cd
    LEFT JOIN profiles p ON p.id=cd.profile_id
    WHERE cd.user_id=?1
    ORDER BY cd.created_at DESC,cd.id DESC
  `).bind(id).all();
  return { success: true, data: (result.results ?? []).map(publicDomainRow), entitlement: access };
}

export async function refreshAdminCustomDomain(context, admin, userId, domainId) {
  const database = context.env.DB;
  await ensureCustomDomainSchema(database);
  const ownerId = asInt(userId, "User ID");
  const row = await ownedDomain(database, domainId, ownerId);
  let data;
  if (!row.cloudflare_hostname_id || row.status === "failed") {
    data = await provision(database, context.env, row);
  } else {
    let snapshot = await getCustomHostname(context.env, row.cloudflare_hostname_id);
    if (!snapshot.ready) snapshot = await restartCustomHostnameValidation(context.env, row.cloudflare_hostname_id);
    data = await updateFromSnapshot(database, row.id, snapshot);
  }
  await writeAudit(database, context.request, admin, "custom_domain_admin_checked", "custom_domain", JSON.stringify({ customer_id: ownerId, custom_domain_id: data.id, hostname: data.domain, status: data.status }));
  return { success: true, data };
}

export async function disconnectAdminCustomDomain(context, admin, userId, domainId, reason = "") {
  const database = context.env.DB;
  await ensureCustomDomainSchema(database);
  const ownerId = asInt(userId, "User ID");
  const row = await ownedDomain(database, domainId, ownerId);
  await removeCloudflareResources(context.env, row);
  await database.prepare(`
    UPDATE custom_domains
    SET status='removed', removed_at=CURRENT_TIMESTAMP, removed_by=?1,
        admin_notes=CASE WHEN ?2='' THEN admin_notes ELSE ?2 END,
        updated_at=CURRENT_TIMESTAMP
    WHERE id=?3
  `).bind(admin.email || String(admin.id), String(reason ?? "").trim(), row.id).run();
  await writeAudit(database, context.request, admin, "custom_domain_admin_disconnected", "custom_domain", JSON.stringify({ customer_id: ownerId, custom_domain_id: row.id, hostname: row.domain, reason: String(reason ?? "").trim() }));
  return { success: true };
}
