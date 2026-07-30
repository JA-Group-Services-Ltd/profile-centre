/**
 * Audit middleware — automatically logs significant API actions.
 * Attaches to mutating routes (POST/PUT/PATCH/DELETE) after auth.
 */
import { type Response, type NextFunction } from 'express';
import { type AuthRequest } from './auth.js';
import { writeAudit } from '../lib/audit.js';

// Map route patterns to human-readable resource types
const RESOURCE_MAP: { pattern: RegExp; resourceType: string; actionFn?: (method: string) => string }[] = [
  { pattern: /^\/api\/profiles/, resourceType: 'profile' },
  { pattern: /^\/api\/links/, resourceType: 'link' },
  { pattern: /^\/api\/enquiries/, resourceType: 'enquiry' },
  { pattern: /^\/api\/messages/, resourceType: 'message' },
  { pattern: /^\/api\/billing/, resourceType: 'billing' },
  { pattern: /^\/api\/points/, resourceType: 'points' },
  { pattern: /^\/api\/notifications/, resourceType: 'notification' },
  { pattern: /^\/api\/account/, resourceType: 'account' },
  { pattern: /^\/api\/users/, resourceType: 'user' },
  { pattern: /^\/api\/support/, resourceType: 'support_request' },
  { pattern: /^\/api\/admin\/users/, resourceType: 'admin_user' },
  { pattern: /^\/api\/admin\/plans/, resourceType: 'admin_plan' },
  { pattern: /^\/api\/admin\/settings/, resourceType: 'admin_settings' },
  { pattern: /^\/api\/admin\/branding/, resourceType: 'admin_branding' },
  { pattern: /^\/api\/admin\/stripe/, resourceType: 'admin_stripe' },
  { pattern: /^\/api\/admin\/points/, resourceType: 'admin_points' },
  { pattern: /^\/api\/admin\/legal/, resourceType: 'legal_policy' },
  { pattern: /^\/api\/admin\/affiliates/, resourceType: 'affiliate' },
  { pattern: /^\/api\/admin\/referrals/, resourceType: 'referral' },
  { pattern: /^\/api\/admin\/features/, resourceType: 'platform_feature' },
  { pattern: /^\/api\/affiliate/, resourceType: 'affiliate' },
  { pattern: /^\/api\/referral/, resourceType: 'referral' },
];

function methodToAction(method: string, path: string): string {
  if (path.includes('/click')) return 'click';
  if (path.includes('/reply')) return 'reply';
  if (path.includes('/accept')) return 'accept';
  if (path.includes('/read')) return 'mark_read';
  if (path.includes('/cancel')) return 'cancel';
  if (path.includes('/checkout')) return 'checkout';
  if (path.includes('/redeem')) return 'redeem';
  if (path.includes('/adjust')) return 'adjust_points';
  if (path.includes('/fulfil')) return 'fulfil_redemption';
  if (path.includes('/lifetime')) return method === 'POST' ? 'grant_lifetime' : 'revoke_lifetime';
  if (path.includes('/sync')) return 'sync';
  if (path.includes('/approve')) return 'approve';
  if (path.includes('/reject')) return 'reject';
  switch (method) {
    case 'POST': return 'create';
    case 'PUT': return 'update';
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return method.toLowerCase();
  }
}

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Only log mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    // Only log successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const resourceEntry = RESOURCE_MAP.find(r => r.pattern.test(req.path));
      if (resourceEntry) {
        const actor = (req as AuthRequest).user;
        const action = methodToAction(req.method, req.path);
        const resourceId = req.params?.id || req.params?.userId || req.params?.threadId || req.params?.key || null;

        writeAudit({
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? null,
          actorEmail: actor?.email ?? null,
          actorType: req.path.startsWith('/api/admin') ? 'admin' : 'user',
          action,
          resourceType: resourceEntry.resourceType,
          resourceId: resourceId ? String(resourceId) : null,
          details: `${req.method} ${req.path}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        });
      }
    }
    return originalJson(body);
  };

  next();
}
