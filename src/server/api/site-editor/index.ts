/**
 * Public Site Editor API
 *
 * Allows users to customise the HTML/CSS of their public profile page.
 * Supports two profile types: 'personal' (default) and 'business'.
 * All HTML/CSS is sanitised server-side before saving and before rendering.
 * Scripts, event handlers, javascript: URLs, and unsafe iframes are blocked.
 *
 * ACTIVATION GATE: users must first activate the site editor for a specific
 * profile (personal or business) before they can save or publish custom content.
 * Activation sets use_custom_editor = 1 on the matching profile row.
 * Deactivation clears the flag and stops the custom HTML/CSS from being served
 * on the public profile — the standard template is shown instead.
 */

import type { Request, Response } from 'express';
import db from '../../db.js';

function auditLog(action: string, details: string, userId?: number) {
  try {
    db.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, details, created_at) VALUES ('user', ?, ?, ?, datetime('now'))`).run(userId ?? null, action, details);
  } catch { /* audit table may differ */ }
}

// ── Sanitisation ────────────────────────────────────────────────────────────
//
// SECURITY MODEL:
// Custom HTML is rendered inside a <div class="profile-custom-content"> container.
// Custom CSS is scoped to that container at save/publish time so it cannot affect
// platform chrome (report button, legal footer, cookie banner, header, etc.).
//
// Blocked HTML patterns: scripts, event handlers, javascript: URLs, unsafe iframes,
// forms, embeds, objects, data: URLs, vbscript.
//
// Blocked / stripped CSS:
//   - expression(), javascript:, behavior:, -moz-binding, data: URLs
//   - Selectors targeting: html, body, #root, :root, header, footer,
//     .platform-*, #platform-*, fixed/sticky overlays, z-index overrides,
//     pointer-events: none on platform controls
//
// CSS scoping: every rule is prefixed with .profile-custom-content so it only
// affects content inside the sandboxed container.

const BLOCKED_HTML_PATTERNS: RegExp[] = [
  /<script[\s\S]*?>/gi,
  /<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,                         // onclick=, onerror=, onload=, etc.
  /<iframe(?![^>]*sandbox)/gi,           // iframes without sandbox attribute
  /<object/gi,
  /<embed/gi,
  /<form/gi,
  /<input/gi,
  /<button/gi,
  /data\s*:/gi,
  /vbscript\s*:/gi,
  /expression\s*\(/gi,
];

const BLOCKED_CSS_PATTERNS: RegExp[] = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  // Fixed: use literal match instead of nested optional quantifiers to prevent ReDoS
  /url\s*\(\s*javascript/gi,
  /url\s*\(\s*data\s*:/gi,
];

// Selectors that must never appear in user CSS — they target platform chrome or
// global page structure. Rules containing these selectors are dropped entirely.
const BLOCKED_CSS_SELECTORS: RegExp[] = [
  /\bhtml\b/i,
  /\bbody\b/i,
  /#root\b/i,
  /:root\b/i,
  /\bheader\b/i,
  /\bfooter\b/i,
  /\.platform-/i,
  /#platform-/i,
  /\[data-platform/i,
  /\.profile-report-/i,
  /#profile-report-/i,
  /\.cookie-/i,
  /#cookie-/i,
  /\.legal-footer/i,
  /#legal-footer/i,
  /\.report-pill/i,
  /#report-pill/i,
  /\[data-platform-legal/i,
  /\[data-report/i,
  /\*\s*\{/i,                            // wildcard selector targeting everything
];

// CSS property patterns that are dangerous regardless of selector
const BLOCKED_CSS_PROPERTIES: RegExp[] = [
  /position\s*:\s*(fixed|sticky)/i,                    // fixed/sticky overlays covering platform chrome
  /z-index\s*:\s*[1-9]\d{3,}/i,                       // z-index >= 1000 (platform chrome uses high z-index)
  /pointer-events\s*:\s*none/i,                        // disabling pointer events on platform controls
  /overflow\s*:\s*hidden/i,                            // hiding the legal footer / report button by clipping
  /overflow-y\s*:\s*hidden/i,
  /overflow-x\s*:\s*hidden/i,
  /width\s*:\s*100vw/i,                               // full-viewport-width takeover
  /height\s*:\s*100v[hw]/i,                           // full-viewport-height takeover
  /min-height\s*:\s*100v[hw]/i,
  /max-height\s*:\s*100v[hw]/i,
  /min-width\s*:\s*100vw/i,
  /max-width\s*:\s*100vw/i,
  /visibility\s*:\s*hidden/i,                         // hiding platform chrome via visibility
  /display\s*:\s*none/i,                              // hiding platform chrome via display:none
  /opacity\s*:\s*0[^.]/i,                             // making platform chrome invisible
  /clip\s*:/i,                                        // clip/clip-path to hide elements
  /clip-path\s*:/i,
  // Fixed: avoid chained .* quantifiers (ReDoS). Check for translate with negative value separately.
  /transform\s*:[^;]{0,200}translate/i,               // translating elements (checked with bounded length)
];

function sanitiseHtml(html: string): { clean: string; blocked: string[] } {
  const blocked: string[] = [];
  let clean = html;
  for (const pattern of BLOCKED_HTML_PATTERNS) {
    if (pattern.test(clean)) {
      blocked.push(pattern.source);
      clean = clean.replace(pattern, '<!-- [blocked] -->');
    }
    pattern.lastIndex = 0;
  }
  return { clean, blocked };
}

/**
 * Sanitise and scope CSS to .profile-custom-content.
 *
 * Process:
 * 1. Strip dangerous CSS values (expression, javascript:, etc.)
 * 2. Parse rules naively by splitting on `}` boundaries
 * 3. For each rule:
 *    a. Drop it if the selector targets platform chrome
 *    b. Drop it if it contains dangerous property values
 *    c. Prefix the selector with `.profile-custom-content` so it only
 *       affects content inside the sandboxed container
 * 4. @keyframes, @font-face, @import are passed through (after value sanitisation)
 *    but @import is blocked entirely (could load external scripts/styles)
 */
function sanitiseCss(css: string): { clean: string; blocked: string[] } {
  const blocked: string[] = [];
  let clean = css;

  // Step 1: strip dangerous CSS values
  for (const pattern of BLOCKED_CSS_PATTERNS) {
    if (pattern.test(clean)) {
      blocked.push(pattern.source);
      clean = clean.replace(pattern, '/* [blocked] */');
    }
    pattern.lastIndex = 0;
  }

  // Step 2: block @import entirely
  if (/@import/i.test(clean)) {
    blocked.push('@import');
    clean = clean.replace(/@import[^;]*;?/gi, '/* [blocked: @import] */');
  }

  // Step 3: scope rules to .profile-custom-content
  // We use a simple state-machine parser that handles nested braces (e.g. @media).
  const scoped = scopeCssToContainer(clean, '.profile-custom-content', blocked);

  return { clean: scoped, blocked };
}

/**
 * Scope all CSS selectors to `containerClass`.
 * Handles @media, @supports, @keyframes, @font-face at-rules.
 * Drops rules whose selectors match BLOCKED_CSS_SELECTORS.
 * Drops declarations containing BLOCKED_CSS_PROPERTIES.
 */
function scopeCssToContainer(css: string, containerClass: string, blocked: string[]): string {
  const output: string[] = [];
  let i = 0;
  const len = css.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(css[i])) i++;
    if (i >= len) break;

    // Comment: /* ... */
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) { output.push(css.slice(i)); break; }
      output.push(css.slice(i, end + 2));
      i = end + 2;
      continue;
    }

    // At-rule
    if (css[i] === '@') {
      const atEnd = css.indexOf('{', i);
      const semiEnd = css.indexOf(';', i);

      // At-rules without a block (e.g. @charset, @import — already stripped)
      if (semiEnd !== -1 && (atEnd === -1 || semiEnd < atEnd)) {
        output.push(css.slice(i, semiEnd + 1));
        i = semiEnd + 1;
        continue;
      }

      if (atEnd === -1) { output.push(css.slice(i)); break; }

      const atKeyword = css.slice(i, atEnd).trim().toLowerCase();

      // @keyframes and @font-face: pass through as-is (find matching closing brace)
      if (atKeyword.startsWith('@keyframes') || atKeyword.startsWith('@font-face') || atKeyword.startsWith('@-webkit-keyframes')) {
        const block = extractBlock(css, atEnd);
        output.push(css.slice(i, atEnd + 1) + block.content + '}');
        i = block.end + 1;
        continue;
      }

      // @media, @supports, @layer: recurse into the block
      const block = extractBlock(css, atEnd);
      const innerScoped = scopeCssToContainer(block.content, containerClass, blocked);
      output.push(css.slice(i, atEnd + 1) + innerScoped + '}');
      i = block.end + 1;
      continue;
    }

    // Regular rule: find selector + block
    const braceOpen = css.indexOf('{', i);
    if (braceOpen === -1) break; // no more rules

    const selector = css.slice(i, braceOpen).trim();
    const block = extractBlock(css, braceOpen);
    i = block.end + 1;

    if (!selector) continue;

    // Drop rules targeting platform chrome
    const selectorBlocked = BLOCKED_CSS_SELECTORS.some(re => { re.lastIndex = 0; return re.test(selector); });
    if (selectorBlocked) {
      blocked.push(`selector: ${selector.slice(0, 60)}`);
      continue;
    }

    // Filter declarations for dangerous properties
    const declarations = filterDeclarations(block.content, blocked);

    // Scope each comma-separated selector part
    const scopedSelector = selector
      .split(',')
      .map(part => {
        const p = part.trim();
        if (!p) return '';
        // Already scoped (shouldn't happen but be safe)
        if (p.startsWith(containerClass)) return p;
        return `${containerClass} ${p}`;
      })
      .filter(Boolean)
      .join(', ');

    if (scopedSelector && declarations.trim()) {
      output.push(`${scopedSelector} {${declarations}}`);
    }
  }

  return output.join('\n');
}

/** Extract the content between matching braces starting at `openPos`. */
function extractBlock(css: string, openPos: number): { content: string; end: number } {
  let depth = 0;
  let i = openPos;
  const len = css.length;
  let start = openPos + 1;
  while (i < len) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return { content: css.slice(start, i), end: i };
    }
    i++;
  }
  return { content: css.slice(start), end: len - 1 };
}

/** Remove declarations that match BLOCKED_CSS_PROPERTIES. */
function filterDeclarations(declarations: string, blocked: string[]): string {
  return declarations
    .split(';')
    .filter(decl => {
      const d = decl.trim();
      if (!d) return true;
      const isBlocked = BLOCKED_CSS_PROPERTIES.some(re => { re.lastIndex = 0; return re.test(d); });
      if (isBlocked) { blocked.push(`property: ${d.slice(0, 60)}`); return false; }
      return true;
    })
    .join(';');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type ProfileType = 'personal' | 'business';

function resolveProfileType(raw: unknown): ProfileType {
  return raw === 'business' ? 'business' : 'personal';
}

/**
 * Returns the profile row for this user + profile_type, or null if none exists.
 * Used to check use_custom_editor activation status.
 */
function getProfileRow(userId: number, profileType: ProfileType) {
  return db.prepare(
    "SELECT id, use_custom_editor FROM profiles WHERE user_id = ? AND profile_type = ? ORDER BY id ASC LIMIT 1"
  ).get(userId, profileType) as { id: number; use_custom_editor: number } | undefined;
}

/**
 * Returns true if the user has activated the site editor for this profile type.
 */
function isEditorActivated(userId: number, profileType: ProfileType): boolean {
  const profile = getProfileRow(userId, profileType);
  return !!profile && !!profile.use_custom_editor;
}

// ── DB setup ────────────────────────────────────────────────────────────────

export function ensureSiteEditorTables() {
  // Legacy table (user_id UNIQUE) — kept for backwards compat, now superseded
  // by the new profile-type-aware table below.
  db.prepare(`
    CREATE TABLE IF NOT EXISTS site_editor_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      html TEXT NOT NULL DEFAULT '',
      css TEXT NOT NULL DEFAULT '',
      draft_html TEXT NOT NULL DEFAULT '',
      draft_css TEXT NOT NULL DEFAULT '',
      disabled_by_admin INTEGER NOT NULL DEFAULT 0,
      disabled_reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // New per-profile-type table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS site_editor_content_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      profile_type TEXT NOT NULL DEFAULT 'personal',
      html TEXT NOT NULL DEFAULT '',
      css TEXT NOT NULL DEFAULT '',
      draft_html TEXT NOT NULL DEFAULT '',
      draft_css TEXT NOT NULL DEFAULT '',
      disabled_by_admin INTEGER NOT NULL DEFAULT 0,
      disabled_reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, profile_type)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS site_editor_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      profile_type TEXT NOT NULL DEFAULT 'personal',
      html TEXT NOT NULL DEFAULT '',
      css TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 0,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Add profile_type column to versions if it doesn't exist (migration)
  try {
    db.prepare(`ALTER TABLE site_editor_versions ADD COLUMN profile_type TEXT NOT NULL DEFAULT 'personal'`).run();
  } catch { /* column already exists */ }
}

