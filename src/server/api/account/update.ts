/**
 * PUT /api/account/update
 *
 * Updates the signed-in customer's account details (name, email) locally,
 * then syncs the name fields to their Microsoft Entra External ID profile
 * via Microsoft Graph.
 *
 * Flow:
 *  1. Validate submitted fields
 *  2. Save locally (users table)
 *  3. Identify the customer's Entra OID (users.entra_oid)
 *  4. PATCH /users/{oid} on Microsoft Graph with givenName, surname, displayName
 *  5. Return success or partial-success (local saved, Entra failed)
 *
 * SECURITY: Graph credentials are server-only. No token or secret is ever
 * sent to the browser. A customer can only update their own profile.
 */

import { type Response } from 'express';
import db from '../../db.js';
import { type AuthRequest } from '../../middleware/auth.js';
import { isValidEmail } from '../../../lib/validate-email.js';
import { updateEntraProfile } from '../../lib/graph.js';
import { writeAudit } from '../../lib/audit.js';

export default async function handler(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { name, email } = req.body;

    // ── 1. Validate ──────────────────────────────────────────────────────────
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    // ── 2. Check email uniqueness ────────────────────────────────────────────
    const existing = db.prepare(
      "SELECT id FROM users WHERE email = ? AND id != ? AND role = 'user'"
    ).get(email.toLowerCase(), userId) as { id: number } | undefined;

    if (existing) {
      return res.status(409).json({ success: false, error: 'That email address is already in use' });
    }

    // ── 3. Save locally ──────────────────────────────────────────────────────
    db.prepare(
      'UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name.trim(), email.trim().toLowerCase(), userId);

    // ── 4. Fetch the user's Entra OID ────────────────────────────────────────
    const userRow = db.prepare(
      'SELECT entra_oid FROM users WHERE id = ?'
    ).get(userId) as { entra_oid: string | null } | undefined;

    const entraOid = userRow?.entra_oid ?? null;

    // ── 5. Sync to Entra External ID via Microsoft Graph ─────────────────────
    if (entraOid) {
      // Parse name into given/surname for Graph
      const nameParts  = name.trim().split(/\s+/);
      const givenName  = nameParts[0] ?? '';
      const surname    = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const displayName = name.trim();

      try {
        await updateEntraProfile(entraOid, { givenName, surname, displayName });

        // Clear any previous sync failure flag
        db.prepare(
          'UPDATE users SET entra_sync_failed = 0, entra_sync_failed_at = NULL, entra_sync_error = NULL WHERE id = ?'
        ).run(userId);

        console.log(`[account:update] Entra profile synced for user ${userId} (oid: ${entraOid.slice(0, 8)}…)`);

        try {
          writeAudit({
            actorId: userId,
            actorName: name.trim(),
            actorEmail: email.trim().toLowerCase(),
            actorType: 'user',
            action: 'update_profile',
            resourceType: 'user',
            resourceId: String(userId),
            details: 'Customer profile updated and synced to Entra External ID',
            result: 'success',
          });
        } catch { /* non-fatal */ }

        return res.json({ success: true, entraSynced: true });

      } catch (graphErr) {
        // Local save succeeded but Entra sync failed — log and mark for admin review
        // This is NOT a failure for the user — their data is saved locally.
        const errMsg = graphErr instanceof Error ? graphErr.message : String(graphErr);
        console.warn(`[account:update] Entra sync failed for user ${userId} (local save succeeded):`, errMsg);

        // Only mark as failed if it's not a "credentials not configured" case
        const isConfigError = errMsg.includes('not configured');
        if (!isConfigError) {
          db.prepare(
            `UPDATE users
               SET entra_sync_failed = 1,
                   entra_sync_failed_at = CURRENT_TIMESTAMP,
                   entra_sync_error = ?
             WHERE id = ?`
          ).run(errMsg.slice(0, 500), userId);
        }

        try {
          writeAudit({
            actorId: userId,
            actorName: name.trim(),
            actorEmail: email.trim().toLowerCase(),
            actorType: 'user',
            action: 'update_profile',
            resourceType: 'user',
            resourceId: String(userId),
            details: `Profile saved locally${isConfigError ? ' (Entra not configured)' : ` but Entra sync failed: ${errMsg.slice(0, 200)}`}`,
            result: isConfigError ? 'success' : 'error',
          });
        } catch { /* non-fatal */ }

        // Always return success — local save worked
        return res.json({
          success: true,
          entraSynced: false,
          // Only surface a warning to the user if it's a real sync failure (not a config issue)
          entraError: isConfigError ? undefined : 'Your profile was saved. We could not update your sign-in profile at this time — please try again later or contact support if this persists.',
        });
      }
    }

    // No Entra OID — local-only save (e.g. legacy account without OIDC)
    try {
      writeAudit({
        actorId: userId,
        actorName: name.trim(),
        actorEmail: email.trim().toLowerCase(),
        actorType: 'user',
        action: 'update_profile',
        resourceType: 'user',
        resourceId: String(userId),
        details: 'Customer profile updated locally (no Entra OID — Entra sync skipped)',
        result: 'success',
      });
    } catch { /* non-fatal */ }

    return res.json({ success: true, entraSynced: false });

  } catch (err) {
    console.error('[account:update] Unexpected error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}
