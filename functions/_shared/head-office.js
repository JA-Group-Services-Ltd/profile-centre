import { HttpError } from "./http.js";

const PLATFORM_CODE = "PROFILE_CENTRE";
const DEGRADED_ALLOW_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_SETTING_KEY = "head_office_last_heartbeat_at";
const ALLOWED_DECISIONS = new Set(["allow", "deny", "review", "step_up"]);

function configured(env) {
  return Boolean(env.HEAD_OFFICE_API_BASE_URL && env.HEAD_OFFICE_PLATFORM_KEY);
}

function endpoint(env, path) {
  return new URL(path, `${String(env.HEAD_OFFICE_API_BASE_URL).replace(/\/+$/, "")}/`).toString();
}

export async function requestHeadOffice(env, path, init = {}) {
  if (!configured(env)) {
    throw new HttpError(503, "Head Office security authority is not configured.", "head_office_not_configured");
  }
  const response = await fetch(endpoint(env, path), {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.HEAD_OFFICE_PLATFORM_KEY}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code || payload?.code || "head_office_request_failed";
    const error = new HttpError(response.status >= 500 ? 503 : response.status,
      "Head Office could not authorise this customer request.", code);
    error.headOfficeStatus = response.status;
    throw error;
  }
  return payload;
}

function safeJson(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

export async function reportPlatformHeartbeat(env, options = {}) {
  if (!configured(env) || !env.DB) return { skipped: true, reason: "not_configured" };
  const force = options.force === true;
  const lastHeartbeat = await env.DB.prepare(
    "SELECT value FROM app_settings WHERE key=?1 LIMIT 1",
  ).bind(HEARTBEAT_SETTING_KEY).first();
  const lastSentAt = Date.parse(lastHeartbeat?.value || "");
  if (!force && Number.isFinite(lastSentAt) && Date.now() - lastSentAt < HEARTBEAT_INTERVAL_MS) {
    return { skipped: true, reason: "fresh" };
  }

  const now = new Date().toISOString();
  const [customerRow, sessionRow, errorRow, stripeRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM users WHERE customer_number IS NOT NULL AND TRIM(customer_number)<>''").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM sessions WHERE expires_at>?1")
      .bind(Date.now()).first(),
    env.DB.prepare(`
      SELECT COUNT(*) count FROM users
      WHERE head_office_connector_error IS NOT NULL AND TRIM(head_office_connector_error)<>''
    `).first(),
    env.DB.prepare("SELECT value FROM app_settings WHERE key='stripe_production_verified_at' LIMIT 1").first(),
  ]);
  const branch = String(env.CF_PAGES_BRANCH || "");
  const environment = !branch || branch === "main" ? "production" : "preview";
  const result = await requestHeadOffice(env, "/api/platform/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      healthStatus: "operational",
      healthMessage: "Sousa Murray Profiles connector is responding normally.",
      publicUrl: environment === "production"
        ? "https://sousamurrayprofiles.jagroupservices.co.uk/"
        : env.CF_PAGES_URL || null,
      environment,
      hostingProvider: "Cloudflare Pages",
      releaseVersion: env.CF_PAGES_COMMIT_SHA || null,
      releaseCommit: env.CF_PAGES_COMMIT_SHA || null,
      customerCount: Number(customerRow?.count || 0),
      activeSessionCount: Number(sessionRow?.count || 0),
      openErrorCount: Number(errorRow?.count || 0),
      capabilities: ["customer-sync", "ucn", "access-decisions", "security-commands", "events"],
      integrations: {
        headOfficeCustomerAuthority: true,
        microsoftEntraExternalId: true,
        stripe: Boolean(stripeRow?.value),
      },
      occurredAt: now,
      metadata: { platformCode: PLATFORM_CODE },
    }),
  });
  await env.DB.prepare(`
    INSERT INTO app_settings (key,value,is_secret,updated_at) VALUES (?1,?2,0,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_secret=0,updated_at=CURRENT_TIMESTAMP
  `).bind(HEARTBEAT_SETTING_KEY, now).run();
  return result;
}

async function reportHeartbeatWithoutBlocking(env, options = {}) {
  try {
    return await reportPlatformHeartbeat(env, options);
  } catch {
    return { queued: true };
  }
}

