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

  // Content Security Policy — nonce-based for scripts (no unsafe-inline)
  // - script-src: only same-origin scripts + the per-request nonce
  // - style-src: 'unsafe-inline' is still required for Tailwind/Radix inline styles
  //   (eliminating it would require a full CSS-in-JS rewrite — tracked separately)
  // - img-src: self + data URIs (QR codes) + blob + airo assets CDN
  // - connect-src: self + Microsoft OIDC / B2C / CIAM endpoints
  // - frame-ancestors 'none': belt-and-braces clickjacking protection
  const csp = [
    "default-src 'self'",
    // nonce covers inline hydration script; 'self' covers sw.js + all JS bundles
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://airo-assets.imgix.net https://*.airoapp.ai",
    // connect-src must cover both page fetches AND service worker fetches
    "connect-src 'self' https://login.microsoftonline.com https://*.b2clogin.com https://*.ciamlogin.com",
    // worker-src: allows the browser to load and execute /sw.js as a service worker
    // Without this, strict CSP implementations (Chrome on Android, Firefox) silently
    // block SW registration even though the file is same-origin.
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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
