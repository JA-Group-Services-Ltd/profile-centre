/**
 * PwaNavBar
 *
 * A fixed bottom navigation bar shown ONLY when the app is running in
 * standalone (PWA / installed) mode. Provides the native-app controls
 * that the browser chrome normally supplies but hides in standalone mode:
 *
 *   ← Back   |   ⌂ Home   |   ↺ Refresh
 *
 * The bar is invisible in a normal browser tab — users still have the
 * browser's own back/forward/refresh there.
 *
 * It also adds bottom padding to the page so content is never hidden
 * behind the bar.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { Home, ArrowLeft, RefreshCw } from 'lucide-react';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export default function PwaNavBar() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const [show, setShow]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [canGoBack, setCanGoBack]   = useState(false);

  // Only mount in standalone mode
  useEffect(() => {
    setShow(isStandalone());
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => setShow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Track whether there is history to go back to
  useEffect(() => {
    // history.length > 1 means there is at least one entry to go back to.
    // We also disable Back when already on the dashboard home.
    setCanGoBack(window.history.length > 1 && location.pathname !== '/dashboard');
  }, [location]);

  const handleBack = useCallback(() => {
    if (canGoBack) navigate(-1);
  }, [canGoBack, navigate]);

  const handleHome = useCallback(() => {
    navigate('/dashboard', { replace: false });
  }, [navigate]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    // Tell the service worker to revalidate caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_REVALIDATE' });
    }

    // Small visual delay then reload the current route data
    await new Promise(r => setTimeout(r, 600));

    // Soft refresh: navigate to same path to re-run loaders
    navigate(location.pathname + location.search, { replace: true });
    setRefreshing(false);
  }, [refreshing, navigate, location]);

  if (!show) return null;

  const isHome = location.pathname === '/dashboard';

  return (
    <>
      {/* Spacer so page content isn't hidden behind the bar */}
      <div style={{ height: 64 }} aria-hidden="true" />

      <nav
        aria-label="App navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9000,
          height: 64,
          display: 'flex',
          alignItems: 'stretch',
          background: 'hsl(var(--card))',
          borderTop: '1px solid hsl(var(--border))',
          /* Safe area inset for notched phones */
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Back */}
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          aria-label="Go back"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            cursor: canGoBack ? 'pointer' : 'default',
            opacity: canGoBack ? 1 : 0.3,
            color: 'hsl(var(--muted-foreground))',
            transition: 'opacity 0.15s, color 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.01em' }}>Back</span>
        </button>

        {/* Home */}
        <button
          onClick={handleHome}
          aria-label="Go to dashboard home"
          aria-current={isHome ? 'page' : undefined}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isHome ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
            transition: 'color 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Home size={20} strokeWidth={isHome ? 2.5 : 2} />
          <span style={{
            fontSize: 10,
            fontWeight: isHome ? 700 : 500,
            letterSpacing: '0.01em',
          }}>Home</span>
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh page"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            cursor: refreshing ? 'default' : 'pointer',
            color: 'hsl(var(--muted-foreground))',
            transition: 'color 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <RefreshCw
            size={20}
            strokeWidth={2}
            style={{
              transition: 'transform 0.6s ease',
              transform: refreshing ? 'rotate(360deg)' : 'rotate(0deg)',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.01em' }}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </span>
        </button>
      </nav>
    </>
  );
}
