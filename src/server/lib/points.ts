/**
 * Points engine — award, deduct, balance.
 * All mutations go through this module to keep the ledger consistent.
 */
import { randomBytes } from 'crypto';
import db from '../db.js';

export interface LedgerEntry {
  id: number;
  user_id: number;
  delta: number;
  balance_after: number;
  action: string;
  description: string | null;
  ref_id: number | null;
  created_at: string;
}

/** Get current points balance for a user */
export async function getBalance(userId: number): Promise<number> {
  const row = await db.prepare(
    'SELECT balance_after FROM points_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 1'
  ).get(userId) as { balance_after: number } | undefined;
  return row?.balance_after ?? 0;
}

/** Get points rule by action */
export async function getRule(action: string): Promise<{ points: number; is_active: number } | undefined> {
  return await db.prepare('SELECT points, is_active FROM points_rules WHERE action = ?').get(action) as
    { points: number; is_active: number } | undefined;
}

/** Award points for a qualifying action. Returns the new balance or null if rule inactive/missing. */
export async function awardPoints(
  userId: number,
  action: string,
  description?: string,
  refId?: number,
  overridePoints?: number
): Promise<number | null> {
  const rule = await getRule(action);
  const pts = overridePoints ?? rule?.points ?? 0;
  if (!overridePoints && (!rule || !rule.is_active || pts === 0)) return null;

  const current = await getBalance(userId);
  const newBalance = current + pts;
  await db.prepare(
    'INSERT INTO points_ledger (user_id, delta, balance_after, action, description, ref_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, pts, newBalance, action, description ?? null, refId ?? null);
  return newBalance;
}

/** Deduct points (e.g. redemption). Returns new balance or throws if insufficient. */
export async function deductPoints(
  userId: number,
  points: number,
  action: string,
  description?: string,
  refId?: number
): Promise<number> {
  const current = await getBalance(userId);
  if (current < points) throw new Error('Insufficient points balance');
  const newBalance = current - points;
  await db.prepare(
    'INSERT INTO points_ledger (user_id, delta, balance_after, action, description, ref_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, -points, newBalance, action, description ?? null, refId ?? null);
  return newBalance;
}

/** Get or create a referral code for a user */
export async function getOrCreateReferralCode(userId: number): Promise<string> {
  if (!userId) throw new Error('getOrCreateReferralCode: userId is required');
  const existing = await db.prepare('SELECT code FROM referral_codes WHERE user_id = ?').get(userId) as
    { code: string } | undefined;
  if (existing) return existing.code;

  // Generate a short unique code: first 3 chars of user id + 5 random hex chars
  const code = `JA${userId}${randomBytes(3).toString('hex').toUpperCase()}`;
  await db.prepare('INSERT OR IGNORE INTO referral_codes (user_id, code) VALUES (?, ?)').run(userId, code);
  return code;
}
