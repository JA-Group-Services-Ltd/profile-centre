import bcrypt from "bcryptjs";
import { HttpError } from "./http.js";
import { saveSession } from "./auth.js";
import { writeAudit } from "./audit.js";

const SALT_ROUNDS = 12;
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const PIN_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

function lockedUntilMs(value) {
  if (!value) return 0;
  const normalized = value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pinSessionStatus(session) {
  const verifiedAt = Number(session.data.adminPinVerifiedAt);
  const valid = session.data.adminPinVerified === true
    && Number.isFinite(verifiedAt)
    && Date.now() - verifiedAt < PIN_SESSION_TIMEOUT_MS;
  return {
    valid,
    expiresAt: valid ? verifiedAt + PIN_SESSION_TIMEOUT_MS : null,
  };
}

async function pinRow(database, adminId) {
  return database.prepare(`
    SELECT pin_hash, failed_attempts, locked_until
    FROM admin_pins WHERE admin_id = ?1 LIMIT 1
  `).bind(adminId).first();
}

async function markVerified(database, session) {
  session.data.adminPinVerified = true;
  session.data.adminPinVerifiedAt = Date.now();
  await saveSession(database, session);
  return session.data.adminPinVerifiedAt + PIN_SESSION_TIMEOUT_MS;
}

async function clearVerified(database, session) {
  session.data.adminPinVerified = false;
  delete session.data.adminPinVerifiedAt;
  await saveSession(database, session);
}

async function recordFailure(database, request, admin, row, action) {
  const attempts = Number(row.failed_attempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MS).toISOString()
    : null;
  await database.prepare(`
    UPDATE admin_pins SET failed_attempts = ?1, locked_until = ?2, updated_at = CURRENT_TIMESTAMP
    WHERE admin_id = ?3
  `).bind(attempts, lockedUntil, admin.id).run();
  await writeAudit(
    database,
    request,
    admin,
    action,
    "admin",
    `Admin PIN verification failed (attempt ${attempts}/${MAX_ATTEMPTS})`,
    "failure",
  );
  return { attempts, lockedUntil };
}

export async function adminPinStatus(database, session, admin) {
  const row = await pinRow(database, admin.id);
  const now = Date.now();
  const sessionStatus = pinSessionStatus(session);
  return {
    success: true,
    hasPin: Boolean(row),
    pinVerified: sessionStatus.valid,
    locked: Boolean(row?.locked_until && lockedUntilMs(row.locked_until) > now),
    lockedUntil: row?.locked_until && lockedUntilMs(row.locked_until) > now
      ? row.locked_until
      : null,
    expiresAt: sessionStatus.expiresAt,
    timeoutMs: PIN_SESSION_TIMEOUT_MS,
  };
}

export async function setAdminPin(request, database, session, admin, body) {
  const pin = String(body.pin ?? "");
  const currentPin = String(body.currentPin ?? "");
  if (!/^\d{4,8}$/.test(pin)) {
    throw new HttpError(400, "PIN must be 4–8 digits.", "validation_error");
  }

  const existing = await pinRow(database, admin.id);
  if (existing) {
    if (lockedUntilMs(existing.locked_until) > Date.now()) {
      throw new HttpError(429, "Account locked. Try again later.", "pin_locked");
    }
    if (!currentPin) {
      throw new HttpError(400, "Current PIN required to change PIN.", "current_pin_required");
    }
    if (!(await bcrypt.compare(currentPin, existing.pin_hash))) {
      await recordFailure(database, request, admin, existing, "admin_pin_change_failed");
      throw new HttpError(401, "Current PIN is incorrect.", "invalid_pin");
    }
  }

  const hash = await bcrypt.hash(pin, SALT_ROUNDS);
  if (existing) {
    await database.prepare(`
      UPDATE admin_pins
      SET pin_hash = ?1, failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE admin_id = ?2
    `).bind(hash, admin.id).run();
  } else {
    await database.prepare(`
      INSERT INTO admin_pins (admin_id, pin_hash, failed_attempts, created_at, updated_at)
      VALUES (?1, ?2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(admin.id, hash).run();
  }
  const expiresAt = await markVerified(database, session);
  await writeAudit(
    database,
    request,
    admin,
    existing ? "admin_pin_changed" : "admin_pin_set",
    "admin",
    existing ? "Admin changed their portal PIN" : "Admin set their portal PIN for the first time",
  );
  return { success: true, message: existing ? "PIN updated." : "PIN set successfully.", expiresAt };
}

export async function verifyAdminPin(request, database, session, admin, body) {
  const pin = String(body.pin ?? "");
  if (!pin) throw new HttpError(400, "PIN required.", "validation_error");
  const row = await pinRow(database, admin.id);
  if (!row) {
    return {
      status: 403,
      body: {
        success: false,
        noPinSet: true,
        error: "No PIN is set. Please set a PIN before accessing the admin portal.",
      },
    };
  }
  if (lockedUntilMs(row.locked_until) > Date.now()) {
    return {
      status: 429,
      body: { success: false, locked: true, error: "Too many attempts. Try again later." },
    };
  }
  if (!(await bcrypt.compare(pin, row.pin_hash))) {
    const failure = await recordFailure(database, request, admin, row, "admin_pin_failed");
    const locked = Boolean(failure.lockedUntil);
    return {
      status: locked ? 429 : 401,
      body: {
        success: false,
        locked,
        error: locked
          ? "Too many failed attempts. Account locked for 15 minutes."
          : `Incorrect PIN. ${MAX_ATTEMPTS - failure.attempts} attempts remaining.`,
      },
    };
  }
  await database.prepare(`
    UPDATE admin_pins SET failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE admin_id = ?1
  `).bind(admin.id).run();
  const expiresAt = await markVerified(database, session);
  await writeAudit(database, request, admin, "admin_pin_verified", "admin", "Admin PIN verified");
  return { status: 200, body: { success: true, expiresAt } };
}

export async function adminPinHeartbeat(database, session) {
  const status = pinSessionStatus(session);
  if (!status.valid) {
    return {
      status: 403,
      body: { success: false, expired: true, error: "PIN session expired. Please re-enter your PIN." },
    };
  }
  const expiresAt = await markVerified(database, session);
  return { status: 200, body: { success: true, expiresAt } };
}

export async function clearAdminPin(database, session) {
  await clearVerified(database, session);
  return { success: true };
}

export async function resetAdminPinLockout(request, database, admin) {
  const row = await pinRow(database, admin.id);
  if (!row) throw new HttpError(400, "No PIN is set.", "pin_not_set");
  await database.prepare(`
    UPDATE admin_pins SET failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE admin_id = ?1
  `).bind(admin.id).run();
  await writeAudit(database, request, admin, "admin_pin_lockout_reset", "admin", "Admin reset their PIN lockout");
  return { success: true, message: "Lockout cleared. You can now enter your PIN again." };
}
