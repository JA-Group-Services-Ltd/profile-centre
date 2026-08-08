import bcrypt from "bcryptjs";
import { HttpError } from "./http.js";
import { writeAudit } from "./audit.js";

const SALT_ROUNDS = 12;
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function parseCookies(request) {
  const cookies = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  return cookies;
}

function cookieName(profileId) {
  return `sm_profile_unlock_${Number(profileId)}`;
}

function unlockCookie(profileId, token, maxAge = Math.floor(UNLOCK_TTL_MS / 1000)) {
  return `${cookieName(profileId)}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}

async function ensureColumn(database, table, name, definition) {
  const info = await database.prepare(`PRAGMA table_info(${table})`).all();
  const columns = new Set((info.results || []).map((column) => String(column.name)));
  if (!columns.has(name)) {
    await database.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}

export async function ensurePublicProfilePinSchema(database) {
  await ensureColumn(database, "profile_configuration", "public_pin_enabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(database, "profile_configuration", "public_pin_hash", "TEXT");

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS profile_public_pin_unlocks (
      profile_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (profile_id, token_hash)
    )
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_profile_public_pin_unlocks_expiry
    ON profile_public_pin_unlocks(expires_at)
  `).run();

  await database.prepare(`
    CREATE TABLE IF NOT EXISTS profile_public_pin_attempts (
      profile_id INTEGER NOT NULL,
      source_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (profile_id, source_hash)
    )
  `).run();
}

export async function getPublicProfileGate(database, username) {
  await ensurePublicProfilePinSchema(database);
  return database.prepare(`
    SELECT p.id, p.display_name, p.profile_photo, p.is_published,
           COALESCE(cfg.public_pin_enabled, 0) AS public_pin_enabled,
           cfg.public_pin_hash
    FROM profiles p
    LEFT JOIN profile_configuration cfg ON cfg.profile_id = p.id
    WHERE lower(p.username) = lower(?1)
    LIMIT 1
  `).bind(String(username || "").trim()).first();
}

export async function isPublicProfileUnlocked(request, database, profileId) {
  await ensurePublicProfilePinSchema(database);
  const token = parseCookies(request)[cookieName(profileId)];
  if (!token || token.length < 20 || token.length > 256) return false;
  const tokenHash = await sha256(token);
  const row = await database.prepare(`
    SELECT 1 AS valid FROM profile_public_pin_unlocks
    WHERE profile_id=?1 AND token_hash=?2 AND expires_at>?3
    LIMIT 1
  `).bind(profileId, tokenHash, Date.now()).first();
  return Boolean(row?.valid);
}

async function requestSourceHash(request) {
  const ip = String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim();
  return sha256(`ip:${ip}`);
}

async function ownedProfile(database, userId, profileId) {
  const row = await database.prepare(`
    SELECT p.id, p.username, p.display_name,
           COALESCE(ppc.enquiry_enabled, 1) AS enquiry_enabled,
           COALESCE(cfg.public_pin_enabled, 0) AS public_pin_enabled,
           cfg.public_pin_hash
    FROM profiles p
    LEFT JOIN profile_public_content ppc ON ppc.profile_id=p.id
    LEFT JOIN profile_configuration cfg ON cfg.profile_id=p.id
    WHERE p.id=?1 AND p.user_id=?2
    LIMIT 1
  `).bind(profileId, userId).first();
  if (!row) throw new HttpError(404, "Profile not found.", "profile_not_found");
  return row;
}

function generatedPin() {
  const numbers = new Uint32Array(1);
  crypto.getRandomValues(numbers);
  return String(numbers[0] % 1_000_000).padStart(6, "0");
}

export async function managePublicProfilePin(request, database, user, profileId, action, requestedPin) {
  await ensurePublicProfilePinSchema(database);
  const profile = await ownedProfile(database, user.id, profileId);
  const normalisedAction = String(action || "").trim().toLowerCase();

  if (normalisedAction === "clear") {
    await database.batch([
      database.prepare(`
        UPDATE profile_configuration
        SET public_pin_enabled=0, public_pin_hash=NULL, updated_at=CURRENT_TIMESTAMP
        WHERE profile_id=?1
      `).bind(profile.id),
      database.prepare("DELETE FROM profile_public_pin_unlocks WHERE profile_id=?1").bind(profile.id),
      database.prepare("DELETE FROM profile_public_pin_attempts WHERE profile_id=?1").bind(profile.id),
    ]);
    await writeAudit(database, request, user, "profile_public_pin_cleared", "profile", `Cleared public PIN for profile ${profile.id}`);
    return { success: true, enabled: false };
  }

  if (!["set", "generate"].includes(normalisedAction)) {
    throw new HttpError(400, "Unsupported public PIN action.", "validation_error");
  }

  const pin = normalisedAction === "generate" ? generatedPin() : String(requestedPin || "").trim();
  if (!/^\d{4,8}$/.test(pin)) {
    throw new HttpError(400, "Public profile PIN must be 4–8 digits.", "validation_error");
  }

  const hash = await bcrypt.hash(pin, SALT_ROUNDS);
  await database.batch([
    database.prepare(`
      UPDATE profile_configuration
      SET public_pin_enabled=1, public_pin_hash=?1, updated_at=CURRENT_TIMESTAMP
      WHERE profile_id=?2
    `).bind(hash, profile.id),
    database.prepare("DELETE FROM profile_public_pin_unlocks WHERE profile_id=?1").bind(profile.id),
    database.prepare("DELETE FROM profile_public_pin_attempts WHERE profile_id=?1").bind(profile.id),
  ]);
  await writeAudit(database, request, user, "profile_public_pin_set", "profile", `Set public PIN for profile ${profile.id}`);

  return {
    success: true,
    enabled: true,
    ...(normalisedAction === "generate"
      ? { pin, warning: "Copy this PIN now. For security, it will not be shown again." }
      : {}),
  };
}

