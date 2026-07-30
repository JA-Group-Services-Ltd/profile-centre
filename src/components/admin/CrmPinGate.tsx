/**
 * CrmPinGate
 *
 * A page-level PIN gate that wraps the Users & CRM page.
 * Unlike AdminPinGate (which grants a 15-min session for the whole portal),
 * this gate re-challenges on EVERY visit to the page — i.e. each time the
 * component mounts. Navigating away and back always requires re-entry.
 *
 * Uses the existing /api/admin/pin/verify endpoint. On success it stores
 * a short-lived in-memory flag (React state only — never localStorage).
 * The flag is cleared when the component unmounts, so leaving the page
 * always resets it.
 */
import { useState, useEffect, useRef } from 'react';
import { Lock, Shield, Eye, EyeOff, Loader2, AlertTriangle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CrmPinGateProps {
  children: React.ReactNode;
}

export default function CrmPinGate({ children }: CrmPinGateProps) {
  // `verified` is purely in-memory React state — cleared on unmount automatically
  const [verified, setVerified] = useState(false);
  // Small gate to ensure the session cookie from the verify response is fully
  // committed before children mount and fire their own API requests
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.length < 4) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.success) {
        setVerified(true);
        setPin('');
        // Defer rendering children by one tick so the browser can process the
        // Set-Cookie header from this response before children fire their fetches
        setTimeout(() => setReady(true), 50);
      } else if (data.locked) {
        setLocked(true);
        setLockedUntil(data.lockedUntil ?? null);
        setPin('');
      } else {
        setError(data.error || 'Incorrect PIN. Please try again.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (verified && ready) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-slate-900/5 border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-7 h-7 text-slate-700" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1.5">PIN required</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Users &amp; CRM requires your admin PIN every time you open it.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">

          {/* Locked out */}
          {locked && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Too many failed attempts. Account locked
                {lockedUntil ? ` until ${lockedUntil}` : ' temporarily'}.
              </span>
            </div>
          )}

          {/* Error */}
          {error && !locked && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!locked && (
            <form onSubmit={handleVerify} className="space-y-4">
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
                  className={`text-center h-14 pr-12 font-mono border-slate-200 text-2xl ${showPin ? 'tracking-[0.5em]' : 'tracking-normal'}`}
                  autoComplete="current-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium bg-slate-900 hover:bg-slate-800 text-white"
                disabled={submitting || pin.length < 4}
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Verifying…</>
                  : <><Shield className="w-4 h-4 mr-2" />Unlock Users & CRM</>}
              </Button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              This page is re-locked every time you navigate away. 5 failed attempts locks the account for 15 minutes.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <KeyRound className="w-3 h-3" />
          <span>PIN is never stored in your browser</span>
        </div>
      </div>
    </div>
  );
}
