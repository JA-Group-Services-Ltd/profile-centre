import { type Request, type Response } from 'express';
import db from '../../db.js';
import { notifyUserPaused, notifyAccountStatus } from '../../lib/notifications.js';
import { writeAudit } from '../../lib/audit.js';
import { assignUserNumber } from '../../lib/user-number.js';

// ── Create Customer (manual admin-initiated account creation) ─────────────────
export async function createUser(req: Request, res: Response) {
  try {
    const { email, name, plan_id } = req.body as { email?: string; name?: string; plan_id?: number };

    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'Email and name are required.' });
    }

    const lowerEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowerEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    // Check for duplicate
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(lowerEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
    }

    // Resolve plan — default to Free
    const freePlan = db.prepare("SELECT id FROM plans WHERE slug = 'free'").get() as { id: number } | undefined;
    const resolvedPlanId = plan_id ?? freePlan?.id ?? 1;

    const result = db.prepare(
      "INSERT INTO users (email, name, role, plan_id, created_at, updated_at) VALUES (?, ?, 'member', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).run(lowerEmail, name.trim(), resolvedPlanId) as { lastInsertRowid: number };

    const newUserId = Number(result.lastInsertRowid);

    // Assign Sousa Murray Profiles User Number (non-fatal)
    try {
      assignUserNumber(
        newUserId,
        (req as any).adminUser?.id,
        (req as any).adminUser?.name,
        (req as any).adminUser?.email,
        req.ip,
      );
    } catch (err) {
      console.error('[user-number] Failed to assign user number on admin user creation:', err);
    }

    // Award signup points & referral code (non-fatal)
    try {
      const { awardPoints, getOrCreateReferralCode } = await import('../../lib/points.js');
      awardPoints(newUserId, 'signup', 'Welcome bonus — account created by admin');
      getOrCreateReferralCode(newUserId);
    } catch { /* non-fatal */ }

    writeAudit({
      actorId: (req as any).adminUser?.id,
      actorName: (req as any).adminUser?.name,
      actorEmail: (req as any).adminUser?.email,
      actorType: 'admin',
      tenant: 'admin_workforce',
      authProvider: 'microsoft_entra_workforce',
      action: 'create_user',
      resourceType: 'user',
      resourceId: String(newUserId),
      resourceLabel: lowerEmail,
      details: `Admin manually created customer account for ${lowerEmail} (plan_id: ${resolvedPlanId})`,
      ipAddress: req.ip,
      result: 'success',
    });

    const newUser = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.plan_id, u.created_at, p.name AS plan_name
      FROM users u LEFT JOIN plans p ON u.plan_id = p.id WHERE u.id = ?
    `).get(newUserId);

    res.status(201).json({ success: true, data: newUser });
  } catch (err) {
    console.error('[createUser]', err);
    res.status(500).json({ success: false, error: 'Failed to create user.' });
  }
}

// Users
export async function getAdminUserDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.plan_id, u.lifetime_access, u.created_at,
             COALESCE(u.is_paused, 0) AS is_paused, u.pause_reason,
             u.user_number,
             u.lifetime_granted_at, u.lifetime_granted_by, u.lifetime_reason_category,
             u.lifetime_internal_note, u.lifetime_review_date, u.lifetime_customer_note,
             COALESCE(u.lifetime_can_be_withdrawn, 1) AS lifetime_can_be_withdrawn,
             p.name AS plan_name, p.slug AS plan_slug, p.max_seats, p.has_messaging,
             p.price_monthly, p.max_profiles, p.max_links,
             s.status AS subscription_status, s.billing_interval, s.current_period_end
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status NOT IN ('cancelled','incomplete_expired')
      WHERE u.id = ?
      ORDER BY s.created_at DESC
      LIMIT 1
    `).get(id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const profiles = db.prepare(`
      SELECT id, username, display_name, profile_type, is_published, biz_slug, person_slug,
             job_title, company, created_at
      FROM profiles WHERE user_id = ? ORDER BY created_at ASC
    `).all(id);

    // Business seats where this user is a member
    const seatMemberships = db.prepare(`
      SELECT bs.id, bs.role, bs.status, bs.created_at,
             p.business_name, p.biz_slug, p.id AS profile_id
      FROM business_seats bs
      JOIN profiles p ON p.id = bs.profile_id
      WHERE bs.user_id = ? AND bs.status = 'active'
    `).all(id);

    // Business profiles owned by this user and their seat counts
    const businessProfiles = db.prepare(`
      SELECT p.id, p.business_name, p.biz_slug, p.is_published,
             (SELECT COUNT(*) FROM business_seats bs WHERE bs.profile_id = p.id AND bs.status = 'active') AS active_seats,
             (SELECT COUNT(*) FROM business_seat_invites bsi WHERE bsi.profile_id = p.id AND bsi.status = 'pending') AS pending_invites
      FROM profiles p
      WHERE p.user_id = ? AND p.profile_type = 'business'
    `).all(id);

    // Recent audit log entries for this user
    const auditLog = db.prepare(`
      SELECT action, resource_type, details, created_at, result
      FROM audit_log
      WHERE actor_id = ? OR (resource_type = 'user' AND resource_id = ?)
      ORDER BY created_at DESC LIMIT 20
    `).all(id, String(id));

    res.json({ success: true, data: { user, profiles, seatMemberships, businessProfiles, auditLog } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user detail' });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    // ?role=admin  → admin accounts only (used by Admin Accounts page)
    // ?role=member → customers only
    // (no param)   → all users (used by Users & CRM page)
    // ?search=     → filter by name, email, internal id, or user_number (spaced or unspaced)
    const roleFilter = (req.query.role as string | undefined)?.toLowerCase();
    const searchRaw = ((req.query.search as string | undefined) ?? '').trim();
    const searchNorm = searchRaw.replace(/\s/g, ''); // strip spaces for user_number matching

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (roleFilter) {
      conditions.push(`u.role = '${roleFilter === 'admin' ? 'admin' : 'member'}'`);
    }
    if (searchRaw) {
      conditions.push(
        `(u.name LIKE ? OR u.email LIKE ? OR CAST(u.id AS TEXT) = ? OR u.user_number = ? OR u.user_number LIKE ?)`
      );
      params.push(`%${searchRaw}%`, `%${searchRaw}%`, searchRaw, searchNorm, `%${searchNorm}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const users = db.prepare(`
      SELECT u.id, u.name,
        CASE WHEN u.role = 'admin' THEN
          SUBSTR(u.email, 1, 2) || '***@' || SUBSTR(u.email, INSTR(u.email, '@') + 1)
        ELSE u.email END AS email,
        u.role, u.plan_id, u.created_at, u.last_login_at,
        COALESCE(u.is_paused, 0) AS is_paused, u.pause_reason,
        u.lifetime_access, u.lifetime_plan_id, u.account_status,
        COALESCE(u.is_blocked, 0) AS is_blocked,
        u.user_number,
        p.name as plan_name, p.slug as plan_slug,
        (SELECT COUNT(*) FROM profiles WHERE user_id = u.id) as profile_count,
        (SELECT status FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as subscription_status
      FROM users u LEFT JOIN plans p ON u.plan_id = p.id
      ${whereClause}
      ORDER BY u.created_at DESC
    `).all(...params);
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { role, plan_id, name } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    // Role changes to 'admin' are blocked — admins are managed exclusively via
    // the JA Group Services Azure portal (workforce tenant). Any attempt to
    // promote a customer to admin via this API is silently ignored.
    if (role !== undefined && role !== 'admin') { updates.push('role = ?'); values.push(role); }
    // plan_id: null means "remove plan"; a number means assign that plan
    if (plan_id !== undefined) {
      updates.push('plan_id = ?');
      values.push(plan_id === null || plan_id === 'none' ? null : Number(plan_id));
    }
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    await db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
    const user = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.plan_id, u.created_at, p.name as plan_name
      FROM users u LEFT JOIN plans p ON u.plan_id = p.id WHERE u.id = ?
    `).get(id);
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'update_user', resourceType: 'user', resourceId: String(id),
      resourceLabel: (user as any)?.email,
      details: `Admin updated user ${id}: ${updates.join(', ')}`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as { id: number; email: string } | undefined;
    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'delete_user', resourceType: 'user', resourceId: String(id),
      resourceLabel: target?.email,
      details: `Admin deleted user ${id} (${target?.email ?? 'unknown'})`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
}

// ── Block / Unblock a user ─────────────────────────────────────────────────
export async function blockUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason, hide_profiles } = req.body as { reason?: string; hide_profiles?: boolean };
    await db.prepare(`UPDATE users SET is_blocked = 1, block_reason = ?, blocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(reason ?? null, id);
    if (hide_profiles) {
      await db.prepare(`UPDATE profiles SET is_published = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(id);
    }
    const user = await db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id) as { id: number; email: string; name: string } | undefined;
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'block_user', resourceType: 'user', resourceId: String(id),
      resourceLabel: user?.email,
      details: `Admin blocked user ${id} (${user?.email ?? ''})${reason ? ` — reason: ${reason}` : ''}${hide_profiles ? ' — profiles hidden' : ''}`,
      ipAddress: req.ip, result: 'success',
    });
    // Notify the user their account has been suspended
    if (user) notifyAccountStatus({ userEmail: user.email, userName: user.name, action: 'suspended', reason });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to block user' });
  }
}

