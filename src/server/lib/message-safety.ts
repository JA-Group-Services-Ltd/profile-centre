/**
 * Message Safety — anti-abuse checks for public direct messages.
 *
 * Checks applied before a new thread or visitor reply is accepted:
 *  1. Blocked-IP check (database-backed, persistent)
 *  2. Per-IP rate limiting (in-memory, resets on restart)
 *  3. Blocked-word / phrase filter
 *  4. Unsafe link detection
 *  5. Severity scoring (normal / warning / high / critical)
 */

import db from '../db.js';

// ─── Severity levels ──────────────────────────────────────────────────────────

export type Severity = 'normal' | 'warning' | 'high' | 'critical';

// ─── Blocked words by severity ────────────────────────────────────────────────

const CRITICAL_PHRASES: string[] = [
  'i will kill', 'i will hurt', 'i will find you', 'i know where you live',
  'i know where you work', 'you will regret', 'watch your back',
  'bomb', 'explosive', 'weapon', 'gun', 'knife attack',
];

const HIGH_PHRASES: string[] = [
  'send me your password', 'send me your bank', 'wire transfer', 'western union',
  'bitcoin wallet', 'crypto investment', 'guaranteed returns', 'make money fast',
  'your account has been suspended', 'verify your account', 'confirm your details',
  'hot singles', 'meet local', 'adult dating', 'nude', 'explicit',
];

const WARNING_PHRASES: string[] = [
  'click here to claim', 'you have won', 'congratulations you have been selected',
  'free gift card', 'limited time offer', 'act now', 'urgent action required',
  'free money', 'earn from home', 'work from home opportunity',
];

function scoreSeverity(text: string): { severity: Severity; matchedPhrase: string | null } {
  const lower = text.toLowerCase();
  for (const phrase of CRITICAL_PHRASES) {
    if (lower.includes(phrase)) return { severity: 'critical', matchedPhrase: phrase };
  }
  for (const phrase of HIGH_PHRASES) {
    if (lower.includes(phrase)) return { severity: 'high', matchedPhrase: phrase };
  }
  for (const phrase of WARNING_PHRASES) {
    if (lower.includes(phrase)) return { severity: 'warning', matchedPhrase: phrase };
  }
  return { severity: 'normal', matchedPhrase: null };
}

// ─── Unsafe link detection ────────────────────────────────────────────────────

const UNSAFE_LINK_PATTERNS: RegExp[] = [
  /https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|adf\.ly|bc\.vc|shorte\.st)\//i,
  // Fixed: use a bounded character class instead of [^\s]+ to prevent ReDoS
  /https?:\/\/\S{1,200}\.(xyz|top|click|loan|work|gq|ml|cf|ga|tk|pw|cc|su|ru)\b/i,
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  // Fixed: split into two separate checks to avoid nested quantifier ReDoS
  /https?:\/\/\S{0,100}(paypa1|g00gle|arnazon|micros0ft|app1e|faceb00k)/i,
];

function containsUnsafeLink(text: string): boolean {
  return UNSAFE_LINK_PATTERNS.some(re => re.test(text));
}

// ─── In-memory per-IP rate limiting ──────────────────────────────────────────

interface RateEntry { count: number; windowStart: number }
const ipRateMap = new Map<string, RateEntry>();

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;              // max 5 new threads per IP per hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    ipRateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count++;
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [ip, entry] of ipRateMap) {
    if (entry.windowStart < cutoff) ipRateMap.delete(ip);
  }
}, RATE_WINDOW_MS);

// ─── Database-backed IP block check ──────────────────────────────────────────

function isIpBlockedInDb(ip: string): boolean {
  try {
    const row = db.prepare(`
      SELECT id FROM blocked_ips
      WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `).get(ip);
    return !!row;
  } catch {
    return false; // table may not exist yet on first boot
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SafetyCheckResult {
  blocked: boolean;
  reason?: string;
  severity: Severity;
  flagged: boolean;
  flagReason?: string;
  matchedPhrase?: string | null;
}

/**
 * Run all safety checks on a message body.
 * @param body        The message text to check
 * @param ip          The sender's IP address
 * @param isNewThread true for the first message in a thread (rate-limited)
 */
export function checkMessageSafety(
  body: string,
  ip: string,
  isNewThread = true,
): SafetyCheckResult {
  // 1. Database IP block — hard block
  if (isIpBlockedInDb(ip)) {
    return {
      blocked: true,
      reason: 'Your access to this platform has been restricted.',
      severity: 'critical',
      flagged: true,
      flagReason: 'Blocked IP address',
    };
  }

  // 2. Rate limit — only for new threads
  if (isNewThread && isRateLimited(ip)) {
    return {
      blocked: true,
      reason: 'Too many messages sent recently. Please wait a while before trying again.',
      severity: 'warning',
      flagged: true,
      flagReason: 'Rate limit exceeded',
    };
  }

  // 3. Severity scoring
  const { severity, matchedPhrase } = scoreSeverity(body);

  // Critical and high severity = hard block
  if (severity === 'critical' || severity === 'high') {
    return {
      blocked: true,
      reason: 'Your message contains content that is not permitted on this platform.',
      severity,
      flagged: true,
      flagReason: `Matched phrase: "${matchedPhrase}"`,
      matchedPhrase,
    };
  }

  // 4. Unsafe links — hard block
  if (containsUnsafeLink(body)) {
    return {
      blocked: true,
      reason: 'Your message contains a link that has been flagged as potentially unsafe.',
      severity: 'high',
      flagged: true,
      flagReason: 'Unsafe link detected',
    };
  }

  // Warning severity — allow but flag for review
  if (severity === 'warning') {
    return {
      blocked: false,
      severity: 'warning',
      flagged: true,
      flagReason: `Matched phrase: "${matchedPhrase}"`,
      matchedPhrase,
    };
  }

  return { blocked: false, severity: 'normal', flagged: false };
}
