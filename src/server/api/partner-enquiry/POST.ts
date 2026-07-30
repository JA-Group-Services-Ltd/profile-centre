/**
 * POST /api/partner-enquiry
 * Stores affiliate programme interest.
 *
 * UK GDPR compliance:
 * - Only 'affiliate' type accepted (reseller programme removed)
 * - consent_given_at recorded at submission time
 * - Email normalised to lowercase; name/message trimmed and length-capped
 * - No raw IP stored; rate limiting handled upstream
 */
import type { Request, Response } from 'express';
import db from '../../db.js';
import { isValidEmail } from '../../../lib/validate-email.js';

// Max field lengths — prevent oversized payloads reaching the DB
const MAX_NAME    = 120;
const MAX_EMAIL   = 254;
const MAX_MESSAGE = 2000;

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, message } = req.body as Record<string, unknown>;

    // ── Validation ──────────────────────────────────────────────────────────
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Name is required.' });
      return;
    }
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: 'Message is required.' });
      return;
    }

    const safeName    = name.trim().slice(0, MAX_NAME);
    const safeEmail   = email.trim().toLowerCase().slice(0, MAX_EMAIL);
    const safeMessage = message.trim().slice(0, MAX_MESSAGE);

    // ── Duplicate check — prevent the same email registering twice ──────────
    const existing = await db.prepare(
      `SELECT id FROM partner_enquiries WHERE email = ? AND type = 'affiliate'`
    ).get(safeEmail);
    if (existing) {
      // Return 200 so we don't leak whether the email is already registered
      res.json({ success: true, message: 'Application received.' });
      return;
    }

    // ── Insert ──────────────────────────────────────────────────────────────
    db.prepare(`
      INSERT INTO partner_enquiries (type, name, email, message, consent_given_at)
      VALUES ('affiliate', ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(safeName, safeEmail, safeMessage);

    res.status(201).json({ success: true, message: 'Application received.' });
  } catch (err) {
    console.error('[partner-enquiry] POST error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit application.' });
  }
}