export async function unblockUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.prepare(`UPDATE users SET is_blocked = 0, block_reason = NULL, blocked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    const user = await db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id) as { id: number; email: string; name: string } | undefined;
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'unblock_user', resourceType: 'user', resourceId: String(id),
      resourceLabel: user?.email,
      details: `Admin unblocked user ${id} (${user?.email ?? ''})`,
      ipAddress: req.ip, result: 'success',
    });
    // Notify the user their account has been restored
    if (user) notifyAccountStatus({ userEmail: user.email, userName: user.name, action: 'restored' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to unblock user' });
  }
}

// ── Pause / Unpause a single user ──────────────────────────────────────────
export async function pauseUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paused, reason } = req.body as { paused: boolean; reason?: string };
    await db.prepare('UPDATE users SET is_paused = ?, pause_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(paused ? 1 : 0, reason ?? null, id);
    const user = await db.prepare('SELECT id, email, name, is_paused, pause_reason FROM users WHERE id = ?').get(id) as {
      id: number; email: string; name: string; is_paused: number; pause_reason: string | null;
    } | undefined;
    if (user) notifyUserPaused({ userName: user.name, userEmail: user.email, userId: user.id, paused, reason });
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: paused ? 'pause_user' : 'unpause_user', resourceType: 'user', resourceId: String(id),
      resourceLabel: user?.email,
      details: paused
        ? `Admin paused user ${id} (${user?.email ?? ''})${reason ? ` — reason: ${reason}` : ''}`
        : `Admin unpaused user ${id} (${user?.email ?? ''})`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user pause state' });
  }
}

// ── Global plans pause (admin_settings key: plans_paused) ──────────────────
export async function getGlobalPauseState(_req: Request, res: Response) {
  try {
    const row = await db.prepare("SELECT value FROM admin_settings WHERE key = 'plans_paused'").get() as { value: string } | undefined;
    const msg = await db.prepare("SELECT value FROM admin_settings WHERE key = 'plans_paused_message'").get() as { value: string } | undefined;
    res.json({
      success: true,
      paused: row?.value === '1',
      message: msg?.value ?? '',
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get pause state' });
  }
}

export async function setGlobalPauseState(req: Request, res: Response) {
  try {
    const { paused, message } = req.body as { paused: boolean; message?: string };
    await db.prepare('INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run('plans_paused', paused ? '1' : '0');
    if (message !== undefined) {
      await db.prepare('INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run('plans_paused_message', message);
    }
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: paused ? 'global_pause_enabled' : 'global_pause_disabled', resourceType: 'settings',
      details: paused ? `Global plan pause enabled${message ? ` — message: "${message}"` : ''}` : 'Global plan pause disabled',
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to set pause state' });
  }
}

// Profiles
export async function getProfiles(_req: Request, res: Response) {
  try {
    // Check which optional tables exist so we can safely include their counts.
    // This prevents the whole query from crashing if a table hasn't been created yet.
    const tableExists = (name: string): boolean => {
      try {
        const row = db.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(name) as { name: string } | undefined;
        return !!row;
      } catch { return false; }
    };

    const hasProfileLinks    = tableExists('profile_links');
    const hasPageViews       = tableExists('page_views');
    const hasContactEnquiries = tableExists('contact_enquiries');
    const hasMessageThreads  = tableExists('message_threads');

    const linkCountExpr      = hasProfileLinks     ? '(SELECT COUNT(*) FROM profile_links    WHERE profile_id = p.id)' : '0';
    const viewCountExpr      = hasPageViews        ? '(SELECT COUNT(*) FROM page_views        WHERE profile_id = p.id)' : '0';
    const enquiryCountExpr   = hasContactEnquiries ? '(SELECT COUNT(*) FROM contact_enquiries WHERE profile_id = p.id)' : '0';
    const messageCountExpr   = hasMessageThreads   ? '(SELECT COUNT(*) FROM message_threads   WHERE profile_id = p.id)' : '0';

    const profiles = db.prepare(`
      SELECT p.id, p.username, p.display_name, p.is_published, p.profile_type,
             p.biz_slug, p.person_slug, p.created_at, p.user_id,
             COALESCE(p.is_verified, 0)   AS is_verified,
             p.verified_at, p.verified_by,
             p.verification_requested_at, p.verification_request_note,
             p.bio, p.job_title, p.company, p.contact_email, p.phone,
             p.website, p.address, p.seo_title, p.seo_description,
             p.business_name,
             COALESCE(p.is_suspended, 0)  AS is_suspended,
             COALESCE(p.is_hidden, 0)     AS is_hidden,
             u.email  AS user_email,
             u.name   AS user_name,
             ${linkCountExpr}    AS link_count,
             ${viewCountExpr}    AS view_count,
             ${enquiryCountExpr} AS enquiry_count,
             ${messageCountExpr} AS message_count
      FROM profiles p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `).all();

    res.json({ success: true, data: profiles });
  } catch (err) {
    console.error('[admin] getProfiles error:', err);
    res.status(500).json({ success: false, error: `Failed to fetch profiles: ${String(err)}` });
  }
}

export async function updateAdminProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const allowed = [
      'display_name', 'username', 'bio', 'job_title', 'company',
      'contact_email', 'phone', 'website', 'address',
      'seo_title', 'seo_description', 'is_published',
      'business_name', 'biz_slug',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    await db.prepare(`UPDATE profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'update_profile', resourceType: 'profile', resourceId: String(id),
      details: `Admin updated profile ${id}: ${updates.join(', ')}`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
}

