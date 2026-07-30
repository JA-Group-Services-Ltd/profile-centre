/**
 * Admin PIN middleware
 *
 * requireAdminPin
 *   Checks that the admin has a valid, unexpired PIN session before allowing
 *   access to sensitive admin API routes. Returns 403 with `pinRequired: true`
 *   if the PIN session is missing or has expired (15-minute inactivity timeout).
 *   The frontend AdminPinGate listens for this response and re-shows the PIN
 *   entry screen.
 *
 * requireAdminPinHighRisk
 *   For the highest-risk actions (SAR export, delete user, legal policy changes,
 *   billing controls, etc.) the client must supply a short-lived challenge token
 *   obtained from POST /api/admin/pin/challenge. This middleware validates the
 *   token and rejects the request if it is missing, expired, or for the wrong
 *   action. The token is one-time-use and expires after 5 minutes.
 *
 * Neither middleware stores, logs, or returns the PIN itself.
 */
import type { Request, Response, NextFunction } from 'express';
import { isPinSessionValid, validateChallengeToken } from '../api/admin/admin-pin.js';

// ── requireAdminPin ────────────────────────────────────────────────────────────

/**
 * Require a valid, unexpired PIN session.
 * Apply to any admin route that handles sensitive data or mutations.
 *
 * On success: calls next().
 * On failure: 403 JSON { success: false, pinRequired: true, expired?: true }
 */
export function requireAdminPin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session?.adminUserId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (!isPinSessionValid(req)) {
    const wasVerified = !!req.session?.adminPinVerified;
    res.status(403).json({
      success: false,
      pinRequired: true,
      expired: wasVerified, // true = was verified but timed out; false = never verified
      error: wasVerified
        ? 'PIN session expired. Please re-enter your PIN.'
        : 'PIN verification required.',
    });
    return;
  }

  // Refresh the activity timestamp on every protected request
  req.session.adminPinVerifiedAt = Date.now();
  // Non-blocking save — we don't need to await this
  req.session.save(() => {});

  next();
}

// ── requireAdminPinHighRisk ────────────────────────────────────────────────────

/**
 * Require a valid one-time challenge token for a specific high-risk action.
 *
 * The client must:
 *   1. Call POST /api/admin/pin/challenge with { pin, action } to get a token
 *   2. Include the token in the request header: X-Admin-Pin-Token: <token>
 *      AND the action in: X-Admin-Pin-Action: <action>
 *
 * On success: calls next().
 * On failure: 403 JSON { success: false, challengeRequired: true }
 *
 * @param action  The expected action string (e.g. 'sar_export', 'delete_user')
 */
export function requireAdminPinHighRisk(action: string) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.session?.adminUserId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const token = (req.headers['x-admin-pin-token'] as string | undefined)?.trim();
    const claimedAction = (req.headers['x-admin-pin-action'] as string | undefined)?.trim();

    if (!token || !claimedAction) {
      res.status(403).json({
        success: false,
        challengeRequired: true,
        action,
        error: 'This action requires PIN re-authentication.',
      });
      return;
    }

    // Validate token: must match adminId, action, and not be expired/used
    const adminId = req.session.adminUserId!;
    const valid = validateChallengeToken(token, adminId, action);

    if (!valid) {
      res.status(403).json({
        success: false,
        challengeRequired: true,
        action,
        error: 'Invalid or expired PIN challenge token. Please re-authenticate.',
      });
      return;
    }

    next();
  };
}
