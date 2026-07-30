/**
 * Points system DB setup — called once on server boot.
 * Creates:
 *   - points_store_items  : admin-managed perks catalogue
 *   - user_achievements   : persisted achievement records with earned_at timestamps
 *   - points_redemptions  : user redemption history
 *
 * Safe to call multiple times (IF NOT EXISTS / ADD COLUMN guards).
 */
import db from '../db.js';

export function setupPointsTables() {
  // ── Store items (admin-managed catalogue) ─────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS points_store_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT    NOT NULL UNIQUE,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      cost        INTEGER NOT NULL DEFAULT 100,
      category    TEXT    NOT NULL DEFAULT 'feature',
      icon        TEXT    NOT NULL DEFAULT 'gift',
      color       TEXT    NOT NULL DEFAULT 'text-primary',
      is_active   INTEGER NOT NULL DEFAULT 1,
      repeatable  INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Seed default items if table is empty ──────────────────────────────────
  const count = (db.prepare(`SELECT COUNT(*) as c FROM points_store_items`).get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO points_store_items (key, title, description, cost, category, icon, color, is_active, repeatable, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    const seed = [
      ['theme_midnight',             'Midnight Theme',            'A deep navy and gold premium theme for your public profile.',                    200,  'theme',   'palette',      'text-indigo-400', 0, 1],
      ['theme_ember',                'Ember Theme',               'A warm amber and charcoal theme that stands out from the crowd.',                200,  'theme',   'palette',      'text-orange-400', 0, 2],
      ['theme_forest',               'Forest Theme',              'A rich forest green theme — calm, professional, and distinctive.',               200,  'theme',   'palette',      'text-green-400',  0, 3],
      ['theme_violet',               'Violet Theme',              'A bold violet and white theme for creatives and personal brands.',               200,  'theme',   'palette',      'text-violet-400', 0, 4],
      ['badge_pioneer',              'Pioneer Badge',             'Display a "Pioneer" badge on your public profile — for early adopters.',         150,  'badge',   'badge-check',  'text-amber-400',  0, 5],
      ['badge_expert',               'Expert Badge',              'Display an "Expert" badge on your public profile.',                              300,  'badge',   'crown',        'text-yellow-400', 0, 6],
      ['badge_community',            'Community Champion Badge',  'Display a "Community Champion" badge on your public profile.',                   250,  'badge',   'star',         'text-cyan-400',   0, 7],
      ['boost_featured_7',           '7-Day Featured Boost',      'Your profile is highlighted in the directory for 7 days.',                       500,  'boost',   'megaphone',    'text-pink-400',   1, 8],
      ['boost_featured_30',          '30-Day Featured Boost',     'Your profile is highlighted in the directory for 30 days.',                      1500, 'boost',   'megaphone',    'text-pink-400',   1, 9],
      ['feature_animated_banner',    'Animated Profile Banner',   'Unlock a subtle animated gradient banner on your public profile.',               400,  'feature', 'sparkles',     'text-purple-400', 0, 10],
      ['feature_profile_views_public','Public View Counter',      'Show a live view count on your public profile page.',                            350,  'feature', 'eye',          'text-blue-400',   0, 11],
      ['feature_custom_footer',      'Custom Profile Footer',     'Add a custom tagline or call-to-action in the footer of your public profile.',   300,  'feature', 'layers',       'text-teal-400',   0, 12],
    ];
    const insertMany = db.transaction(() => {
      for (const row of seed) {
        insert.run(...row as Parameters<typeof insert.run>);
      }
    });
    insertMany();
  }

  // ── User achievements (persisted with timestamps) ─────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      achievement_key TEXT    NOT NULL,
      earned          INTEGER NOT NULL DEFAULT 0,
      points          INTEGER NOT NULL DEFAULT 0,
      earned_at       TEXT,
      UNIQUE(user_id, achievement_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ── Redemptions ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS points_redemptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      perk_key    TEXT    NOT NULL,
      cost        INTEGER NOT NULL DEFAULT 0,
      redeemed_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}
