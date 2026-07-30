/**
 * PinChallenge
 *
 * A modal dialog that prompts the admin to re-enter their PIN before a
 * high-risk action is executed. On success it calls onSuccess(token) with
 * a short-lived challenge token that the caller must include in the
 * subsequent API request as the X-Admin-Pin-Token header.
 *
 * Usage:
 *   const [showChallenge, setShowChallenge] = useState(false);
 *
 *   <PinChallenge
 *     open={showChallenge}
 *     action="delete_user"
 *     actionLabel="delete this user"
 *     onSuccess={(token) => { setShowChallenge(false); doDeleteUser(token); }}
 *     onCancel={() => setShowChallenge(false)}
 *   />
 *
 * Supported action values (must match requireAdminPinHighRisk in entry.ts):
 *   sar_view, sar_export, delete_user, assign_plan, update_settings,
 *   update_legal, assisted_access, billing_control, feature_change, suspend_user
 *
 * Security:
 *   - PIN is sent over HTTPS to POST /api/admin/pin/challenge
 *   - The returned token is one-time-use and expires in 5 minutes
 *   - The token is passed to the caller — never stored in state beyond the call
 *   - The PIN input is cleared immediately after submission
 */
import { useState, useRef, useEffect } from 'react';
import { Shield, Loader2, AlertTriangle, Eye, EyeOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Action label map ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  sar_view:        'view subject access request data',
  sar_export:      'export a subject access request PDF',
  delete_user:     'permanently delete this user account',
  delete_profile:  'permanently delete this profile',
  assign_plan:     'change this user\'s plan',
  update_settings: 'change platform settings',
  update_legal:    'update a legal policy',
  assisted_access: 'enter assisted access for this account',
  billing_control: 'change billing configuration',
  feature_change:  'change feature availability',
  suspend_user:    'suspend this user',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface PinChallengeProps {
  open: boolean;
  /** The action key — must match a requireAdminPinHighRisk action in entry.ts */
  action: string;
  /** Human-readable description of what the admin is about to do */
  actionLabel?: string;
  /** Called with the challenge token on success */
  onSuccess: (token: string) => void;
  /** Called when the admin cancels */
  onCancel: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PinChallenge({
  open,
  action,
  actionLabel,
  onSuccess,
  onCancel,
}: PinChallengeProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const label = actionLabel ?? ACTION_LABELS[action] ?? action;

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
      setShowPin(false);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || pin.length < 4) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pin/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin, action }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        setPin('');
        onSuccess(data.token);
      } else if (data.expired || res.status === 403) {
        // PIN session expired — re-verify the session first, then re-issue challenge
        setError('');
        setSubmitting(true);
        // Step 1: re-verify the session with the PIN they just entered
        const verifyRes = await fetch('/api/admin/pin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setError(verifyData.error || 'Incorrect PIN.');
          setPin('');
          inputRef.current?.focus();
          return;
        }
        // Step 2: now re-issue the challenge token
        const retryRes = await fetch('/api/admin/pin/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin, action }),
        });
        const retryData = await retryRes.json();
        if (retryData.success && retryData.token) {
          setPin('');
          onSuccess(retryData.token);
        } else {
          setError(retryData.error || 'Could not issue challenge token. Please try again.');
          setPin('');
          inputRef.current?.focus();
        }
      } else {
        setError(data.error || 'Incorrect PIN.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-challenge-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 id="pin-challenge-title" className="text-base font-bold text-slate-900">
                  Confirm with PIN
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">High-security action</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            You are about to <span className="font-semibold text-slate-800">{label}</span>.
            This action requires PIN re-authentication.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="\d*"
                maxLength={8}
                placeholder="Enter your PIN"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className={`text-center h-13 pr-12 font-mono border-slate-200 text-xl ${showPin ? 'tracking-[0.4em]' : 'tracking-normal'}`}
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

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white"
                disabled={submitting || pin.length < 4}
              >
                {submitting
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  : <Shield className="w-4 h-4 mr-1.5" />}
                {submitting ? 'Verifying…' : 'Confirm'}
              </Button>
            </div>
          </form>

          <p className="mt-4 text-xs text-slate-400 text-center leading-relaxed">
            Your PIN is never stored or displayed. Only a secure hashed version is kept.
          </p>
        </div>
      </div>
    </div>
  );
}