function getRow(userId: number, profileType: ProfileType) {
  return db.prepare('SELECT * FROM site_editor_content_v2 WHERE user_id = ? AND profile_type = ?').get(userId, profileType) as any;
}

// ── Handlers ────────────────────────────────────────────────────────────────

// GET /api/site-editor?profile_type=personal|business
export async function getSiteEditor(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const profileType = resolveProfileType(req.query.profile_type);
  try {
    ensureSiteEditorTables();
    const profile = getProfileRow(userId, profileType);
    const activated = !!profile?.use_custom_editor;
    const row = getRow(userId, profileType);
    if (!row) {
      return res.json({ success: true, html: '', css: '', draft_html: '', draft_css: '', disabled: false, activated, profile_type: profileType });
    }
    if (row.disabled_by_admin) {
      return res.json({ success: true, html: '', css: '', draft_html: '', draft_css: '', disabled: true, disabled_reason: row.disabled_reason, activated, profile_type: profileType });
    }
    res.json({ success: true, html: row.html, css: row.css, draft_html: row.draft_html, draft_css: row.draft_css, disabled: false, activated, profile_type: profileType });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/site-editor/activate  — activate custom editor for a profile type
export async function activateSiteEditor(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    const profile = getProfileRow(userId, profileType);
    if (!profile) {
      return res.status(404).json({ success: false, error: `No ${profileType} profile found. Create a ${profileType} profile first before activating the site editor.` });
    }
    db.prepare('UPDATE profiles SET use_custom_editor = 1 WHERE id = ?').run(profile.id);
    auditLog('site_editor_activated', `User ${userId} activated site editor for ${profileType} profile (profile_id: ${profile.id})`, userId);
    res.json({ success: true, activated: true, profile_type: profileType });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/site-editor/deactivate  — deactivate custom editor (reverts to standard template)
export async function deactivateSiteEditor(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    const profile = getProfileRow(userId, profileType);
    if (!profile) {
      return res.status(404).json({ success: false, error: `No ${profileType} profile found.` });
    }
    db.prepare('UPDATE profiles SET use_custom_editor = 0 WHERE id = ?').run(profile.id);
    auditLog('site_editor_deactivated', `User ${userId} deactivated site editor for ${profileType} profile (profile_id: ${profile.id}) — standard template will be shown`, userId);
    res.json({ success: true, activated: false, profile_type: profileType });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/site-editor/draft
export async function saveDraft(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { html = '', css = '', profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    ensureSiteEditorTables();

    // ── Size cap ─────────────────────────────────────────────────────────────
    const MAX_HTML = 200_000; // 200 KB
    const MAX_CSS  =  50_000; //  50 KB
    if (String(html).length > MAX_HTML) return res.status(413).json({ success: false, error: `HTML exceeds the maximum size of ${MAX_HTML / 1000} KB.` });
    if (String(css).length  > MAX_CSS)  return res.status(413).json({ success: false, error: `CSS exceeds the maximum size of ${MAX_CSS / 1000} KB.` });

    // ── Activation gate ──────────────────────────────────────────────────────
    if (!isEditorActivated(userId, profileType)) {
      return res.status(403).json({
        success: false,
        error: `Site editor is not activated for your ${profileType} profile. Activate it from the Site Editor page first.`,
        not_activated: true,
      });
    }

    const row = getRow(userId, profileType);
    if (row?.disabled_by_admin) return res.status(403).json({ success: false, error: 'Site editor has been disabled for your account by an administrator.' });

    const { clean: cleanHtml, blocked: blockedHtml } = sanitiseHtml(String(html));
    const { clean: cleanCss, blocked: blockedCss } = sanitiseCss(String(css));

    if (blockedHtml.length > 0 || blockedCss.length > 0) {
      auditLog('site_editor_blocked', `Blocked content in draft for user ${userId} (${profileType})`, userId);
    }

    db.prepare(`
      INSERT INTO site_editor_content_v2 (user_id, profile_type, draft_html, draft_css, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, profile_type) DO UPDATE SET draft_html = excluded.draft_html, draft_css = excluded.draft_css, updated_at = excluded.updated_at
    `).run(userId, profileType, cleanHtml, cleanCss);

    res.json({ success: true, sanitisedHtml: cleanHtml, sanitisedCss: cleanCss, blockedHtml, blockedCss });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/site-editor/publish
export async function publishSiteEditor(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { html = '', css = '', profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    ensureSiteEditorTables();

    // ── Size cap ─────────────────────────────────────────────────────────────
    const MAX_HTML = 200_000;
    const MAX_CSS  =  50_000;
    if (String(html).length > MAX_HTML) return res.status(413).json({ success: false, error: `HTML exceeds the maximum size of ${MAX_HTML / 1000} KB.` });
    if (String(css).length  > MAX_CSS)  return res.status(413).json({ success: false, error: `CSS exceeds the maximum size of ${MAX_CSS / 1000} KB.` });

    // ── Activation gate ──────────────────────────────────────────────────────
    if (!isEditorActivated(userId, profileType)) {
      return res.status(403).json({
        success: false,
        error: `Site editor is not activated for your ${profileType} profile. Activate it from the Site Editor page first.`,
        not_activated: true,
      });
    }

    const row = getRow(userId, profileType);
    if (row?.disabled_by_admin) return res.status(403).json({ success: false, error: 'Site editor has been disabled for your account by an administrator.' });

    const { clean: cleanHtml, blocked: blockedHtml } = sanitiseHtml(String(html));
    const { clean: cleanCss, blocked: blockedCss } = sanitiseCss(String(css));

    if (blockedHtml.length > 0 || blockedCss.length > 0) {
      auditLog('site_editor_blocked', `Blocked content on publish for user ${userId} (${profileType})`, userId);
    }

    // Save version snapshot
    db.prepare(`
      INSERT INTO site_editor_versions (user_id, profile_type, html, css, published) VALUES (?, ?, ?, ?, 1)
    `).run(userId, profileType, cleanHtml, cleanCss);

    // Update live content
    db.prepare(`
      INSERT INTO site_editor_content_v2 (user_id, profile_type, html, css, draft_html, draft_css, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, profile_type) DO UPDATE SET html = excluded.html, css = excluded.css, draft_html = excluded.draft_html, draft_css = excluded.draft_css, updated_at = excluded.updated_at
    `).run(userId, profileType, cleanHtml, cleanCss, cleanHtml, cleanCss);

    auditLog('site_editor_published', `User ${userId} published site editor content (${profileType})`, userId);
    res.json({ success: true, blockedHtml, blockedCss });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/site-editor/reset
export async function resetSiteEditor(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const { profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    ensureSiteEditorTables();
    db.prepare(`
      INSERT INTO site_editor_content_v2 (user_id, profile_type, html, css, draft_html, draft_css, updated_at)
      VALUES (?, ?, '', '', '', '', datetime('now'))
      ON CONFLICT(user_id, profile_type) DO UPDATE SET html = '', css = '', draft_html = '', draft_css = '', updated_at = datetime('now')
    `).run(userId, profileType);
    auditLog('site_editor_reset', `User ${userId} reset site editor to default (${profileType})`, userId);
    res.json({ success: true, html: '', css: '' });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// GET /api/site-editor/versions?profile_type=personal|business
export async function getSiteEditorVersions(req: Request, res: Response) {
  const userId = (req as any).session?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const profileType = resolveProfileType(req.query.profile_type);
  try {
    ensureSiteEditorTables();
    const versions = db.prepare(`
      SELECT id, html, css, published, label, created_at
      FROM site_editor_versions WHERE user_id = ? AND profile_type = ?
      ORDER BY created_at DESC LIMIT 20
    `).all(userId, profileType);
    res.json({ success: true, versions });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// Admin: GET /api/admin/site-editor/:userId
export async function adminGetSiteEditor(req: Request, res: Response) {
  try {
    ensureSiteEditorTables();
    const rows = db.prepare('SELECT * FROM site_editor_content_v2 WHERE user_id = ?').all(req.params.userId);
    res.json({ success: true, data: rows ?? [] });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/admin/site-editor/:userId/disable
export async function adminDisableSiteEditor(req: Request, res: Response) {
  const { reason = 'Disabled by administrator', profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    ensureSiteEditorTables();
    db.prepare(`
      INSERT INTO site_editor_content_v2 (user_id, profile_type, disabled_by_admin, disabled_reason, updated_at)
      VALUES (?, ?, 1, ?, datetime('now'))
      ON CONFLICT(user_id, profile_type) DO UPDATE SET disabled_by_admin = 1, disabled_reason = excluded.disabled_reason, updated_at = excluded.updated_at
    `).run(req.params.userId, profileType, reason);
    auditLog('site_editor_disabled', `Admin disabled site editor for user ${req.params.userId} (${profileType}): ${reason}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/admin/site-editor/:userId/enable
export async function adminEnableSiteEditor(req: Request, res: Response) {
  const { profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    ensureSiteEditorTables();
    db.prepare(`
      INSERT INTO site_editor_content_v2 (user_id, profile_type, disabled_by_admin, disabled_reason, updated_at)
      VALUES (?, ?, 0, NULL, datetime('now'))
      ON CONFLICT(user_id, profile_type) DO UPDATE SET disabled_by_admin = 0, disabled_reason = NULL, updated_at = datetime('now')
    `).run(req.params.userId, profileType);
    auditLog('site_editor_enabled', `Admin re-enabled site editor for user ${req.params.userId} (${profileType})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// POST /api/admin/site-editor/:userId/revert
export async function adminRevertSiteEditor(req: Request, res: Response) {
  const { profile_type } = req.body;
  const profileType = resolveProfileType(profile_type);
  try {
    ensureSiteEditorTables();
    db.prepare(`
      INSERT INTO site_editor_content_v2 (user_id, profile_type, html, css, draft_html, draft_css, updated_at)
      VALUES (?, ?, '', '', '', '', datetime('now'))
      ON CONFLICT(user_id, profile_type) DO UPDATE SET html = '', css = '', draft_html = '', draft_css = '', updated_at = datetime('now')
    `).run(req.params.userId, profileType);
    auditLog('site_editor_reverted', `Admin reverted site editor to default for user ${req.params.userId} (${profileType})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
