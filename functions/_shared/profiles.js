import { HttpError, readJson } from "./http.js";
import { writeAudit } from "./audit.js";
import { sendOperationalEvent } from "./head-office.js";

const BASE_FIELDS = [
  "username", "display_name", "job_title", "company", "bio", "phone", "email",
  "website", "address", "profile_photo", "profile_type", "url_prefix", "biz_slug",
  "person_slug", "theme_id", "is_published", "verification_request_note",
];
const BUSINESS_FIELDS = [
  "business_name", "business_description", "business_category", "opening_hours",
  "logo_url", "cover_url", "services", "team_members", "announcements",
  "business_description_html", "business_tagline", "business_email", "business_phone",
  "business_website", "business_address", "max_seats", "business_type", "business_hours",
  "booking_url", "map_embed_url", "payment_methods", "featured_offer", "booking_link",
  "map_embed",
];
const PUBLIC_FIELDS = [
  "bio_html", "gallery", "awards", "faqs", "certifications", "testimonials",
  "cta_buttons", "headline", "skills", "languages", "education", "experience",
  "portfolio_url", "availability", "pronouns", "location_city", "cover_image",
  "social_channels", "content_niche", "speaking_topics", "coaching_areas",
  "volunteer_causes", "ministry_role", "publications", "collab_rate",
  "content_formats", "platforms", "gpa", "graduation_year", "internships", "clubs",
  "contact_email", "social_links", "menu_items", "menu_title", "pdf_attachments",
];
const CONFIG_FIELDS = [
  "show_phone", "show_email", "show_website", "show_address", "show_bio",
  "team_directory_public", "messaging_enabled", "enquiry_enabled", "allow_indexing",
  "seo_title", "seo_description", "public_pin_enabled", "personal_type",
  "layout_preset", "colour_palette", "custom_colour", "button_style", "photo_shape",
  "avatar_url", "layout_style", "design_style", "color_scheme", "font_style",
  "cta_label", "cta_url", "show_contact_form", "show_qr_code", "plan_gated",
  "use_custom_editor", "whatsapp_url", "whatsapp_label", "whatsapp_enabled",
  "menu_enabled", "pdf_enabled", "gallery_enabled", "social_links_enabled",
  "search_directory_enabled",
];

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function cleanUsername(value) {
  const username = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(username)) {
    throw new HttpError(400, "Username must use 3-50 lowercase letters, numbers or hyphens.", "invalid_username");
  }
  return username;
}

function parseJsonColumns(record) {
  if (!record) return record;
  for (const field of [
    "gallery", "awards", "faqs", "certifications", "testimonials", "cta_buttons",
    "skills", "languages", "education", "experience", "social_channels",
    "speaking_topics", "coaching_areas", "volunteer_causes", "publications",
    "content_formats", "platforms", "internships", "clubs", "social_links",
    "menu_items", "pdf_attachments", "services", "team_members", "announcements",
    "opening_hours", "business_hours", "payment_methods",
  ]) {
    if (typeof record[field] !== "string") continue;
    try {
      record[field] = JSON.parse(record[field]);
    } catch {
      // Legacy plain text remains plain text.
    }
  }
  return record;
}

