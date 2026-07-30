/**
 * Central audit logging library.
 * Logs every significant action — admin, user, cookie consent, points, messages, auth.
 * All entries go to the audit_log table.
 */
import db from '../db.js';

// Ensure table exists and run schema migrations (SQLite)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_name TEXT,
      actor_email TEXT,
      actor_type TEXT NOT NULL DEFAULT 'user',
      tenant TEXT,
      auth_provider TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT '',
      resource_id TEXT,
      resource_label TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      result TEXT NOT NULL DEFAULT 'success',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch { /* table already exists */ }

try {
  const colsRaw = db.prepare("PRAGMA table_info(audit_log)").all() as unknown;
  if (Array.isArray(colsRaw)) {
    const cols = colsRaw as { name: string; notnull: number }[];
    const adminIdCol = cols.find(c => c.name === 'admin_id');
    const hasActorId    = cols.some(c => c.name === 'actor_id');
    const hasDetailCol  = cols.some(c => c.name === 'detail');
    const hasDetailsCol = cols.some(c => c.name === 'details');
    // Rebuild if: (a) only admin_id exists (no actor_id), OR
    //             (b) admin_id exists AND is NOT NULL (notnull=1) — blocks writes
    const needsRebuild = (adminIdCol && !hasActorId) || (adminIdCol && adminIdCol.notnull === 1);
    if (needsRebuild) {
      const actorExpr   = hasActorId ? 'actor_id' : 'admin_id';
      const detailsExpr = hasDetailCol && hasDetailsCol ? 'COALESCE(details, detail)'
                        : hasDetailsCol ? 'details'
                        : hasDetailCol  ? 'detail'
                        : 'NULL';
      db.exec(`
        ALTER TABLE audit_log RENAME TO audit_log_old;
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id INTEGER,
          actor_name TEXT,
          actor_email TEXT,
          actor_type TEXT NOT NULL DEFAULT 'user',
          tenant TEXT,
          auth_provider TEXT,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL DEFAULT '',
          resource_id TEXT,
          resource_label TEXT,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          result TEXT NOT NULL DEFAULT 'success',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO audit_log (id, actor_id, action, resource_type, details, created_at)
          SELECT id, ${actorExpr}, action, COALESCE(resource_type,''), ${detailsExpr}, created_at FROM audit_log_old;
        DROP TABLE audit_log_old;
      `);
      console.log('[audit] Migrated audit_log — admin_id NOT NULL constraint removed');
    }
  }
} catch (e) {
  console.error('[audit] Schema migration check failed:', e);
}

// Idempotent column additions — add every column that may be missing from older DB files
try { db.exec(`ALTER TABLE audit_log ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'user'`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN user_agent TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN actor_id INTEGER`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN actor_name TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN actor_email TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN tenant TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN auth_provider TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN result TEXT NOT NULL DEFAULT 'success'`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN resource_label TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE audit_log ADD COLUMN resource_id TEXT`); } catch { /* exists */ }

export interface AuditEntry {
  actorId?: number | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorType?: 'admin' | 'user' | 'system' | 'visitor';
  /** Which tenant/platform authenticated this actor: 'customer_ciam' | 'admin_workforce' | 'system' */
  tenant?: string | null;
  /** Auth provider used: 'microsoft_entra_external_id' | 'microsoft_entra_workforce' | 'local' | 'system' */
  authProvider?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Outcome: 'success' | 'failed' | 'blocked' | 'error' */
  result?: 'success' | 'failed' | 'blocked' | 'error';
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    db.prepare(`
      INSERT INTO audit_log
        (actor_id, actor_name, actor_email, actor_type, tenant, auth_provider, action, resource_type, resource_id, resource_label, details, ip_address, user_agent, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.actorId ?? null,
      entry.actorName ?? null,
      entry.actorEmail ?? null,
      entry.actorType ?? 'user',
      entry.tenant ?? null,
      entry.authProvider ?? null,
      entry.action,
      entry.resourceType ?? '',
      entry.resourceId ?? null,
      entry.resourceLabel ?? null,
      entry.details ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      entry.result ?? 'success',
    );
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/** Convenience: write from an admin action (backwards compat with old writeAuditLog signature) */
export async function writeAuditLog(
  adminId: number,
  adminName: string,
  adminEmail: string,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  resourceLabel?: string | null,
  details?: string | null,
  ipAddress?: string | null,
): Promise<void> {
  writeAudit({
    actorId: adminId,
    actorName: adminName,
    actorEmail: adminEmail,
    actorType: 'admin',
    tenant: 'admin_workforce',
    authProvider: 'microsoft_entra_workforce',
    action,
    resourceType,
    resourceId,
    resourceLabel,
    details,
    ipAddress,
    result: 'success',
  });
}
