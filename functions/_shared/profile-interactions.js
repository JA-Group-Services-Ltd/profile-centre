import QRCode from "qrcode";
import { HttpError } from "./http.js";
import { writeAudit } from "./audit.js";
import { getPublicProfileGate, isPublicProfileUnlocked } from "./public-profile-pin.js";

const SITE = "https://sousamurrayprofiles.jagroupservices.co.uk";
const ENQUIRY_LIMIT = 5;
const REPORT_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function visitorHash(request, env, scope = "visitor") {
  const ip = String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim();
  const ua = String(request.headers.get("user-agent") || "unknown").slice(0, 300);
  const salt = String(env?.ANALYTICS_HASH_SALT || env?.HEAD_OFFICE_PLATFORM_KEY || "").slice(0, 256);
  const day = new Date().toISOString().slice(0, 10);
  return sha256(`${scope}|${day}|${salt}|${ip}|${ua}`);
}

function requestIp(request) {
  return String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function safeReferrer(request) {
  const raw = String(request.headers.get("referer") || request.headers.get("referrer") || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`.slice(0, 300);
  } catch {
    return null;
  }
}

async function tableColumns(database, table) {
  const result = await database.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((result.results || []).map((column) => String(column.name)));
}

async function ensureColumns(database, table, columns) {
  const existing = await tableColumns(database, table);
  for (const [name, definition] of columns) {
    if (!existing.has(name)) {
      await database.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
    }
  }
}

export async function ensureProfileInteractionSchema(database) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS profile_interaction_events (
      id TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      link_id INTEGER,
      visitor_hash TEXT,
      referrer_origin TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_profile_interaction_events_profile_time
    ON profile_interaction_events(profile_id,created_at)`).run();
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_profile_interaction_events_type_time
    ON profile_interaction_events(event_type,created_at)`).run();
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_profile_interaction_events_link_time
    ON profile_interaction_events(link_id,created_at)`).run();

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS public_interaction_rate_limits (
      scope TEXT NOT NULL,
      subject_id INTEGER NOT NULL,
      source_hash TEXT NOT NULL,
      window_started_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(scope,subject_id,source_hash)
    )
  `).run();

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS contact_enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      profile_id INTEGER,
      profile_name TEXT,
      username TEXT,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await ensureColumns(database, "contact_enquiries", [
    ["user_id", "INTEGER"],
    ["profile_id", "INTEGER"],
    ["profile_name", "TEXT"],
    ["username", "TEXT"],
    ["sender_name", "TEXT"],
    ["sender_email", "TEXT"],
    ["message", "TEXT"],
    ["is_read", "INTEGER NOT NULL DEFAULT 0"],
    ["status", "TEXT NOT NULL DEFAULT 'new'"],
    ["created_at", "TEXT"],
    ["updated_at", "TEXT"],
  ]);
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_contact_enquiries_user_time
    ON contact_enquiries(user_id,created_at)`).run();
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_contact_enquiries_profile_time
    ON contact_enquiries(profile_id,created_at)`).run();

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS issue_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      issue_type TEXT NOT NULL DEFAULT 'profile_report',
      subject TEXT,
      description TEXT,
      page_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      reported_user_id INTEGER,
      reported_profile_id INTEGER,
      report_reason TEXT,
      ip_address TEXT,
      reporter_ip TEXT,
      reported_url TEXT,
      resolution_notes TEXT,
      assigned_to TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await ensureColumns(database, "issue_reports", [
    ["name", "TEXT"], ["email", "TEXT"], ["issue_type", "TEXT"], ["subject", "TEXT"],
    ["description", "TEXT"], ["page_url", "TEXT"], ["status", "TEXT NOT NULL DEFAULT 'new'"],
    ["reported_user_id", "INTEGER"], ["reported_profile_id", "INTEGER"], ["report_reason", "TEXT"],
    ["ip_address", "TEXT"], ["reporter_ip", "TEXT"], ["reported_url", "TEXT"],
    ["resolution_notes", "TEXT"], ["assigned_to", "TEXT"], ["created_at", "TEXT"], ["updated_at", "TEXT"],
  ]);
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_issue_reports_profile_time
    ON issue_reports(reported_profile_id,created_at)`).run();
  await database.prepare(`CREATE INDEX IF NOT EXISTS idx_issue_reports_status_time
    ON issue_reports(status,created_at)`).run();

  await ensureColumns(database, "profiles", [
    ["verification_requested_at", "TEXT"],
    ["verification_request_note", "TEXT"],
    ["is_verified", "INTEGER NOT NULL DEFAULT 0"],
    ["verified_at", "TEXT"],
    ["verified_by", "TEXT"],
  ]);
}

