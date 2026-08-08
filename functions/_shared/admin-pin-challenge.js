import bcrypt from "bcryptjs";
import { saveSession } from "./auth.js";
import { writeAudit } from "./audit.js";
import { HttpError } from "./http.js";

const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const PIN_SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const ALLOWED_ACTIONS = new Set([
  "sar_view",
  "sar_export",
  "delete_user",
  "delete_profile",
  "assign_plan",
  "update_settings",
  "update_legal",
  "assisted_access",
  "billing_control",
  "feature_change",
  "suspend_user",
  "authority_report",
]);

function lockedUntilMs(value) {
  if (!value) return 0;
  const normalized = String(value).endsWith("Z") ? String(value) : `${String(value).replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pinSessionValid(session) {
  const verifiedAt = Number(session?.data?.adminPinVerifiedAt);
  return session?.data?.adminPinVerified === true
    && Number.isFinite(verifiedAt)
    && Date.now() - verifiedAt < PIN_SESSION_TIMEOUT_MS;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function pinRow(database, adminId) {
  return database.prepare(`SELECT pin_hash,failed_attempts,locked_until
    FROM admin_pins WHERE admin_id=?1 LIMIT 1`).bind(adminId).first();
}

async function recordFailure(database, request, admin, row, action) {
  const attempts = Number(row?.failed_attempts || 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MS).toISOString()
    : null;
  await database.prepare(`UPDATE admin_pins
    SET failed_attempts=?1,locked_until=?2,updated_at=CURRENT_TIMESTAMP
    WHERE admin_id=?3`).bind(attempts, lockedUntil, admin.id).run();
  await writeAudit(
    database,
    request,
    admin,
    "admin_pin_challenge_failed",
    "admin",
    `PIN challenge failed for ${action} (attempt ${attempts}/${MAX_ATTEMPTS})`,
    "failure",
  );
  return { attempts, lockedUntil };
}

export async function issueAdminPinChallenge(request, database, session, admin, body) {
  if (!pinSessionValid(session)) {
    throw new HttpError(403, "PIN session expired. Please re-enter your PIN.", "admin_pin_session_expired");
  }

  const action = String(body?.action || "").trim();
  const pin = String(body?.pin || "").trim();
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new HttpError(400, "This high-risk action is not recognised.", "invalid_admin_pin_action");
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw new HttpError(400, "PIN must be 4–8 digits.", "invalid_admin_pin");
  }

  const row = await pinRow(database, admin.id);
  if (!row) throw new HttpError(403, "No admin PIN is set.", "admin_pin_not_set");
  if (lockedUntilMs(row.locked_until) > Date.now()) {
    throw new HttpError(429, "Too many attempts. Try again later.", "admin_pin_locked");
  }

  if (!(await bcrypt.compare(pin, row.pin_hash))) {
    const failure = await recordFailure(database, request, admin, row, action);
    if (failure.lockedUntil) {
      throw new HttpError(429, "Too many failed attempts. Account locked for 15 minutes.", "admin_pin_locked");
    }
    throw new HttpError(
      401,
      `Incorrect PIN. ${MAX_ATTEMPTS - failure.attempts} attempts remaining.`,
      "invalid_admin_pin",
    );
  }

  await database.prepare(`UPDATE admin_pins
    SET failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP
    WHERE admin_id=?1`).bind(admin.id).run();
  await database.prepare("DELETE FROM admin_challenge_tokens WHERE expires_at<?1").bind(Date.now()).run();

  const token = randomToken();
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  await database.prepare(`INSERT INTO admin_challenge_tokens(token,admin_id,action,expires_at)
    VALUES (?1,?2,?3,?4)`).bind(token, admin.id, action, expiresAt).run();

  session.data.adminPinVerified = true;
  session.data.adminPinVerifiedAt = Date.now();
  await saveSession(database, session);
  await writeAudit(
    database,
    request,
    admin,
    "admin_pin_challenge_issued",
    "admin",
    `One-time PIN challenge issued for ${action}`,
  );

  return { success: true, token, expiresAt };
}

export async function consumeAdminPinChallenge(request, database, admin, expectedAction) {
  const token = String(request.headers.get("x-admin-pin-token") || "").trim();
  const claimedAction = String(request.headers.get("x-admin-pin-action") || "").trim();
  if (!token || claimedAction !== expectedAction) {
    throw new HttpError(
      403,
      "This action requires PIN re-authentication.",
      "admin_pin_challenge_required",
    );
  }

  const row = await database.prepare(`SELECT admin_id,action,expires_at
    FROM admin_challenge_tokens WHERE token=?1 LIMIT 1`).bind(token).first();
  if (!row
    || Number(row.admin_id) !== Number(admin.id)
    || row.action !== expectedAction
    || Number(row.expires_at) < Date.now()) {
    if (row) await database.prepare("DELETE FROM admin_challenge_tokens WHERE token=?1").bind(token).run();
    throw new HttpError(
      403,
      "Invalid or expired PIN challenge token. Please re-authenticate.",
      "admin_pin_challenge_invalid",
    );
  }

  // Challenge tokens are deliberately one-time use.
  await database.prepare("DELETE FROM admin_challenge_tokens WHERE token=?1").bind(token).run();
  return true;
}