export async function publicProfileFeatureStatus(database, user, profileId) {
  await ensurePublicProfilePinSchema(database);
  const profile = await ownedProfile(database, user.id, profileId);
  return {
    success: true,
    data: {
      public_pin_enabled: Number(profile.public_pin_enabled) === 1,
      enquiry_enabled: Number(profile.enquiry_enabled) !== 0,
    },
  };
}

export async function setPublicProfileEnquiry(database, user, profileId, enabled) {
  await ensurePublicProfilePinSchema(database);
  const profile = await ownedProfile(database, user.id, profileId);
  const value = enabled === true || Number(enabled) === 1 ? 1 : 0;
  await database.prepare(`
    INSERT INTO profile_public_content(profile_id,enquiry_enabled)
    VALUES (?1,?2)
    ON CONFLICT(profile_id) DO UPDATE SET enquiry_enabled=excluded.enquiry_enabled
  `).bind(profile.id, value).run();
  return { success: true, enquiry_enabled: value };
}

export async function verifyPublicProfilePin(request, database, username, pin) {
  await ensurePublicProfilePinSchema(database);
  const profile = await getPublicProfileGate(database, username);
  if (!profile || Number(profile.is_published) !== 1) {
    throw new HttpError(404, "Profile not found.", "profile_not_found");
  }
  if (Number(profile.public_pin_enabled) !== 1 || !profile.public_pin_hash) {
    return { success: true, verified: true, cookie: null };
  }

  const suppliedPin = String(pin || "").trim();
  if (!/^\d{4,8}$/.test(suppliedPin)) {
    throw new HttpError(400, "PIN must be 4–8 digits.", "validation_error");
  }

  const sourceHash = await requestSourceHash(request);
  const attempt = await database.prepare(`
    SELECT failed_attempts, locked_until FROM profile_public_pin_attempts
    WHERE profile_id=?1 AND source_hash=?2 LIMIT 1
  `).bind(profile.id, sourceHash).first();
  if (Number(attempt?.locked_until || 0) > Date.now()) {
    throw new HttpError(429, "Too many incorrect PIN attempts. Try again later.", "public_pin_locked");
  }

  const correct = await bcrypt.compare(suppliedPin, profile.public_pin_hash);
  if (!correct) {
    const failures = Number(attempt?.failed_attempts || 0) + 1;
    const lockedUntil = failures >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
    await database.prepare(`
      INSERT INTO profile_public_pin_attempts(profile_id,source_hash,failed_attempts,locked_until,updated_at)
      VALUES (?1,?2,?3,?4,CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id,source_hash) DO UPDATE SET
        failed_attempts=excluded.failed_attempts,
        locked_until=excluded.locked_until,
        updated_at=CURRENT_TIMESTAMP
    `).bind(profile.id, sourceHash, failures, lockedUntil).run();
    if (lockedUntil) {
      throw new HttpError(429, "Too many incorrect PIN attempts. Try again in 15 minutes.", "public_pin_locked");
    }
    throw new HttpError(401, "Incorrect profile PIN.", "invalid_public_pin");
  }

  await database.prepare("DELETE FROM profile_public_pin_attempts WHERE profile_id=?1 AND source_hash=?2")
    .bind(profile.id, sourceHash).run();
  await database.prepare("DELETE FROM profile_public_pin_unlocks WHERE expires_at<=?1").bind(Date.now()).run();

  const token = randomToken();
  const tokenHash = await sha256(token);
  await database.prepare(`
    INSERT INTO profile_public_pin_unlocks(profile_id,token_hash,expires_at)
    VALUES (?1,?2,?3)
  `).bind(profile.id, tokenHash, Date.now() + UNLOCK_TTL_MS).run();

  return {
    success: true,
    verified: true,
    cookie: unlockCookie(profile.id, token),
  };
}

export function clearPublicProfileUnlockCookie(profileId) {
  return unlockCookie(profileId, "", 0);
}
