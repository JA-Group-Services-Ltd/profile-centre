/**
 * Sousa Murray Profiles — Service Worker v4
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CACHING STRATEGY                                                       │
 * ├──────────────────────────┬──────────────────────────────────────────────┤
 * │  Resource type           │  Strategy                                    │
 * ├──────────────────────────┼──────────────────────────────────────────────┤
 * │  App shell (JS/CSS)      │  Cache-first (hashed filenames = safe)       │
 * │  Public pages (HTML)     │  Network-first → cache fallback              │
 * │  Public API (/api/plans, │  Stale-while-revalidate (show cached,        │
 * │  /api/homepage-content,  │  refresh in background)                      │
 * │  /api/public/*)          │                                              │
 * │  Static assets           │  Cache-first (images, fonts, icons)          │
 * │  /api/* (private)        │  Network-only — NEVER cached                 │
 * │  /dashboard/* (HTML)     │  Network-first → offline shell fallback      │
 * │  /admin/*                │  Network-only                                │
 * │  POST/PUT/PATCH/DELETE   │  Network-only — pass through untouched       │
 * └──────────────────────────┴──────────────────────────────────────────────┘
 *
 * SECURITY:
 *  - Private API responses (/api/* except public whitelist) are NEVER cached.
 *  - Admin pages are NEVER cached.
 *  - Only GET requests are ever cached.
 *  - Dashboard HTML is cached for shell-only offline display (no data).
 *
 * UPDATE FLOW:
 *  - skipWaiting() activates the new SW immediately.
 *  - clients.claim() takes control of all open tabs.
 *  - SW_UPDATED postMessage lets the UI show a "reload for updates" banner.
 */

// v10: bust stale RootLayout module cache
// FORCE_REVALIDATE message clears page/API caches so Refresh button gets fresh data
const CACHE_VERSION = 'v10';
const SHELL_CACHE   = `ja-profile-studio-shell-${CACHE_VERSION}`;
const PAGE_CACHE    = `ja-profile-studio-pages-${CACHE_VERSION}`;
const API_CACHE     = `ja-profile-studio-api-${CACHE_VERSION}`;
const ASSET_CACHE   = `ja-profile-studio-assets-${CACHE_VERSION}`;

const ALL_CACHES = [SHELL_CACHE, PAGE_CACHE, API_CACHE, ASSET_CACHE];

const OFFLINE_URL = '/offline.html';

// ── Public API routes that are safe to cache (no private user data) ──────────
const PUBLIC_API_PATHS = [
  '/api/plans',
  '/api/homepage-content',
  '/api/site-status',
  '/api/platform-branding',
];

// ── Private routes — NEVER cache ─────────────────────────────────────────────
const PRIVATE_PREFIXES = [
  '/api/',        // all API (public ones are whitelisted above)
  '/admin/',
  '/auth/',
];

// ── Connectivity probe — always bypass SW, go straight to network ─────────────
// /api/health is used by useOnlineStatus as a real-connectivity probe.
// It must NEVER be served from cache — a cached 200 would falsely report
// "online" when the device has no actual internet access.
const PROBE_PATH = '/api/health';

// ── Public pages to pre-cache on install ─────────────────────────────────────
const PRECACHE_PAGES = [
  '/',
  '/login',
  '/register',
  '/help',
  '/services',
  '/status',
  '/legal',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/acceptable-use',
  '/legal/refunds',
  '/legal/complaints',
  '/legal/accessibility',
  '/legal/service-status',
  '/legal/eligibility',
  '/legal/data-retention',
  '/legal/reporting',
  '/legal/security',
  '/legal/data-rights',
  '/support',
  '/report-issue',
  OFFLINE_URL,
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPrivate(url) {
  const { pathname } = new URL(url);
  return PRIVATE_PREFIXES.some(p => pathname.startsWith(p));
}

function isPublicApi(url) {
  const { pathname } = new URL(url);
  return PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + '?'));
}

function isStaticAsset(url) {
  const { pathname } = new URL(url);
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/airo-assets/') ||
    /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp|gif|avif)$/.test(pathname)
  );
}

function isDashboard(url) {
  const { pathname } = new URL(url);
  return pathname.startsWith('/dashboard/') || pathname === '/dashboard';
}

// ── Install — pre-cache shell + public pages ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Pre-cache the offline page immediately
      caches.open(SHELL_CACHE).then(cache => cache.add(OFFLINE_URL)),
      // Pre-cache public pages in the background (failures are non-fatal)
      caches.open(PAGE_CACHE).then(cache =>
        Promise.allSettled(
          PRECACHE_PAGES.filter(p => p !== OFFLINE_URL).map(path =>
            fetch(path, { credentials: 'same-origin' })
              .then(res => { if (res.ok) cache.put(path, res); })
              .catch(() => {/* non-fatal */})
          )
        )
      ),
      // Pre-cache public API responses
      caches.open(API_CACHE).then(cache =>
        Promise.allSettled(
          PUBLIC_API_PATHS.map(path =>
            fetch(path)
              .then(res => { if (res.ok) cache.put(path, res); })
              .catch(() => {/* non-fatal */})
          )
        )
      ),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate — delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => !ALL_CACHES.includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
        )
      )
  );
});

// ── Message handler — FORCE_REVALIDATE from PwaNavBar Refresh button ─────────
// Clears the page and API caches so the next navigation fetches fresh content.
// Does NOT clear the shell cache (JS/CSS assets) — those are hashed and safe.
self.addEventListener('message', event => {
  if (event.data?.type !== 'FORCE_REVALIDATE') return;
  event.waitUntil(
    Promise.all([
      caches.delete(PAGE_CACHE),
      caches.delete(API_CACHE),
    ]).then(() => {
      // Re-seed the public API cache immediately so the next load is fast
      return caches.open(API_CACHE).then(cache =>
        Promise.allSettled(
          PUBLIC_API_PATHS.map(path =>
            fetch(path)
              .then(res => { if (res.ok) cache.put(path, res); })
              .catch(() => {})
          )
        )
      );
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Non-GET / HEAD: pass straight through — never intercept mutations
  // (HEAD is allowed through for the connectivity probe)
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  // Cross-origin: pass through
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // ── 0. Connectivity probe — always network-only, never cached ────────────
  // This is the real-connectivity check used by useOnlineStatus. A cached
  // response would defeat the purpose entirely.
  if (url.pathname === PROBE_PATH) return;

  // ── 1. Public API — stale-while-revalidate ────────────────────────────────
  if (isPublicApi(request.url)) {
    event.respondWith(
      caches.open(API_CACHE).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => null);

          // Return cached immediately; refresh in background
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // ── 2. Private API — network-only, never cache ────────────────────────────
  if (isPrivate(request.url)) return;

  // ── 3. Static assets — cache-first ───────────────────────────────────────
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // ── 4. Navigation requests ────────────────────────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            // Cache public pages; dashboard pages cached for shell-only fallback
            const targetCache = isDashboard(request.url) ? SHELL_CACHE : PAGE_CACHE;
            caches.open(targetCache).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          // Offline: try exact page cache, then offline.html
          caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // ── 5. Everything else — network-first, cache fallback ───────────────────
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          caches.open(PAGE_CACHE).then(c => c.put(request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
