/**
 * PwaSplashScreen
 *
 * Shown for ~1.2 s when the app is launched in standalone (PWA) mode.
 * Mimics the native OS splash screen — full-screen branded overlay that
 * fades out once the app shell is ready.
 *
 * Only renders in standalone mode. In a normal browser tab it returns null
 * immediately so there is zero overhead.
 */

import { useState, useEffect } from 'react';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// Only show once per page load — use a module-level flag (in-memory, no storage)
let splashShown = false;

export default function PwaSplashScreen() {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'fading' | 'gone'>('hidden');

  useEffect(() => {
    if (!isStandalone()) return;
    if (splashShown) return; // already shown this page load
    splashShown = true;
    setPhase('visible');

    // Hold for 1.1 s then start fade
    const fadeTimer = setTimeout(() => setPhase('fading'), 1100);
    // Remove from DOM after fade completes (400 ms transition)
    const goneTimer = setTimeout(() => setPhase('gone'), 1500);

    return () => { clearTimeout(fadeTimer); clearTimeout(goneTimer); };
  }, []);

  if (phase === 'hidden' || phase === 'gone') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: phase === 'fading' ? 'none' : 'all',
      }}
    >
      {/* App icon */}
      <div style={{
        width: 96,
        height: 96,
        borderRadius: 22,
        overflow: 'hidden',
        marginBottom: 24,
        boxShadow: '0 8px 32px rgba(37,99,235,0.35)',
      }}>
        <img
          src="/icon-192.png"
          alt="Sousa Murray Profiles"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* App name */}
      <p style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        fontSize: 20,
        fontWeight: 700,
        color: '#f1f5f9',
        letterSpacing: '-0.01em',
        marginBottom: 6,
      }}>
        Sousa Murray Profiles
      </p>

      {/* Tagline */}
      <p style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        fontSize: 13,
        color: '#64748b',
        letterSpacing: '0.01em',
      }}>
        Your digital profile, always with you
      </p>

      {/* Loading dots */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 40,
      }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#2563eb',
              animation: `ja-splash-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ja-splash-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
