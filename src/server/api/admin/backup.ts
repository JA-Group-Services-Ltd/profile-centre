/**
 * Admin Backup & Export API
 *
 * POST /api/admin/backup/create        — trigger a manual snapshot now
 * GET  /api/admin/backup/list          — list all snapshots in /private/db/backups/
 * GET  /api/admin/backup/download/:filename — stream a snapshot file
 * DELETE /api/admin/backup/:filename   — delete a specific snapshot
 * GET  /api/admin/backup/export/json   — export all tables as JSON
 * GET  /api/admin/backup/export/csv/:table — export one table as CSV
 * GET  /api/admin/backup/export/tables — list all table names + row counts
 * POST /api/admin/backup/schedule      — update auto-backup settings (stored in admin_settings)
 * GET  /api/admin/backup/schedule      — get current schedule config
 */

import type { Request, Response } from 'express';
import { mkdirSync, readdirSync, statSync, createReadStream, unlinkSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import db, { rawSqliteDb } from '../../db.js';

const BACKUP_DIR = '/private/db/backups';
const DB_PATH    = '/private/db/japrofilestudio.db';
const MAX_BACKUPS = 30; // keep at most 30 snapshots

mkdirSync(BACKUP_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

function listBackupFiles() {
  try {
    return readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const full = join(BACKUP_DIR, f);
        const stat = statSync(full);
        return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

function pruneOldBackups() {
  const files = listBackupFiles();
  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      try { unlinkSync(join(BACKUP_DIR, f.filename)); } catch { /* ignore */ }
    }
  }
}

function createSnapshot(triggeredBy: string): { filename: string; size: number } {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const filename = `japrofilestudio_${ts}.db`;
  const dest = join(BACKUP_DIR, filename);

  // Use SQLite VACUUM INTO for a clean, consistent copy (no WAL pages)
  try {
    rawSqliteDb.exec(`VACUUM INTO '${dest}'`);
  } catch {
    // Fallback: file copy (less clean but works)
    copyFileSync(DB_PATH, dest);
  }

  const size = statSync(dest).size;

  // Log to audit
  try {
    db.prepare(`
      INSERT INTO audit_log (actor_type, action, resource_type, resource_id, details, result, created_at)
      VALUES ('admin', 'backup_created', 'database', ?, ?, 'success', CURRENT_TIMESTAMP)
    `).run(filename, JSON.stringify({ triggered_by: triggeredBy, size_bytes: size }));
  } catch { /* audit table may not have these cols — non-fatal */ }

  pruneOldBackups();
  return { filename, size };
}

function getAllTableNames(): string[] {
  try {
    const rows = rawSqliteDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as { name: string }[];
    return rows.map(r => r.name);
  } catch {
    return [];
  }
}

function getTableRowCount(table: string): number {
  try {
    const row = rawSqliteDb.prepare(`SELECT COUNT(*) as n FROM "${table}"`).get() as { n: number };
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

function getTableColumns(table: string): string[] {
  try {
    const cols = rawSqliteDb.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
    return cols.map(c => c.name);
  } catch {
    return [];
  }
}

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Log export to audit ───────────────────────────────────────────────────────
function logExport(adminId: number | undefined, format: string, table: string | null, rowCount: number) {
  try {
    db.prepare(`
      INSERT INTO audit_log (actor_id, actor_type, action, resource_type, resource_id, details, result, created_at)
      VALUES (?, 'admin', 'data_export', 'database', ?, ?, 'success', CURRENT_TIMESTAMP)
    `).run(
      adminId ?? null,
      table ?? 'all',
      JSON.stringify({ format, table: table ?? 'all_tables', row_count: rowCount })
    );
  } catch { /* non-fatal */ }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/** POST /api/admin/backup/create */
export async function createBackup(req: Request, res: Response) {
  try {
    const adminId = (req.session as any)?.adminId;
    const result = createSnapshot(`admin:${adminId ?? 'unknown'}`);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[backup] createBackup error:', err);
    res.status(500).json({ error: 'Backup failed', message: String(err) });
  }
}

/** GET /api/admin/backup/list */
export async function listBackups(req: Request, res: Response) {
  try {
    const files = listBackupFiles();
    res.json({ backups: files, count: files.length, max: MAX_BACKUPS });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups', message: String(err) });
  }
}

/** GET /api/admin/backup/download/:filename */
export async function downloadBackup(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    // Security: only allow .db files, no path traversal
    if (!filename || !filename.endsWith('.db') || filename.includes('/') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = join(BACKUP_DIR, filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', statSync(filePath).size);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Download failed', message: String(err) });
  }
}

/** DELETE /api/admin/backup/:filename */
export async function deleteBackup(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    if (!filename || !filename.endsWith('.db') || filename.includes('/') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = join(BACKUP_DIR, filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', message: String(err) });
  }
}

/** GET /api/admin/backup/export/tables */
export async function listExportTables(req: Request, res: Response) {
  try {
    const tables = getAllTableNames().map(name => ({
      name,
      row_count: getTableRowCount(name),
    }));
    res.json({ tables });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list tables', message: String(err) });
  }
}

/** GET /api/admin/backup/export/json?tables=users,profiles (or all) */
export async function exportJson(req: Request, res: Response) {
  try {
    const adminId = (req.session as any)?.adminId;
    const requestedTables = req.query.tables
      ? String(req.query.tables).split(',').map(t => t.trim()).filter(Boolean)
      : getAllTableNames();

    const allTables = getAllTableNames();
    const validTables = requestedTables.filter(t => allTables.includes(t));

    const result: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const table of validTables) {
      try {
        const rows = rawSqliteDb.prepare(`SELECT * FROM "${table}"`).all();
        result[table] = rows;
        totalRows += rows.length;
      } catch {
        result[table] = [];
      }
    }

    logExport(adminId, 'json', validTables.length === 1 ? validTables[0] : null, totalRows);

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="japrofilestudio_export_${ts}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ exported_at: new Date().toISOString(), tables: result });
  } catch (err) {
    res.status(500).json({ error: 'Export failed', message: String(err) });
  }
}

/** GET /api/admin/backup/export/csv/:table */
export async function exportCsv(req: Request, res: Response) {
  try {
    const adminId = (req.session as any)?.adminId;
    const { table } = req.params;
    const allTables = getAllTableNames();

    if (!allTables.includes(table)) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const cols = getTableColumns(table);
    const rows = rawSqliteDb.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];

    logExport(adminId, 'csv', table, rows.length);

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="${table}_${ts}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');

    // BOM for Excel compatibility
    res.write('\uFEFF');
    res.write(cols.map(escapeCSV).join(',') + '\r\n');
    for (const row of rows) {
      res.write(cols.map(c => escapeCSV((row as Record<string, unknown>)[c])).join(',') + '\r\n');
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'CSV export failed', message: String(err) });
  }
}

/** GET /api/admin/backup/schedule */
export async function getBackupSchedule(req: Request, res: Response) {
  try {
    const row = db.prepare("SELECT value FROM admin_settings WHERE key = 'backup_schedule'").get() as { value: string } | undefined;
    const defaults = { enabled: true, interval_hours: 24, max_backups: MAX_BACKUPS, last_run: null };
    const config = row ? { ...defaults, ...JSON.parse(row.value) } : defaults;
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedule', message: String(err) });
  }
}

/** POST /api/admin/backup/schedule */
export async function updateBackupSchedule(req: Request, res: Response) {
  try {
    const { enabled, interval_hours, max_backups } = req.body;
    const current = (() => {
      try {
        const row = db.prepare("SELECT value FROM admin_settings WHERE key = 'backup_schedule'").get() as { value: string } | undefined;
        return row ? JSON.parse(row.value) : {};
      } catch { return {}; }
    })();
    const updated = {
      ...current,
      enabled: enabled !== undefined ? Boolean(enabled) : current.enabled ?? true,
      interval_hours: interval_hours ? Number(interval_hours) : current.interval_hours ?? 24,
      max_backups: max_backups ? Number(max_backups) : current.max_backups ?? MAX_BACKUPS,
    };
    db.prepare(`
      INSERT INTO admin_settings (key, value, updated_at) VALUES ('backup_schedule', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(JSON.stringify(updated));
    res.json({ ok: true, config: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule', message: String(err) });
  }
}

// ── Auto-backup scheduler ─────────────────────────────────────────────────────
// Runs on server startup and then every hour to check if a backup is due.

export function startAutoBackupScheduler() {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

  async function runIfDue() {
    try {
      const row = db.prepare("SELECT value FROM admin_settings WHERE key = 'backup_schedule'").get() as { value: string } | undefined;
      const config = row ? JSON.parse(row.value) : { enabled: true, interval_hours: 24 };
      if (!config.enabled) return;

      const intervalMs = (config.interval_hours ?? 24) * 60 * 60 * 1000;
      const lastRun = config.last_run ? new Date(config.last_run).getTime() : 0;
      const now = Date.now();

      if (now - lastRun >= intervalMs) {
        console.log('[backup] Auto-backup triggered');
        const result = createSnapshot('scheduler');
        // Update last_run
        const updated = { ...config, last_run: new Date().toISOString() };
        db.prepare(`
          INSERT INTO admin_settings (key, value, updated_at) VALUES ('backup_schedule', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(JSON.stringify(updated));
        console.log(`[backup] Auto-backup complete: ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
      }
    } catch (err) {
      console.error('[backup] Auto-backup scheduler error:', err);
    }
  }

  // Run immediately on startup, then every hour
  runIfDue();
  setInterval(runIfDue, CHECK_INTERVAL_MS);
}
