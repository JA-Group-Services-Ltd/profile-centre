import { HttpError } from "./http.js";
import { writeAudit } from "./audit.js";
import { ensureProfileInteractionSchema } from "./profile-interactions.js";

const ACTIONS = new Set([
  "verify", "unverify", "publish", "unpublish", "hide", "suspend", "restore", "reinstate",
]);

export async function listAdminProfiles(database) {
  await ensureProfileInteractionSchema(database);
  const result = await database.prepare(`
    SELECT
      p.id,p.user_id,p.username,p.profile_type,p.is_published,p.is_verified,p.verified_at,p.verified_by,
      p.verification_requested_at,p.verification_request_note,p.display_name,p.business_name,
      p.job_title,p.company,p.bio,p.email,p.phone,p.website,p.profile_photo,p.created_at,p.updated_at,
      u.name AS user_name,u.email AS user_email,u.account_status,u.customer_number,
      pl.name AS plan_name,pl.slug AS plan_slug,
      (SELECT COUNT(*) FROM profile_links l WHERE l.profile_id=p.id) AS link_count,
      (SELECT COUNT(*) FROM profile_interaction_events e WHERE e.profile_id=p.id AND e.event_type='view') AS view_count,
      (SELECT COUNT(*) FROM issue_reports r WHERE r.reported_profile_id=p.id AND r.status NOT IN ('resolved','dismissed')) AS open_report_count
    FROM profiles p
    JOIN users u ON u.id=p.user_id
    LEFT JOIN plans pl ON pl.id=u.plan_id
    ORDER BY
      CASE WHEN p.verification_requested_at IS NULL THEN 1 ELSE 0 END,
      datetime(p.verification_requested_at) DESC,
      datetime(p.updated_at) DESC,
      p.id DESC
    LIMIT 2000
  `).all();
  return { success: true, data: result.results || [] };
}

export async function getAdminProfile(database, profileId) {
  await ensureProfileInteractionSchema(database);
  const profile = await database.prepare(`
    SELECT p.*,u.name AS user_name,u.email AS user_email,u.account_status,u.customer_number,
           pl.name AS plan_name,pl.slug AS plan_slug
    FROM profiles p
    JOIN users u ON u.id=p.user_id
    LEFT JOIN plans pl ON pl.id=u.plan_id
    WHERE p.id=?1 LIMIT 1
  `).bind(profileId).first();
  if (!profile) throw new HttpError(404, "Profile not found.", "profile_not_found");
  return { success: true, data: profile };
}

export async function performAdminProfileAction(request, database, admin, profileId, action) {
  await ensureProfileInteractionSchema(database);
  const normalised = String(action || "").trim().toLowerCase();
  if (!ACTIONS.has(normalised)) {
    throw new HttpError(400, "Unsupported profile moderation action.", "validation_error");
  }
  const existing = await database.prepare("SELECT id,is_published,is_verified FROM profiles WHERE id=?1 LIMIT 1")
    .bind(profileId).first();
  if (!existing) throw new HttpError(404, "Profile not found.", "profile_not_found");

  if (normalised === "verify") {
    await database.prepare(`
      UPDATE profiles SET is_verified=1,verified_at=CURRENT_TIMESTAMP,verified_by=?1,
        verification_requested_at=NULL,verification_request_note=NULL,updated_at=CURRENT_TIMESTAMP
      WHERE id=?2
    `).bind(admin.email || admin.id || "admin", profileId).run();
  } else if (normalised === "unverify") {
    await database.prepare(`
      UPDATE profiles SET is_verified=0,verified_at=NULL,verified_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1
    `).bind(profileId).run();
  } else if (["publish", "restore", "reinstate"].includes(normalised)) {
    await database.prepare("UPDATE profiles SET is_published=1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(profileId).run();
  } else {
    await database.prepare("UPDATE profiles SET is_published=0,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(profileId).run();
  }

  await writeAudit(database, request, admin, `admin_profile_${normalised}`, "profile", `Admin ${normalised} action on profile ${profileId}`);
  return { success: true, action: normalised };
}

export async function deleteAdminProfile(request, database, admin, profileId) {
  const profile = await database.prepare("SELECT id,user_id FROM profiles WHERE id=?1 LIMIT 1").bind(profileId).first();
  if (!profile) throw new HttpError(404, "Profile not found.", "profile_not_found");
  await writeAudit(database, request, admin, "admin_profile_delete", "profile", `Admin deleted profile ${profileId}`);
  await database.prepare("DELETE FROM profiles WHERE id=?1").bind(profileId).run();
  return { success: true };
}
