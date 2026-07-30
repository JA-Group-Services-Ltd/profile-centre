/**
 * Onboarding / Assisted Setup API
 *
 * GET  /api/onboarding/state          — current onboarding state for the logged-in user
 * POST /api/onboarding/step           — mark a step complete
 * POST /api/onboarding/dismiss        — dismiss the overlay permanently (no auto-reopen)
 * POST /api/onboarding/reset          — re-open the overlay (user can trigger from Help Centre)
 * GET  /api/legal/reaccept-status     — whether user needs to re-accept terms
 * POST /api/legal/reaccept            — record re-acceptance of terms
 */
import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';

// Current terms version — bump this string to force all users to re-accept
const CURRENT_TERMS_VERSION = '2.0';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUser(userId: number) {
  return db.prepare(`
    SELECT id, name, email, role,
           assisted_setup_dismissed_at,
           assisted_setup_completed_steps,
           legal_reaccepted_at,
           legal_reaccept_version,
           terms_consent, terms_consent_at,
           created_at
    FROM users WHERE id = ?
  `).get(userId) as Record<string, unknown> | undefined;
}

function parseSteps(raw: unknown): string[] {
  try { return JSON.parse(String(raw || '[]')); } catch { return []; }
}

function isSetupActive(user: Record<string, unknown>): boolean {
  const dismissed = user.assisted_setup_dismissed_at as string | null;
  // Once dismissed, it stays dismissed permanently — user can re-open from sidebar
  return !dismissed;
}

function needsLegalReaccept(user: Record<string, unknown>): boolean {
  const version = user.legal_reaccept_version as string | null;
  const acceptedAt = user.legal_reaccepted_at as string | null;
  // If they've never re-accepted the current version, they need to
  if (!acceptedAt || version !== CURRENT_TERMS_VERSION) return true;
  return false;
}

// ── GET /api/onboarding/state ─────────────────────────────────────────────────

export async function getOnboardingState(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const completedSteps = parseSteps(user.assisted_setup_completed_steps);
  const setupActive = isSetupActive(user);
  const requiresLegalReaccept = needsLegalReaccept(user);

  return res.json({
    success: true,
    data: {
      setupActive,
      completedSteps,
      dismissedAt: user.assisted_setup_dismissed_at ?? null,
      requiresLegalReaccept,
      currentTermsVersion: CURRENT_TERMS_VERSION,
      legalReacceptedAt: user.legal_reaccepted_at ?? null,
    },
  });
}

// ── POST /api/onboarding/step ─────────────────────────────────────────────────

export async function markOnboardingStep(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { stepId } = req.body as { stepId?: string };
  if (!stepId) return res.status(400).json({ error: 'stepId is required' });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const steps = parseSteps(user.assisted_setup_completed_steps);
  if (!steps.includes(stepId)) steps.push(stepId);

  db.prepare(`UPDATE users SET assisted_setup_completed_steps = ? WHERE id = ?`)
    .run(JSON.stringify(steps), userId);

  return res.json({ success: true, completedSteps: steps });
}

// ── POST /api/onboarding/dismiss ──────────────────────────────────────────────

export async function dismissOnboarding(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  db.prepare(`UPDATE users SET assisted_setup_dismissed_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(userId);

  return res.json({ success: true });
}

// ── POST /api/onboarding/reset ────────────────────────────────────────────────

export async function resetOnboarding(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  db.prepare(`UPDATE users SET assisted_setup_dismissed_at = NULL, assisted_setup_completed_steps = '[]' WHERE id = ?`)
    .run(userId);

  return res.json({ success: true });
}

// ── GET /api/legal/reaccept-status ───────────────────────────────────────────

export async function getLegalReacceptStatus(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    success: true,
    requiresReaccept: needsLegalReaccept(user),
    currentVersion: CURRENT_TERMS_VERSION,
    acceptedVersion: user.legal_reaccept_version ?? null,
    acceptedAt: user.legal_reaccepted_at ?? null,
  });
}

// ── POST /api/legal/reaccept ──────────────────────────────────────────────────

export async function submitLegalReaccept(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { termsAccepted, privacyAccepted } = req.body as {
    termsAccepted?: boolean;
    privacyAccepted?: boolean;
  };

  if (!termsAccepted || !privacyAccepted) {
    return res.status(400).json({ error: 'You must accept both the Terms of Service and Privacy Policy to continue.' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.socket?.remoteAddress
    ?? null;

  db.prepare(`
    UPDATE users
    SET legal_reaccepted_at = CURRENT_TIMESTAMP,
        legal_reaccept_version = ?,
        terms_consent = 1,
        terms_consent_at = CURRENT_TIMESTAMP,
        privacy_consent = 1,
        privacy_consent_at = CURRENT_TIMESTAMP,
        consent_ip = ?,
        consent_version = ?
    WHERE id = ?
  `).run(CURRENT_TERMS_VERSION, ip, CURRENT_TERMS_VERSION, userId);

  return res.json({ success: true, version: CURRENT_TERMS_VERSION });
}
