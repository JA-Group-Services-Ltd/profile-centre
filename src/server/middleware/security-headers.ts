/**
 * Security headers middleware
 * Applied globally in entry.ts before all routes.
 *
 * UK GDPR / NCSC guidance alignment:
 * - HSTS: enforces HTTPS, prevents downgrade attacks
 * - CSP: nonce-based — eliminates unsafe-inline for scripts
 * - X-Frame-Options: clickjacking protection
 * - X-Content-Type-Options: MIME sniffing protection
 * - Referrer-Policy: limits referrer leakage (PII in URLs)
 * - Permissions-Policy: disables unused browser APIs
 * - Cache-Control on API: prevents caching of personal data
 *
 * NONCE STRATEGY:
 * A fresh cryptographic nonce is generated per-request and attached to
 * res.locals.cspNonce. The SSR render path reads it from res.locals and
 * injects it into the Vite hydration <script> tag so the browser accepts
 * the inline script without needing 'unsafe-inline'.
 */
import { type Request, type Response, type NextFunction } from 'express';
import { randomBytes } from 'node:crypto';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Generate a fresh nonce for every request
  const nonce = randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  // HSTS — 1 year, include subdomains (production only; dev has no valid cert)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Remove Express fingerprint header
  res.removeHeader('X-Powered-By');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Limit referrer leakage — important for GDPR (URLs can contain PII)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable unused browser APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );

  // Content Security Policy — nonce-based for first-party scripts.
  // The narrowly scoped tawk.to sources are required for the approved
  // group-wide customer-support widget, its iframe, assets and websocket.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.tawk.to https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://*.tawk.to",
    "img-src 'self' data: blob: https://airo-assets.imgix.net https://*.airoapp.ai https://*.tawk.to https://tawk.link https://cdn.jsdelivr.net https://s3.amazonaws.com",
    "connect-src 'self' https://login.microsoftonline.com https://*.b2clogin.com https://*.ciamlogin.com https://*.tawk.to https://*.tawk.help wss://*.tawk.to",
    "frame-src https://*.tawk.to",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.tawk.to",
    "object-src 'none'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  // Prevent caching of API responses that may contain personal data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}
