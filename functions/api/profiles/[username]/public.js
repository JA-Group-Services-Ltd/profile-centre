import { errorResponse, json, methodNotAllowed, withRequestId } from "../../../_shared/http.js";
import { getPublicProfile } from "../../../_shared/profiles.js";
import { getPublicProfileGate, isPublicProfileUnlocked } from "../../../_shared/public-profile-pin.js";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  try {
    if (context.request.method.toUpperCase() !== "GET") {
      return withRequestId(methodNotAllowed(["GET"], requestId), requestId);
    }
    if (!context.env.DB) throw new Error("D1 binding DB is not configured.");

    const username = String(context.params.username || "").trim();
    const gate = await getPublicProfileGate(context.env.DB, username);
    if (!gate || Number(gate.is_published) !== 1) {
      return withRequestId(json({ success: false, error: "Profile not found", code: "profile_not_found", requestId }, 404), requestId);
    }

    if (Number(gate.public_pin_enabled) === 1 && gate.public_pin_hash) {
      const unlocked = await isPublicProfileUnlocked(context.request, context.env.DB, gate.id);
      if (!unlocked) {
        return withRequestId(json({
          success: false,
          error: "This public profile is protected by a PIN.",
          code: "public_pin_required",
          pin_required: true,
          display_name: gate.display_name || "Protected Profile",
          profile_photo: gate.profile_photo || null,
          requestId,
        }, 403), requestId);
      }
    }

    const profile = await getPublicProfile(context.env.DB, username);
    const [plan, theme] = await Promise.all([
      context.env.DB.prepare(`
        SELECT p.slug, p.name, p.has_contact_form, p.has_vcard_download,
               p.remove_branding, p.has_messaging
        FROM profiles pr
        JOIN users u ON u.id=pr.user_id
        LEFT JOIN plans p ON p.id=u.plan_id
        WHERE pr.id=?1 LIMIT 1
      `).bind(profile.id).first(),
      profile.theme_id
        ? context.env.DB.prepare(`
            SELECT primary_color,accent_color,background_color,text_color
            FROM themes WHERE id=?1 AND is_active=1 LIMIT 1
          `).bind(profile.theme_id).first()
        : Promise.resolve(null),
    ]);

    profile.plan = plan || {
      has_contact_form: 0,
      has_vcard_download: 0,
      remove_branding: 0,
      has_messaging: 0,
    };
    profile.theme = theme || {
      primary_color: "#3B82F6",
      accent_color: "#6366F1",
      background_color: "#FFFFFF",
      text_color: "#0F172A",
    };

    return withRequestId(json({ success: true, data: profile }), requestId);
  } catch (error) {
    return withRequestId(errorResponse(error, requestId), requestId);
  }
}
