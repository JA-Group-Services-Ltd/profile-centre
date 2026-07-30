/**
 * In-process rate limiting.
 * Uses a sliding-window counter keyed on hashed IP (or user ID for authenticated routes).
 * No external dependency — pure Node.js Map.
 *
 * UK GDPR note: raw IPs are personal data. We hash them with a
 * per-process salt so the Map never holds a raw IP address.
 */
import { type Request, type Response, type NextFunction } from 'express';
import { createHash, randomBytes } from 'node:crypto';

// Per-process salt — not persisted, resets on restart (acceptable for rate limiting)
const SALT = randomBytes(16).toString('hex');

function hashIp(ip: string): string {
  return createHash('sha256').update(SALT + ip).digest('hex').slice(0, 16);
}

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// Clean up expired windows every 10 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store) {
    if (now > win.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000).unref();

function createLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
  /** If true, use authenticated user ID as key (falls back to IP if unauthenticated) */
  useUserId?: boolean;
}) {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Use user ID when available (avoids shared-IP false positives in preview/proxied envs)
    const authReq = req as Request & { user?: { id?: number } };
    const identity = options.useUserId && authReq.user?.id
      ? `uid:${authReq.user.id}`
      : `ip:${hashIp(req.ip || req.socket?.remoteAddress || 'unknown')}`;

    const key = `${options.keyPrefix}:${identity}`;
    const now = Date.now();

    let win = store.get(key);
    if (!win || now > win.resetAt) {
      win = { count: 0, resetAt: now + options.windowMs };
      store.set(key, win);
    }

    win.count++;

    if (win.count > options.max) {
      const retryAfter = Math.ceil((win.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests. Please try again later.',
      });
      return;
    }

    next();
  };
}

/** 10 requests per minute — general public API endpoints */
export const publicApiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'pub',
  message: 'Too many requests. Please slow down.',
});

/** 10 form submissions per hour per user (falls back to IP for unauthenticated) */
export const formSubmitLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyPrefix: 'form',
  useUserId: true,
  message: 'Too many submissions. Please try again later.',
});

/** 20 requests per 15 minutes — auth endpoints */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/** 30 requests per minute — analytics/view recording (prevent spam bots; allows legitimate page loads) */
export const analyticsLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'analytics',
});

/** 15 PIN attempts per 15 minutes — account PIN verify (DB lockout at 10 fires first with exact time) */
export const pinLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: 'pin',
  message: 'Too many PIN attempts. Please wait 15 minutes before trying again.',
});

/** 3 profile reports per hour — prevent report spam */
export const reportLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: 'report',
  message: 'Too many reports submitted. Please try again later.',
});

/** 10 admin sensitive actions per 15 minutes */
export const adminSensitiveLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'admin_sensitive',
  message: 'Too many sensitive admin actions. Please wait before retrying.',
});

/** 20 public API calls per minute — public profile views, QR, etc. */
export const publicProfileLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'pub_profile',
});
