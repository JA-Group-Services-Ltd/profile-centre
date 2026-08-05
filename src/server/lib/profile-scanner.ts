/**
 * Profile Safety Scanner
 * ─────────────────────────────────────────────────────────────────────────────
 * Analyses a Sousa Murray Profiles for safety/policy violations and produces a
 * structured risk report for admin review.
 *
 * Scan categories:
 *   spam_scam            — spam/scam indicators, investment/crypto wording
 *   impersonation        — impersonation signals (celebrity, brand, official)
 *   harassment_abuse     — abusive or threatening language
 *   adult_unsafe         — adult / NSFW content indicators
 *   illegal_content      — illegal content signals
 *   misleading_claims    — unverifiable superlatives, fake credentials
 *   suspicious_links     — phishing, malware, redirect chains, broken URLs
 *   financial_fraud      — requests for bank details, passwords, crypto
 *   platform_tampering   — attempts to hide report button / legal footer
 *   hidden_content       — obfuscated text, invisible elements
 *
 * Risk levels: low | medium | high | critical
 * Risk score:  0–100
 *
 * Privacy: scan results are internal-only. Never exposed to reporter or owner.
 */

import db from '../db.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ScanEvidence {
  field: string;
  snippet: string;
  rule: string;
}

export interface ScanResult {
  profileId: number;
  profileType: string;
  riskLevel: RiskLevel;
  riskScore: number;
  issueCategories: string[];
  summary: string;
  evidence: ScanEvidence[];
  recommendedAction: string;
  scannedAt: string;
  scanVersion: string;
}

// ─── Pattern libraries ────────────────────────────────────────────────────────

