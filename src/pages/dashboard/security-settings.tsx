/**
 * Dashboard — Security Settings
 * Sign-in security is managed through JA Group Services ID.
 * Sousa Murray Profiles does not store passwords.
 */
import { useState, useEffect } from 'react';
import { fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Shield, Key, LogOut, Clock, CheckCircle,
  Eye, EyeOff, Loader2, Lock, Smartphone, RefreshCw, Trash2,
  ExternalLink, AlertTriangle, UserCheck, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { recordPinSuccess, clearOfflinePin } from '@/hooks/useOfflinePin';

// ── JA Group Services ID — security actions ───────────────────────────────────
// Password and sign-in security changes are handled by contacting JA Group Services support.
// No direct external portal URLs are exposed to customers.
const JA_ID_SUPPORT_EMAIL = 'contact@jagroupservices.co.uk';

// ── Redirect confirmation modal ───────────────────────────────────────────────
interface JaIdRedirectModalProps {
  open: boolean;
  action: 'password' | 'security' | 'account' | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ACTION_LABELS: Record<string, { title: string; description: string; href: string }> = {
  password: {
    title: 'Change your sign-in password',
    description: 'Your sign-in password is managed through JA Group Services ID. To change your password, please contact our support team and we will guide you through the process securely.',
    href: `mailto:${JA_ID_SUPPORT_EMAIL}?subject=Password%20Change%20Request`,
  },
  security: {
    title: 'Manage sign-in security',
    description: 'Your sign-in security settings (two-factor authentication, recovery options) are managed through JA Group Services ID. Please contact our support team for assistance.',
    href: `mailto:${JA_ID_SUPPORT_EMAIL}?subject=Sign-in%20Security%20Request`,
  },
  account: {
    title: 'Manage your JA Group Services ID account',
    description: 'For changes to your JA Group Services ID account, please contact our support team. We will assist you securely and verify your identity before making any changes.',
    href: `mailto:${JA_ID_SUPPORT_EMAIL}?subject=JA%20Group%20Services%20ID%20Account%20Request`,
  },
};

function JaIdRedirectModal({ open, action, onConfirm, onCancel }: JaIdRedirectModalProps) {
  if (!action) return null;
  const { title, description } = ACTION_LABELS[action];
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-4 h-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 my-1">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your sign-in is managed through <strong className="text-foreground">JA Group Services ID</strong>.
            Sousa Murray Profiles does not store or manage your password — these actions are handled securely
            by our support team.
          </p>
        </div>
        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="bg-primary text-xs gap-1.5" onClick={onConfirm}>
            Contact Support <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionActivity {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_active_at: string;
  is_current: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SecuritySettingsPage() {
  useAuth();

  // JA ID redirect modal
  const [jaIdModal, setJaIdModal] = useState<'password' | 'security' | 'account' | null>(null);

  const openJaId = (action: 'password' | 'security' | 'account') => setJaIdModal(action);
  const confirmJaId = () => {
    if (jaIdModal) window.location.href = ACTION_LABELS[jaIdModal].href;
    setJaIdModal(null);
  };

  // PIN state
  const [pinMode, setPinMode] = useState<'view' | 'set' | 'change'>('view');
  const [hasPin, setHasPin] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinLockedUntil, setPinLockedUntil] = useState<string | null>(null);
  const [pinUnlocking, setPinUnlocking] = useState(false);
  const [pinLoading, setPinLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  // Session state
  const [sessions, setSessions] = useState<SessionActivity[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [logoutAllDone, setLogoutAllDone] = useState(false);

  // Support PIN
  const [supportPin, setSupportPin] = useState<string | null>(null);
  const [supportPinLoading, setSupportPinLoading] = useState(false);
  const [supportPinVisible, setSupportPinVisible] = useState(false);

  useEffect(() => {
    loadPinStatus();
    loadSessions();
  }, []);

  const loadPinStatus = () => {
    setPinLoading(true);
    fetch('/api/security/pin/status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setHasPin(d.hasPin);
          setPinLocked(!!d.isLocked);
          setPinLockedUntil(d.lockedUntil ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setPinLoading(false));
  };

  const loadSessions = () => {
    setSessionsLoading(true);
    fetch('/api/security/sessions', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setSessions(d.sessions ?? []); })
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  };

  const handleSelfUnlockPin = async () => {
    setPinUnlocking(true);
    try {
      const res = await fetch('/api/security/pin/self-unlock', { method: 'POST', credentials: 'include' });
      const d = await res.json();
      if (d.success) {
        setPinLocked(false);
        setPinLockedUntil(null);
        setPinSuccess('PIN lockout cleared — you can try again now.');
      } else {
        setPinError(d.error || 'Could not clear lockout.');
      }
    } catch {
      setPinError('Network error — please try again.');
    } finally {
      setPinUnlocking(false);
    }
  };

  const handleSetPin = async () => {
    setPinError('');
    if (newPin.length < 4 || newPin.length > 8) { setPinError('PIN must be 4–8 digits.'); return; }
    if (!/^\d+$/.test(newPin)) { setPinError('PIN must contain digits only.'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match.'); return; }
    if (hasPin && !currentPin) { setPinError('Please enter your current PIN to change it.'); return; }
    setPinSaving(true);
    try {
      const res = await fetch('/api/security/pin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: hasPin ? currentPin : undefined, newPin }),
      });
      const d = await res.json();
      if (d.success) {
        setPinSuccess('PIN set successfully.');
        setHasPin(true);
        setPinMode('view');
        setCurrentPin(''); setNewPin(''); setConfirmPin('');
        // Record offline PIN hash so the user can access the dashboard while offline
        if (user?.id) recordPinSuccess(newPin, user.id).catch(() => {});
      } else {
        setPinError(d.error || 'Failed to set PIN.');
      }
    } catch {
      setPinError('Network error. Please try again.');
    } finally {
      setPinSaving(false);
    }
  };

  const handleRemovePin = async () => {
    if (!currentPin) { setPinError('Enter your current PIN to remove it.'); return; }
    setPinSaving(true);
    try {
      const res = await fetch('/api/security/pin', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin }),
      });
      const d = await res.json();
      if (d.success) {
        setHasPin(false);
        setPinMode('view');
        setCurrentPin('');
        setPinSuccess('PIN removed.');
        clearOfflinePin();
      } else {
        setPinError(d.error || 'Failed to remove PIN.');
      }
    } catch {
      setPinError('Network error. Please try again.');
    } finally {
      setPinSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);
    try {
      await fetch('/api/security/sessions/logout-all', { method: 'POST', credentials: 'include' });
      setLogoutAllDone(true);
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } catch {
      setLogoutAllLoading(false);
    }
  };

  const handleGetSupportPin = async () => {
    setSupportPinLoading(true);
    try {
      const res = await fetch('/api/security/support-pin', { credentials: 'include' });
      const d = await res.json();
      if (d.success) { setSupportPin(d.pin); setSupportPinVisible(true); }
    } catch {
    } finally {
      setSupportPinLoading(false);
    }
  };

  const fmt = (d: string) => fmtDateTime(d);

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0 space-y-6">
      <JaIdRedirectModal
        open={jaIdModal !== null}
        action={jaIdModal}
        onConfirm={confirmJaId}
        onCancel={() => setJaIdModal(null)}
      />
      <Helmet>
        <title>Security Settings — Dashboard</title>
        <meta name="description" content="Manage your account security, active sessions, and security PIN." />
        <link rel="canonical" href="/dashboard/security" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Security Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your sign-in security, active sessions, and account PIN.
        </p>
      </div>

      {/* ── JA Group Services ID — Sign-in Security ─────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" /> Sign-in Security
          </CardTitle>
          <CardDescription className="text-xs">
            Your sign-in is managed through JA Group Services ID. Sousa Murray Profiles does not store your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              To change your password or manage sign-in security, continue to{' '}
              <strong className="text-foreground">JA Group Services ID</strong>. No passwords are collected
              or stored inside Sousa Murray Profiles.
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid gap-2 sm:grid-cols-1">
            <Button variant="outline" className="border-border gap-2 w-full justify-between text-sm" onClick={() => openJaId('password')}>
              <span className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                Change sign-in password
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button variant="outline" className="border-border gap-2 w-full justify-between text-sm" onClick={() => openJaId('security')}>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Manage sign-in security
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button variant="outline" className="border-border gap-2 w-full justify-between text-sm" onClick={() => openJaId('account')}>
              <span className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                Manage JA Group Services ID account
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Your sign-in password and security settings are managed through JA Group Services ID.
            Contact our support team to make changes — we will verify your identity and assist you securely.
          </p>
        </CardContent>
      </Card>

      {/* ── Account Security PIN ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> Account Security PIN
          </CardTitle>
          <CardDescription className="text-xs">
            Your PIN is required before sensitive actions such as changing account settings, billing, publishing public content, and data exports.
            This PIN is separate from your JA Group Services ID sign-in password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pinLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {hasPin ? (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" /> PIN set
                  </Badge>
                ) : (
                  <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                    <AlertTriangle className="w-3 h-3 mr-1" /> No PIN set
                  </Badge>
                )}
                {pinMode === 'view' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border text-xs h-7"
                    onClick={() => { setPinMode(hasPin ? 'change' : 'set'); setPinError(''); setPinSuccess(''); }}
                  >
                    {hasPin ? 'Change PIN' : 'Set PIN'}
                  </Button>
                )}
              </div>

              {/* Lockout banner */}
              {pinLocked && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-orange-300">PIN locked</p>
                    <p className="text-xs text-orange-300/80 mt-0.5">
                      {pinLockedUntil
                        ? `Too many incorrect attempts. Locked until ${pinLockedUntil}.`
                        : 'Too many incorrect attempts. Please wait before trying again.'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-500/40 text-orange-300 hover:bg-orange-500/20 text-xs h-7 flex-shrink-0"
                    onClick={handleSelfUnlockPin}
                    disabled={pinUnlocking}
                  >
                    {pinUnlocking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Clear lockout'}
                  </Button>
                </div>
              )}

              {pinSuccess && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {pinSuccess}
                </p>
              )}

              {(pinMode === 'set' || pinMode === 'change') && (
                <div className="space-y-3 pt-1">
                  {hasPin && (
                    <div className="space-y-1">
                      <Label className="text-xs">Current PIN</Label>
                      <div className="relative">
                        <Input
                          type={showPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={8}
                          value={currentPin}
                          onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                          className="bg-background border-border pr-9 text-sm"
                          placeholder="Enter current PIN"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowPin(v => !v)}
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">New PIN (4–8 digits)</Label>
                    <Input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={8}
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="bg-background border-border text-sm"
                      placeholder="Enter new PIN"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Confirm new PIN</Label>
                    <Input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={8}
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="bg-background border-border text-sm"
                      placeholder="Confirm new PIN"
                    />
                  </div>
                  {pinError && <p className="text-xs text-red-400">{pinError}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="bg-primary text-xs" onClick={handleSetPin} disabled={pinSaving}>
                      {pinSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      {hasPin ? 'Update PIN' : 'Set PIN'}
                    </Button>
                    {hasPin && (
                      <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs" onClick={handleRemovePin} disabled={pinSaving}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove PIN
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setPinMode('view'); setPinError(''); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Active Sessions ──────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" /> Active Sessions
          </CardTitle>
          <CardDescription className="text-xs">
            Devices and browsers currently signed in to your Sousa Murray Profiles account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No session data available.</p>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium text-foreground truncate">{s.user_agent || 'Unknown device'}</p>
                    {s.is_current && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Current session</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">IP: {s.ip || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">Last active: {fmt(s.last_active_at || s.created_at)}</p>
                </div>
              </div>
            ))
          )}
          <Separator className="bg-border" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button size="sm" variant="outline" className="border-border text-xs gap-1.5" onClick={loadSessions} disabled={sessionsLoading}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/30 text-red-400 text-xs gap-1.5"
              onClick={handleLogoutAll}
              disabled={logoutAllLoading || logoutAllDone}
            >
              {logoutAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              {logoutAllDone ? 'Signed out — redirecting…' : 'Sign out all devices'}
            </Button>
          </div>

          {/* Auto-logout info */}
          <div className="flex items-start gap-2 pt-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sessions automatically expire after 20 minutes of inactivity. You will see a warning at 18 minutes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Telephone Support PIN ────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Telephone Support PIN
          </CardTitle>
          <CardDescription className="text-xs">
            Use this short-lived PIN when calling our support team to verify your identity. It expires after a short time and should not be shared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportPinVisible && supportPin ? (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground mb-1">Your support PIN (valid for 10 minutes)</p>
              <p className="text-3xl font-mono font-bold text-primary tracking-widest">{supportPin}</p>
              <p className="text-xs text-muted-foreground mt-2">Do not share this PIN with anyone other than our support team.</p>
              <Button size="sm" variant="ghost" className="text-xs mt-2" onClick={() => { setSupportPin(null); setSupportPinVisible(false); }}>
                Hide PIN
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="border-border text-xs gap-1.5" onClick={handleGetSupportPin} disabled={supportPinLoading}>
              {supportPinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              Generate support PIN
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Account Closure ──────────────────────────────────────────────────── */}
      <Card className="bg-card border-border border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" /> Account Closure
          </CardTitle>
          <CardDescription className="text-xs">
            Permanently close your Sousa Murray Profiles account and delete your data. This cannot be undone.
            Your JA Group Services ID account is not affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/30 text-red-400 text-xs"
            onClick={() => window.location.href = '/dashboard/account-closure'}
          >
            Request account closure
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
