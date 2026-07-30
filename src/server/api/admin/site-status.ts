/**
 * Site Status API
 * Controls whether the public website shows Normal / Coming Soon / Maintenance.
 * Only authenticated admins can change the status.
 * Public GET is unauthenticated so the frontend gate can check it.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { writeAudit } from '../../lib/audit.js';

export type SiteStatusValue = 'normal' | 'coming_soon' | 'maintenance';

export async function getSiteStatus(_req: Request, res: Response) {
  try {
    const row = await db.prepare(
      "SELECT value FROM admin_settings WHERE key = 'site_status'"
    ).get() as { value: string } | undefined;
    const status: SiteStatusValue = (row?.value as SiteStatusValue) || 'normal';
    res.json({ success: true, status });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get site status' });
  }
}

export async function setSiteStatus(req: Request, res: Response) {
  try {
    const { status } = req.body as { status: SiteStatusValue };
    const allowed: SiteStatusValue[] = ['normal', 'coming_soon', 'maintenance'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const prev = await db.prepare(
      "SELECT value FROM admin_settings WHERE key = 'site_status'"
    ).get() as { value: string } | undefined;

    await db.prepare(
      'INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).run('site_status', status);

    writeAudit({
      actorId: (req as any).adminUser?.id,
      actorName: (req as any).adminUser?.name,
      actorEmail: (req as any).adminUser?.email,
      actorType: 'admin',
      tenant: 'admin_workforce',
      authProvider: 'microsoft_entra_workforce',
      action: 'site_status_change',
      resourceType: 'settings',
      resourceId: 'site_status',
      details: `Site status changed from "${prev?.value ?? 'normal'}" to "${status}"`,
      ipAddress: req.ip,
      result: 'success',
    });

    res.json({ success: true, status });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to set site status' });
  }
}
