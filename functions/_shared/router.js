import {
  errorResponse,
  HttpError,
  json,
  methodNotAllowed,
  notFound,
  readJson,
  withRequestId,
} from "./http.js";
import { destroySession, requireAdmin, requireUser } from "./auth.js";
import {
  createPlan,
  deactivatePlan,
  getFeaturePlanRules,
  getLegalPolicies,
  getPlans,
  getPlatformFeatures,
  getPublicSettings,
  getThemes,
  updatePlan,
} from "./catalogue.js";
import {
  createProfile,
  createLink,
  deleteLink,
  deleteProfile,
  getLinks,
  getMyProfiles,
  getPublicProfile,
  reorderLinks,
  setPublished,
  updateLink,
  updateProfile,
} from "./profiles.js";
import { writeAudit } from "./audit.js";
import { accountClosure, dataRequests } from "./account.js";
import {
  businessCardsEnabled,
  createBusinessCardOrder,
  myBusinessCardOrders,
} from "./business-cards.js";
import {
  adminPinHeartbeat,
  adminPinStatus,
  clearAdminPin,
  resetAdminPinLockout,
  setAdminPin,
  verifyAdminPin,
} from "./admin-pin.js";
import { getBranchSecurityState, processHeadOfficeCommands } from "./head-office.js";

function integer(value, name = "id") {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) {
    throw new HttpError(400, `${name} must be a positive integer.`, "validation_error");
  }
  return result;
}

function routeParts(context) {
  const path = context.params?.path;
  if (Array.isArray(path)) {
    const parts = path.filter(Boolean);
    return parts[0] === "api" ? parts.slice(1) : parts;
  }
  if (typeof path === "string") {
    const parts = path.split("/").filter(Boolean);
    return parts[0] === "api" ? parts.slice(1) : parts;
  }
  const pathname = new URL(context.request.url).pathname;
  return pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
}

async function currentUserResponse(database, user) {
  const row = await database.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.plan_id, u.lifetime_access, u.created_at,
           COALESCE(u.is_paused, 0) AS is_paused, u.pause_reason,
           u.account_status, u.appearance_preference, u.customer_number,
           p.name AS plan_name, p.slug AS plan_slug, p.has_messaging, p.max_seats,
           COALESCE(p.max_org_profiles, 0) AS max_org_profiles,
           s.status AS subscription_status, s.billing_interval, s.current_period_end
    FROM users u
    LEFT JOIN plans p ON p.id = u.plan_id
    LEFT JOIN subscriptions s
      ON s.user_id = u.id AND s.status NOT IN ('incomplete_expired')
    WHERE u.id = ?1
    ORDER BY s.started_at DESC
    LIMIT 1
  `).bind(user.id).first();
  if (!row) throw new HttpError(401, "User not found.", "authentication_required");
  return { success: true, data: { user: row } };
}

async function subscriptions(database, userId) {
  const result = await database.prepare(`
    SELECT s.id, s.user_id, s.plan_id, s.status, s.billing_interval,
           s.current_period_start, s.current_period_end, s.started_at,
           s.expires_at, s.cancelled_at, p.name AS plan_name, p.slug AS plan_slug
    FROM subscriptions s
    LEFT JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ?1
    ORDER BY s.started_at DESC, s.id DESC
  `).bind(userId).all();
  return {
    success: true,
    data: result.results,
    subscriptions: result.results,
    active: result.results.find((subscription) =>
      ["active", "trialing", "past_due"].includes(subscription.status)) ?? null,
  };
}

async function preferences(request, database, user, method) {
  if (method === "GET") {
    const row = await database.prepare(`
      SELECT preferences, email_notification_prefs, appearance_preference
      FROM users WHERE id = ?1
    `).bind(user.id).first();
    const parse = (value, fallback) => {
      try {
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      success: true,
      data: {
        preferences: parse(row?.preferences, {}),
        email_notification_prefs: parse(row?.email_notification_prefs, {}),
        appearance_preference: row?.appearance_preference ?? "dark",
      },
    };
  }
  const body = await readJson(request);
  const fields = [];
  const values = [];
  for (const field of ["preferences", "email_notification_prefs", "appearance_preference"]) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    fields.push(`"${field}" = ?${values.length + 1}`);
    values.push(typeof body[field] === "object" ? JSON.stringify(body[field]) : body[field]);
  }
  if (!fields.length) throw new HttpError(400, "No supported preference fields supplied.", "validation_error");
  values.push(user.id);
  await database.prepare(`
    UPDATE users SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?${values.length}
  `).bind(...values).run();
  await writeAudit(database, request, user, "update", "account_preferences", "Updated account preferences");
  return { success: true };
}

async function adminUsers(database, url) {
  const search = (url.searchParams.get("search") ?? "").trim();
  const role = (url.searchParams.get("role") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 250);
  const clauses = [];
  const values = [];
  if (search) {
    clauses.push(`(lower(u.name) LIKE ?${values.length + 1} OR lower(u.email) LIKE ?${values.length + 1} OR u.customer_number LIKE ?${values.length + 1})`);
    values.push(`%${search.toLowerCase()}%`);
  }
  if (role) {
    clauses.push(`u.role = ?${values.length + 1}`);
    values.push(role);
  }
  values.push(limit);
  const result = await database.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.plan_id, u.account_status, u.is_paused,
           u.is_blocked, u.created_at, u.last_login_at, u.customer_number,
           p.name AS plan_name, p.slug AS plan_slug
    FROM users u LEFT JOIN plans p ON p.id = u.plan_id
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY u.created_at DESC, u.id DESC LIMIT ?${values.length}
  `).bind(...values).all();
  return { success: true, data: result.results, users: result.results };
}