// Spam / scam
const SPAM_SCAM_PATTERNS: RegExp[] = [
  /\b(click here|act now|limited time|urgent|congratulations you (have|'ve) won)\b/i,
  /\b(make money fast|earn \$[\d,]+|passive income|financial freedom|work from home)\b/i,
  /\b(mlm|multi.?level marketing|pyramid scheme|downline|upline|recruit)\b/i,
  /\b(nigerian prince|inheritance|lottery winner|unclaimed funds)\b/i,
  /\b(100% (free|guaranteed)|no risk|zero risk|guaranteed returns?)\b/i,
  /\b(whatsapp me|telegram me|dm me for details|contact me privately)\b/i,
  /\b(buy followers|get followers|boost your (profile|account|page))\b/i,
];

// Crypto / investment scam
const FINANCIAL_FRAUD_PATTERNS: RegExp[] = [
  /\b(bitcoin|btc|ethereum|eth|crypto|nft|defi|web3)\s+(investment|profit|return|signal|trading)\b/i,
  /\b(forex|binary options|trading signal|account manager|recovery (agent|expert|specialist))\b/i,
  /\b(send (me|us) (your )?(bank|account|card|pin|password|otp|verification code))\b/i,
  /\b(wire transfer|western union|moneygram|gift card payment)\b/i,
  /\b(double your (money|investment|bitcoin)|guaranteed (profit|return|income))\b/i,
  /\b(lost crypto|recover (stolen|lost) (funds|crypto|bitcoin))\b/i,
  /\b(investment (platform|opportunity|scheme)|high (yield|return) investment)\b/i,
  /\b(account (details|number|credentials)|sort code|routing number)\b/i,
  /\b(password|pin|otp|one.?time.?password|verification code)\b/i,
];

// Impersonation
const IMPERSONATION_PATTERNS: RegExp[] = [
  /\b(official|verified|certified|authorised|authorized)\s+(account|profile|representative|agent)\b/i,
  /\b(i am|i'm|this is)\s+(the )?(real|official|genuine|authentic)\b/i,
  /\b(elon musk|jeff bezos|bill gates|mark zuckerberg|rishi sunak|keir starmer)\b/i,
  /\b(hmrc|nhs|police|government|official uk|uk gov|gov\.uk)\b/i,
  /\b(microsoft support|apple support|google support|amazon support|paypal support)\b/i,
  /\b(ceo|founder|director)\s+of\s+(google|apple|microsoft|amazon|meta|tesla)\b/i,
];

// Harassment / abuse
const HARASSMENT_PATTERNS: RegExp[] = [
  /\b(kill yourself|kys|go die|i will (hurt|kill|find) you|you deserve to die)\b/i,
  /\b(f+\*+ck|sh+\*+t|b+\*+tch|c+\*+nt|n+\*+gger|f+\*+ggot)\b/i,
  /\b(doxx|doxing|swat|swatting|i know where you live|i have your address)\b/i,
  /\b(rape|sexual assault|molest)\b/i,
];

// Adult / unsafe
const ADULT_PATTERNS: RegExp[] = [
  /\b(onlyfans|only fans|adult content|explicit content|nsfw|18\+|xxx)\b/i,
  /\b(escort|massage with extras|happy ending|adult services|companionship services)\b/i,
  /\b(nude|naked|topless|strip|cam girl|cam boy|webcam model)\b/i,
];

// Illegal content
const ILLEGAL_PATTERNS: RegExp[] = [
  /\b(drugs for sale|buy (weed|cocaine|heroin|meth|pills)|darknet|dark web)\b/i,
  /\b(counterfeit|fake (passport|id|documents|currency)|forged)\b/i,
  /\b(child (porn|abuse|exploitation)|cp |csam)\b/i,
  /\b(weapons for sale|buy (guns|firearms|explosives|ammo) online)\b/i,
  /\b(human trafficking|people smuggling|illegal immigration services)\b/i,
];

// Misleading claims
const MISLEADING_PATTERNS: RegExp[] = [
  /\b(#1 in (the world|uk|europe|london)|world.?s (best|leading|top)|number one (provider|company|agency))\b/i,
  /\b(award.?winning|multi.?award|5.?star rated|100% (success|satisfaction) (rate|guaranteed))\b/i,
  /\b(fca (regulated|authorised|approved)|regulated by (fca|pra|cma))\b/i,
  /\b(doctor|dr\.|physician|surgeon|solicitor|barrister|chartered)\b/i,
];

// Phishing / suspicious link patterns (applied to URLs)
const SUSPICIOUS_URL_PATTERNS: RegExp[] = [
  /bit\.ly|tinyurl|t\.co|ow\.ly|goo\.gl|rb\.gy|cutt\.ly|short\.io/i,
  /\.(tk|ml|ga|cf|gq|xyz|top|click|download|zip|review|country|kim|science|work|party)\b/i,
  /paypal.+login|apple.+id|microsoft.+login|google.+signin|amazon.+login/i,
  /verify.+account|confirm.+identity|update.+payment|suspended.+account/i,
  /free.+(iphone|gift|prize|voucher|amazon)/i,
  /login\.(php|aspx|html?)\?/i,
];

// Platform tampering (CSS / HTML tricks to hide report button)
const PLATFORM_TAMPER_PATTERNS: RegExp[] = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0/i,
  /z-index\s*:\s*-/i,
  /pointer-events\s*:\s*none/i,
  /position\s*:\s*(fixed|absolute).*z-index\s*:\s*[1-9]\d{3,}/i,
  /#report|\.report|report-button|report-pill|report-this/i,
  /footer|legal-footer|platform-footer/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>()[\]{}]+/gi;
  return Array.from(text.matchAll(urlRegex)).map(m => m[0]).slice(0, 30);
}

function checkPatterns(
  text: string,
  field: string,
  patterns: RegExp[],
  ruleName: string,
  evidence: ScanEvidence[],
): number {
  let hits = 0;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      hits++;
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      evidence.push({
        field,
        snippet: `…${text.slice(start, end).replace(/\n/g, ' ')}…`,
        rule: ruleName,
      });
      if (hits >= 3) break; // cap evidence per category
    }
  }
  return hits;
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function buildSummary(categories: string[], riskLevel: RiskLevel, evidence: ScanEvidence[]): string {
  if (categories.length === 0) return 'No significant policy violations detected. Profile appears clean.';
  const catLabels: Record<string, string> = {
    spam_scam:          'spam or scam content',
    impersonation:      'impersonation signals',
    harassment_abuse:   'harassment or abusive language',
    adult_unsafe:       'adult or unsafe content',
    illegal_content:    'illegal content indicators',
    misleading_claims:  'misleading claims',
    suspicious_links:   'suspicious or phishing-style links',
    financial_fraud:    'financial fraud indicators (bank details / crypto scam)',
    platform_tampering: 'attempts to hide platform controls',
    hidden_content:     'hidden or obfuscated content',
  };
  const labels = categories.map(c => catLabels[c] ?? c).join(', ');
  const topEvidence = evidence.slice(0, 2).map(e => `"${e.snippet.slice(0, 80)}"` ).join('; ');
  return `${riskLevel.toUpperCase()} risk — detected: ${labels}. Evidence: ${topEvidence || 'see full scan details'}.`;
}

function buildRecommendation(riskLevel: RiskLevel, categories: string[]): string {
  if (riskLevel === 'critical') {
    return 'Immediately hide profile pending review. Notify admin team. Consider permanent suspension if confirmed.';
  }
  if (riskLevel === 'high') {
    if (categories.includes('financial_fraud') || categories.includes('illegal_content')) {
      return 'Suspend profile pending investigation. Escalate to compliance team.';
    }
    return 'Review profile content urgently. Consider temporary hide while reviewing.';
  }
  if (riskLevel === 'medium') {
    return 'Review profile content. Contact profile owner if policy breach confirmed.';
  }
  return 'Monitor. No immediate action required — review at next moderation cycle.';
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

export async function scanProfile(profileId: number, profileType: string): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();

  // ── Fetch profile data ──────────────────────────────────────────────────────
  const profile = db.prepare(`
    SELECT
      display_name, bio, bio_html, business_name, business_description,
      business_description_html, username, biz_slug, profile_type,
      website, phone, email, address, job_title, company,
      services, social_links, announcements, faqs, gallery,
      custom_css, custom_html
    FROM profiles WHERE id = ? LIMIT 1
  `).get(profileId) as Record<string, unknown> | undefined;

  if (!profile) {
    return {
      profileId, profileType,
      riskLevel: 'low', riskScore: 0,
      issueCategories: [],
      summary: 'Profile not found — scan skipped.',
      evidence: [],
      recommendedAction: 'Verify profile still exists.',
      scannedAt, scanVersion: '1.0',
    };
  }

  const evidence: ScanEvidence[] = [];
  const categoryScores: Record<string, number> = {};

  // ── Build text corpus ───────────────────────────────────────────────────────
  const textFields: [string, string][] = [
    ['display_name',              String(profile.display_name ?? '')],
    ['bio',                       String(profile.bio ?? '')],
    ['bio_html',                  String(profile.bio_html ?? '')],
    ['business_name',             String(profile.business_name ?? '')],
    ['business_description',      String(profile.business_description ?? '')],
    ['business_description_html', String(profile.business_description_html ?? '')],
    ['job_title',                 String(profile.job_title ?? '')],
    ['company',                   String(profile.company ?? '')],
    ['address',                   String(profile.address ?? '')],
  ];

  // Parse JSON arrays
  const tryParseArray = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    try { const p = JSON.parse(String(v ?? '[]')); return Array.isArray(p) ? p : []; } catch { return []; }
  };

  const services     = tryParseArray(profile.services);
  const socialLinks  = tryParseArray(profile.social_links);
  const announcements = tryParseArray(profile.announcements);
  const faqs         = tryParseArray(profile.faqs);

  for (const svc of services) {
    const s = svc as Record<string, unknown>;
    textFields.push(['service.name',        String(s.name ?? '')]);
    textFields.push(['service.description', String(s.description ?? '')]);
  }
  for (const ann of announcements) {
    const a = ann as Record<string, unknown>;
    textFields.push(['announcement.title', String(a.title ?? '')]);
    textFields.push(['announcement.body',  String(a.body ?? '')]);
  }
  for (const faq of faqs) {
    const f = faq as Record<string, unknown>;
    textFields.push(['faq.question', String(f.question ?? '')]);
    textFields.push(['faq.answer',   String(f.answer ?? '')]);
  }

  // ── Text analysis ───────────────────────────────────────────────────────────
  for (const [field, text] of textFields) {
    if (!text.trim()) continue;

    const spamHits = checkPatterns(text, field, SPAM_SCAM_PATTERNS, 'spam_scam', evidence);
    if (spamHits) categoryScores.spam_scam = (categoryScores.spam_scam ?? 0) + spamHits * 12;

    const fraudHits = checkPatterns(text, field, FINANCIAL_FRAUD_PATTERNS, 'financial_fraud', evidence);
    if (fraudHits) categoryScores.financial_fraud = (categoryScores.financial_fraud ?? 0) + fraudHits * 20;

    const impHits = checkPatterns(text, field, IMPERSONATION_PATTERNS, 'impersonation', evidence);
    if (impHits) categoryScores.impersonation = (categoryScores.impersonation ?? 0) + impHits * 18;

    const harHits = checkPatterns(text, field, HARASSMENT_PATTERNS, 'harassment_abuse', evidence);
    if (harHits) categoryScores.harassment_abuse = (categoryScores.harassment_abuse ?? 0) + harHits * 25;

    const adultHits = checkPatterns(text, field, ADULT_PATTERNS, 'adult_unsafe', evidence);
    if (adultHits) categoryScores.adult_unsafe = (categoryScores.adult_unsafe ?? 0) + adultHits * 20;

    const illegalHits = checkPatterns(text, field, ILLEGAL_PATTERNS, 'illegal_content', evidence);
    if (illegalHits) categoryScores.illegal_content = (categoryScores.illegal_content ?? 0) + illegalHits * 30;

    const misleadHits = checkPatterns(text, field, MISLEADING_PATTERNS, 'misleading_claims', evidence);
    if (misleadHits) categoryScores.misleading_claims = (categoryScores.misleading_claims ?? 0) + misleadHits * 8;
  }

  // ── URL analysis ────────────────────────────────────────────────────────────
  const allText = textFields.map(([, t]) => t).join(' ');
  const urls = extractUrls(allText);

  // Also extract URLs from social links
  for (const sl of socialLinks) {
    const s = sl as Record<string, unknown>;
    if (s.url) urls.push(String(s.url));
  }

  for (const url of urls) {
    const urlHits = checkPatterns(url, 'url', SUSPICIOUS_URL_PATTERNS, 'suspicious_links', evidence);
    if (urlHits) categoryScores.suspicious_links = (categoryScores.suspicious_links ?? 0) + urlHits * 15;
  }

  // ── Custom CSS / HTML platform tampering check ──────────────────────────────
  // The site editor has been removed, but legacy custom_css/custom_html fields
  // may still contain data from before removal — scan them for safety.
  {
    const customCss  = String(profile.custom_css ?? '');
    const customHtml = String(profile.custom_html ?? '');

    if (customCss || customHtml) {
      const cssHits  = checkPatterns(customCss,  'custom_css',  PLATFORM_TAMPER_PATTERNS, 'platform_tampering', evidence);
      const htmlHits = checkPatterns(customHtml, 'custom_html', PLATFORM_TAMPER_PATTERNS, 'platform_tampering', evidence);
      if (cssHits + htmlHits > 0) {
        categoryScores.platform_tampering = (categoryScores.platform_tampering ?? 0) + (cssHits + htmlHits) * 20;
      }

      // Check for hidden/obfuscated content in HTML
      const hiddenPatterns = [/style=["'][^"']*display\s*:\s*none/i, /style=["'][^"']*opacity\s*:\s*0/i, /<!--.*?-->/gs];
      for (const p of hiddenPatterns) {
        if (p.test(customHtml)) {
          categoryScores.hidden_content = (categoryScores.hidden_content ?? 0) + 10;
          evidence.push({ field: 'custom_html', snippet: 'Hidden/obfuscated content detected in legacy custom HTML', rule: 'hidden_content' });
          break;
        }
      }
    }
  }

  // ── Compute final score ─────────────────────────────────────────────────────
  const issueCategories = Object.entries(categoryScores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat]) => cat);

  let riskScore = Math.min(100, Object.values(categoryScores).reduce((a, b) => a + b, 0));

  // Boost score for critical combos
  if (categoryScores.illegal_content && categoryScores.illegal_content >= 30) riskScore = Math.max(riskScore, 80);
  if (categoryScores.financial_fraud && categoryScores.financial_fraud >= 40) riskScore = Math.max(riskScore, 70);
  if (categoryScores.harassment_abuse && categoryScores.harassment_abuse >= 25) riskScore = Math.max(riskScore, 65);
  if (categoryScores.platform_tampering && categoryScores.platform_tampering >= 20) riskScore = Math.max(riskScore, 60);

  const riskLevel = scoreToLevel(riskScore);
  const summary = buildSummary(issueCategories, riskLevel, evidence);
  const recommendedAction = buildRecommendation(riskLevel, issueCategories);

  return {
    profileId, profileType,
    riskLevel, riskScore,
    issueCategories,
    summary,
    evidence: evidence.slice(0, 20), // cap at 20 evidence items
    recommendedAction,
    scannedAt,
    scanVersion: '1.0',
  };
}

