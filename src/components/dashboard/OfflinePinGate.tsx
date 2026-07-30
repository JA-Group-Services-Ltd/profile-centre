/**
 * OfflinePinGate
 *
 * Shown inside the dashboard when the device is offline.
 *
 * Behaviour:
 *  - If the user has a PIN hash stored in sessionStorage (recorded when they
 *    set/verified their PIN while online), show a PIN entry form.
 *    On correct PIN → render children (read-only cached dashboard).
 *  - If no PIN hash is stored, show a friendly offline screen with a
 *    "Try again" button — they can still navigate the sidebar.
 *
 * Security:
 *  - PIN is verified client-side via SHA-256 hash comparison only.
 *  - No mutations are possible offline (all save/submit buttons are disabled
 *    by useOfflineGuard throughout the dashboard).
 *  - The offline PIN gate is purely a read-access convenience — it does not
 *    grant any elevated permissions.
 */
import { useState, useRef, useEffect } from 'react';
import { WifiOff, Lock, Eye, EyeOff, Loader2, AlertTriangle, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hasStoredOfflinePin, verifyOfflinePin } from '@/hooks/useOfflinePin';
import { useAuth } from '@/lib/auth';

/**
 * SECURITY CONTRACT
 * -----------------
 * The service worker guarantees /api/* is NEVER cached (network-only).
 * So when offline, every dashboard page's useEffect fetch will throw a
 * network error. Pages already handle this gracefully — they call
 * setLoading(false) after the try/catch, leaving state as null/empty.
 *
 * What this means:
 *  - No private user data (email, phone, billing, profile content) is ever
 *    served from cache — it simply doesn't exist offline.
 *  - Pages render their empty/zero state, which is safe.
 *  - The PIN gate is a UX convenience (access the shell + cached public
 *    assets) — it does NOT grant access to any private data.
 *  - All mutation buttons are already disabled by useOfflineGuard.
 *
 * Sensitive pages (billing, security settings, messages) will show their
 * empty state with the amber "offline — data unavailable" notice bar.
 * This is intentional and correct.
 */

interface OfflinePinGateProps {
  children: React.ReactNode;
}

export default function OfflinePinGate({ children }: OfflinePinGateProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const hasPinHash = userId !== undefined && hasStoredOfflinePin(userId);

  // If no PIN hash stored, skip the gate entirely — show the no-connection screen
  const [unlocked, setUnlocked] = useState(!hasPinHash);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked && hasPinHash) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [unlocked, hasPinHash]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !userId) return;
    setVerifying(true);
    setError('');
    try {
      const ok = await verifyOfflinePin(pin, userId);
      if (ok) {
        setUnlocked(true);
        setPin('');
      } else {
        setError('Incorrect PIN. Try again.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Could not verify PIN. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Unlocked — render the cached dashboard shell ─────────────────────────
  if (unlocked) {
    return (
      <>
        {/* Persistent offline notice — clearly states data is unavailable, not just read-only */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            You're offline — account data is unavailable. All changes are disabled until you reconnect.
          </span>
        </div>
        {children}
      </>
    );
  }

  // ── PIN gate ──────────────────────────────────────────────────────────────
  if (hasPinHash) {
    return (
      <div className="flex items-start justify-center pt-16 px-4">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>

          {/* Status pill */}
          <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 mb-4">
            <WifiOff className="w-3 h-3" />
            No internet connection
          </div>

          <h2 className="text-lg font-semibold text-foreground mb-1">You're offline</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Enter your security PIN to view your cached dashboard. No changes can be saved until you reconnect.
          </p>

          <form onSubmit={handleVerify} className="space-y-3 text-left">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="relative">
              <Input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="\d*"
                maxLength={8}
                placeholder="Enter PIN"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="text-center h-14 pr-12 font-mono text-2xl"
                autoComplete="current-password"
                disabled={verifying}
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              type="submit"
              className="w-full h-11 gap-2"
              disabled={verifying || pin.length < 4}
            >
              {verifying
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : <><Lock className="w-4 h-4" /> View Dashboard</>
              }
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            Your PIN was set in Security Settings. Only cached data is available offline.
          </p>
        </div>
      </div>
    );
  }

  // ── No PIN set — plain offline screen ────────────────────────────────────
  return (
    <div className="flex items-start justify-center pt-16 px-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">

        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-7 h-7 text-red-500" />
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          No internet connection
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-2">You're offline</h2>
        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
          Your dashboard needs an internet connection to load your data.
        </p>
        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
          Tip: set a security PIN in <strong className="text-foreground">Security Settings</strong> to access your cached dashboard offline.
        </p>

        <Button className="w-full gap-2" onClick={() => window.location.reload()}>
          <Wifi className="w-4 h-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
