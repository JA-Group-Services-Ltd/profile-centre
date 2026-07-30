/**
 * blockDuringAssistedSession
 *
 * Middleware that rejects requests to dangerous endpoints when the current
 * session is an admin-assisted impersonation session.
 *
 * Blocked actions: delete account, change email, change password,
 * export personal data, change payment method, transfer ownership.
 *
 * Apply to any route that performs one of these actions:
 *   app.delete('/api/account', blockDuringAssistedSession, handler)
 *   app.put('/api/account/email', blockDuringAssistedSession, handler)
 */
import { type Request, type Response, type NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

export function blockDuringAssistedSession(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.isAssistedSession) {
    res.status(403).json({
      success: false,
      error: 'This action is not permitted during an assisted access session.',
      code: 'ASSISTED_SESSION_BLOCKED',
    });
    return;
  }
  next();
}