async function enforcePublicAccess(request, database, username) {
  const gate = await getPublicProfileGate(database, username);
  if (!gate || Number(gate.is_published) !== 1) {
    throw new HttpError(404, "Profile not found.", "profile_not_found");
  }
  if (Number(gate.public_pin_enabled) === 1 && gate.public_pin_hash) {
    const unlocked = await isPublicProfileUnlocked(request, database, gate.id);
    if (!unlocked) throw new HttpError(403, "This public profile is protected by a PIN.", "public_pin_required");
  }
  return gate;
}

async function enforceRateLimit(request, env, database, scope, subjectId, limit) {
  const sourceHash = await visitorHash(request, env, `rate:${scope}`);
  const row = await database.prepare(`
    SELECT window_started_at,attempts FROM public_interaction_rate_limits
    WHERE scope=?1 AND subject_id=?2 AND source_hash=?3 LIMIT 1
  `).bind(scope, subjectId, sourceHash).first();
  const now = Date.now();
  const windowStarted = Number(row?.window_started_at || 0);
  const attempts = Number(row?.attempts || 0);
  if (windowStarted && now - windowStarted < WINDOW_MS && attempts >= limit) {
    throw new HttpError(429, "Too many requests. Please try again later.", "rate_limited");
  }
  if (!windowStarted || now - windowStarted >= WINDOW_MS) {
    await database.prepare(`
      INSERT INTO public_interaction_rate_limits(scope,subject_id,source_hash,window_started_at,attempts)
      VALUES (?1,?2,?3,?4,1)
      ON CONFLICT(scope,subject_id,source_hash) DO UPDATE SET window_started_at=excluded.window_started_at,attempts=1
    `).bind(scope, subjectId, sourceHash, now).run();
  } else {
    await database.prepare(`
      UPDATE public_interaction_rate_limits SET attempts=attempts+1
      WHERE scope=?1 AND subject_id=?2 AND source_hash=?3
    `).bind(scope, subjectId, sourceHash).run();
  }
}

export async function recordProfileView(request, env, username) {
  await ensureProfileInteractionSchema(env.DB);
  const gate = await enforcePublicAccess(request, env.DB, username);
  const hash = await visitorHash(request, env, `profile:${gate.id}`);
  await env.DB.prepare(`
    INSERT INTO profile_interaction_events(id,profile_id,event_type,visitor_hash,referrer_origin)
    VALUES (?1,?2,'view',?3,?4)
  `).bind(crypto.randomUUID(), gate.id, hash, safeReferrer(request)).run();
  return { success: true };
}