export async function deleteAdminProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // Fetch profile info before deleting for audit log
    const profile = db.prepare('SELECT id, username, biz_slug, profile_type, user_id FROM profiles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Cascade-delete all related data
    db.prepare('DELETE FROM profile_links WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM contact_enquiries WHERE profile_id = ?').run(id);
    db.prepare("DELETE FROM issue_reports WHERE reported_profile_id = ?").run(id);
    // Remove business seats if this is a business profile
    if (profile.profile_type === 'business') {
      db.prepare('DELETE FROM business_seats WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM business_invites WHERE profile_id = ?').run(id);
    }
    // Finally delete the profile itself
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);

    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'delete_profile', resourceType: 'profile', resourceId: String(id),
      resourceLabel: String(profile.username || profile.biz_slug || id),
      details: `Admin permanently deleted ${profile.profile_type} profile ${id} (${profile.username || profile.biz_slug}) belonging to user ${profile.user_id}`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
}

// GET /api/admin/profiles/:id/preview — full profile data for admin preview, ignores is_published
export async function getAdminProfilePreview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const profile = db.prepare(`
      SELECT p.*, u.email as user_email, u.name as user_name,
             pl.name as plan_name
      FROM profiles p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN plans pl ON u.plan_id = pl.id
      WHERE p.id = ?
    `).get(id) as Record<string, unknown> | undefined;
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Fetch links
    const links = db.prepare(
      'SELECT * FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(id) as Record<string, unknown>[];

    res.json({ success: true, data: { profile, links } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile preview' });
  }
}

// Enquiries
export async function getAllEnquiries(_req: Request, res: Response) {
  try {
    const enquiries = await db.prepare(`
      SELECT ce.*, ce.profile_id, p.username, p.display_name as profile_name, u.email as user_email
      FROM contact_enquiries ce 
      JOIN profiles p ON ce.profile_id = p.id 
      JOIN users u ON p.user_id = u.id
      ORDER BY ce.created_at DESC
    `).all();
    res.json({ success: true, data: enquiries });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch enquiries' });
  }
}

export async function adminMarkEnquiryRead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.prepare('UPDATE contact_enquiries SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
}

export async function adminDeleteEnquiry(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const enquiry = await db.prepare('SELECT id FROM contact_enquiries WHERE id = ?').get(id);
    if (!enquiry) return res.status(404).json({ success: false, error: 'Enquiry not found' });
    await db.prepare('DELETE FROM contact_enquiries WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete enquiry' });
  }
}

