/**
 * Profile Centre User Number System
 * ─────────────────────────────────────
 * Format:  12 digits, numbers only, no leading zero
 * Storage: "742918305614"
 * Display: "742 918 305 614"
 *
 * Structure: 11-digit base + 1 Luhn check digit
 *
 * Base range starts at 10_000_000_000 (10 digits + 1 = 11 digits)
 * to guarantee no leading zero and a high numeric range.
 *
 * The Luhn algorithm is the industry-standard check digit used on
 * credit cards — it catches single-digit transposition errors.
 */

import db from '../db.js';
import { writeAudit } from './audit.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Starting base for the 11-digit base number (no leading zero guaranteed) */
const BASE_START = 74_291_830_000n; // 11 digits, starts in the 74 billion range
const MAX_RETRIES = 20;

// ── Luhn check digit ──────────────────────────────────────────────────────────

/**
 * Compute the Luhn check digit for a numeric string.
 * The check digit is appended to make the full number pass Luhn validation.
 */
export function luhnCheckDigit(base: string): number {
  let sum = 0;
  let alternate = true; // rightmost digit of base is position 1 (odd), so we start doubling from there
  for (let i = base.length - 1; i >= 0; i--) {
    let n = parseInt(base[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate a 12-digit user number using the Luhn algorithm.
 */
export function validateUserNumber(num: string): boolean {
  const clean = num.replace(/\s/g, '');
  if (!/^\d{12}$/.test(clean)) return false;
  if (clean[0] === '0') return false;

  // Full Luhn check on all 12 digits
  let sum = 0;
  let alternate = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format a stored 12-digit number for display: "742 918 305 614"
 */
export function formatUserNumber(num: string | null | undefined): string {
  if (!num) return '';
  const clean = num.replace(/\s/g, '');
  if (clean.length !== 12) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9, 12)}`;
}

/**
 * Normalise a user-supplied number (strip spaces) for DB lookup.
 */
export function normaliseUserNumber(input: string): string {
  return input.replace(/\s/g, '');
}

// ── Generation ────────────────────────────────────────────────────────────────

/**
 * Generate the next available user number.
 * Finds the highest existing base, increments by 1, appends check digit.
 * Retries up to MAX_RETRIES times if a collision occurs (extremely unlikely).
 */
export function generateUserNumber(
  adminId?: number,
  adminName?: string,
  adminEmail?: string,
  ipAddress?: string,
): string {
  // Find the current maximum base in use so we always increment forward
  const maxRow = db.prepare(
    "SELECT user_number FROM users WHERE user_number IS NOT NULL AND user_number != '' ORDER BY user_number DESC LIMIT 1"
  ).get() as { user_number: string } | undefined;

  let nextBase: bigint;
  if (maxRow?.user_number && maxRow.user_number.length === 12) {
    // Strip the check digit (last digit) to recover the 11-digit base
    const existingBase = BigInt(maxRow.user_number.slice(0, 11));
    nextBase = existingBase + 1n;
  } else {
    nextBase = BASE_START;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const baseStr = nextBase.toString().padStart(11, '0');
    const check = luhnCheckDigit(baseStr);
    const candidate = baseStr + check.toString();

    // Sanity checks
    if (candidate[0] === '0' || candidate.length !== 12) {
      nextBase++;
      continue;
    }

    // Collision check
    const exists = db.prepare(
      "SELECT id FROM users WHERE user_number = ?"
    ).get(candidate);

    if (!exists) {
      if (attempt > 0) {
        // Log retry
        writeAudit({
          actorId: adminId, actorName: adminName ?? 'system', actorEmail: adminEmail ?? '',
          actorType: 'system', tenant: 'system', authProvider: 'system',
          action: 'user_number_generation_retry',
          resourceType: 'user', resourceId: 'new',
          details: `User number generation retry attempt ${attempt + 1} — candidate ${candidate}`,
          ipAddress, result: 'success',
        });
      }
      return candidate;
    }

    // Collision — try next base
    nextBase++;
  }

  // Generation failure (should never happen in practice)
  writeAudit({
    actorId: adminId, actorName: adminName ?? 'system', actorEmail: adminEmail ?? '',
    actorType: 'system', tenant: 'system', authProvider: 'system',
    action: 'user_number_generation_failed',
    resourceType: 'user', resourceId: 'new',
    details: `User number generation failed after ${MAX_RETRIES} attempts`,
    ipAddress, result: 'failure',
  });
  throw new Error(`Failed to generate a unique Profile Centre User Number after ${MAX_RETRIES} attempts`);
}

// ── Assign to a new user ──────────────────────────────────────────────────────

/**
 * Generate and save a user number for a newly created user.
 * Call this immediately after INSERT INTO users.
 */
export function assignUserNumber(
  userId: number,
  adminId?: number,
  adminName?: string,
  adminEmail?: string,
  ipAddress?: string,
): string {
  const userNumber = generateUserNumber(adminId, adminName, adminEmail, ipAddress);
  db.prepare("UPDATE users SET user_number = ? WHERE id = ?").run(userNumber, userId);

  writeAudit({
    actorId: adminId ?? userId, actorName: adminName ?? 'system', actorEmail: adminEmail ?? '',
    actorType: adminId ? 'admin' : 'system', tenant: 'system', authProvider: 'system',
    action: 'user_number_generated',
    resourceType: 'user', resourceId: String(userId),
    details: `Profile Centre User Number ${formatUserNumber(userNumber)} assigned to user ${userId}`,
    ipAddress, result: 'success',
  });

  return userNumber;
}

// ── Backfill existing users ───────────────────────────────────────────────────

/**
 * Backfill user numbers for all existing users that don't have one.
 * Processes users in ascending id order.
 * Returns { updated, failed, skipped }.
 */
export function backfillUserNumbers(
  adminId?: number,
  adminName?: string,
  adminEmail?: string,
  ipAddress?: string,
): { updated: number; failed: number; skipped: number } {
  const usersWithout = db.prepare(
    "SELECT id FROM users WHERE user_number IS NULL OR user_number = '' ORDER BY id ASC"
  ).all() as { id: number }[];

  let updated = 0;
  let failed = 0;
  const skipped = 0;

  for (const user of usersWithout) {
    try {
      const userNumber = generateUserNumber(adminId, adminName, adminEmail, ipAddress);
      db.prepare("UPDATE users SET user_number = ? WHERE id = ?").run(userNumber, user.id);

      writeAudit({
        actorId: adminId ?? 0, actorName: adminName ?? 'system', actorEmail: adminEmail ?? '',
        actorType: 'system', tenant: 'system', authProvider: 'system',
        action: 'user_number_backfilled',
        resourceType: 'user', resourceId: String(user.id),
        details: `Profile Centre User Number ${formatUserNumber(userNumber)} backfilled for user ${user.id}`,
        ipAddress, result: 'success',
      });

      updated++;
    } catch (err) {
      writeAudit({
        actorId: adminId ?? 0, actorName: adminName ?? 'system', actorEmail: adminEmail ?? '',
        actorType: 'system', tenant: 'system', authProvider: 'system',
        action: 'user_number_backfill_failed',
        resourceType: 'user', resourceId: String(user.id),
        details: `Failed to backfill user number for user ${user.id}: ${String(err)}`,
        ipAddress, result: 'failure',
      });
      failed++;
    }
  }

  return { updated, failed, skipped };
}
