/**
 * Safe email validation — avoids ReDoS by splitting on '@' and validating
 * each part independently with bounded, non-backtracking checks.
 * Limits: local part ≤64 chars, domain ≤255 chars, TLD 2–63 chars.
 */

// Safe bounded patterns — no nested quantifiers, no catastrophic backtracking
const LOCAL_RE  = /^[^\s@]{1,64}$/;
const DOMAIN_RE = /^[^\s@]{1,255}$/;
const TLD_RE    = /\.[^\s@.]{2,63}$/;

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  // Split on the LAST '@' — avoids multi-@ ambiguity and keeps each part small
  const atIdx = email.lastIndexOf('@');
  if (atIdx < 1) return false;
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  return LOCAL_RE.test(local) && DOMAIN_RE.test(domain) && TLD_RE.test(domain);
}