// Analytics
export async function getAdminAnalytics(_req: Request, res: Response) {
  try {
    const totalUsersRow = await db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
    const totalUsers = totalUsersRow?.c ?? 0;
    const totalProfilesRow = await db.prepare('SELECT COUNT(*) as c FROM profiles').get() as { c: number };
    const totalProfiles = totalProfilesRow?.c ?? 0;
    const totalEnquiriesRow = await db.prepare('SELECT COUNT(*) as c FROM contact_enquiries').get() as { c: number };
    const totalEnquiries = totalEnquiriesRow?.c ?? 0;
    const totalViewsRow = await db.prepare('SELECT COUNT(*) as c FROM page_views').get() as { c: number };
    const totalViews = totalViewsRow?.c ?? 0;
    const totalClicksRow = await db.prepare('SELECT COUNT(*) as c FROM link_clicks').get() as { c: number };
    const totalClicks = totalClicksRow?.c ?? 0;

    const recentUsers = await db.prepare('SELECT id, email, name, role, created_at FROM users WHERE role != ? ORDER BY created_at DESC LIMIT 10').all('admin');
    const topProfiles = await db.prepare(`
      SELECT p.username, p.display_name, COUNT(pv.id) as views
      FROM profiles p LEFT JOIN page_views pv ON p.id = pv.profile_id
      GROUP BY p.id ORDER BY views DESC LIMIT 10
    `).all();

    let viewsByDay: unknown[] = [];
    try {
      viewsByDay = await db.prepare(`
        SELECT DATE(viewed_at) as date, COUNT(*) as count 
        FROM page_views WHERE viewed_at >= datetime('now', '-30 days')
        GROUP BY DATE(viewed_at) ORDER BY date ASC
      `).all();
    } catch { /* ignore */ }

    res.json({ success: true, data: { totalUsers, totalProfiles, totalEnquiries, totalViews, totalClicks, recentUsers, topProfiles: Array.isArray(topProfiles) ? topProfiles : [], viewsByDay: Array.isArray(viewsByDay) ? viewsByDay : [] } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
}

// Plans
export async function getAdminPlans(_req: Request, res: Response) {
  try {
    const plans = await db.prepare('SELECT * FROM plans ORDER BY price_monthly ASC').all();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
}

export async function createPlan(req: Request, res: Response) {
  try {
    const {
      name, slug, price_monthly, price_yearly, max_profiles, max_links,
      has_qr_download, has_contact_form, has_advanced_analytics, has_vcard_download,
      has_custom_themes, remove_branding, has_profile_link_customisation, has_messaging,
      has_lifetime, max_seats, is_public,
      stripe_price_monthly, stripe_price_yearly, stripe_price_lifetime, stripe_product_id,
    } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, error: 'Name and slug required' });
    const result = await db.prepare(`
      INSERT INTO plans (
        name, slug, price_monthly, price_yearly, max_profiles, max_links,
        has_qr_download, has_contact_form, has_advanced_analytics, has_vcard_download,
        has_custom_themes, remove_branding, has_profile_link_customisation, has_messaging,
        has_lifetime, max_seats, is_public,
        stripe_price_monthly, stripe_price_yearly, stripe_price_lifetime, stripe_product_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, slug,
      price_monthly || 0, price_yearly || 0,
      max_profiles || 1, max_links || 5,
      has_qr_download || 0, has_contact_form || 0, has_advanced_analytics || 0,
      has_vcard_download || 0, has_custom_themes || 0, remove_branding || 0,
      has_profile_link_customisation || 0, has_messaging || 0, has_lifetime || 0, max_seats || 1,
      is_public || 0,
      stripe_price_monthly || null, stripe_price_yearly || null,
      stripe_price_lifetime || null, stripe_product_id || null,
    );
    const newPlan = await db.prepare('SELECT * FROM plans WHERE id = ?').get((result as { lastInsertRowid: number }).lastInsertRowid);
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'create_plan', resourceType: 'plan', resourceId: String((result as { lastInsertRowid: number }).lastInsertRowid),
      resourceLabel: name, details: `Admin created plan "${name}" (slug: ${slug})`,
      ipAddress: req.ip, result: 'success',
    });
    res.status(201).json({ success: true, data: newPlan });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const fields = [
      'name', 'price_monthly', 'price_yearly', 'max_profiles', 'max_links',
      'has_qr_download', 'has_contact_form', 'has_advanced_analytics', 'has_vcard_download',
      'has_custom_themes', 'remove_branding', 'is_active', 'is_public',
      'has_messaging', 'has_lifetime', 'max_seats',
      'stripe_price_monthly', 'stripe_price_yearly', 'stripe_price_lifetime', 'stripe_product_id',
    ];
    const updates = fields.filter(f => req.body[f] !== undefined);
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => req.body[f]);
    await db.prepare(`UPDATE plans SET ${setClause} WHERE id = ?`).run(...values, id);
    const updatedPlan = await db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'update_plan', resourceType: 'plan', resourceId: String(id),
      resourceLabel: (updatedPlan as any)?.name,
      details: `Admin updated plan ${id}: fields [${updates.join(', ')}]`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true, data: updatedPlan });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update plan' });
  }
}

export async function deletePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userCount = ((await db.prepare('SELECT COUNT(*) as c FROM users WHERE plan_id = ?').get(id)) as { c: number })?.c ?? 0;
    if (userCount > 0) {
      return res.status(409).json({ success: false, error: `Cannot delete: ${userCount} user(s) are on this plan. Move them first.` });
    }
    await db.prepare('DELETE FROM plans WHERE id = ?').run(id);
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'delete_plan', resourceType: 'plan', resourceId: String(id),
      details: `Admin deleted plan ${id}`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete plan' });
  }
}

// Toggle plan public visibility
export async function togglePlanPublic(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const plan = await db.prepare('SELECT id, is_public FROM plans WHERE id = ?').get(id) as { id: number; is_public: number } | undefined;
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
    const newValue = plan.is_public ? 0 : 1;
    await db.prepare('UPDATE plans SET is_public = ? WHERE id = ?').run(newValue, id);
    res.json({ success: true, is_public: newValue });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to toggle plan visibility' });
  }
}

// Assign a plan directly to a user (admin action — bypasses Stripe)
export async function assignPlanToUser(req: Request, res: Response) {
  try {
    const { id } = req.params; // user id
    const { plan_id, note } = req.body as { plan_id: number | null | 'none'; note?: string };
    const user = await db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id) as { id: number; email: string; name: string } | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    // 'none' or null both mean remove the plan
    const resolvedPlanId = (plan_id === null || plan_id === 'none' || plan_id === undefined) ? null : Number(plan_id);
    await db.prepare('UPDATE users SET plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(resolvedPlanId, id);
    // Audit log
    writeAudit({
      actorId: (req as any).user?.id ?? 0,
      actorName: (req as any).user?.name ?? 'Admin',
      actorEmail: (req as any).user?.email ?? '',
      actorType: 'admin',
      tenant: 'admin_workforce',
      authProvider: 'microsoft_entra_workforce',
      action: resolvedPlanId === null ? 'remove_plan' : 'assign_plan',
      resourceType: 'user',
      resourceId: String(id),
      resourceLabel: user.email,
      details: resolvedPlanId === null
        ? `Admin removed plan from ${user.email}${note ? ` — ${note}` : ''}`
        : `Admin assigned plan_id=${resolvedPlanId} to ${user.email}${note ? ` — ${note}` : ''}`,
      ipAddress: req.ip,
      result: 'success',
    });
    res.json({ success: true, plan_id: resolvedPlanId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to assign plan' });
  }
}

// Themes
export async function getAdminThemes(_req: Request, res: Response) {
  try {
    const themes = await db.prepare('SELECT * FROM themes ORDER BY id ASC').all();
    res.json({ success: true, data: themes });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch themes' });
  }
}

export async function createTheme(req: Request, res: Response) {
  try {
    const { name, slug, description, primary_color, accent_color, background_color, text_color, is_free } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, error: 'Name and slug required' });
    const result = await db.prepare(`
      INSERT INTO themes (name, slug, description, primary_color, accent_color, background_color, text_color, is_free)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, slug, description || '', primary_color || '#3B82F6', accent_color || '#3B82F6',
      background_color || '#FFFFFF', text_color || '#0F172A', is_free !== undefined ? is_free : 1);
    res.status(201).json({ success: true, data: await db.prepare('SELECT * FROM themes WHERE id = ?').get((result as { lastInsertRowid: number }).lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create theme' });
  }
}

export async function updateTheme(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'primary_color', 'accent_color', 'background_color', 'text_color', 'is_free', 'is_active'];
    const updates = fields.filter(f => req.body[f] !== undefined);
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => req.body[f]);
    await db.prepare(`UPDATE themes SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true, data: await db.prepare('SELECT * FROM themes WHERE id = ?').get(id) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update theme' });
  }
}

// Settings
export async function getSettings(_req: Request, res: Response) {
  try {
    const settings = await db.prepare('SELECT * FROM admin_settings').all() as { key: string; value: string }[];
    const obj: Record<string, string> = {};
    for (const s of settings) obj[s.key] = s.value;
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    for (const [key, value] of Object.entries(req.body as Record<string, string>)) {
      await db.prepare('INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, String(value));
    }
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'update_settings', resourceType: 'settings',
      details: `Admin updated settings: keys [${Object.keys(req.body).join(', ')}]`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
}

// User settings update
export async function updateUserSettings(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // IDOR guard — a customer can only update their own account.
    // req.session.userId is set by requireAuth middleware.
    const sessionUserId = (req as any).session?.userId;
    if (!sessionUserId || Number(id) !== Number(sessionUserId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { name, email, current_password, new_password } = req.body;
    
    if (new_password) {
      const bcrypt = require('bcryptjs');
      const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as { password_hash: string } | undefined;
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      if (!bcrypt.compareSync(current_password, user.password_hash)) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }
      const hash = bcrypt.hashSync(new_password, 10);
      await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, id);
    }
    
    if (name) await db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id);
    if (email) {
      const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), id);
      if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });
      await db.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(email.toLowerCase(), id);
    }
    
    const user = await db.prepare('SELECT id, email, name, role, plan_id FROM users WHERE id = ?').get(id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
}

/**
 * UK GDPR Art 17 — Right to Erasure ("right to be forgotten").
 * Deletes all personal data associated with the account:
 * - User record (cascades to profiles, links, enquiries, subscriptions via FK)
 * - Explicit deletion of analytics rows (page_views, link_clicks) — no FK cascade
 * - Partner enquiries and support requests linked by email are anonymised
 * - A deletion record is kept for compliance audit (no PII, just timestamp + hashed ref)
 */
export async function deleteAccount(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // IDOR guard — a customer can only delete their own account.
    const sessionUserId = (req as any).session?.userId;
    if (!sessionUserId || Number(id) !== Number(sessionUserId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as
      { id: number; email: string } | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Collect profile IDs before deletion (needed for analytics cleanup)
    const profiles = await db.prepare('SELECT id FROM profiles WHERE user_id = ?').all(id) as { id: number }[];
    const profileIds = profiles.map(p => p.id);

    // Anonymise partner_enquiries and support_requests by email (not linked by FK)
    await db.prepare(`UPDATE partner_enquiries SET name = '[deleted]', email = '[deleted]' WHERE email = ?`).run(user.email);
    await db.prepare(`UPDATE support_requests SET name = '[deleted]', email = '[deleted]' WHERE email = ?`).run(user.email);

    // Delete analytics rows (no FK cascade on these)
    if (profileIds.length > 0) {
      const placeholders = profileIds.map(() => '?').join(',');
      await db.prepare(`DELETE FROM page_views WHERE profile_id IN (${placeholders})`).run(...profileIds);
      await db.prepare(`DELETE FROM link_clicks WHERE profile_id IN (${placeholders})`).run(...profileIds);
    }

    // Delete the user — FK ON DELETE CASCADE handles profiles, links, enquiries, subscriptions
    await db.prepare('DELETE FROM users WHERE id = ?').run(id);

    // Record deletion for compliance audit (no PII stored — just a timestamp)
    try {
      await db.prepare(`
        INSERT INTO data_deletion_requests (user_id, email, status, completed_at)
        VALUES (?, '[erased]', 'completed', CURRENT_TIMESTAMP)
      `).run(id, '[erased]');
    } catch { /* non-fatal */ }

    // Audit log
    try {
      await db.prepare(`INSERT INTO audit_log (actor, action, detail) VALUES (?, 'account.deleted', ?)`)
        .run('system', `user_id=${id} — GDPR erasure completed`);
    } catch { /* non-fatal */ }

    res.json({ success: true });
  } catch (err) {
    console.error('[admin] deleteAccount error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
}

// ─── Branding ─────────────────────────────────────────────────────────────────

const BRANDING_KEYS = [
  'platform_name', 'platform_tagline', 'platform_description', 'platform_url',
  'platform_logo_url', 'platform_favicon_url',
  'master_brand_name', 'master_brand_url',
  'legal_company_name', 'legal_company_number', 'legal_registered_address',
  'legal_vat_number', 'legal_email', 'legal_privacy_email',
  'support_email', 'contact_email',
  'footer_tagline', 'footer_show_legal_name', 'footer_links',
  'social_twitter', 'social_linkedin', 'social_instagram', 'social_facebook',
  'email_from_name',
];

export async function getBranding(_req: Request, res: Response) {
  try {
    const rows = await db.prepare('SELECT key, value FROM admin_settings').all() as { key: string; value: string }[];
    const obj: Record<string, string> = {};
    for (const r of rows) {
      if (BRANDING_KEYS.includes(r.key)) obj[r.key] = r.value;
    }
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch branding' });
  }
}

export async function updateBranding(req: Request, res: Response) {
  try {
    for (const key of BRANDING_KEYS) {
      if (key in req.body) {
        await db.prepare('INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, String(req.body[key]));
      }
    }
    writeAudit({
      actorId: (req as any).user?.id, actorName: (req as any).user?.name, actorEmail: (req as any).user?.email,
      actorType: 'admin', tenant: 'admin_workforce', authProvider: 'microsoft_entra_workforce',
      action: 'update_branding', resourceType: 'settings',
      details: `Admin updated branding: keys [${BRANDING_KEYS.filter(k => k in req.body).join(', ')}]`,
      ipAddress: req.ip, result: 'success',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update branding' });
  }
}

// ─── Partner Enquiries ────────────────────────────────────────────────────────

export async function getPartnerEnquiries(_req: Request, res: Response) {
  try {
    // SQLite only: ensure table exists (Azure schema handles this at startup)
    if (typeof (db as any).exec === 'function' && !(db as any)._isAzure) {
      try {
        (db as any).exec(`
          CREATE TABLE IF NOT EXISTS partner_enquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL DEFAULT 'affiliate',
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            company TEXT,
            website TEXT,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch { /* ignore */ }
    }
    const rows = await db.prepare('SELECT * FROM partner_enquiries ORDER BY created_at DESC').all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch partner enquiries' });
  }
}

export async function markPartnerEnquiryRead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.prepare('UPDATE partner_enquiries SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update enquiry' });
  }
}

