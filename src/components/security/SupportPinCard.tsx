/**
 * SupportPinCard
 *
 * Displays the user's current telephone support PIN with a live countdown
 * to the next rotation. The PIN is fetched from the server — never localStorage.
 *
 * Also allows the user to set a custom PIN:
 *   1. Enter PIN + confirm PIN
 *   2. If they match → saved immediately
 *   3. If they don't match → email verification code sent; user enters code to confirm
 *
 * Used on the dashboard Settings page.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, RefreshCw, Copy, Check, ShieldCheck, Eye, EyeOff, Loader2, KeyRound, Mail, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PinData {
  pin: string;
  expiresAt: string;
  issuedAt: string;
  secondsRemaining: number;
  lifetimeMinutes: number;
}

type SetPinStep = 'idle' | 'entering' | 'email-verify' | 'success';

export default function SupportPinCard() {
  const [data, setData] = useState<PinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set custom PIN state
  const [setPinStep, setSetPinStep] = useState<SetPinStep>('idle');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [setPinLoading, setSetPinLoading] = useState(false);
  const [setPinError, setSetPinError] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const fetchPin = useCallback(async () => {
    try {
      const res = await fetch('/api/security/support-pin', { credentials: 'include' });
      const d = await res.json();
      if (d.success) {
        setData(d);
        setSecondsLeft(d.secondsRemaining);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPin(); }, [fetchPin]);

  // Live countdown tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          fetchPin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [fetchPin]);

  const rotate = async () => {
    setRotating(true);
    try {
      const res = await fetch('/api/security/support-pin/rotate', { method: 'POST', credentials: 'include' });
      const d = await res.json();
      if (d.success) {
        setData(d);
        setSecondsLeft(d.secondsRemaining);
        setRevealed(true);
      }
    } catch { /* silent */ } finally {
      setRotating(false);
    }
  };

  const copyPin = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Set custom PIN ────────────────────────────────────────────────────────

  const handleSetPin = async () => {
    setSetPinError('');
    if (!/^\d{6}$/.test(newPin)) {
      setSetPinError('PIN must be exactly 6 digits (numbers only).');
      return;
    }
    setSetPinLoading(true);
    try {
      const res = await fetch('/api/security/support-pin/set', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin, confirmPin }),
      });
      const d = await res.json();
      if (d.success) {
        // PINs matched — saved
        setData(d);
        setSecondsLeft(d.secondsRemaining);
        setRevealed(true);
        setSetPinStep('success');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => setSetPinStep('idle'), 3000);
      } else if (d.mismatch) {
        // PINs didn't match — email verification sent
        setSetPinStep('email-verify');
        setSetPinError('');
      } else {
        setSetPinError(d.error || 'Failed to set PIN. Please try again.');
      }
    } catch {
      setSetPinError('Network error. Please try again.');
    } finally {
      setSetPinLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setSetPinError('');
    if (!/^\d{6}$/.test(verifyCode)) {
      setSetPinError('Verification code must be 6 digits.');
      return;
    }
    setSetPinLoading(true);
    try {
      const res = await fetch('/api/security/support-pin/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const d = await res.json();
      if (d.success) {
        setData(d);
        setSecondsLeft(d.secondsRemaining);
        setRevealed(true);
        setSetPinStep('success');
        setNewPin('');
        setConfirmPin('');
        setVerifyCode('');
        setTimeout(() => setSetPinStep('idle'), 3000);
      } else {
        setSetPinError(d.error || 'Incorrect code. Please try again.');
      }
    } catch {
      setSetPinError('Network error. Please try again.');
    } finally {
      setSetPinLoading(false);
    }
  };

  const cancelSetPin = () => {
    setSetPinStep('idle');
    setNewPin('');
    setConfirmPin('');
    setVerifyCode('');
    setSetPinError('');
  };

  const totalSeconds = (data?.lifetimeMinutes ?? 30) * 60;
  const progress = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const urgency = secondsLeft < 120 ? 'text-red-500' : secondsLeft < 300 ? 'text-blue-400' : 'text-green-600';
  const barColor = secondsLeft < 120 ? 'bg-red-500' : secondsLeft < 300 ? 'bg-blue-500/50' : 'bg-green-500';

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" />
          Telephone Support PIN
        </CardTitle>
        <CardDescription>
          Quote this PIN when calling Sousa Murray Profiles support to verify your identity.
          It rotates automatically every {data?.lifetimeMinutes ?? 30} minutes. You can also set your own custom PIN below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* PIN display */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Your current PIN</p>
                <div className="flex items-center gap-3">
                  {revealed ? (
                    <span className="text-3xl font-bold tracking-[0.3em] text-foreground font-mono select-all">
                      {data?.pin ?? '------'}
                    </span>
                  ) : (
                    <span className="text-3xl font-bold tracking-[0.3em] text-muted-foreground font-mono">
                      ••••••
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setRevealed(r => !r)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title={revealed ? 'Hide PIN' : 'Reveal PIN'}
                    >
                      {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {revealed && (
                      <button
                        onClick={copyPin}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Copy PIN"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <Badge className={`text-xs border-0 flex-shrink-0 ${
                urgency === 'text-green-600' ? 'bg-green-100 text-green-700' :
                urgency === 'text-blue-400' ? 'bg-blue-500/10 text-blue-400' :
                'bg-red-100 text-red-700'
              }`}>
                {secondsLeft < 60 ? `${secondsLeft}s` : `${mins}m ${String(secs).padStart(2, '0')}s`}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Auto-rotates every {data?.lifetimeMinutes ?? 30} minutes</span>
                <span className={urgency}>
                  {secondsLeft < 60
                    ? `Expires in ${secondsLeft}s`
                    : `Expires in ${mins}m ${String(secs).padStart(2, '0')}s`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Security notice */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 leading-relaxed">
              <strong className="text-blue-800">How it works:</strong> When you call support, our team will ask for this PIN to confirm it's really you. Never share this PIN by email or message — support will only ask for it verbally on a call.
            </div>

            {/* ── Actions: two clear options ──────────────────────────────── */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIN options</p>

              {/* Option 1: Refresh auto-generated PIN now */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div>
                  <p className="text-sm font-medium text-foreground">Refresh auto-generated PIN</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Get a new random PIN immediately instead of waiting for the timer.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rotate}
                  disabled={rotating}
                  className="gap-2 flex-shrink-0"
                >
                  {rotating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {rotating ? 'Refreshing…' : 'Refresh'}
                </Button>
              </div>

              {/* Option 2: Set a custom PIN */}
              {setPinStep === 'idle' && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">Set a custom PIN</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Choose your own memorable 6-digit PIN instead of the random one.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSetPinStep('entering')}
                    className="gap-2 flex-shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Set PIN
                  </Button>
                </div>
              )}

              {setPinStep === 'entering' && (
                <div className="space-y-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" /> Set a custom PIN
                  </p>
                  <p className="text-xs text-muted-foreground">Enter your chosen 6-digit PIN twice. If they match it saves immediately. If they don't match, we'll send a verification code to your email.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">New PIN</Label>
                      <div className="relative">
                        <Input
                          type={showNewPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6 digits"
                          value={newPin}
                          onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="pr-9 font-mono tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPin(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Confirm PIN</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Repeat PIN"
                          value={confirmPin}
                          onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className={`pr-9 font-mono tracking-widest ${
                            confirmPin.length === 6
                              ? confirmPin === newPin
                                ? 'border-green-400 focus-visible:ring-green-400'
                                : 'border-red-400 focus-visible:ring-red-400'
                              : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPin(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {confirmPin.length === 6 && confirmPin !== newPin && (
                        <p className="text-xs text-blue-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> PINs don't match — email verification required
                        </p>
                      )}
                      {confirmPin.length === 6 && confirmPin === newPin && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> PINs match — will save immediately
                        </p>
                      )}
                    </div>
                  </div>

                  {setPinError && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {setPinError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSetPin}
                      disabled={setPinLoading || newPin.length !== 6 || confirmPin.length !== 6}
                      className="gap-2"
                    >
                      {setPinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {confirmPin === newPin && confirmPin.length === 6 ? 'Save PIN' : 'Continue'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelSetPin}>Cancel</Button>
                  </div>
                </div>
              )}

              {setPinStep === 'email-verify' && (
                <div className="space-y-3 p-3 rounded-xl border border-blue-200 bg-blue-50">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Verification code sent</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        The PINs didn't match, so we've sent a 6-digit code to your email. Enter it below to confirm and save your PIN.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Verification code from email</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="font-mono tracking-widest max-w-[180px]"
                    />
                  </div>
                  {setPinError && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {setPinError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleVerifyEmail} disabled={setPinLoading || verifyCode.length !== 6} className="gap-2">
                      {setPinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Verify &amp; Save PIN
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelSetPin}>Cancel</Button>
                  </div>
                </div>
              )}

              {setPinStep === 'success' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Your custom PIN has been saved successfully.</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