async function storeDecision(database, userId, customer, access, error = null) {
  const decision = String(access?.decision || access?.action || "");
  await database.prepare(`
    UPDATE users SET
      head_office_customer_id = COALESCE(?1, head_office_customer_id),
      customer_number = COALESCE(?2, customer_number),
      head_office_link_status = CASE WHEN ?1 IS NULL THEN head_office_link_status ELSE 'linked' END,
      head_office_last_synced_at = CASE WHEN ?1 IS NULL THEN head_office_last_synced_at ELSE CURRENT_TIMESTAMP END,
      head_office_access_decision = CASE WHEN ?3 = '' THEN head_office_access_decision ELSE ?3 END,
      head_office_access_decided_at = CASE WHEN ?3 = '' THEN head_office_access_decided_at ELSE CURRENT_TIMESTAMP END,
      head_office_security_status = COALESCE(?4, head_office_security_status),
      head_office_restrictions_json = CASE WHEN ?3 = '' THEN head_office_restrictions_json ELSE ?5 END,
      head_office_age_assurance_json = CASE WHEN ?3 = '' THEN head_office_age_assurance_json ELSE ?6 END,
      head_office_connector_error = ?7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?8
  `).bind(
    customer?.id || null,
    customer?.customerNumber || null,
    decision,
    customer?.securityStatus || null,
    safeJson(access?.restrictions, []),
    safeJson(access?.ageAssurance, {}),
    error,
    userId,
  ).run();
}

function enforceDecision(decision) {
  if (decision === "allow") return;
  if (decision === "deny") {
    throw new HttpError(403, "Head Office has denied access to Sousa Murray Profiles.", "head_office_access_denied");
  }
  if (decision === "step_up") {
    throw new HttpError(403, "Additional identity assurance is required before access can continue.",
      "head_office_step_up_required");
  }
  throw new HttpError(403, "Head Office review is required before access can continue.",
    "head_office_review_required");
}

export async function synchroniseCustomer(env, user, claims, tenantId, options = {}) {
  const primaryProfile = await env.DB.prepare(`SELECT id,created_at,updated_at FROM profiles
    WHERE user_id=?1 ORDER BY created_at,id LIMIT 1`).bind(user.id).first();
  const now = new Date().toISOString();
  const payload = await requestHeadOffice(env, "/api/platform/customers/upsert", {
    method: "POST",
    body: JSON.stringify({
      entraTenantId: String(claims.tid || tenantId || ""),
      entraObjectId: String(claims.oid || claims.sub || ""),
      platformCustomerId: String(user.id),
      platformPersonId: primaryProfile?.id == null ? null : String(primaryProfile.id),
      centralCustomerId: user.head_office_customer_id || null,
      customerNumber: user.customer_number || null,
      displayName: String(claims.name || user.name || user.email),
      givenName: claims.given_name || null,
      surname: claims.family_name || null,
      email: String(claims.email || claims.preferred_username || user.email).toLowerCase(),
      userPrincipalName: claims.preferred_username || null,
      accountEnabled: true,
      accountStatus: "active",
      createdAt: user.created_at || null,
      lastSignInAt: options.recordSignIn === false ? null : now,
      lastActivityAt: primaryProfile?.updated_at || now,
      secureRecordUrl: `https://sousamurrayprofiles.jagroupservices.co.uk/admin/users/${encodeURIComponent(String(user.id))}`,
      platformMetadata: { platformCode: PLATFORM_CODE, profileCount: primaryProfile ? 1 : 0 },
    }),
  });
  const access = payload?.enforcement || {};
  const decision = String(access.decision || access.action || "");
  if (!payload?.customer?.id || !payload?.customer?.customerNumber || !ALLOWED_DECISIONS.has(decision)) {
    throw new HttpError(503, "Head Office returned an invalid customer decision.", "head_office_invalid_response");
  }
  await storeDecision(env.DB, user.id, payload.customer, access);
  if (access.revokeSessions) {
    await env.DB.prepare("DELETE FROM sessions WHERE json_extract(data, '$.userId') = ?1").bind(user.id).run();
  }
  enforceDecision(decision);
  if (payload.created) {
    await sendOperationalEvent(env,{...user,customer_number:payload.customer.customerNumber,
      head_office_customer_id:payload.customer.id},"account.created",{
      outcome:"success",category:"account_lifecycle",targetType:"account",description:"Sousa Murray Profiles account linked"
    });
  }
  if (options.recordSignIn !== false) {
    await sendOperationalEvent(env,{...user,customer_number:payload.customer.customerNumber,
      head_office_customer_id:payload.customer.id},"auth.sign_in_succeeded",{
      outcome:"success",category:"security_event",targetType:"account",description:"Customer signed in successfully"
    });
  }
  await reportHeartbeatWithoutBlocking(env, { force: true });
  return payload;
}