export async function deletePartnerEnquiry(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM partner_enquiries WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete enquiry' });
  }
}

// Public branding endpoint (no auth required)
export async function getPublicBranding(_req: Request, res: Response) {
  try {
    const rows = await db.prepare('SELECT key, value FROM admin_settings').all() as { key: string; value: string }[];
    const obj: Record<string, string> = {};
    const publicKeys = ['platform_name', 'platform_tagline', 'platform_description', 'platform_url',
      'master_brand_name', 'master_brand_url', 'legal_company_name', 'legal_company_number',
      'footer_tagline', 'footer_show_legal_name', 'footer_links', 'support_email', 'contact_email',
      'social_twitter', 'social_linkedin', 'social_instagram', 'social_facebook',
      // Theme keys are also public so the frontend can apply them on load
      'site_color_mode', 'site_primary_color', 'site_secondary_color', 'site_accent_color'];
    for (const r of rows) {
      if (publicKeys.includes(r.key)) obj[r.key] = r.value;
    }
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch branding' });
  }
}

// ─── Site Theme ───────────────────────────────────────────────────────────────

const THEME_KEYS = ['site_color_mode', 'site_primary_color', 'site_secondary_color', 'site_accent_color'];

export async function getSiteTheme(_req: Request, res: Response) {
  try {
    const rows = await db.prepare('SELECT key, value FROM admin_settings')
      .all() as { key: string; value: string }[];
    const obj: Record<string, string> = {};
    for (const r of rows) {
      if (THEME_KEYS.includes(r.key)) obj[r.key] = r.value;
    }
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch theme' });
  }
}

export async function updateSiteTheme(req: Request, res: Response) {
  try {
    for (const key of THEME_KEYS) {
      if (key in req.body) {
        await db.prepare('INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, String(req.body[key]));
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update theme' });
  }
}

// ── Sousa Murray Profiles User Number — admin backfill endpoint ────────────────────
export async function backfillUserNumbersEndpoint(req: Request, res: Response) {
  try {
    const adminUser = (req as any).adminUser;
    const { backfillUserNumbers } = await import('../../lib/user-number.js');
    const result = backfillUserNumbers(
      adminUser?.id,
      adminUser?.name,
      adminUser?.email,
      req.ip,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}



