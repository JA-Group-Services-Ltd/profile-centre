/**
 * AdminPinGate
 *
 * Shown after OIDC login if the admin has a PIN set and hasn't verified it
 * in this session, OR if no PIN is set yet (forces setup on first login).
 *
 * Security properties:
 *  - PIN is NEVER stored in localStorage, sessionStorage, or cookies
 *  - The session flag expires server-side after 15 minutes of inactivity
 *  - The client polls /api/admin/pin/status and re-locks the UI when the
 *    server reports the session has expired
 *  - A heartbeat is sent every 3 minutes to refresh the server-side timestamp
 *    while the admin is actively using the portal
 *  - No PIN set = portal is blocked until a PIN is created (no bypass)
 *
 * Flow:
 *  1. No PIN set  → show "Set up your PIN" screen (cannot skip)
 *  2. PIN set, not verified → show "Enter your PIN" screen
 *  3. PIN set, verified, not expired → render children (portal)
 *  4. PIN session expired → re-show "Enter your PIN" screen
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { fmtTime } from '@/lib/date';
import {
  Shield, Lock, KeyRound, Loader2, AlertTriangle,
  Eye, EyeOff, CheckCircle2, ShieldCheck, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Constants ──────────────────────────────────────────────────────────────────

/** How often to send a heartbeat to refresh the server-side PIN session (ms) */
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

/** How often to poll the server for PIN status (ms) */
const STATUS_POLL_INTERVAL_MS = 60 * 1000; // 1 minute

// ── Types ──────────────────────────────────────────────────────────────────────

interface PinStatus {
  hasPin: boolean;
  pinVerified: boolean;
  locked: boolean;
  lockedUntil: string | null;
  expiresAt: number | null;
  timeoutMs: number;
}