export async function enforceCustomerAccess(env, user) {
  try {
    const payload = await requestHeadOffice(env, "/api/platform/access/decision", {
      method: "POST",
      body: JSON.stringify({
        customerNumber: user.customer_number || undefined,
        platformCustomerId: String(user.id),
      }),
    });
    const access = payload?.access || {};
    const decision = String(access.decision || "");
    if (!ALLOWED_DECISIONS.has(decision)) {
      throw new HttpError(503, "Head Office returned an invalid access decision.", "head_office_invalid_response");
    }
    await storeDecision(env.DB, user.id, payload.customer, access);
    if (access.revokeSessions) {
      await env.DB.prepare("DELETE FROM sessions WHERE json_extract(data, '$.userId') = ?1").bind(user.id).run();
    }
    enforceDecision(decision);
    await reportHeartbeatWithoutBlocking(env);
    return access;
  } catch (error) {
    if (error instanceof HttpError && [
      "head_office_access_denied", "head_office_step_up_required", "head_office_review_required",
    ].includes(error.code)) throw error;
    await storeDecision(env.DB, user.id, null, null, String(error?.code || error?.message || error).slice(0, 200));
    const decidedAt = Date.parse(user.head_office_access_decided_at || "");
    if (user.head_office_access_decision === "allow"
      && Number.isFinite(decidedAt)
      && Date.now() - decidedAt <= DEGRADED_ALLOW_WINDOW_MS) return { decision: "allow", degraded: true };
    throw new HttpError(503, "Head Office security authority is temporarily unavailable.",
      "head_office_security_unavailable");
  }
}

export async function getBranchSecurityState(env, customerNumber) {
  if (!customerNumber) {
    throw new HttpError(409, "This customer is not linked to a Head Office UCN.", "head_office_customer_not_linked");
  }
  return requestHeadOffice(env, `/api/platform/security/state?ucn=${encodeURIComponent(customerNumber)}`);
}

export async function processHeadOfficeCommands(env) {
  const payload = await requestHeadOffice(env, "/api/platform/commands");
  const commands = Array.isArray(payload?.commands) ? payload.commands : [];
  const results = [];
  for (const command of commands) {
    const existing = await env.DB.prepare(
      "SELECT status FROM head_office_command_receipts WHERE command_id=?1",
    ).bind(command.id).first();
    if (existing?.status === "acknowledged") {
      results.push({ commandId: command.id, status: "already_acknowledged" });
      continue;
    }
    const user = await env.DB.prepare(`
      SELECT id FROM users
      WHERE customer_number=?1 OR CAST(id AS TEXT)=?2 LIMIT 1
    `).bind(command.customer_number || null, command.platform_customer_id || "").first();
    await env.DB.prepare(`
      INSERT INTO head_office_command_receipts
        (command_id, command, user_id, status, payload_json)
      VALUES (?1, ?2, ?3, 'received', ?4)
      ON CONFLICT(command_id) DO NOTHING
    `).bind(command.id, command.command, user?.id || null, safeJson(command, {})).run();
    let success = true;
    let message = "Command applied idempotently.";
    try {
      if (!user) throw new Error("The linked Sousa Murray Profiles customer was not found.");
      if (String(command.command).includes("revoke") || String(command.command).includes("deny")) {
        await env.DB.prepare("DELETE FROM sessions WHERE json_extract(data, '$.userId')=?1").bind(user.id).run();
      }
      await env.DB.prepare(`
        UPDATE head_office_command_receipts
        SET status='applied', applied_at=CURRENT_TIMESTAMP, error=NULL WHERE command_id=?1
      `).bind(command.id).run();
    } catch (error) {
      success = false;
      message = String(error?.message || error).slice(0, 200);
      await env.DB.prepare(`
        UPDATE head_office_command_receipts SET status='failed', error=?1 WHERE command_id=?2
      `).bind(message, command.id).run();
    }
    await requestHeadOffice(env, `/api/platform/commands/${encodeURIComponent(command.id)}`, {
      method: "POST",
      body: JSON.stringify({ success, message }),
    });
    await env.DB.prepare(`
      UPDATE head_office_command_receipts
      SET status=?1, acknowledged_at=CURRENT_TIMESTAMP WHERE command_id=?2
    `).bind(success ? "acknowledged" : "failed", command.id).run();
    results.push({ commandId: command.id, status: success ? "acknowledged" : "failed" });
  }
  return { received: commands.length, results };
}