// ─── Persist scan + update report ─────────────────────────────────────────────

export function persistScan(
  result: ScanResult,
  reportId: number | null,
  triggeredBy: 'auto_report' | 'admin_manual',
): number {
  const row = db.prepare(`
    INSERT INTO profile_scans
      (report_id, profile_id, profile_type, risk_level, risk_score,
       issue_categories, summary, evidence, recommended_action,
       scan_version, triggered_by, auto_hidden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    reportId,
    result.profileId,
    result.profileType,
    result.riskLevel,
    result.riskScore,
    JSON.stringify(result.issueCategories),
    result.summary,
    JSON.stringify(result.evidence),
    result.recommendedAction,
    result.scanVersion,
    triggeredBy,
  );

  const scanId = Number(row.lastInsertRowid);

  // Update the issue_report row with scan summary
  if (reportId) {
    db.prepare(`
      UPDATE issue_reports
      SET scan_status = 'completed',
          scan_risk_level = ?,
          scan_summary = ?,
          scan_completed_at = CURRENT_TIMESTAMP,
          scan_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(result.riskLevel, result.summary, scanId, reportId);
  }

  return scanId;
}

// ─── Auto-hide on critical risk ───────────────────────────────────────────────

export function autoHideIfCritical(
  result: ScanResult,
  scanId: number,
): boolean {
  if (result.riskLevel !== 'critical') return false;

  // Only auto-hide if not already suspended/hidden
  const profile = db.prepare(
    'SELECT is_suspended, is_hidden FROM profiles WHERE id = ?'
  ).get(result.profileId) as { is_suspended: number; is_hidden: number } | undefined;

  if (!profile || profile.is_suspended || profile.is_hidden) return false;

  db.prepare(`
    UPDATE profiles
    SET is_hidden = 1, hidden_at = datetime('now'), hidden_by = 'auto_scan',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(result.profileId);

  db.prepare(`
    UPDATE profile_scans SET auto_hidden = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(scanId);

  return true;
}

// ─── Full scan pipeline (scan + persist + optional auto-hide) ─────────────────

export async function runScanPipeline(
  profileId: number,
  profileType: string,
  reportId: number | null,
  triggeredBy: 'auto_report' | 'admin_manual' = 'auto_report',
): Promise<{ result: ScanResult; scanId: number; autoHidden: boolean }> {
  const result = await scanProfile(profileId, profileType);
  const scanId = persistScan(result, reportId, triggeredBy);
  const autoHidden = autoHideIfCritical(result, scanId);
  return { result, scanId, autoHidden };
}