async function adminProfiles(database) {
  const result = await database.prepare(`
    SELECT p.id, p.user_id, p.username, p.display_name, p.profile_type,
           p.is_published, p.is_verified, p.is_suspended, p.is_hidden,
           p.created_at, p.updated_at, u.email AS user_email, u.name AS user_name
    FROM profiles p JOIN users u ON u.id = p.user_id
    ORDER BY p.updated_at DESC, p.id DESC
  `).all();
  return { success: true, data: result.results, profiles: result.results };
}

async function adminAudit(database, url) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 250);
  const result = await database.prepare(`
    SELECT id, actor_id, actor_name, actor_email, actor_type, action, resource_type,
           resource_id, details, result, created_at
    FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?1
  `).bind(limit).all();
  return { success: true, data: result.results, audit_log: result.results };
}

async function optionalRows(database, sql, ...values) {
  try {
    const result = await database.prepare(sql).bind(...values).all();
    return result.results ?? [];
  } catch {
    return [];
  }
}

async function adminCrmUser(database, userId) {
  const user = await database.prepare(`
    SELECT u.id,u.email,u.name,u.role,u.phone,u.plan_id,u.lifetime_access,u.created_at,
           u.last_login_at,u.is_paused,u.pause_reason,u.account_status,u.customer_number,
           u.marketing_consent,u.marketing_consent_at,u.terms_consent,u.terms_consent_at,
           u.privacy_consent,u.privacy_consent_at,u.updates_consent,u.updates_consent_at,
           u.data_improve_consent,u.data_improve_consent_at,u.crm_consent,u.crm_consent_at,
           u.consent_ip,u.consent_version,
           p.name AS plan_name,p.slug AS plan_slug,p.max_seats,p.has_messaging,
           p.price_monthly,p.max_profiles,p.max_links,
           s.status AS subscription_status,s.billing_interval,s.current_period_start,
           s.current_period_end
    FROM users u
    LEFT JOIN plans p ON p.id=u.plan_id
    LEFT JOIN subscriptions s ON s.user_id=u.id
      AND s.status NOT IN ('incomplete_expired','cancelled')
    WHERE u.id=?1
    ORDER BY s.started_at DESC LIMIT 1
  `).bind(userId).first();
  if (!user) throw new HttpError(404, "User not found.", "user_not_found");

  const [profiles, subscriptions, supportRequests, dataRequests, adminNotes, auditEntries,
    enquiries, issueReports, complaints, visitorReports] = await Promise.all([
    optionalRows(database, `
      SELECT p.id,p.username,p.display_name,p.profile_type,p.is_published,p.biz_slug,
             p.person_slug,p.created_at,p.updated_at,b.business_name
      FROM profiles p LEFT JOIN profile_business_details b ON b.id=p.id
      WHERE p.user_id=?1 ORDER BY p.updated_at DESC,p.id DESC
    `, userId),
    optionalRows(database, `
      SELECT s.*,p.name AS plan_name,p.slug AS plan_slug FROM subscriptions s
      LEFT JOIN plans p ON p.id=s.plan_id WHERE s.user_id=?1
      ORDER BY s.started_at DESC,s.id DESC
    `, userId),
    optionalRows(database, "SELECT * FROM support_requests WHERE user_id=?1 ORDER BY created_at DESC", userId),
    optionalRows(database, "SELECT * FROM data_requests WHERE user_id=?1 ORDER BY created_at DESC", userId),
    optionalRows(database, "SELECT * FROM admin_user_notes WHERE user_id=?1 ORDER BY created_at DESC", userId),
    optionalRows(database, `
      SELECT id,actor_id,actor_name,actor_email,actor_type,action,resource_type,
             resource_id,details,result,created_at FROM audit_log
      WHERE actor_id=?1 OR (resource_type='user' AND resource_id=CAST(?1 AS TEXT))
      ORDER BY created_at DESC,id DESC LIMIT 250
    `, userId),
    optionalRows(database, "SELECT * FROM contact_enquiries WHERE user_id=?1 ORDER BY created_at DESC", userId),
    optionalRows(database, "SELECT * FROM issue_reports WHERE user_id=?1 ORDER BY created_at DESC", userId),
    optionalRows(database, "SELECT * FROM complaints WHERE user_id=?1 ORDER BY created_at DESC", userId),
    optionalRows(database, "SELECT * FROM visitor_reports WHERE user_id=?1 ORDER BY created_at DESC", userId),
  ]);
  const linkCountRow = await database.prepare(`
    SELECT COUNT(*) count FROM profile_links l JOIN profiles p ON p.id=l.profile_id
    WHERE p.user_id=?1
  `).bind(userId).first();
  const consent = {
    terms_consent: user.terms_consent, terms_consent_at: user.terms_consent_at,
    privacy_consent: user.privacy_consent, privacy_consent_at: user.privacy_consent_at,
    marketing_consent: user.marketing_consent, marketing_consent_at: user.marketing_consent_at,
    updates_consent: user.updates_consent, updates_consent_at: user.updates_consent_at,
    data_improve_consent: user.data_improve_consent, data_improve_consent_at: user.data_improve_consent_at,
    crm_consent: user.crm_consent, crm_consent_at: user.crm_consent_at,
    consent_ip: user.consent_ip, consent_version: user.consent_version,
  };
  return {
    user,
    profiles,
    linkCount: Number(linkCountRow?.count ?? 0),
    subscriptions,
    subscriptionHistory: subscriptions,
    supportRequests,
    dataRequests,
    adminNotes,
    auditEntries,
    enquiryCount: enquiries.length,
    enquiries,
    supportPin: null,
    featureOverrides: [],
    allFeatures: [],
    issueReports,
    complaints,
    consent,
    visitorReports,
    directMessages: [],
  };
}