function serialise(field, value) {
  if (value != null && typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? null;
}

function buildUpdate(table, fields, body, id, ownerId = null) {
  const selected = fields.filter((field) => own(body, field));
  if (selected.length === 0) return null;
  const assignments = selected.map((field, index) => `"${field}" = ?${index + 1}`);
  const values = selected.map((field) => serialise(field, body[field]));
  const idPosition = values.length + 1;
  const ownerPosition = idPosition + 1;
  return {
    sql: `UPDATE "${table}" SET ${assignments.join(", ")} WHERE id = ?${idPosition}${ownerId == null ? "" : ` AND user_id = ?${ownerPosition}`}`,
    values: ownerId == null ? [...values, id] : [...values, id, ownerId],
  };
}

function statement(database, update) {
  return database.prepare(update.sql).bind(...update.values);
}

export async function loadProfiles(database, userId) {
  const result = await database.prepare(`
    SELECT p.*, b.*, pc.*, cfg.*,
           p.id AS id, p.user_id AS user_id, p.username AS username,
           p.is_published AS is_published, p.created_at AS created_at,
           p.updated_at AS updated_at
    FROM profiles p
    LEFT JOIN profile_business_details b ON b.id = p.id
    LEFT JOIN profile_public_content pc ON pc.id = p.id
    LEFT JOIN profile_configuration cfg ON cfg.id = p.id
    WHERE p.user_id = ?1
    ORDER BY p.created_at ASC, p.id ASC
  `).bind(userId).all();
  return result.results.map((row) => {
    delete row.pin_hash;
    delete row.public_pin_hash;
    return parseJsonColumns(row);
  });
}

export async function getMyProfiles(database, userId) {
  return { success: true, data: await loadProfiles(database, userId) };
}

export async function createProfile(request, database, user, env = null) {
  const body = await readJson(request);
  const username = cleanUsername(body.username);
  const profileType = String(body.profile_type ?? "personal");
  if (!["personal", "business"].includes(profileType)) {
    throw new HttpError(400, "Invalid profile type.", "invalid_profile_type");
  }

  const duplicate = await database.prepare("SELECT id FROM profiles WHERE username = ?1 LIMIT 1")
    .bind(username)
    .first();
  if (duplicate) throw new HttpError(409, "Username is already in use.", "username_conflict");

  const insert = await database.prepare(`
    INSERT INTO profiles
      (user_id, username, display_name, profile_type, is_published, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `).bind(user.id, username, String(body.display_name ?? user.name), profileType).first();
  const profileId = Number(insert?.id);
  if (!Number.isInteger(profileId)) throw new Error("D1 did not return the created profile ID.");

  try {
    await database.batch([
      database.prepare("INSERT INTO profile_business_details (id) VALUES (?1)").bind(profileId),
      database.prepare("INSERT INTO profile_public_content (id) VALUES (?1)").bind(profileId),
      database.prepare("INSERT INTO profile_configuration (id) VALUES (?1)").bind(profileId),
    ]);
    await updateProfileData(database, user.id, profileId, body);
  } catch (error) {
    await database.prepare("DELETE FROM profiles WHERE id = ?1 AND user_id = ?2")
      .bind(profileId, user.id)
      .run();
    throw error;
  }
  await writeAudit(database, request, user, "create", "profile", `Created profile ${profileId}`);
  if (env) await sendOperationalEvent(env,user,"profile.created",{profileId,category:"profile_management",
    targetType:"profile",targetReference:String(profileId),description:"Profile created",metadata:{profileType}});
  const profiles = await loadProfiles(database, user.id);
  return { success: true, data: profiles.find((profile) => Number(profile.id) === profileId) };
}

async function updateProfileData(database, userId, profileId, body) {
  if (own(body, "username")) body.username = cleanUsername(body.username);
  const owner = await database.prepare("SELECT id FROM profiles WHERE id = ?1 AND user_id = ?2 LIMIT 1")
    .bind(profileId, userId)
    .first();
  if (!owner) throw new HttpError(404, "Profile not found.", "profile_not_found");

  const updates = [
    buildUpdate("profiles", BASE_FIELDS, body, profileId, userId),
    buildUpdate("profile_business_details", BUSINESS_FIELDS, body, profileId),
    buildUpdate("profile_public_content", PUBLIC_FIELDS, body, profileId),
    buildUpdate("profile_configuration", CONFIG_FIELDS, body, profileId),
  ].filter(Boolean);

  const baseIndex = updates.findIndex((update) => update.sql.startsWith('UPDATE "profiles"'));
  if (baseIndex >= 0) {
    const base = updates[baseIndex];
    base.sql = base.sql.replace(" WHERE id", ", updated_at = CURRENT_TIMESTAMP WHERE id");
  }
  if (updates.length > 0) await database.batch(updates.map((update) => statement(database, update)));
}

export async function updateProfile(request, database, user, profileId, env = null) {
  const body = await readJson(request);
  await updateProfileData(database, user.id, profileId, body);
  await writeAudit(database, request, user, "update", "profile", `Updated profile ${profileId}`);
  if (env) await sendOperationalEvent(env,user,"profile.updated",{profileId,category:"profile_management",
    targetType:"profile",targetReference:String(profileId),description:"Profile updated"});
  const profiles = await loadProfiles(database, user.id);
  return { success: true, data: profiles.find((profile) => Number(profile.id) === profileId) };
}

export async function deleteProfile(request, database, user, profileId, env = null) {
  const result = await database.prepare("DELETE FROM profiles WHERE id = ?1 AND user_id = ?2")
    .bind(profileId, user.id)
    .run();
  if (Number(result.meta?.changes ?? 0) === 0) {
    throw new HttpError(404, "Profile not found.", "profile_not_found");
  }
  await writeAudit(database, request, user, "delete", "profile", `Deleted profile ${profileId}`);
  if (env) await sendOperationalEvent(env,user,"profile.closed",{profileId,category:"profile_management",
    targetType:"profile",targetReference:String(profileId),description:"Profile removed"});
  return { success: true };
}

export async function getLinks(database, userId, profileId) {
  const owner = await database.prepare("SELECT id FROM profiles WHERE id = ?1 AND user_id = ?2")
    .bind(profileId, userId)
    .first();
  if (!owner) throw new HttpError(404, "Profile not found.", "profile_not_found");
  const links = await database.prepare(`
    SELECT id, profile_id, type, platform, label, url, icon, is_enabled, sort_order, created_at
    FROM profile_links WHERE profile_id = ?1 ORDER BY sort_order ASC, id ASC
  `).bind(profileId).all();
  return { success: true, data: links.results };
}

async function requireOwnedProfile(database, userId, profileId) {
  const profile = await database.prepare(
    "SELECT id FROM profiles WHERE id = ?1 AND user_id = ?2 LIMIT 1",
  ).bind(profileId, userId).first();
  if (!profile) throw new HttpError(403, "Access denied.", "forbidden");
  return profile;
}

async function requireOwnedLink(database, userId, linkId) {
  const link = await database.prepare(`
    SELECT l.* FROM profile_links l
    JOIN profiles p ON p.id = l.profile_id
    WHERE l.id = ?1 AND p.user_id = ?2 LIMIT 1
  `).bind(linkId, userId).first();
  if (!link) throw new HttpError(404, "Link not found.", "link_not_found");
  return link;
}

export async function createLink(request, database, user) {
  const body = await readJson(request);
  const profileId = Number(body.profile_id);
  if (!Number.isInteger(profileId) || !body.type || !body.label || !body.url) {
    throw new HttpError(400, "profile_id, type, label and url are required.", "validation_error");
  }
  await requireOwnedProfile(database, user.id, profileId);
  const capacity = await database.prepare(`
    SELECT p.max_links,
      (SELECT COUNT(*) FROM profile_links WHERE profile_id = ?1) AS link_count,
      (SELECT COALESCE(MAX(sort_order), -1) FROM profile_links WHERE profile_id = ?1) AS max_order
    FROM users u JOIN plans p ON p.id = u.plan_id WHERE u.id = ?2
  `).bind(profileId, user.id).first();
  if (capacity && Number(capacity.max_links) >= 0 &&
      Number(capacity.link_count) >= Number(capacity.max_links)) {
    throw new HttpError(403, `Your plan allows a maximum of ${capacity.max_links} links.`, "plan_limit");
  }
  const link = await database.prepare(`
    INSERT INTO profile_links
      (profile_id, type, platform, label, url, icon, is_enabled, sort_order)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7) RETURNING *
  `).bind(
    profileId, String(body.type), body.platform ?? null, String(body.label),
    String(body.url), body.icon ?? null, Number(capacity?.max_order ?? -1) + 1,
  ).first();
  await writeAudit(database, request, user, "create_link", "link", `Created link ${link.id}`);
  return { success: true, data: link };
}

export async function updateLink(request, database, user, linkId) {
  await requireOwnedLink(database, user.id, linkId);
  const body = await readJson(request);
  const fields = ["label", "url", "platform", "icon", "is_enabled", "sort_order", "type"];
  const update = buildUpdate("profile_links", fields, body, linkId);
  if (!update) throw new HttpError(400, "No supported link fields supplied.", "validation_error");
  const link = await database.prepare(`${update.sql} RETURNING *`).bind(...update.values).first();
  await writeAudit(database, request, user, "update_link", "link", `Updated link ${linkId}`);
  return { success: true, data: link };
}

export async function deleteLink(request, database, user, linkId) {
  await requireOwnedLink(database, user.id, linkId);
  await database.prepare("DELETE FROM profile_links WHERE id = ?1").bind(linkId).run();
  await writeAudit(database, request, user, "delete_link", "link", `Deleted link ${linkId}`);
  return { success: true };
}

export async function reorderLinks(request, database, user) {
  const body = await readJson(request);
  if (!Array.isArray(body.links) || body.links.length > 250) {
    throw new HttpError(400, "links must be an array of at most 250 items.", "validation_error");
  }
  const statements = [];
  for (const item of body.links) {
    const id = Number(item?.id);
    const sortOrder = Number(item?.sort_order);
    if (!Number.isInteger(id) || !Number.isInteger(sortOrder)) {
      throw new HttpError(400, "Each link requires integer id and sort_order values.", "validation_error");
    }
    await requireOwnedLink(database, user.id, id);
    statements.push(database.prepare("UPDATE profile_links SET sort_order = ?1 WHERE id = ?2")
      .bind(sortOrder, id));
  }
  if (statements.length) await database.batch(statements);
  return { success: true };
}

export async function setPublished(request, database, user, profileId, published, env = null) {
  const row = await database.prepare(`
    UPDATE profiles SET is_published = ?1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?2 AND user_id = ?3 RETURNING id, is_published
  `).bind(published ? 1 : 0, profileId, user.id).first();
  if (!row) throw new HttpError(404, "Profile not found.", "profile_not_found");
  await writeAudit(database, request, user, published ? "publish" : "unpublish", "profile",
    `${published ? "Published" : "Unpublished"} profile ${profileId}`);
  if (env) await sendOperationalEvent(env,user,published?"profile.activated":"profile.suspended",{profileId,
    category:"profile_management",targetType:"profile",targetReference:String(profileId),
    description:published?"Profile published":"Profile unpublished"});
  return { success: true, data: row };
}

export async function getPublicProfile(database, username) {
  const profile = await database.prepare(`
    SELECT p.*, b.*, pc.*, cfg.*,
           p.id AS id, p.username AS username, p.user_id AS user_id
    FROM profiles p
    LEFT JOIN profile_business_details b ON b.id = p.id
    LEFT JOIN profile_public_content pc ON pc.id = p.id
    LEFT JOIN profile_configuration cfg ON cfg.id = p.id
    WHERE p.username = ?1 AND p.is_published = 1 AND p.is_suspended = 0
      AND p.is_hidden = 0 LIMIT 1
  `).bind(username).first();
  if (!profile) throw new HttpError(404, "Profile not found.", "profile_not_found");
  delete profile.pin_hash;
  delete profile.public_pin_hash;
  delete profile.user_id;
  const links = await database.prepare(`
    SELECT id, type, platform, label, url, icon, sort_order
    FROM profile_links WHERE profile_id = ?1 AND is_enabled = 1
    ORDER BY sort_order ASC, id ASC
  `).bind(profile.id).all();
  return { success: true, data: { ...parseJsonColumns(profile), links: links.results } };
}
