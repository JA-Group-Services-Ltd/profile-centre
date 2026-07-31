/**
 * Admin — Customer Telephone Verification
 * /admin/verify-customer
 *
 * Allows admin staff to verify a caller's identity over the phone using:
 *   1. Their 6-digit Support PIN (shown in Dashboard → Security)
 *   2. Their registered email address (fallback / secondary check)
 *
 * This page is completely separate from Users & CRM.
 * It does NOT expose the customer's PIN — it only confirms whether the PIN
 * the caller reads out matches the one on record.
 *
 * Security:
 *   - Requires admin session + admin PIN (requireAdminPin middleware)
 *   - All verification attempts (pass and fail) are written to the audit log
 *   - Verified result auto-clears after 5 minutes
 *   - No customer PIN is ever displayed to the admin
 */
import { useState, useEffect, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import {
  Phone, ShieldCheck, ShieldX, User,
  AlertTriangle, CheckCircle2, Clock,
  Eye, EyeOff, Loader2, X, Info, KeyRound,
  ArrowRight, Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────────

type VerifyMethod = 'pin' | 'email';

interface VerifiedUser {
  id: number;
  name: string;
  email: string;
  customer_number?: string | null;
  plan_name: string | null;
  plan_slug: string | null;
  expiresAt: string;
  secondsRemaining: number;
  method: VerifyMethod;
}

interface RecentAttempt {
  ts: string;
  method: VerifyMethod;
  input: string; // masked
  success: boolean;
  userName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function fmtCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminVerifyCustomerPage() {
  const [method, setMethod] = useState<VerifyMethod>('pin');

  // PIN method
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Email method
  const [emailInput, setEmailInput] = useState('');

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState<VerifiedUser | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Countdown timer for verified result
  useEffect(() => {
    if (verified) {
      setCountdown(verified.secondsRemaining);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setVerified(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      // Auto-clear after 5 min regardless
      clearRef.current = setTimeout(() => {
        setVerified(null);
        setCountdown(0);
      }, 5 * 60 * 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, [verified]);

  const addAttempt = (attempt: RecentAttempt) => {
    setRecentAttempts(prev => [attempt, ...prev].slice(0, 8));
  };

  const handleVerifyPin = async () => {
    const trimmed = pin.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Please enter the full 6-digit PIN the caller has given you.');
      return;
    }
    setLoading(true);
    setError('');
    setVerified(null);
    try {
      const res = await fetch('/api/admin/support-pin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: trimmed }),
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setVerified({ ...data.user, expiresAt: data.expiresAt, secondsRemaining: data.secondsRemaining, method: 'pin' });
        setPin('');
        addAttempt({ ts: new Date().toISOString(), method: 'pin', input: `${trimmed.slice(0, 2)}****`, success: true, userName: data.user.name });
      } else {
        setError(data.error || 'PIN not recognised or has expired.');
        addAttempt({ ts: new Date().toISOString(), method: 'pin', input: `${trimmed.slice(0, 2)}****`, success: false });
      }
    } catch (e) {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    setVerified(null);
    try {
      const res = await fetch(`/api/admin/support-pin-lookup?email=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.user) {
        // Email lookup confirms the account exists — show identity without PIN
        setVerified({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          customer_number: data.user.customer_number ?? null,
          plan_name: null,
          plan_slug: null,
          expiresAt: '',
          secondsRemaining: 300,
          method: 'email',
        });
        setEmailInput('');
        addAttempt({ ts: new Date().toISOString(), method: 'email', input: maskEmail(trimmed), success: true, userName: data.user.name });
      } else {
        setError(data.error || 'No account found with that email address.');
        addAttempt({ ts: new Date().toISOString(), method: 'email', input: maskEmail(trimmed), success: false });
      }
    } catch (e) {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'pin') handleVerifyPin();
    else handleVerifyEmail();
  };

  const reset = () => {
    setVerified(null);
    setPin('');
    setEmailInput('');
    setError('');
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (clearRef.current) clearTimeout(clearRef.current);
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Helmet>
        <title>Customer Telephone Verification — Admin</title>
        <meta name="description" content="Verify a customer's identity over the phone using their Support PIN or email address." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/verify-customer" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <h1 className="sr-only">Customer Telephone Verification</h1>

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Phone className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Customer Telephone Verification</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confirm a caller's identity before discussing account details
          </p>
        </div>
      </div>

      {/* ── Protocol notice ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 mb-6">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300 space-y-1">
          <p className="font-semibold text-blue-200">Telephone verification protocol</p>
          <p>Ask the caller to open their dashboard and navigate to <strong>Security Settings → Support PIN</strong>. They will see a 6-digit PIN. Enter it below to confirm their identity.</p>
          <p className="text-blue-300/70">If they cannot access their dashboard, use the email fallback — but treat this as lower-confidence verification and do not discuss sensitive account details.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">

        {/* ── Verify form ── */}
        <div className="md:col-span-3 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Verify Identity
              </CardTitle>
            </CardHeader>
            <CardContent>

              {/* Method tabs */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {([
                  { id: 'pin' as VerifyMethod,         label: 'Support PIN',   icon: KeyRound, desc: '6-digit rotating PIN' },
                  { id: 'email' as VerifyMethod,       label: 'Email address', icon: Mail,     desc: 'Fallback — lower confidence' },
                ]).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMethod(m.id); setError(''); setVerified(null); }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                      method === m.id
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <m.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{m.label}</span>
                    </div>
                    <span className="text-[11px] opacity-70 leading-tight">{m.desc}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {method === 'pin' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      6-digit Support PIN <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setPin(v);
                          setError('');
                        }}
                        placeholder="Enter the 6-digit PIN"
                        className="bg-background border-border pr-10 font-mono text-lg tracking-widest text-center"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="off"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      PINs rotate every 30 minutes. Ask the caller to refresh if theirs has expired.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Email address <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={emailInput}
                      onChange={e => { setEmailInput(e.target.value); setError(''); }}
                      placeholder="customer@example.com"
                      className="bg-background border-border"
                      autoComplete="off"
                      autoFocus
                    />
                    <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-300/80">
                        Email verification is lower confidence. Only confirm account existence — do not discuss billing, security settings, or personal data without PIN verification.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <ShieldX className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    (method === 'pin' ? pin.length !== 6 : !emailInput.trim())
                  }
                  className="w-full bg-primary gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                    : <><ShieldCheck className="w-4 h-4" /> Verify Identity</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── Verified result ── */}
          {verified && (
            <Card className="bg-green-500/5 border-green-500/30">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-300">Identity Confirmed</p>
                      <p className="text-xs text-green-400/70">
                        via {verified.method === 'pin' ? 'Support PIN' : 'Email address'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between py-2 border-b border-green-500/15">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <span className="text-sm font-semibold text-foreground">{verified.name || '(not set)'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-green-500/15">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <span className="text-sm font-mono text-foreground">{maskEmail(verified.email)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-green-500/15">
                    <span className="text-xs text-muted-foreground">Account ID</span>
                    <span className="text-sm font-mono text-muted-foreground">#{verified.id}</span>
                  </div>
                  {verified.customer_number && (
                    <div className="flex items-center justify-between py-2 border-b border-green-500/15">
                      <span className="text-xs text-muted-foreground">Universal Customer Number (UCN)</span>
                      <span className="text-sm font-mono text-foreground font-semibold">
                        {verified.customer_number}
                      </span>
                    </div>
                  )}
                  {verified.plan_name && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs text-muted-foreground">Plan</span>
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{verified.plan_name}</Badge>
                    </div>
                  )}
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/8 border border-green-500/20">
                  <div className="flex items-center gap-1.5 text-xs text-green-400/80">
                    <Clock className="w-3.5 h-3.5" />
                    Result clears in
                  </div>
                  <span className="text-sm font-mono font-bold text-green-300">{fmtCountdown(countdown)}</span>
                </div>

                {/* CRM link */}
                <Link
                  to={`/admin/users/${verified.id}`}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Open full CRM record
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right panel: guidance + recent attempts ── */}
        <div className="md:col-span-2 space-y-4">

          {/* How it works */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</div>
                <p>Ask the caller to open their Profile Centre dashboard and go to <strong className="text-foreground">Security Settings</strong> for their Support PIN.</p>
              </div>
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</div>
                <p>Choose a verification method above: <strong className="text-foreground">Support PIN</strong> (strongest) or <strong className="text-foreground">Email</strong> (fallback only).</p>
              </div>
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</div>
                <p>Enter the value the caller reads out and click <strong className="text-foreground">Verify Identity</strong>.</p>
              </div>
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">✓</div>
                <p>A green confirmation shows the account name and ID. You can now assist the caller.</p>
              </div>
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground/60">
                  All verification attempts are recorded in the audit log regardless of outcome.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent attempts */}
          {recentAttempts.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">This session</CardTitle>
                  <button
                    onClick={() => setRecentAttempts([])}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentAttempts.map((a, i) => (
                  <div key={i} className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs ${
                    a.success
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    {a.success
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      : <ShieldX className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${a.success ? 'text-green-300' : 'text-red-300'}`}>
                        {a.success ? (a.userName || 'Verified') : 'Failed'}
                      </p>
                      <p className="text-muted-foreground/60 truncate">
                        {a.method === 'pin' ? 'PIN' : 'Email'}: {a.input}
                      </p>
                    </div>
                    <span className="text-muted-foreground/50 flex-shrink-0 text-[10px]">
                      {new Date(a.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* What you can discuss */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">After verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div>
                <p className="font-semibold text-green-400 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Support PIN verified — you may discuss
                </p>
                <ul className="space-y-1 text-muted-foreground pl-5 list-disc">
                  <li>Account status and plan details</li>
                  <li>Billing queries and subscription</li>
                  <li>Profile and feature questions</li>
                  <li>Password reset or access issues</li>
                </ul>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Email only — restricted to
                </p>
                <ul className="space-y-1 text-muted-foreground pl-5 list-disc">
                  <li>Confirming account existence</li>
                  <li>General product questions</li>
                  <li>Directing to self-service options</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