export async function sendOperationalEvent(env, user, eventType, payload = {}) {
  if (!user?.id) return { skipped: true, reason: "missing_user" };
  const eventId = payload.eventId || crypto.randomUUID();
  const profile = payload.profileId == null ? await env.DB.prepare(`SELECT id FROM profiles
    WHERE user_id=?1 ORDER BY created_at,id LIMIT 1`).bind(user.id).first() : { id: payload.profileId };
  const category = payload.category || (eventType.startsWith("profile.") ? "profile_management"
    : eventType.startsWith("auth.") || eventType.startsWith("security.") ? "security_event"
    : eventType.startsWith("admin.") ? "administrative_action"
    : eventType.startsWith("head_office.") ? "head_office_instruction"
    : eventType.startsWith("sync.") ? "synchronisation_event" : "account_lifecycle");
  const correlationId = payload.correlationId || crypto.randomUUID();
  const occurredAt = payload.occurredAt || new Date().toISOString();
  const eventPayload = {
    eventId,
    eventType,
    platformCode: PLATFORM_CODE,
    sourceSystem: "Sousa Murray Profiles",
    centralCustomerId: user.head_office_customer_id || null,
    customerNumber: user.customer_number || null,
    platformAccountId: String(user.id),
    platformPersonId: profile?.id == null ? null : String(profile.id),
    actorType: payload.actorType || "customer",
    actorIdentifier: payload.actorIdentifier || String(user.id),
    occurredAt,
    outcome: payload.outcome || "success",
    targetType: payload.targetType || (profile ? "profile" : "account"),
    targetReference: payload.targetReference || (profile?.id == null ? String(user.id) : String(profile.id)),
    correlationId,
    category,
    description: payload.description || null,
    summary: payload.summary || null,
    displayInTimeline: payload.displayInTimeline !== false,
    metadata: payload.metadata || {},
    session: payload.session || undefined,
  };
  await env.DB.prepare(`
    INSERT INTO head_office_event_outbox(event_id,user_id,event_type,payload_json,correlation_id,next_attempt_at)
    VALUES (?1,?2,?3,?4,?5,CURRENT_TIMESTAMP) ON CONFLICT(event_id) DO NOTHING
  `).bind(eventId,user.id,eventType,safeJson(eventPayload,{}),correlationId).run();
  try {
    const result = await requestHeadOffice(env, "/api/platform/events", {
      method: "POST",
      body: JSON.stringify(eventPayload),
    });
    await env.DB.prepare(`
      UPDATE head_office_event_outbox
      SET status='sent', attempts=attempts+1, last_attempt_at=CURRENT_TIMESTAMP,
          sent_at=CURRENT_TIMESTAMP,completed_at=CURRENT_TIMESTAMP,error=NULL WHERE event_id=?1
    `).bind(eventId).run();
    return result;
  } catch (error) {
    await env.DB.prepare(`
      UPDATE head_office_event_outbox
      SET attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP,
          next_attempt_at=datetime('now','+' || MIN(60,MAX(1,attempts+1)*5) || ' minutes'),error=?1 WHERE event_id=?2
    `).bind(String(error?.code || error?.message || error).slice(0, 200), eventId).run();
    return { queued: true };
  }
}

