import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/globals.css';

if (import.meta.env.MODE === 'development') {
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  document.head.appendChild(meta);

  // Suppress the pre-existing "Failed to fetch dynamically imported module:
  // .../export-plugins/index.ts" unhandled rejection so it doesn't surface in
  // the AiroErrorBoundary overlay. This fetch failure originates outside the
  // app source (platform tooling) and is non-fatal.
  //
  // Two listeners are registered: one on the capture phase (runs first,
  // before any bubble-phase listener) and one on the bubble phase (runs
  // before AiroErrorBoundary's bubble-phase listener which is registered
  // later during componentDidMount). Both call preventDefault() +
  // stopImmediatePropagation() to fully silence the event.
  const suppressDevToolsRejection = (event: PromiseRejectionEvent) => {
    const msg: string = event.reason?.message ?? '';
    if (msg.includes('dev-tools/src/index.ts')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  window.addEventListener('unhandledrejection', suppressDevToolsRejection, { capture: true });
  window.addEventListener('unhandledrejection', suppressDevToolsRejection, { capture: false });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('Root element not found');

const tree = (
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);

// SSR markup is detected via a child element inside the #app root. hydrateRoot
// reattaches to the server-rendered tree; createRoot mounts fresh for dev/
// pre-SSR fallback.
if (rootElement.firstElementChild) {
  hydrateRoot(rootElement, tree);
} else {
  createRoot(rootElement).render(tree);
}

// ── Service Worker registration ───────────────────────────────────────────────
// Only in production — dev uses Vite HMR which conflicts with SW caching.
// The SW handles offline fallback, asset caching, and update notifications.
// Private routes (/api/*, /dashboard/*, /admin/*) are never cached by the SW.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        // Listen for updates — notify the user when a new version is ready
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — dispatch a custom event so the UI can show a banner
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        });
      })
      .catch(err => console.warn('[SW] Registration failed:', err));

    // When the SW sends SW_UPDATED (after activate), reload to get fresh assets
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') {
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      }
    });
  });

  // ── Background refresh on visibility change ─────────────────────────────────
  // When the user switches back to the app (from another app or tab), silently
  // tell the SW to revalidate public API caches so data is always fresh.
  // This is the PWA equivalent of a native app's "resume" lifecycle event.
  let lastHiddenAt = 0;
  const REVALIDATE_AFTER_MS = 5 * 60 * 1000; // 5 minutes

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastHiddenAt = Date.now();
      return;
    }
    // App became visible again
    const hiddenFor = Date.now() - lastHiddenAt;
    if (hiddenFor < REVALIDATE_AFTER_MS) return; // was only hidden briefly — skip

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_REVALIDATE' });
    }
  });
}
