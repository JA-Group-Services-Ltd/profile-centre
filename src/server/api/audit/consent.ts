/**
 * POST /api/audit/consent
 * Logs cookie consent choices to the audit log.
 * Public endpoint — no auth required (visitor may not be logged in).
 */
import { type Request, type Response } from 'express';
import { writeAudit } from '../../lib/audit.js';

export default async function logConsent(req: Request, res: Response) {
  try {
    const { necessary, analytics, marketing, preferences } = req.body;
    writeAudit({
      actorType: 'visitor',
      action: 'cookie_consent',
      resourceType: 'cookie',
      details: JSON.stringify({ necessary: !!necessary, analytics: !!analytics, marketing: !!marketing, preferences: !!preferences }),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // non-fatal
  }
}