async function adminSettings(request, database, admin, method) {
  if (method === "GET") {
    const result = await database.prepare(`
      SELECT id, key, value, updated_at FROM admin_settings ORDER BY key ASC
    `).all();
    return {
      success: true,
      data: Object.fromEntries(result.results.map((row) => [row.key, row.value])),
      settings: result.results,
    };
  }
  const body = await readJson(request);
  const entries = Object.entries(body.settings ?? body)
    .filter(([key, value]) => /^[a-z0-9_]{1,80}$/i.test(key) && typeof value !== "object");
  if (!entries.length) throw new HttpError(400, "No valid settings supplied.", "validation_error");
  await database.batch(entries.map(([key, value]) => database.prepare(`
    INSERT INTO admin_settings (key, value, updated_at)
    VALUES (?1, ?2, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(key, value == null ? null : String(value))));
  await writeAudit(database, request, admin, "update", "settings", `Updated ${entries.length} setting(s)`);
  return { success: true };
}

async function dispatch(context, requestId) {
  if (!context.env.DB) throw new HttpError(503, "D1 binding DB is not configured.", "database_not_configured");
  const request = context.request;
  const method = request.method.toUpperCase();
  const parts = routeParts(context);
  const path = `/${parts.join("/")}`;
  const url = new URL(request.url);
  const database = context.env.DB;

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "access-control-allow-origin": url.origin,
        "access-control-max-age": "600",
      },
    });
  }

  if (path === "/plans") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getPlans(database, url.searchParams.get("include_lifetime") === "1"));
  }
  if (path === "/themes") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getThemes(database));
  }
  if (path === "/platform-features") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getPlatformFeatures(database));
  }
  if (path === "/feature-plan-rules") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getFeaturePlanRules(database));
  }
  if (path === "/legal-policies") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getLegalPolicies(database));
  }
  if (path === "/public-settings") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getPublicSettings(database));
  }
  if (path === "/business-cards/feature-flag") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json({ enabled: await businessCardsEnabled(database) });
  }
  const publicProfileMatch = path.match(/^\/profiles\/([^/]+)\/public$/);
  if (publicProfileMatch) {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    return json(await getPublicProfile(database, decodeURIComponent(publicProfileMatch[1])));
  }

  if (path === "/auth/me") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await currentUserResponse(database, user));
  }
  if (path === "/auth/admin/me") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    const { user } = await requireAdmin(request, database);
    return json({ success: true, data: { user } });
  }
  if (path === "/auth/logout") {
    if (!["GET", "POST"].includes(method)) return methodNotAllowed(["GET", "POST"], requestId);
    return json({ success: true }, 200, { "set-cookie": await destroySession(request, database) });
  }

  if (path.startsWith("/admin/pin/")) {
    const { session, user: admin } = await requireAdmin(request, database);
    if (path === "/admin/pin/status") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await adminPinStatus(database, session, admin));
    }
    if (path === "/admin/pin/set") {
      if (method !== "POST") return methodNotAllowed(["POST"], requestId);
      return json(await setAdminPin(request, database, session, admin, await readJson(request)));
    }
    if (path === "/admin/pin/verify") {
      if (method !== "POST") return methodNotAllowed(["POST"], requestId);
      const result = await verifyAdminPin(request, database, session, admin, await readJson(request));
      return json(result.body, result.status);
    }
    if (path === "/admin/pin/heartbeat") {
      if (method !== "POST") return methodNotAllowed(["POST"], requestId);
      const result = await adminPinHeartbeat(database, session);
      return json(result.body, result.status);
    }
    if (path === "/admin/pin/clear") {
      if (method !== "POST") return methodNotAllowed(["POST"], requestId);
      return json(await clearAdminPin(database, session));
    }
    if (path === "/admin/pin/reset-lockout") {
      if (method !== "POST") return methodNotAllowed(["POST"], requestId);
      return json(await resetAdminPinLockout(request, database, admin));
    }
  }

  if (path === "/profiles/me") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await getMyProfiles(database, user.id));
  }
  if (path === "/profiles") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await createProfile(request, database, user), 201);
  }
  const profileMatch = path.match(/^\/profiles\/(\d+)$/);
  if (profileMatch) {
    const { user } = await requireUser(request, database, context.env);
    const profileId = integer(profileMatch[1], "profile ID");
    if (["PUT", "PATCH"].includes(method)) {
      return json(await updateProfile(request, database, user, profileId));
    }
    if (method === "DELETE") return json(await deleteProfile(request, database, user, profileId));
    return methodNotAllowed(["PUT", "PATCH", "DELETE"], requestId);
  }
  const publishMatch = path.match(/^\/profiles\/(\d+)\/(publish|unpublish)$/);
  if (publishMatch) {
    if (!["POST", "PATCH", "PUT"].includes(method)) {
      return methodNotAllowed(["POST", "PATCH", "PUT"], requestId);
    }
    const { user } = await requireUser(request, database, context.env);
    return json(await setPublished(
      request, database, user, integer(publishMatch[1], "profile ID"), publishMatch[2] === "publish",
    ));
  }
  if (path === "/links") {
    if (method !== "POST") return methodNotAllowed(["POST"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await createLink(request, database, user), 201);
  }
  if (path === "/links/reorder") {
    if (method !== "PUT") return methodNotAllowed(["PUT"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await reorderLinks(request, database, user));
  }
  const linksMatch = path.match(/^\/links\/(\d+)$/);
  if (linksMatch) {
    const { user } = await requireUser(request, database, context.env);
    const id = integer(linksMatch[1]);
    if (method === "GET") return json(await getLinks(database, user.id, id));
    if (["PUT", "PATCH"].includes(method)) return json(await updateLink(request, database, user, id));
    if (method === "DELETE") return json(await deleteLink(request, database, user, id));
    return methodNotAllowed(["GET", "PUT", "PATCH", "DELETE"], requestId);
  }
  if (path === "/subscriptions") {
    if (method !== "GET") return methodNotAllowed(["GET"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await subscriptions(database, user.id));
  }
  if (path === "/business-cards") {
    if (!["GET", "POST"].includes(method)) return methodNotAllowed(["GET", "POST"], requestId);
    const { user } = await requireUser(request, database, context.env);
    if (method === "GET") return json(await myBusinessCardOrders(database, user));
    return json(await createBusinessCardOrder(request, database, user), 201);
  }
  if (path === "/account/closure-request") {
    if (!["GET", "POST", "DELETE"].includes(method)) {
      return methodNotAllowed(["GET", "POST", "DELETE"], requestId);
    }
    const { user } = await requireUser(request, database, context.env);
    return json(await accountClosure(request, database, user, method));
  }
  if (path === "/me/data-requests") {
    if (!["GET", "POST"].includes(method)) return methodNotAllowed(["GET", "POST"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await dataRequests(request, database, user, method), method === "POST" ? 201 : 200);
  }
  if (["/users/me/preferences", "/account/settings"].includes(path)) {
    if (!["GET", "PUT", "PATCH"].includes(method)) return methodNotAllowed(["GET", "PUT", "PATCH"], requestId);
    const { user } = await requireUser(request, database, context.env);
    return json(await preferences(request, database, user, method));
  }

  if (path.startsWith("/admin/")) {
    const { user: admin } = await requireAdmin(request, database);
    if (path === "/admin/head-office/commands/sync") {
      if (method !== "POST") return methodNotAllowed(["POST"], requestId);
      return json({ success: true, data: await processHeadOfficeCommands(context.env) });
    }
    const crmUserMatch = path.match(/^\/admin\/crm\/users\/(\d+)$/);
    if (crmUserMatch) {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json({ success: true, data: await adminCrmUser(
        database,
        integer(crmUserMatch[1], "user ID"),
      ) });
    }
    const securityMatch = path.match(/^\/admin\/users\/(\d+)\/head-office-security$/);
    if (securityMatch) {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      const customer = await database.prepare(`
        SELECT id, customer_number, head_office_link_status
        FROM users WHERE id=?1 LIMIT 1
      `).bind(integer(securityMatch[1], "user ID")).first();
      if (!customer) throw new HttpError(404, "User not found.", "user_not_found");
      return json({ success: true, data: await getBranchSecurityState(context.env, customer.customer_number) });
    }
    if (path === "/admin/plans") {
      if (method === "GET") return json(await getPlans(database, true, true));
      if (method === "POST") return json(await createPlan(request, database, admin), 201);
      return methodNotAllowed(["GET", "POST"], requestId);
    }
    const adminPlanMatch = path.match(/^\/admin\/plans\/(\d+)$/);
    if (adminPlanMatch) {
      const id = integer(adminPlanMatch[1], "plan ID");
      if (["PUT", "PATCH"].includes(method)) return json(await updatePlan(request, database, admin, id));
      if (method === "DELETE") return json(await deactivatePlan(request, database, admin, id));
      return methodNotAllowed(["PUT", "PATCH", "DELETE"], requestId);
    }
    if (path === "/admin/themes") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await getThemes(database, true));
    }
    if (path === "/admin/features") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await getPlatformFeatures(database));
    }
    if (path === "/admin/feature-plan-rules") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await getFeaturePlanRules(database));
    }
    if (path === "/admin/users") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await adminUsers(database, url));
    }
    if (path === "/admin/profiles") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await adminProfiles(database));
    }
    if (path === "/admin/audit") {
      if (method !== "GET") return methodNotAllowed(["GET"], requestId);
      return json(await adminAudit(database, url));
    }
    if (path === "/admin/settings") {
      if (!["GET", "PUT", "PATCH"].includes(method)) return methodNotAllowed(["GET", "PUT", "PATCH"], requestId);
      return json(await adminSettings(request, database, admin, method));
    }
  }

  return notFound(requestId);
}

export async function handleApiRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    return withRequestId(await dispatch(context, requestId), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
