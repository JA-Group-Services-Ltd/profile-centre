/**
 * Admin CRM API
 *
 * GET  /api/admin/crm/users          — paginated user list with filters
 * GET  /api/admin/crm/users/:id      — full user profile for CRM
 * POST /api/admin/crm/users/:id/notes — add admin note
 * DELETE /api/admin/crm/users/:id/notes/:noteId — delete note
 *
 * GET  /api/admin/crm/data-requests  — list all data requests
 * POST /api/admin/crm/data-requests/:id — update status/assign/notes
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { notifyMarketingConsent } from '../../lib/power-automate-consent.js';

// ── User list ─────────────────────────────────────────────────────────────

export async function crmListUsers(req: Request, res: Response) {
  try {
    const {
      search = '', plan = '', status = '', consent = '',
      subscription = '', page = '1', limit = '50',
    } = req.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Returns ALL users — admins and customers alike.
    // Admin accounts can hold a plan, profiles, and billing just like customers.
    // Admin emails are masked server-side for security.
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (search) {
      const searchNorm = search.replace(/\s/g, '');
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.user_number = ? OR u.user_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, searchNorm, `%${searchNorm}%`);
    }
    if (plan) {
      where += ' AND p.slug = ?';
      params.push(plan);
    }
    if (status === 'paused') {
      where += ' AND u.is_paused = 1';
    } else if (status === 'active') {
      where += ' AND (u.is_paused = 0 OR u.is_paused IS NULL)';
    } else if (status === 'lifetime') {
      where += ' AND u.lifetime_access = 1';
    } else if (status === 'admin') {
      where += " AND u.role = 'admin'";
    }
    if (consent === 'marketing_yes') {
      where += ' AND u.marketing_consent = 1';
    } else if (consent === 'marketing_no') {
      where += ' AND (u.marketing_consent = 0 OR u.marketing_consent IS NULL)';
    }
    if (subscription === 'active') {
      where += " AND s.status = 'active'";
    } else if (subscription === 'cancelled') {
      where += " AND s.status = 'cancelled'";
    } else if (subscription === 'none') {
      where += ' AND s.id IS NULL';
    }

    const users = await db.prepare(`
      SELECT
        u.id, u.name,
        CASE WHEN u.role = 'admin' THEN
          SUBSTR(u.email, 1, 2) || '***@' || SUBSTR(u.email, INSTR(u.email, '@') + 1)
        ELSE u.email END AS email,
        u.phone, u.role, u.plan_id,
        u.created_at, u.last_login_at, u.is_paused, u.lifetime_access,
        u.marketing_consent, u.terms_consent, u.privacy_consent,
        u.account_status, u.user_number,
        p.name AS plan_name, p.slug AS plan_slug,
        s.status AS subscription_status, s.billing_interval, s.current_period_end,
        (SELECT COUNT(*) FROM profiles pr WHERE pr.user_id = u.id) AS profile_count,
        (SELECT COUNT(*) FROM data_requests dr WHERE dr.user_id = u.id AND dr.status = 'pending') AS pending_requests
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      LEFT JOIN subscriptions s ON s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const totalRow = await db.prepare(`
      SELECT COUNT(DISTINCT u.id) as c FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      LEFT JOIN subscriptions s ON s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      ${where}
    `).get(...params) as { c: number } | undefined;
    const total = totalRow?.c ?? 0;

    res.json({ success: true, data: Array.isArray(users) ? users : [], total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Full user CRM profile ─────────────────────────────────────────────────

export async function crmGetUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Fetch user + plan separately to avoid row-multiplication from subscription JOIN
    const user = await db.prepare(`
      SELECT
        u.*,
        p.name AS plan_name, p.slug AS plan_slug,
        p.max_seats, p.has_messaging
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Latest subscription (separate query — avoids row duplication)
    const latestSub = await db.prepare(`
      SELECT status, billing_interval, current_period_start, current_period_end,
             started_at, cancelled_at, stripe_subscription_id
      FROM subscriptions WHERE user_id = ?
      ORDER BY started_at DESC LIMIT 1
    `).get(id) as Record<string, unknown> | undefined;

    if (latestSub) {
      Object.assign(user, {
        subscription_status: latestSub.status,
        billing_interval: latestSub.billing_interval,
        current_period_start: latestSub.current_period_start,
        current_period_end: latestSub.current_period_end,
        stripe_subscription_id: latestSub.stripe_subscription_id,
      });
    }

    // Profiles
    const profiles = await db.prepare(`
      SELECT id, username, display_name, profile_type, is_published,
        biz_slug, person_slug, business_name, created_at, updated_at
      FROM profiles WHERE user_id = ?
    `).all(id);

    // Links count
    const linkCountRow = await db.prepare(`
      SELECT COUNT(*) as c FROM profile_links pl
      JOIN profiles pr ON pl.profile_id = pr.id
      WHERE pr.user_id = ?
    `).get(id) as { c: number } | undefined;
    const linkCount = linkCountRow?.c ?? 0;

    // Subscription history
    const subscriptions = await db.prepare(`
      SELECT s.*, p.name AS plan_name FROM subscriptions s
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = ? ORDER BY s.started_at DESC
    `).all(id);

    // Support requests — table may not exist on older DBs
    let supportRequests: unknown[] = [];
    try {
      supportRequests = await db.prepare(`
        SELECT id, subject, category, status, created_at, updated_at
        FROM support_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
      `).all(id);
    } catch { /* table not yet created */ }

    // Data requests
    let dataRequests: unknown[] = [];
    try {
      dataRequests = await db.prepare(`
        SELECT * FROM data_requests WHERE user_id = ? ORDER BY created_at DESC
      `).all(id);
    } catch { /* table not yet created */ }

    // Points / referral / redemptions — legacy tables, skip silently if absent
    try { await db.prepare(`SELECT COALESCE(SUM(delta),0) FROM points_ledger WHERE user_id = ? LIMIT 1`).get(id); } catch { /* ok */ }
    try { await db.prepare(`SELECT code FROM referral_codes WHERE user_id = ? LIMIT 1`).get(id); } catch { /* ok */ }
    try { await db.prepare(`SELECT id FROM reward_redemptions WHERE user_id = ? LIMIT 1`).get(id); } catch { /* ok */ }

    // Admin notes
    let adminNotes: unknown[] = [];
    try {
      adminNotes = await db.prepare(`
        SELECT * FROM admin_user_notes WHERE user_id = ? ORDER BY created_at DESC
      `).all(id);
    } catch { /* table not yet created */ }

    // Audit log entries for this user
    let auditEntries: unknown[] = [];
    try {
      auditEntries = await db.prepare(`
        SELECT * FROM audit_log
        WHERE (actor_id = ? AND actor_type = 'user')
           OR (resource_id = ? AND resource_type = 'user')
        ORDER BY created_at DESC LIMIT 30
      `).all(id, String(id));
    } catch { /* table not yet created */ }

    // Enquiries count
    let enquiryCount = 0;
    try {
      const ecRow = await db.prepare(`
        SELECT COUNT(*) as c FROM contact_enquiries ce
        JOIN profiles pr ON ce.profile_id = pr.id
        WHERE pr.user_id = ?
      `).get(id) as { c: number } | undefined;
      enquiryCount = ecRow?.c ?? 0;
    } catch { /* table not yet created */ }

    // Support PIN — current PIN for telephone identity verification
    let supportPin: { pin: string; expires_at: string; issued_at: string } | null = null;
    try {
      supportPin = db.prepare(
        'SELECT pin, issued_at, expires_at FROM support_pins WHERE user_id = ? AND expires_at > ?'
      ).get(id, new Date().toISOString()) as typeof supportPin;
    } catch { /* table not yet created */ }

    // Feature overrides for this user (what admin has explicitly granted/denied)
    let featureOverrides: unknown[] = [];
    try {
      featureOverrides = await db.prepare(`
        SELECT cfo.feature_id, cfo.access_type, cfo.notes, cfo.set_by_admin_name, cfo.updated_at,
               pf.name AS feature_name, pf.slug AS feature_slug, pf.category AS feature_category
        FROM customer_feature_overrides cfo
        JOIN platform_features pf ON cfo.feature_id = pf.id
        WHERE cfo.user_id = ?
        ORDER BY pf.category, pf.name
      `).all(id);
    } catch { /* table not yet created */ }

    // All features with this user's effective access (plan rule + override)
    let allFeatures: unknown[] = [];
    try {
      allFeatures = await db.prepare(`
        SELECT pf.id, pf.name, pf.slug, pf.category, pf.description,
               COALESCE(cfo.access_type, fpr.access_type, 'not_available') AS effective_access,
               cfo.access_type AS override_access,
               cfo.set_by_admin_name AS override_by,
               cfo.updated_at AS override_at,
               fpr.access_type AS plan_access
        FROM platform_features pf
        LEFT JOIN feature_plan_rules fpr ON fpr.feature_id = pf.id AND fpr.plan_slug = (
          SELECT slug FROM plans WHERE id = (SELECT plan_id FROM users WHERE id = ?)
        )
        LEFT JOIN customer_feature_overrides cfo ON cfo.feature_id = pf.id AND cfo.user_id = ?
        WHERE pf.is_active = 1
        ORDER BY pf.category, pf.name
      `).all(id, id);
    } catch { /* table not yet created */ }

    // Contact enquiries received on this user's profiles (full list, not just count)
    let enquiries: unknown[] = [];
    try {
      enquiries = await db.prepare(`
        SELECT ce.id, ce.sender_name, ce.sender_email, ce.message, ce.created_at,
               p.display_name AS profile_name, p.username AS profile_slug
        FROM contact_enquiries ce
        JOIN profiles p ON ce.profile_id = p.id
        WHERE p.user_id = ?
        ORDER BY ce.created_at DESC
        LIMIT 50
      `).all(id);
    } catch { /* table not yet created */ }

    // Issue reports submitted by this user
    let issueReports: unknown[] = [];
    try {
      issueReports = await db.prepare(`
        SELECT id, title, description, category, status, priority, created_at, updated_at
        FROM issue_reports WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 20
      `).all(id);
    } catch { /* table not yet created */ }

    // Complaints
    let complaints: unknown[] = [];
    try {
      complaints = await db.prepare(`
        SELECT id, reference, category, status, summary, handler_name,
               escalation_status, resolution_date, created_at, updated_at
        FROM complaints WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 20
      `).all(id);
    } catch { /* table not yet created */ }

    // Consent records (full detail)
    const consentFields = [
      'terms_consent', 'terms_consent_at',
      'privacy_consent', 'privacy_consent_at',
      'marketing_consent', 'marketing_consent_at',
      'updates_consent', 'updates_consent_at',
      'data_improve_consent', 'data_improve_consent_at',
      'crm_consent', 'crm_consent_at',
      'referral_consent', 'referral_consent_at',
      'consent_ip', 'consent_version',
    ];
    const consentRow = await db.prepare(
      `SELECT ${consentFields.join(', ')} FROM users WHERE id = ?`
    ).get(id) as Record<string, unknown> | undefined;

    // Direct messages (card_messages on user's profiles)
    let directMessages: unknown[] = [];
    try {
      directMessages = await db.prepare(`
        SELECT cm.id, cm.thread_id, cm.sender_type, cm.sender_name, cm.sender_email,
               cm.message, cm.created_at, p.display_name AS profile_name
        FROM card_messages cm
        JOIN profiles p ON cm.profile_id = p.id
        WHERE p.user_id = ?
        ORDER BY cm.created_at DESC LIMIT 50
      `).all(id);
    } catch { /* table not yet created */ }

    // Visitor reports against this user's profiles
    let visitorReports: unknown[] = [];
    try {
      visitorReports = await db.prepare(`
        SELECT vr.id, vr.category, vr.details, vr.reporter_name, vr.reporter_email,
               vr.good_faith_confirmed, vr.status, vr.admin_notes, vr.action_taken,
               vr.outcome, vr.assigned_to, vr.created_at, vr.updated_at,
               p.display_name AS profile_name, p.username AS profile_slug
        FROM visitor_reports vr
        LEFT JOIN profiles p ON vr.profile_id = p.id
        WHERE vr.reported_user_id = ?
        ORDER BY vr.created_at DESC LIMIT 30
      `).all(id);
    } catch { /* table not yet created */ }

    // Subscription history (full)
    const subscriptionHistory = subscriptions;

    res.json({
      success: true,
      data: {
        user,
        profiles,
        linkCount,
        subscriptions,
        supportRequests,
        dataRequests,
        adminNotes,
        auditEntries,
        enquiryCount,
        enquiries,
        supportPin,
        featureOverrides,
        allFeatures,
        issueReports,
        complaints,
        consent: consentRow ?? {},
        directMessages,
        visitorReports,
        subscriptionHistory,
      },
    });
  } catch (err) {
    console.error('[crm:getUser] Error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Admin notes ───────────────────────────────────────────────────────────

export async function crmAddNote(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminUser = (req as unknown as { adminUser?: { id: number; name: string } }).adminUser;
    if (!note?.trim()) return res.status(400).json({ success: false, error: 'Note is required' });

    const result = await db.prepare(`
      INSERT INTO admin_user_notes (user_id, admin_id, admin_name, note)
      VALUES (?, ?, ?, ?)
    `).run(id, adminUser?.id ?? null, adminUser?.name ?? 'Admin', note.trim());

    const inserted = await db.prepare('SELECT * FROM admin_user_notes WHERE id = ?').get((result as { lastInsertRowid: number }).lastInsertRowid);
    res.status(201).json({ success: true, data: inserted });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function crmDeleteNote(req: Request, res: Response) {
  try {
    const { noteId } = req.params;
    await db.prepare('DELETE FROM admin_user_notes WHERE id = ?').run(noteId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Data requests ─────────────────────────────────────────────────────────

export async function crmListDataRequests(req: Request, res: Response) {
  try {
    const { status = '', type = '', search = '', page = '1', limit = '50' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) { where += ' AND dr.status = ?'; params.push(status); }
    if (type) { where += ' AND dr.request_type = ?'; params.push(type); }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const rows = await db.prepare(`
      SELECT dr.*, u.name AS user_name, u.email AS user_email
      FROM data_requests dr
      JOIN users u ON dr.user_id = u.id
      ${where}
      ORDER BY dr.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const totalRow2 = await db.prepare(`
      SELECT COUNT(*) as c FROM data_requests dr
      JOIN users u ON dr.user_id = u.id
      ${where}
    `).get(...params) as { c: number } | undefined;
    const total = totalRow2?.c ?? 0;

    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function crmUpdateDataRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, assigned_to, assigned_name, internal_notes } = req.body;

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    if (assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(assigned_to); }
    if (assigned_name !== undefined) { updates.push('assigned_name = ?'); values.push(assigned_name); }
    if (internal_notes !== undefined) { updates.push('internal_notes = ?'); values.push(internal_notes); }

    await db.prepare(`UPDATE data_requests SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    const updated = await db.prepare('SELECT * FROM data_requests WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Customer: submit data request ─────────────────────────────────────────

export async function customerSubmitDataRequest(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { user?: { id: number } }).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    const { request_type, description } = req.body;
    const VALID_TYPES = [
      'data_copy', 'data_correction', 'data_deletion', 'consent_withdrawal',
      'marketing_change', 'document_export', 'referral_data',
    ];
    if (!VALID_TYPES.includes(request_type)) {
      return res.status(400).json({ success: false, error: 'Invalid request type' });
    }

    const result2 = await db.prepare(`
      INSERT INTO data_requests (user_id, request_type, description, status)
      VALUES (?, ?, ?, 'pending')
    `).run(userId, request_type, description ?? null);

    res.status(201).json({ success: true, data: { id: (result2 as { lastInsertRowid: number }).lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function customerGetDataRequests(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { user?: { id: number } }).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    const rows = await db.prepare(`
      SELECT id, request_type, description, status, created_at, updated_at, completed_at
      FROM data_requests WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Customer: update consent ───────────────────────────────────────────────

export async function customerUpdateConsent(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { user?: { id: number } }).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    const CONSENT_FIELDS = [
      'terms_consent', 'privacy_consent',
      'marketing_consent', 'referral_consent',
      'data_improve_consent', 'updates_consent', 'crm_consent',
    ] as const;

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [];

    for (const field of CONSENT_FIELDS) {
      if (req.body[field] !== undefined) {
        const val = req.body[field] ? 1 : 0;
        updates.push(`${field} = ?`);
        values.push(val);
        updates.push(`${field}_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE ${field}_at END`);
        values.push(val);
      }
    }

    // Record consent version + IP
    if (req.body.consent_version) {
      updates.push('consent_version = ?');
      values.push(String(req.body.consent_version));
    }
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ?? req.ip ?? null;
    if (ip) {
      updates.push('consent_ip = ?');
      values.push(ip);
    }

    if (updates.length === 1) return res.status(400).json({ success: false, error: 'No consent fields provided' });

    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, userId);

    // ── Power Automate relay — fire when marketing_consent changes ──────────
    if (req.body.marketing_consent !== undefined) {
      const userRow = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId) as { email: string; name: string } | undefined;
      if (userRow) {
        // Determine source: if consent_version is present it's the registration modal,
        // otherwise it's an account-settings toggle.
        const source = req.body.consent_version ? 'registration' : 'account_settings';
        notifyMarketingConsent({
          userId,
          email: userRow.email,
          name: userRow.name ?? '',
          marketingConsent: !!req.body.marketing_consent,
          source,
          platform: 'JA Profile Studio',
          ipAddress: ip ?? undefined,
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Customer: get own consent status ──────────────────────────────────────

export async function customerGetConsent(req: Request, res: Response) {
  try {
    const userId = (req as unknown as { user?: { id: number } }).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    const row = await db.prepare(`
      SELECT
        marketing_consent, marketing_consent_at,
        referral_consent, referral_consent_at,
        terms_consent, terms_consent_at,
        privacy_consent, privacy_consent_at,
        data_improve_consent, data_improve_consent_at,
        updates_consent, updates_consent_at,
        crm_consent, crm_consent_at,
        consent_version
      FROM users WHERE id = ?
    `).get(userId);

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