export async function retryOperationalEvents(env, limit = 50) {
  const pending = await env.DB.prepare(`SELECT event_id,user_id,event_type,payload_json FROM head_office_event_outbox
    WHERE status='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP)
    ORDER BY created_at LIMIT ?1`).bind(Math.max(1,Math.min(100,Number(limit)||50))).all();
  const results = [];
  for (const row of pending.results) {
    const user = await env.DB.prepare(`SELECT id,customer_number,head_office_customer_id FROM users WHERE id=?1`).bind(row.user_id).first();
    if (!user) continue;
    let original = {};
    try { original = JSON.parse(row.payload_json||"{}"); } catch {}
    results.push(await sendOperationalEvent(env,user,row.event_type,{...original,eventId:row.event_id}));
  }
  return {processed:results.length,results};
}

export async function backfillHeadOfficeCustomers(env, options = {}) {
  const runId = crypto.randomUUID();
  const limit = Math.max(1,Math.min(500,Number(options.limit)||250));
  await env.DB.prepare(`INSERT INTO head_office_sync_runs(id,run_type,status,started_at)
    VALUES (?1,'customer_backfill','running',CURRENT_TIMESTAMP)`).bind(runId).run();
  const rows = await env.DB.prepare(`SELECT id,email,name,account_status,created_at,entra_oid,customer_number,
      head_office_customer_id FROM users WHERE role='user' ORDER BY id LIMIT ?1`).bind(limit).all();
  const counts = {scanned:0,linked:0,updated:0,skipped:0,unresolved:0,failed:0};
  for (const user of rows.results) {
    counts.scanned += 1;
    const profile = await env.DB.prepare("SELECT id FROM profiles WHERE user_id=?1 ORDER BY created_at,id LIMIT 1").bind(user.id).first();
    if (!user.entra_oid) {
      counts.unresolved += 1;
      await env.DB.prepare(`INSERT INTO head_office_reconciliation_log
        (id,user_id,profile_id,outcome,reason_code,run_id) VALUES (?1,?2,?3,'unresolved','missing_immutable_identity',?4)`)
        .bind(crypto.randomUUID(),user.id,profile?.id||null,runId).run();
      continue;
    }
    try {
      const wasLinked = Boolean(user.head_office_customer_id && user.customer_number);
      const result = await synchroniseCustomer(env,user,{oid:user.entra_oid,name:user.name,email:user.email},env.OIDC_TENANT_ID,
        {recordSignIn:false});
      counts[wasLinked ? "updated" : "linked"] += 1;
      await env.DB.prepare(`INSERT INTO head_office_reconciliation_log
        (id,user_id,profile_id,outcome,central_customer_id,customer_number,run_id)
        VALUES (?1,?2,?3,?4,?5,?6,?7)`).bind(crypto.randomUUID(),user.id,profile?.id||null,
          wasLinked?"updated":"linked",result.customer.id,result.customer.customerNumber,runId).run();
    } catch (error) {
      const unresolved = error?.code === "CUSTOMER_IDENTITY_REVIEW_REQUIRED" || error?.headOfficeStatus === 409;
      counts[unresolved ? "unresolved" : "failed"] += 1;
      await env.DB.prepare(`INSERT INTO head_office_reconciliation_log
        (id,user_id,profile_id,outcome,reason_code,run_id) VALUES (?1,?2,?3,?4,?5,?6)`)
        .bind(crypto.randomUUID(),user.id,profile?.id||null,unresolved?"unresolved":"failed",
          String(error?.code||"sync_failed").slice(0,100),runId).run();
    }
  }
  await env.DB.prepare(`UPDATE head_office_sync_runs SET status='completed',scanned_count=?1,linked_count=?2,
    updated_count=?3,skipped_count=?4,unresolved_count=?5,failed_count=?6,completed_at=CURRENT_TIMESTAMP WHERE id=?7`)
    .bind(counts.scanned,counts.linked,counts.updated,counts.skipped,counts.unresolved,counts.failed,runId).run();
  return {runId,...counts};
}
