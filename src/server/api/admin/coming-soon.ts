/**
 * Coming Soon countdown API
 *
 * GET  /api/coming-soon-config   — public, returns launch date + copy
 * PUT  /api/admin/coming-soon    — admin only, update launch date + copy
 *
 * The launch date is stored in admin_settings as an ISO 8601 string.
 * An empty string means "no countdown set".
 * All data is DB-backed — never localStorage.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

export async function getComingSoonConfig(_req: Request, res: Response) {
  try {
    const rows = db.prepare(
      "SELECT key, value FROM admin_settings WHERE key IN ('coming_soon_launch_date','coming_soon_headline','coming_soon_subtext')"
    ).all() as { key: string; value: string }[];

    const cfg: Record<string, string> = {};
    for (const r of rows) cfg[r.key] = r.value;

    return res.json({
      success: true,
      launchDate: cfg['coming_soon_launch_date'] || '',
      headline: cfg['coming_soon_headline'] || 'Coming Soon',
      subtext: cfg['coming_soon_subtext'] || 'We are putting the finishing touches on something great.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

export async function updateComingSoonConfig(req: Request, res: Response) {
  try {
    const { launchDate, headline, subtext } = req.body as {
      launchDate?: string;
      headline?: string;
      subtext?: string;
    };

    // Validate ISO date if provided
    if (launchDate && launchDate.trim()) {
      const d = new Date(launchDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid launch date — must be ISO 8601' });
      }
    }

    const upsert = db.prepare(
      'INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );

    const updates = db.transaction(() => {
      if (launchDate !== undefined) upsert.run('coming_soon_launch_date', launchDate.trim());
      if (headline !== undefined) upsert.run('coming_soon_headline', headline.trim() || 'Coming Soon');
      if (subtext !== undefined) upsert.run('coming_soon_subtext', subtext.trim() || '');
    });
    updates();

    writeAudit({
      actorId: (req as any).user?.id,
      actorName: (req as any).user?.name,
      actorEmail: (req as any).user?.email,
      actorType: 'admin',
      action: 'coming_soon_config_update',
      resourceType: 'settings',
      resourceId: 'coming_soon',
      details: `Launch date set to "${launchDate ?? '(unchanged)'}"`,
      ipAddress: req.ip,
      result: 'success',
    });

    return res.json({ success: true, launchDate, headline, subtext });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
