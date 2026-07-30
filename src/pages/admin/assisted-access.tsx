/**
 * Admin — Assisted Access
 * /admin/assisted-access
 *
 * Request temporary, consent-based access to a customer account.
 * All actions are audit-logged. Dangerous actions are blocked.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Shield, Plus, Check, Loader2, RefreshCw,
  LogIn, LogOut, ChevronDown, ChevronUp,
  TriangleAlert, Lock, Search, User, X,
  Hash, Mail, AtSign, Info, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import PinChallenge from '@/components/admin/PinChallenge';

// ── Types ─────────────────────────────────────────────────────────────────

interface AccessRequest {
  id: number;
  admin_id: number;
  admin_name: string | null;
  admin_email: string | null;
  user_id: number;
  user_email: string | null;
  user_name: string | null;
  reason: string;
  access_areas: string;
  status: string;
  session_token: string | null;
  session_expires_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  revoked_at: string | null;
  exited_at: string | null;
  created_at: string;
}

interface ResolvedUser {
  id: number;
  email: string;
  name: string;
  user_number?: string | null;
}

const ACCESS_AREAS = [
  { key: 'profiles',          label: 'Profiles' },
  { key: 'business_profiles', label: 'Business Profiles' },
  { key: 'links',             label: 'Links' },
  { key: 'enquiries',         label: 'Enquiries' },
  { key: 'settings',          label: 'Settings' },
  { key: 'billing_readonly',  label: 'Billing (read-only)' },
  { key: 'analytics_readonly',label: 'Analytics (read-only)' },
];

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  active:   'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  revoked:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  exited:   'bg-muted text-muted-foreground border-border',
  cancelled:'bg-muted text-muted-foreground border-border',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtUserNumber(n: string | null | undefined): string {
  if (!n) return '';
  return n.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
}

// ── Search hint helper ────────────────────────────────────────────────────

function detectQueryType(val: string): 'email' | 'user_number' | 'id' | 'name' | 'empty' | 'short' {
  const t = val.trim();
  if (!t) return 'empty';
  if (t.includes('@')) return 'email';
  const digits = t.replace(/\s+/g, '');
  if (/^\d+$/.test(digits) && digits.length === 12) return 'user_number';
  if (/^\d+$/.test(t) && t.length < 10) return 'id';
  if (t.length < 2) return 'short';
  return 'name';
}

// ── New Request Form ──────────────────────────────────────────────────────

function NewRequestForm({ onCreated }: { onCreated: () => void }) {
  const [query, setQuery]               = useState('');
  const [resolvedUser, setResolvedUser] = useState<ResolvedUser | null>(null);
  const [lookupState, setLookupState]   = useState<'idle' | 'searching' | 'found' | 'not_found' | 'error'>('idle');
  const [lookupMsg, setLookupMsg]       = useState('');
  const [reason, setReason]             = useState('');
  const [areas, setAreas]               = useState<string[]>(['profiles', 'links']);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleArea = (key: string) =>
    setAreas(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]);

  const doLookup = useCallback(async (val: string) => {
    const trimmed = val.trim();
    const qType = detectQueryType(trimmed);

    if (qType === 'empty' || qType === 'short') {
      setLookupState('idle');
      setLookupMsg('');
      return;
    }

    setLookupState('searching');
    try {
      const url = `/api/admin/assisted-access/lookup?q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, { credentials: 'include' });
      const d = await res.json();
      if (d.success && d.data) {
        setResolvedUser(d.data);
        setLookupState('found');
        setLookupMsg('');
      } else {
        setLookupState('not_found');
        setLookupMsg(d.error ?? 'No account found');
      }
    } catch {
      setLookupState('error');
      setLookupMsg('Lookup failed — check your connection');
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setResolvedUser(null);
    setLookupMsg('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doLookup(val), 380);
  };

  const clearUser = () => {
    setQuery('');
    setResolvedUser(null);
    setLookupState('idle');
    setLookupMsg('');
  };

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed || !reason.trim() || areas.length === 0) {
      setError('Customer identifier, reason and at least one access area are required.');
      return;
    }
    if (!resolvedUser && lookupState !== 'found') {
      setError('Please wait for the customer lookup to complete before submitting.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = resolvedUser
        ? { user_id: resolvedUser.id, reason, access_areas: areas }
        : trimmed.includes('@')
          ? { user_email: trimmed, reason, access_areas: areas }
          : { user_id: parseInt(trimmed, 10), reason, access_areas: areas };

      const res = await fetch('/api/admin/assisted-access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        setSuccess(true);
        clearUser();
        setReason('');
        setAreas(['profiles', 'links']);
        onCreated();
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(d.error ?? 'Failed to create request');
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const qType = detectQueryType(query);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Request Assisted Access
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          The customer will receive a notification and must approve before you can enter their account. All actions during the session are audit-logged.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            <Check className="w-4 h-4 flex-shrink-0" /> Request sent — waiting for customer approval.
          </div>
        )}

        {/* ── Customer search ── */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Find Customer</Label>

          {/* Search type chips */}
          <div className="flex flex-wrap gap-1.5 mb-1">
            {[
              { icon: Mail,   label: 'Email',       hint: 'user@example.com' },
              { icon: Hash,   label: 'User Number',  hint: '742 918 305 614' },
              { icon: AtSign, label: 'Name',         hint: 'Jane Smith' },
              { icon: User,   label: 'Account ID',   hint: '42' },
            ].map(({ icon: Icon, label, hint }) => (
              <button
                key={label}
                type="button"
                onClick={() => { clearUser(); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={`Search by ${label}: ${hint}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Email, user number, name, or account ID…"
              className="bg-background border-border text-sm pl-8 pr-8"
              autoComplete="off"
            />
            {query && (
              <button
                onClick={clearUser}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lookup feedback */}
          {lookupState === 'searching' && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Looking up account…
            </div>
          )}

          {lookupState === 'found' && resolvedUser && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/8 border border-green-500/25">
              <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-300 truncate">{resolvedUser.name || '(no name)'}</p>
                <p className="text-xs text-muted-foreground truncate">{resolvedUser.email}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground/60">ID #{resolvedUser.id}</span>
                  {resolvedUser.user_number && (
                    <span className="text-xs text-muted-foreground/60 font-mono">
                      · {fmtUserNumber(resolvedUser.user_number)}
                    </span>
                  )}
                </div>
              </div>
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
            </div>
          )}

          {(lookupState === 'not_found' || lookupState === 'error') && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <X className="w-3.5 h-3.5 flex-shrink-0" />
              {lookupMsg}
            </div>
          )}

          {lookupState === 'idle' && !query && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/50">
              <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search by <strong className="text-foreground">email address</strong>, <strong className="text-foreground">12-digit user number</strong> (e.g. 742 918 305 614), <strong className="text-foreground">full or partial name</strong>, or <strong className="text-foreground">numeric account ID</strong>.
              </p>
            </div>
          )}

          {lookupState === 'idle' && query && qType === 'short' && (
            <p className="text-xs text-muted-foreground">Keep typing — need at least 2 characters for a name search.</p>
          )}
        </div>

        {/* ── Reason ── */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Reason for Access <span className="text-red-400">*</span></Label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Customer reported issue with profile links — investigating on their behalf."
            className="bg-background border-border text-sm resize-none"
            rows={3}
          />
        </div>

        {/* ── Access areas ── */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Access Areas <span className="text-red-400">*</span></Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ACCESS_AREAS.map(a => (
              <label
                key={a.key}
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  areas.includes(a.key)
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/20 border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <input type="checkbox" checked={areas.includes(a.key)} onChange={() => toggleArea(a.key)} className="sr-only" />
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                  areas.includes(a.key) ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                }`}>
                  {areas.includes(a.key) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <span className="text-xs font-medium">{a.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Blocked actions notice ── */}
        <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/20 text-xs text-orange-400 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5" /> Always blocked during assisted access
          </p>
          <p className="text-orange-400/80">
            Delete account · Delete profile · Change email · Change password · Change payment method · Export personal data · Transfer ownership
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <X className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        <Button
          onClick={submit}
          disabled={loading || lookupState === 'searching' || lookupState === 'not_found' || lookupState === 'error' || !resolvedUser}
          className="bg-primary gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
          {loading ? 'Sending…' : 'Send Access Request'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Request Row ───────────────────────────────────────────────────────────

function RequestRow({ r, onRefresh }: { r: AccessRequest; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [entering, setEntering] = useState(false);
  const [exiting, setExiting]   = useState(false);
  const [enterError, setEnterError] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [launchExpiry, setLaunchExpiry] = useState<string | null>(null);
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const areas: string[] = (() => { try { return JSON.parse(r.access_areas); } catch { return []; } })();

  const doEnter = async (pinToken: string) => {
    setEntering(true);
    setEnterError('');
    try {
      // Step 1: enter the session (generates the session token, marks status=active)
      const enterRes = await fetch(`/api/admin/assisted-access/${r.id}/enter`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin-Token': pinToken,
          'X-Admin-Pin-Action': 'assisted_access',
        },
      });
      const enterData = await enterRes.json();
      if (!enterData.success) {
        setEnterError(enterData.error ?? 'Failed to enter session');
        setEntering(false);
        return;
      }

      // Store the session token — used to generate the launch URL
      setSessionToken(enterData.sessionToken);
      onRefresh();

      // Step 2: immediately generate the launch URL so the admin can open it
      await generateUrl();
    } catch {
      setEnterError('Network error — could not enter session');
    } finally {
      setEntering(false);
    }
  };

  const generateUrl = async () => {
    setGeneratingUrl(true);
    setEnterError('');
    try {
      const res = await fetch(`/api/admin/assisted-access/${r.id}/generate-launch-url`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      if (d.success) {
        setLaunchUrl(d.launchUrl);
        setLaunchExpiry(d.expiresAt);
      } else {
        setEnterError(d.error ?? 'Failed to generate launch URL');
      }
    } catch {
      setEnterError('Network error — could not generate launch URL');
    } finally {
      setGeneratingUrl(false);
    }
  };

  const openDashboard = () => {
    if (launchUrl) {
      window.open(launchUrl, '_blank', 'noopener,noreferrer');
      // Clear the URL immediately — it's one-time use
      setLaunchUrl(null);
      setLaunchExpiry(null);
      onRefresh();
    }
  };

  const exit = async () => {
    setExiting(true);
    await fetch(`/api/admin/assisted-access/${r.id}/exit`, { method: 'POST', credentials: 'include' });
    setSessionToken(null);
    setLaunchUrl(null);
    setLaunchExpiry(null);
    setExiting(false);
    onRefresh();
  };

  const isActive   = r.status === 'active';
  const isApproved = r.status === 'approved';

  return (
    <>
      <PinChallenge
        open={pinOpen}
        action="assisted_access"
        actionLabel={`enter an assisted session for ${r.user_name || r.user_email || `user #${r.user_id}`}`}
        onSuccess={(token) => { setPinOpen(false); doEnter(token); }}
        onCancel={() => setPinOpen(false)}
      />

      <Card className={`bg-card border-border transition-colors ${
        isActive   ? 'border-green-500/30 bg-green-500/3' :
        isApproved ? 'border-blue-500/30' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Status icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              isActive   ? 'bg-green-500/15' :
              isApproved ? 'bg-blue-500/15' :
              r.status === 'rejected' || r.status === 'revoked' ? 'bg-red-500/10' :
              'bg-muted/40'
            }`}>
              <Shield className={`w-4 h-4 ${
                isActive   ? 'text-green-400' :
                isApproved ? 'text-blue-400' :
                r.status === 'rejected' || r.status === 'revoked' ? 'text-red-400' :
                'text-muted-foreground'
              }`} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + status */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-foreground">
                  {r.user_name || r.user_email || `User #${r.user_id}`}
                </p>
                <Badge className={`text-xs border ${STATUS_COLORS[r.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                  {r.status}
                </Badge>
              </div>

              {/* Reason */}
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{r.reason}</p>

              {/* Access areas */}
              <div className="flex flex-wrap gap-1 mb-2">
                {areas.map(a => (
                  <span key={a} className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>

              {/* Timestamps */}
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground/70">Requested: {fmtDate(r.created_at)}</p>
                {r.approved_at && <p className="text-xs text-green-400/80">Approved: {fmtDate(r.approved_at)}</p>}
                {r.rejected_at && <p className="text-xs text-red-400/80">Rejected: {fmtDate(r.rejected_at)}</p>}
                {r.revoked_at  && <p className="text-xs text-orange-400/80">Revoked by customer: {fmtDate(r.revoked_at)}</p>}
                {r.exited_at   && <p className="text-xs text-muted-foreground/60">Session exited: {fmtDate(r.exited_at)}</p>}
              </div>

              {/* Enter error */}
              {enterError && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {enterError}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
              {isApproved && (
                <Button
                  size="sm"
                  onClick={() => { setEnterError(''); setPinOpen(true); }}
                  disabled={entering}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-7 text-xs"
                >
                  {entering ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                  Enter Session
                </Button>
              )}
              {isActive && !launchUrl && (
                <Button
                  size="sm"
                  onClick={() => generateUrl()}
                  disabled={generatingUrl}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-7 text-xs"
                >
                  {generatingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                  Get Launch Link
                </Button>
              )}
              {isActive && launchUrl && (
                <Button
                  size="sm"
                  onClick={openDashboard}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-7 text-xs"
                >
                  <LogIn className="w-3 h-3" />
                  Open Dashboard ↗
                </Button>
              )}
              {isActive && (
                <Button
                  size="sm"
                  onClick={exit}
                  disabled={exiting}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 h-7 text-xs"
                >
                  {exiting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                  Exit Session
                </Button>
              )}
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Toggle details"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Launch URL card — shown after entering session */}
          {launchUrl && (
            <div className="mt-3 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
              <p className="text-xs font-semibold text-blue-400 mb-1">Launch Link Ready</p>
              <p className="text-xs text-muted-foreground mb-2">
                Click <strong>Open Dashboard ↗</strong> to open the customer dashboard in a new tab. This link is one-time use and expires in 2 minutes.
              </p>
              {launchExpiry && (
                <p className="text-xs text-muted-foreground/60">Expires: {fmtDate(launchExpiry)}</p>
              )}
            </div>
          )}

          {/* Active session — no launch URL yet */}
          {isActive && !launchUrl && sessionToken && (
            <div className="mt-3 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
              <p className="text-xs font-semibold text-green-400 mb-1">Session Active</p>
              <p className="text-xs text-muted-foreground">Click <strong>Get Launch Link</strong> to generate a one-time URL to open the customer dashboard in a new tab.</p>
            </div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p><span className="text-muted-foreground/60">Request ID</span> #{r.id}</p>
              <p><span className="text-muted-foreground/60">User ID</span> #{r.user_id}</p>
              <p className="col-span-2"><span className="text-muted-foreground/60">Admin</span> {r.admin_name} ({r.admin_email})</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'pending', 'approved', 'active', 'rejected', 'revoked', 'exited'];

export default function AdminAssistedAccess() {
  const [requests, setRequests]       = useState<AccessRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/assisted-access', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setRequests(d.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const counts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'all' ? requests.length : requests.filter(r => r.status === s).length;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Assisted Access — Admin</title>
        <meta name="description" content="Request and manage temporary assisted access to customer accounts." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/assisted-access" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Assisted Access
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Request temporary, consent-based access to customer accounts. Customer must approve. All actions are audited.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5 flex-shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Policy notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 mb-6">
        <Lock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-400/90 leading-relaxed space-y-1">
          <p className="font-semibold text-blue-300">Assisted Access Policy</p>
          <p>Access is only permitted with explicit customer consent. Sessions are time-limited to 2 hours. All actions during a session are recorded in the audit log. Dangerous actions (delete account, change email/password, export data, change payment method) are blocked during assisted sessions.</p>
        </div>
      </div>

      <NewRequestForm onCreated={load} />

      {/* History */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            Access History
            {requests.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">{requests.length} total</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
                {counts[s] > 0 && s !== 'all' && (
                  <span className="ml-1 opacity-60">{counts[s]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all' ? 'No assisted access requests yet.' : `No ${statusFilter} requests.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => <RequestRow key={r.id} r={r} onRefresh={load} />)}
          </div>
        )}
      </div>
    </div>
  );
}
