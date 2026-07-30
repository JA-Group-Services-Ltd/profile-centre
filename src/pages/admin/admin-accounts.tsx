/**
 * Admin Accounts Management
 * /admin/admin-accounts
 *
 * View and manage staff admin accounts.
 * Also the canonical place to manage your own admin PIN.
 */
import { useState, useEffect } from 'react';
import { fmtDate, fmtTime } from '@/lib/date';
import {
  ShieldCheck, Trash2, Loader2, RefreshCw, AlertCircle, Info,
  KeyRound, Eye, EyeOff, CheckCircle2, Lock, AlertTriangle, Shield,
} from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

interface AdminAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  entra_oid: string | null;
}

// ── PIN Management panel ──────────────────────────────────────────────────────

function PinManagement() {
  const [pinHasPin, setPinHasPin] = useState<boolean | null>(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinLockedUntil, setPinLockedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pin/status', { credentials: 'include' });
      const d = await res.json();
      if (d.success) {
        setPinHasPin(d.hasPin);
        setPinLocked(d.locked);
        setPinLockedUntil(d.lockedUntil);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) { setMsg({ type: 'error', text: 'PIN must be at least 4 digits.' }); return; }
    if (!/^\d+$/.test(newPin)) { setMsg({ type: 'error', text: 'PIN must contain digits only.' }); return; }
    if (newPin !== confirmPin) { setMsg({ type: 'error', text: 'PINs do not match.' }); return; }
    if (pinHasPin && !currentPin) { setMsg({ type: 'error', text: 'Enter your current PIN to change it.' }); return; }
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/pin/set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ pin: newPin, currentPin: pinHasPin ? currentPin : undefined }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg({ type: 'success', text: d.message });
        setPinHasPin(true);
        setCurrentPin(''); setNewPin(''); setConfirmPin('');
      } else {
        setMsg({ type: 'error', text: d.error || 'Failed.' });
      }
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  const handleRemove = async () => {
    if (!currentPin) { setMsg({ type: 'error', text: 'Enter your current PIN to remove it.' }); return; }
    if (!confirm('Remove your admin PIN? You will be required to set a new one on next login.')) return;
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/pin/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ currentPin }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg({ type: 'success', text: 'PIN removed. You will be prompted to set a new one on next login.' });
        setPinHasPin(false); setCurrentPin('');
      } else {
        setMsg({ type: 'error', text: d.error || 'Failed.' });
      }
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 max-w-lg">

      {/* Status */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border text-sm font-medium ${
        pinHasPin
          ? 'bg-green-500/10 border-green-500/20 text-green-700'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
      }`}>
        {pinHasPin
          ? <><ShieldCheck className="w-4 h-4 shrink-0" /> PIN is set — portal is protected.</>
          : <><AlertTriangle className="w-4 h-4 shrink-0" /> No PIN set — you will be required to set one on next login.</>}
      </div>

      {pinLocked && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 border bg-red-50 border-red-200 text-red-700 text-sm">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Account locked until{' '}
            {pinLockedUntil ? fmtTime(pinLockedUntil) : 'later'}.
          </span>
        </div>
      )}

      {/* Feedback */}
      {msg && (
        <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm border ${
          msg.type === 'success'
            ? 'bg-green-500/10 text-green-700 border-green-500/20'
            : 'bg-red-500/10 text-red-600 border-red-500/20'
        }`}>
          {msg.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSet} className="space-y-4">
        {pinHasPin && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">Current PIN</label>
            <div className="relative">
              <Input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                placeholder="Enter current PIN"
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="bg-background border-border font-mono tracking-widest pr-10"
                disabled={submitting || pinLocked}
              />
              <button
                type="button"
                onClick={() => setShowPins(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">
              {pinHasPin ? 'New PIN' : 'PIN'} (4–8 digits)
            </label>
            <div className="relative">
              <Input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                placeholder="Choose a PIN"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="bg-background border-border font-mono tracking-widest pr-10"
                disabled={submitting || pinLocked}
              />
              {!pinHasPin && (
                <button
                  type="button"
                  onClick={() => setShowPins(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">Confirm PIN</label>
            <Input
              type={showPins ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              placeholder="Repeat PIN"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="bg-background border-border font-mono tracking-widest"
              disabled={submitting || pinLocked}
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button
            type="submit"
            disabled={submitting || pinLocked || newPin.length < 4 || confirmPin.length < 4}
            className="gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            {pinHasPin ? 'Update PIN' : 'Set PIN'}
          </Button>
          {pinHasPin && (
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 gap-1.5"
              onClick={handleRemove}
              disabled={submitting || pinLocked}
            >
              <Lock className="w-3.5 h-3.5" /> Remove PIN
            </Button>
          )}
        </div>
      </form>

      <div className="rounded-xl bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground text-xs flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> How the admin PIN works
        </p>
        <p className="leading-relaxed">
          Your Admin PIN is used to confirm sensitive admin actions. JA Profile Studio never stores or displays your actual PIN. Only a secure hashed version is stored.
        </p>
        <ul className="list-disc list-inside space-y-0.5 pl-1">
          <li>Required after every Microsoft OIDC login before entering the portal.</li>
          <li>Stored as a bcrypt hash — never in plain text, never in cookies or browser storage.</li>
          <li>PIN session expires after <strong className="text-foreground">15 minutes of inactivity</strong> — you will be prompted to re-enter it.</li>
          <li>High-risk actions (SAR export, deleting users, billing changes, legal policy edits) require a fresh PIN re-authentication even within an active session.</li>
          <li>5 failed attempts locks the account for 15 minutes.</li>
          <li>Removing the PIN means you must set a new one on next login.</li>
          <li>No admin — including system admins — can view another admin's PIN.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAccountsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users?role=admin', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setAdmins(data.data as AdminAccount[]);
      } else {
        setError(data.error || 'Failed to load admin accounts');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setAdmins(a => a.filter(x => x.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Admin Accounts — Staff Portal</title>
        <meta name="description" content="Manage staff admin accounts and your admin portal PIN." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/admin-accounts" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Admin Accounts
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage staff accounts and your admin portal PIN.
        </p>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList className="mb-6 bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="accounts" className="rounded-lg text-sm gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Staff Accounts
          </TabsTrigger>
          <TabsTrigger value="pin" className="rounded-lg text-sm gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> My Admin PIN
          </TabsTrigger>
        </TabsList>

        {/* ── Staff accounts tab ── */}
        <TabsContent value="accounts" className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Staff accounts with full admin portal access.</p>
            <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-0.5">OIDC-only authentication</p>
                <p className="text-muted-foreground">
                  Admin accounts are created automatically when a user signs in with a Microsoft account that has the <strong>Administrator</strong> role assigned in Azure AD.
                  To add a new admin, assign the role in Azure AD and have them sign in at{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">/admin/auth/start</code>.
                  Each admin must set a PIN on their first login.
                </p>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : admins.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center">
                <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">No admin accounts found</p>
                <p className="text-xs text-muted-foreground">Admins are created automatically via Microsoft OIDC sign-in.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {admins.map(admin => (
                <Card key={admin.id} className="bg-card border-border">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{admin.name}</p>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Admin</Badge>
                        {admin.entra_oid && (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">Microsoft SSO</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{admin.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {fmtDate(admin.created_at)}
                        {admin.last_login_at && ` · Last login ${fmtDate(admin.last_login_at)}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      onClick={() => setDeleteTarget(admin)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── PIN tab ── */}
        <TabsContent value="pin">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" /> My Admin Portal PIN
              </CardTitle>
              <CardDescription>
                This PIN is required every time you log into the admin portal after Microsoft OIDC authentication.
                It is separate from your Microsoft account password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PinManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Remove Admin Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) from the admin portal?
              They will need to be re-assigned the Administrator role in Azure AD to regain access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-border">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remove Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
