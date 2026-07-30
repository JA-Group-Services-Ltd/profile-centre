/**
 * GET /api/feature-flags
 *
 * Public endpoint — returns only the feature flags that the frontend needs
 * to show/hide UI sections. No sensitive settings are exposed.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';

const FLAG_KEYS = [
  'feature_email_signature',
  'allow_registration',
  'maintenance_mode',
  'cookie_banner_enabled',
  'gdpr_enabled',
] as const;

export default async function handler(_req: Request, res: Response) {
  try {
    const rows = await db.prepare(
      `SELECT key, value FROM admin_settings WHERE key IN (${FLAG_KEYS.map(() => '?').join(',')})`
    ).all(...FLAG_KEYS) as Array<{ key: string; value: string }>;

    const flags: Record<string, string> = {};
    for (const row of rows) {
      flags[row.key] = row.value;
    }

    // Defaults for any missing keys
    const defaults: Record<string, string> = {
      feature_email_signature: '0',  // Beta-only — admin enables per user; never on by default
      allow_registration: '1',
      maintenance_mode: '0',
      cookie_banner_enabled: '1',
      gdpr_enabled: '1',
    };

    const result: Record<string, string> = { ...defaults, ...flags };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[feature-flags] error:', err);
    // Return safe defaults on error — never block the UI
    res.json({
      success: true,
      data: {
        feature_email_signature: '0',  // Beta-only — fail closed
        allow_registration: '1',
        maintenance_mode: '0',
        cookie_banner_enabled: '1',
        gdpr_enabled: '1',
      },
    });
  }
}