interface AdminPinGateProps {
  children: React.ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminPinGate({ children }: AdminPinGateProps) {
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load PIN status from server ──────────────────────────────────────────────

  const loadStatus = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/admin/pin/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setStatus(data as PinStatus);
        // If the server says the session is no longer valid, re-lock the UI
        if (!data.pinVerified && !silent) {
          setSessionExpired(true);
          setPin('');
          setError('');
        }
      }
    } catch {
      // Network error — do not lock out on transient failures
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Focus PIN input when gate is shown ───────────────────────────────────────

  useEffect(() => {
    if (!loading && status && !status.pinVerified) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [loading, status]);

  // ── Heartbeat — keep PIN session alive while admin is active ─────────────────

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/pin/heartbeat', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        if (!data.success && data.expired) {
          // Server says the PIN session has expired — re-lock
          setStatus(prev => prev ? { ...prev, pinVerified: false } : prev);
          setSessionExpired(true);
          setPin('');
          stopHeartbeat();
        }
      } catch { /* ignore transient network errors */ }
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // ── Status poll — detect server-side expiry even without heartbeat ───────────

  useEffect(() => {
    if (status?.pinVerified) {
      startHeartbeat();
      // Poll status periodically to catch server-side expiry
      pollRef.current = setInterval(() => loadStatus(true), STATUS_POLL_INTERVAL_MS);
    } else {
      stopHeartbeat();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      stopHeartbeat();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status?.pinVerified, startHeartbeat, stopHeartbeat, loadStatus]);

  // ── Verify PIN ───────────────────────────────────────────────────────────────

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
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
        setSessionExpired(false);
        setStatus(prev => prev
          ? { ...prev, pinVerified: true, expiresAt: data.expiresAt ?? null }
          : prev
        );
        setPin('');
      } else if (data.noPinSet) {
        // Server says no PIN is set — switch to setup screen
        setStatus(prev => prev ? { ...prev, hasPin: false, pinVerified: false } : prev);
        setError('');
      } else {
        setError(data.error || 'Incorrect PIN.');
        setPin('');
        inputRef.current?.focus();
        // Refresh status to pick up lockout state
        if (data.locked) await loadStatus(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Set up PIN (first time or change) ───────────────────────────────────────

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    if (!/^\d+$/.test(newPin)) { setError('PIN must contain digits only.'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('PIN set successfully. You now have access to the admin portal.');
        setStatus(prev => prev ? { ...prev, hasPin: true, pinVerified: true } : prev);
        setNewPin('');
        setConfirmPin('');
      } else {
        setError(data.error || 'Failed to set PIN.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset lockout (escape hatch) ─────────────────────────────────────────────

  const handleResetLockout = async () => {
    setResetting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pin/reset-lockout', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Lockout cleared. You can now enter your PIN again.');
        await loadStatus(false);
      } else {
        setError(data.error || 'Could not reset lockout.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // PIN verified and session still valid — render the portal
  if (status?.pinVerified) {
    return <>{children}</>;
  }

  const isSetup = !status?.hasPin;
  const isExpired = sessionExpired && !isSetup;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border ${
            isSetup
              ? 'bg-amber-500/10 border-amber-500/20'
              : isExpired
                ? 'bg-orange-500/10 border-orange-500/20'
                : 'bg-slate-900/5 border-slate-200'
          }`}>
            {isSetup
              ? <KeyRound className="w-8 h-8 text-amber-600" />
              : isExpired
                ? <Clock className="w-8 h-8 text-orange-600" />
                : <Lock className="w-8 h-8 text-slate-700" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isSetup
              ? 'Create your admin PIN'
              : isExpired
                ? 'Session timed out'
                : 'Admin portal locked'}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {isSetup
              ? 'You must set a PIN before accessing the admin portal. This protects the portal if your browser session is left open.'
              : isExpired
                ? 'Your PIN session expired after 15 minutes of inactivity. Please re-enter your PIN to continue.'
                : 'Enter your PIN to unlock the admin portal.'}
          </p>
          {isSetup && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Required on first login
            </div>
          )}
          {isExpired && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              PIN sessions expire after 15 minutes
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">

          {/* Locked */}
          {status?.locked && (
            <div className="mb-5 space-y-3">
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Too many failed attempts. Account locked until{' '}
                  {status.lockedUntil ? fmtTime(status.lockedUntil) : 'later'}.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 text-sm border-red-200 text-red-700 hover:bg-red-50"
                onClick={handleResetLockout}
                disabled={resetting}
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                {resetting ? 'Clearing lockout…' : 'Clear lockout & try again'}
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Verify form */}
          {!isSetup && !status?.locked && (
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                {submitting ? 'Verifying…' : 'Unlock Portal'}
              </Button>
            </form>
          )}

          {/* Setup form — cannot be skipped */}
          {isSetup && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">New PIN (4–8 digits)</label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={8}
                    placeholder="Choose a PIN"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className={`text-center h-12 pr-12 font-mono border-slate-200 text-xl ${showPin ? 'tracking-[0.4em]' : 'tracking-normal'}`}
                    disabled={submitting}
                    autoComplete="new-password"
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
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Confirm PIN</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={8}
                    placeholder="Repeat PIN"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className={`text-center h-12 pr-12 font-mono border-slate-200 text-xl ${showConfirm ? 'tracking-[0.4em]' : 'tracking-normal'}`}
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide confirm PIN' : 'Show confirm PIN'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium bg-amber-600 hover:bg-amber-700 text-white"
                disabled={submitting || newPin.length < 4 || confirmPin.length < 4}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                {submitting ? 'Setting PIN…' : 'Set PIN & Enter Portal'}
              </Button>
              <p className="text-xs text-slate-400 text-center">
                You cannot access the admin portal without setting a PIN.
              </p>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Your Admin PIN is used to confirm sensitive admin actions. JA Profile Studio never stores or displays your actual PIN. Only a secure hashed version is stored.
            </p>
            <p className="text-xs text-slate-400 text-center">
              10 failed attempts locks the account for 15 minutes. Sessions expire after 15 minutes of inactivity.
            </p>
          </div>
        </div>

        <div className="mt-5 text-center">
          <a href="/admin/logout" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