export async function recordLinkClick(request, env, linkId) {
  await ensureProfileInteractionSchema(env.DB);
  const link = await env.DB.prepare(`
    SELECT l.id,l.profile_id,p.username
    FROM profile_links l JOIN profiles p ON p.id=l.profile_id
    WHERE l.id=?1 AND l.is_active=1 LIMIT 1
  `).bind(linkId).first();
  if (!link) throw new HttpError(404, "Link not found.", "link_not_found");
  await enforcePublicAccess(request, env.DB, link.username);
  const hash = await visitorHash(request, env, `profile:${link.profile_id}`);
  await env.DB.prepare(`
    INSERT INTO profile_interaction_events(id,profile_id,event_type,link_id,visitor_hash,referrer_origin)
    VALUES (?1,?2,'click',?3,?4,?5)
  `).bind(crypto.randomUUID(), link.profile_id, link.id, hash, safeReferrer(request)).run();
  return { success: true };
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getProfileAnalytics(database, user, profileId, days = 30) {
  await ensureProfileInteractionSchema(database);
  const profile = await database.prepare("SELECT id FROM profiles WHERE id=?1 AND user_id=?2 LIMIT 1")
    .bind(profileId, user.id).first();
  if (!profile) throw new HttpError(404, "Profile not found.", "profile_not_found");

  const range = Math.max(1, Math.min(365, Number(days) || 30));
  const start = new Date(Date.now() - range * 86400000).toISOString();
  const previousStart = new Date(Date.now() - range * 2 * 86400000).toISOString();
  const [allTime, recent, previous, byDay, clicksByDay, weekdays, topLinks] = await Promise.all([
    database.prepare(`SELECT
      SUM(CASE WHEN event_type='view' THEN 1 ELSE 0 END) total_views,
      SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) total_clicks
      FROM profile_interaction_events WHERE profile_id=?1`).bind(profileId).first(),
    database.prepare(`SELECT
      SUM(CASE WHEN event_type='view' THEN 1 ELSE 0 END) recent_views,
      SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) recent_clicks,
      COUNT(DISTINCT CASE WHEN event_type='view' THEN visitor_hash END) unique_visitors
      FROM profile_interaction_events WHERE profile_id=?1 AND created_at>=?2`).bind(profileId, start).first(),
    database.prepare(`SELECT
      SUM(CASE WHEN event_type='view' THEN 1 ELSE 0 END) previous_views,
      SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) previous_clicks
      FROM profile_interaction_events WHERE profile_id=?1 AND created_at>=?2 AND created_at<?3`).bind(profileId, previousStart, start).first(),
    database.prepare(`SELECT date(created_at) date,COUNT(*) views FROM profile_interaction_events
      WHERE profile_id=?1 AND event_type='view' AND created_at>=?2 GROUP BY date(created_at) ORDER BY date`).bind(profileId, start).all(),
    database.prepare(`SELECT date(created_at) date,COUNT(*) clicks FROM profile_interaction_events
      WHERE profile_id=?1 AND event_type='click' AND created_at>=?2 GROUP BY date(created_at) ORDER BY date`).bind(profileId, start).all(),
    database.prepare(`SELECT CAST(strftime('%w',created_at) AS INTEGER) weekday,COUNT(*) views FROM profile_interaction_events
      WHERE profile_id=?1 AND event_type='view' AND created_at>=?2 GROUP BY strftime('%w',created_at) ORDER BY weekday`).bind(profileId, start).all(),
    database.prepare(`SELECT l.id,l.label,l.url,COUNT(e.id) clicks
      FROM profile_links l
      LEFT JOIN profile_interaction_events e ON e.link_id=l.id AND e.event_type='click' AND e.created_at>=?2
      WHERE l.profile_id=?1 GROUP BY l.id,l.label,l.url ORDER BY clicks DESC,l.sort_order ASC LIMIT 10`).bind(profileId, start).all(),
  ]);

  const recentViews = number(recent?.recent_views);
  const recentClicks = number(recent?.recent_clicks);
  return {
    success: true,
    data: {
      totalViews: number(allTime?.total_views),
      recentViews,
      previousViews: number(previous?.previous_views),
      totalClicks: number(allTime?.total_clicks),
      recentClicks,
      previousClicks: number(previous?.previous_clicks),
      uniqueVisitors: number(recent?.unique_visitors),
      ctr: recentViews ? (recentClicks / recentViews) * 100 : 0,
      viewsByDay: byDay.results || [],
      clicksByDay: clicksByDay.results || [],
      weekdayViews: weekdays.results || [],
      topLinks: topLinks.results || [],
    },
  };
}

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function createPublicEnquiry(request, env, username, body) {
  await ensureProfileInteractionSchema(env.DB);
  const gate = await enforcePublicAccess(request, env.DB, username);
  if (String(body?._hp || "").trim()) return { success: true };
  await enforceRateLimit(request, env, env.DB, "enquiry", gate.id, ENQUIRY_LIMIT);

  const profile = await env.DB.prepare(`
    SELECT p.id,p.user_id,p.display_name,p.username,COALESCE(ppc.enquiry_enabled,1) enquiry_enabled
    FROM profiles p LEFT JOIN profile_public_content ppc ON ppc.profile_id=p.id
    WHERE p.id=?1 LIMIT 1
  `).bind(gate.id).first();
  if (!profile || Number(profile.enquiry_enabled) !== 1) {
    throw new HttpError(403, "Enquiries are not enabled for this profile.", "enquiries_disabled");
  }
  const senderName = String(body?.sender_name || "").trim().slice(0, 120);
  const senderEmail = validEmail(body?.sender_email);
  const message = String(body?.message || "").trim().slice(0, 5000);
  if (!senderName || !senderEmail || message.length < 2) {
    throw new HttpError(400, "Name, a valid email address and a message are required.", "validation_error");
  }

  const result = await env.DB.prepare(`
    INSERT INTO contact_enquiries(user_id,profile_id,profile_name,username,sender_name,sender_email,message,is_read,status,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,0,'new',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    RETURNING id
  `).bind(profile.user_id, profile.id, profile.display_name || profile.username, profile.username, senderName, senderEmail, message).first();
  return { success: true, id: result?.id || null };
}

export async function listCustomerEnquiries(database, user) {
  await ensureProfileInteractionSchema(database);
  const result = await database.prepare(`
    SELECT id,profile_id,profile_name,username,sender_name,sender_email,message,is_read,created_at
    FROM contact_enquiries WHERE user_id=?1 ORDER BY datetime(created_at) DESC,id DESC LIMIT 500
  `).bind(user.id).all();
  return { success: true, data: result.results || [] };
}

export async function markCustomerEnquiryRead(database, user, enquiryId) {
  await ensureProfileInteractionSchema(database);
  const result = await database.prepare(`
    UPDATE contact_enquiries SET is_read=1,status=CASE WHEN status='new' THEN 'read' ELSE status END,updated_at=CURRENT_TIMESTAMP
    WHERE id=?1 AND user_id=?2 RETURNING id
  `).bind(enquiryId, user.id).first();
  if (!result) throw new HttpError(404, "Enquiry not found.", "enquiry_not_found");
  return { success: true };
}

const REPORT_REASONS = new Set([
  "spam_scam", "impersonation", "harassment_abuse", "illegal_content", "adult_unsafe_content",
  "misleading_information", "privacy_issue", "intellectual_property", "other",
]);

export async function createProfileReport(request, env, username, body) {
  await ensureProfileInteractionSchema(env.DB);
  const gate = await enforcePublicAccess(request, env.DB, username);
  await enforceRateLimit(request, env, env.DB, "report", gate.id, REPORT_LIMIT);
  const profile = await env.DB.prepare("SELECT id,user_id,username,display_name FROM profiles WHERE id=?1 LIMIT 1").bind(gate.id).first();
  const name = String(body?.reporter_name || "").trim().slice(0, 120);
  const email = validEmail(body?.reporter_email);
  const reason = String(body?.reason || "").trim();
  const details = String(body?.details || "").trim().slice(0, 5000);
  if (!name || !email || !REPORT_REASONS.has(reason) || details.length < 10) {
    throw new HttpError(400, "Reporter details, a valid reason and sufficient report details are required.", "validation_error");
  }
  const url = `${SITE}/profile/${encodeURIComponent(profile.username)}`;
  const ip = requestIp(request);
  const result = await env.DB.prepare(`
    INSERT INTO issue_reports(name,email,issue_type,subject,description,page_url,status,reported_user_id,reported_profile_id,
      report_reason,ip_address,reporter_ip,reported_url,created_at,updated_at)
    VALUES (?1,?2,'profile_report',?3,?4,?5,'new',?6,?7,?8,?9,?9,?5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    RETURNING id
  `).bind(name, email, `Profile report: ${profile.display_name || profile.username}`, details, url, profile.user_id, profile.id, reason, ip).first();
  return { success: true, id: result?.id || null };
}

export async function requestProfileVerification(request, database, user, profileId, note) {
  await ensureProfileInteractionSchema(database);
  const profile = await database.prepare(`
    SELECT id,is_verified,verification_requested_at FROM profiles WHERE id=?1 AND user_id=?2 LIMIT 1
  `).bind(profileId, user.id).first();
  if (!profile) throw new HttpError(404, "Profile not found.", "profile_not_found");
  if (Number(profile.is_verified) === 1) {
    throw new HttpError(409, "This profile is already verified.", "profile_already_verified");
  }
  const cleanedNote = String(note || "").trim().slice(0, 1000);
  await database.prepare(`
    UPDATE profiles SET verification_requested_at=CURRENT_TIMESTAMP,verification_request_note=?1,updated_at=CURRENT_TIMESTAMP
    WHERE id=?2
  `).bind(cleanedNote || null, profileId).run();
  await writeAudit(database, request, user, "verification_requested", "profile", `Requested verification for profile ${profileId}`);
  return { success: true, message: "Verification request submitted for review." };
}

function profilePath(profile, person = false) {
  if (person && profile.profile_type === "business" && profile.biz_slug && profile.person_slug) {
    return `/profile/${encodeURIComponent(profile.biz_slug)}/${encodeURIComponent(profile.person_slug)}`;
  }
  if (profile.profile_type === "business" && profile.biz_slug) return `/profile/${encodeURIComponent(profile.biz_slug)}`;
  return `/profile/${encodeURIComponent(profile.username)}`;
}

export async function createProfileQr(database, user, profileId, person = false) {
  const profile = await database.prepare(`
    SELECT id,user_id,username,profile_type,biz_slug,person_slug,display_name,business_name
    FROM profiles WHERE id=?1 AND user_id=?2 LIMIT 1
  `).bind(profileId, user.id).first();
  if (!profile) throw new HttpError(404, "Profile not found.", "profile_not_found");
  if (person && !(profile.profile_type === "business" && profile.biz_slug && profile.person_slug)) {
    throw new HttpError(404, "Business person profile URL not found.", "profile_person_not_found");
  }
  const url = `${SITE}${profilePath(profile, person)}`;
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 768,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return { success: true, data: { qr_data_url: qrDataUrl, profile_url: url } };
}

export async function createPublicProfileQr(request, env, username) {
  const gate = await enforcePublicAccess(request, env.DB, username);
  const profile = await env.DB.prepare("SELECT id,username FROM profiles WHERE id=?1 LIMIT 1").bind(gate.id).first();
  const url = `${SITE}/profile/${encodeURIComponent(profile.username)}`;
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 768,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return { success: true, data: { qr_data_url: qrDataUrl, profile_url: url } };
}
