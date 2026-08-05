/**
 * Admin CRM — Customer Management Dashboard
 * /admin/crm
 *
 * Full customer profile visibility: plan, billing, consent,
 * support requests, data requests, admin notes, audit log,
 * enquiries, feature access, issue reports,
 * complaints, direct messages, visitor reports.
 * UK GDPR compliant — data minimisation, consent records, right to access/delete.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Users, Search, RefreshCw, ChevronRight,
  User, Mail, Phone, CreditCard, Calendar, Clock, Shield,
  MessageCircle, Plus, Trash2, Loader2,
  Link2, ArrowLeft, Check, Lock,
  LogIn, Settings, Cookie, AlertCircle, Globe, Cpu, Building2,
  ScrollText, ChevronDown, ChevronUp, FileSignature, FileDown,
  Inbox, Flag, BarChart2, Layers, ExternalLink, TriangleAlert,
  Infinity, Ban,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import PinChallenge from '@/components/admin/PinChallenge';

// ── Types ─────────────────────────────────────────────────────────────────

interface CrmUser {
  id: number; name: string; email: string; phone: string | null;
  role: string; plan_name: string | null; plan_slug: string | null;
  created_at: string; last_login_at: string | null;
  is_paused: number; lifetime_access: number;
  marketing_consent: number;
  subscription_status: string | null; billing_interval: string | null;
  profile_count: number; pending_requests: number;
  customer_number: string | null;
}

interface CrmProfile {
  id: number; username: string; display_name: string;
  profile_type: string; is_published: number;
  biz_slug: string | null; person_slug: string | null;
  business_name: string | null; created_at: string;
}

interface AdminNote {
  id: number; user_id: number; admin_name: string;
  note: string; created_at: string;
}

interface DataRequest {
  id: number; request_type: string; description: string | null;
  status: string; created_at: string; updated_at: string;
  completed_at: string | null; assigned_name: string | null;
  internal_notes: string | null;
}

interface AuditEntry {
  id?: number;
  actor_id?: number | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_type?: string;
  tenant?: string | null;
  auth_provider?: string | null;
  action: string;
  resource_type?: string;
  resource_id?: string | null;
  resource_label?: string | null;
  details?: string | null;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  result?: string | null;
  created_at: string;
  event_type?: string;
}

interface SupportRequest {
  id: number; subject: string; message: string | null;
  status: string; priority: string | null; category: string | null;
  created_at: string; updated_at: string; resolved_at: string | null;
  assigned_name: string | null; internal_notes: string | null;
}

interface Enquiry {
  id: number; sender_name: string; sender_email: string;
  message: string; created_at: string;
  profile_name: string; profile_slug: string;
}

interface FeatureAccess {
  id: number; name: string; slug: string; category: string;
  description: string | null;
  effective_access: string; override_access: string | null;
  override_by: string | null; override_at: string | null;
  plan_access: string | null;
}

interface IssueReport {
  id: number; title: string; description: string | null;
  category: string | null; status: string; priority: string | null;
  created_at: string; updated_at: string;
}

interface Complaint {
  id: number; reference: string; category: string | null;
  status: string; summary: string | null; handler_name: string | null;
  escalation_status: string | null; resolution_date: string | null;
  created_at: string; updated_at: string;
}

interface DirectMessage {
  id: number; thread_id: string; sender_type: string;
  sender_name: string; sender_email: string;
  message: string; created_at: string; profile_name: string;
}

interface VisitorReport {
  id: number; category: string; details: string | null;
  reporter_name: string | null; reporter_email: string | null;
  status: string; admin_notes: string | null; action_taken: string | null;
  outcome: string | null; created_at: string; updated_at: string;
  profile_name: string | null; profile_slug: string | null;
}

interface FullCrmUser {
  user: Record<string, unknown> & { block_reason?: string | null; pause_reason?: string | null };
  profiles: CrmProfile[];
  linkCount: number;
  subscriptions: Record<string, unknown>[];
  supportRequests: SupportRequest[];
  dataRequests: DataRequest[];
  adminNotes: AdminNote[];
  auditEntries: AuditEntry[];
  enquiryCount: number;
  enquiries: Enquiry[];
  supportPin: { pin: string; expires_at: string; issued_at: string } | null;
  featureOverrides: FeatureAccess[];
  allFeatures: FeatureAccess[];
  issueReports: IssueReport[];
  complaints: Complaint[];
  directMessages: DirectMessage[];
  visitorReports: VisitorReport[];
  consent: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  data_copy: 'Copy of Data',
  data_correction: 'Data Correction',
  data_deletion: 'Account Deletion',
  consent_withdrawal: 'Consent Withdrawal',
  marketing_change: 'Marketing Preferences',
  document_export: 'Document Export',
  referral_data: 'Document/File Export',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
  active: 'bg-green-500/10 text-green-400',
  cancelled: 'bg-red-500/10 text-red-400',
  verified: 'bg-green-500/10 text-green-400',
  unverified: 'bg-orange-500/10 text-orange-400',
  open: 'bg-blue-500/10 text-blue-400',
  resolved: 'bg-green-500/10 text-green-400',
  closed: 'bg-muted text-muted-foreground',
};

const ACTOR_TYPE_COLORS: Record<string, string> = {
  admin:   'bg-red-500/10 text-red-400',
  user:    'bg-blue-500/10 text-blue-400',
  visitor: 'bg-green-500/10 text-green-400',
  system:  'bg-purple-500/10 text-purple-400',
};

const RESULT_COLORS: Record<string, string> = {
  success: 'bg-green-500/10 text-green-400',
  failure: 'bg-red-500/10 text-red-400',
  error:   'bg-orange-500/10 text-orange-400',
};

const ACCESS_COLORS: Record<string, string> = {
  full_access: 'bg-green-500/10 text-green-400',
  limited_access: 'bg-blue-500/10 text-blue-400',
  not_available: 'bg-muted text-muted-foreground',
  beta_access: 'bg-purple-500/10 text-purple-400',
};

function AuditActionIcon({ action }: { action: string }) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    login: LogIn, register: User, cookie_consent: Cookie,
    create: Settings, update: Settings, delete: AlertCircle,
    message: MessageCircle, checkout: CreditCard,
    profile_view: Globe, link_click: Link2, auth: LogIn,
  };
  const Icon = map[action] ?? ScrollText;
  return <Icon className="w-3.5 h-3.5 text-muted-foreground" />;
}

function normaliseDate(dt: string): string {
  const withT = dt.replace(' ', 'T');
  const dotIdx = withT.indexOf('.');
  return dotIdx !== -1 ? withT.slice(0, dotIdx) : withT;
}



function ConsentDot({ value }: { value: number | null }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${value ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
  );
}

function EmptyState({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Audit Row ─────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const action = entry.action ?? entry.event_type ?? '—';
  const resourceType = entry.resource_type ?? '';
  const result = entry.result ?? 'success';
  const actorType = entry.actor_type ?? 'user';
  const details = entry.details ?? entry.description ?? null;
  let parsedDetails: Record<string, unknown> | null = null;
  if (details) { try { parsedDetails = JSON.parse(details); } catch { /* plain string */ } }
  const hasExtra = !!(entry.ip_address || entry.user_agent || entry.tenant || entry.auth_provider || entry.resource_id || entry.resource_label || details);

  return (
    <div className="relative mb-2">
      <div className={`absolute -left-[29px] top-3 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${result === 'success' ? 'bg-green-500/80' : result === 'failure' ? 'bg-red-500/80' : 'bg-orange-500/80'}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
      </div>
      <div className={`rounded-xl border p-3 transition-colors ${expanded ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/10 hover:border-border'}`}>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
            <AuditActionIcon action={action} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-sm font-semibold text-foreground font-mono">{action}</p>
              {resourceType && <Badge className="text-xs border-0 bg-muted text-muted-foreground capitalize">{resourceType}</Badge>}
              <Badge className={`text-xs border-0 ${RESULT_COLORS[result] ?? 'bg-muted text-muted-foreground'}`}>{result}</Badge>
              <Badge className={`text-xs border-0 ${ACTOR_TYPE_COLORS[actorType] ?? 'bg-muted text-muted-foreground'}`}>{actorType}</Badge>
            </div>
            {entry.resource_label && (
              <p className="text-xs text-foreground/80 mb-0.5">
                <span className="text-muted-foreground">Resource: </span>{entry.resource_label}
                {entry.resource_id && <span className="font-mono text-muted-foreground ml-1">#{entry.resource_id}</span>}
              </p>
            )}
            {details && !parsedDetails && <p className="text-xs text-muted-foreground leading-relaxed">{details}</p>}
            <p className="text-xs text-muted-foreground mt-1">{fmtDateTime(entry.created_at)}</p>
          </div>
          {hasExtra && (
            <button onClick={() => setExpanded(v => !v)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            {parsedDetails && (
              <div className="rounded-lg bg-muted/30 p-2 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Event details</p>
                {Object.entries(parsedDetails).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground font-mono w-28 flex-shrink-0">{k}</span>
                    <span className="text-foreground break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {entry.ip_address && (
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">IP:</span>
                  <span className="font-mono text-foreground">{entry.ip_address}</span>
                </div>
              )}
              {entry.tenant && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Tenant:</span>
                  <span className="text-foreground">{entry.tenant}</span>
                </div>
              )}
              {entry.auth_provider && (
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Auth:</span>
                  <span className="text-foreground">{entry.auth_provider}</span>
                </div>
              )}
              {entry.actor_name && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Actor:</span>
                  <span className="text-foreground">{entry.actor_name}</span>
                  {entry.actor_email && <span className="text-muted-foreground">({entry.actor_email})</span>}
                </div>
              )}
              {entry.user_agent && (
                <div className="flex items-start gap-1.5 sm:col-span-2">
                  <Cpu className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">UA:</span>
                  <span className="text-foreground break-all leading-relaxed">{entry.user_agent}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── User detail view ──────────────────────────────────────────────────────

function UserDetail({ userId, onBack }: { userId: number; onBack: () => void }) {
  const [data, setData] = useState<FullCrmUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editRequest, setEditRequest] = useState<DataRequest | null>(null);
  const [reqStatus, setReqStatus] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [savingReq, setSavingReq] = useState(false);
  const [generatingSarPdf, setGeneratingSarPdf] = useState(false);
  const [sarPdfError, setSarPdfError] = useState<string | null>(null);
  const [featureTab, setFeatureTab] = useState<'overrides' | 'all'>('overrides');
  // SAR PIN challenge — true when waiting for PIN before downloading
  const [sarPinPending, setSarPinPending] = useState(false);

  const executeSarDownload = async (token: string) => {
    if (!data) return;
    setGeneratingSarPdf(true);
    setSarPdfError(null);
    try {
      const res = await fetch(`/api/admin/sar/${userId}/pdf`, {
        credentials: 'include',
        headers: { 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'sar_export' },
      });
      if (!res.ok) {
        let errMsg = `Server returned ${res.status}`;
        try {
          const ct = res.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) { const j = await res.json(); errMsg = j.error ?? errMsg; }
          else { const t = await res.text(); errMsg = t.slice(0, 300) || errMsg; }
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const name = data.user.name || data.user.email || `user-${userId}`;
      a.download = match?.[1] ?? `SAR_${String(name).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setSarPdfError(String(err)); }
    setGeneratingSarPdf(false);
  };

  // Trigger PIN challenge before downloading SAR PDF
  const downloadSarPdf = () => { setSarPinPending(true); };

  // ── Email Signature Beta Access ───────────────────────────────────────────
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaNote, setBetaNote] = useState('');
  const [betaGrantedBy, setBetaGrantedBy] = useState<string | null>(null);
  const [betaGrantedAt, setBetaGrantedAt] = useState<string | null>(null);
  const [betaLoading, setBetaLoading] = useState(true);
  const [betaSaving, setBetaSaving] = useState(false);
  const [betaSaved, setBetaSaved] = useState(false);

  // ── Block / Pause controls ────────────────────────────────────────────────
  const [blockReason, setBlockReason] = useState('');
  const [blockHideProfiles, setBlockHideProfiles] = useState(true);
  const [blockLoading, setBlockLoading] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);
  const [controlsSaved, setControlsSaved] = useState('');

  // ── Lifetime access controls ──────────────────────────────────────────────
  const [lifetimePlans, setLifetimePlans] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [lifetimePlanId, setLifetimePlanId] = useState('');
  const [lifetimeReason, setLifetimeReason] = useState('');
  const [lifetimeBusy, setLifetimeBusy] = useState(false);
  const [lifetimeMsg, setLifetimeMsg] = useState('');
  const [lifetimeErr, setLifetimeErr] = useState('');
  type LifetimePendingAction = 'grant' | 'revoke';
  const [lifetimePending, setLifetimePending] = useState<LifetimePendingAction | null>(null);

  useEffect(() => {
    fetch('/api/plans?include_lifetime=1', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setLifetimePlans((d.plans ?? []).filter((p: { slug: string }) => p.slug !== 'free')); })
      .catch(() => {});
  }, []);

  const executeLifetime = async (token: string) => {
    if (!lifetimePending) return;
    const action = lifetimePending;
    setLifetimePending(null);
    setLifetimeBusy(true); setLifetimeMsg(''); setLifetimeErr('');
    try {
      if (action === 'grant') {
        if (!lifetimePlanId) { setLifetimeErr('Select a plan first.'); setLifetimeBusy(false); return; }
        const r = await fetch(`/api/admin/users/${userId}/lifetime`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'billing_control' },
          body: JSON.stringify({ plan_id: Number(lifetimePlanId), reason: lifetimeReason }),
        });
        const d = await r.json();
        if (d.success) { setLifetimeMsg('Lifetime access granted.'); load(); }
        else setLifetimeErr(`Failed: ${d.error || 'Unknown error'}`);
      } else {
        const r = await fetch(`/api/admin/users/${userId}/lifetime`, {
          method: 'DELETE', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'billing_control' },
          body: JSON.stringify({ reason: lifetimeReason }),
        });
        const d = await r.json();
        if (d.success) { setLifetimeMsg('Lifetime access revoked.'); load(); }
        else setLifetimeErr(`Failed: ${d.error || 'Unknown error'}`);
      }
    } catch { setLifetimeErr('Network error.'); }
    finally { setLifetimeBusy(false); }
  };

  const doBlock = async () => {
    if (!confirm(`Block this user? They will not be able to log in.`)) return;
    setBlockLoading(true);
    await fetch(`/api/admin/users/${userId}/block`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason: blockReason, hide_profiles: blockHideProfiles }),
    });
    setBlockLoading(false);
    setControlsSaved('User blocked.');
    setTimeout(() => setControlsSaved(''), 3000);
    load();
  };

  const doUnblock = async () => {
    setBlockLoading(true);
    await fetch(`/api/admin/users/${userId}/unblock`, { method: 'PATCH', credentials: 'include' });
    setBlockLoading(false);
    setControlsSaved('User unblocked.');
    setTimeout(() => setControlsSaved(''), 3000);
    load();
  };

  const doPause = async (paused: boolean) => {
    setPauseLoading(true);
    await fetch(`/api/admin/users/${userId}/pause`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paused, reason: pauseReason }),
    });
    setPauseLoading(false);
    setControlsSaved(paused ? 'Account paused.' : 'Account resumed.');
    setTimeout(() => setControlsSaved(''), 3000);
    load();
  };

  const doAssistedAccess = () => {
    window.location.href = `/admin/assisted-access`;
  };

  const loadBeta = useCallback(() => {
    setBetaLoading(true);
    fetch(`/api/admin/users/${userId}/email-signature-beta`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBetaEnabled(!!d.data.enabled);
          setBetaNote(d.data.admin_note ?? '');
          setBetaGrantedBy(d.data.granted_by_name ?? null);
          setBetaGrantedAt(d.data.granted_at ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setBetaLoading(false));
  }, [userId]);

  const saveBeta = async (enabled: boolean) => {
    setBetaSaving(true);
    await fetch(`/api/admin/users/${userId}/email-signature-beta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled, admin_note: betaNote }),
    });
    setBetaEnabled(enabled);
    setBetaSaving(false);
    setBetaSaved(true);
    setTimeout(() => setBetaSaved(false), 2500);
    loadBeta();
  };

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/admin/crm/users/${userId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setData(d.data); } else { setLoadError(d.error ?? 'Unknown error from server'); } })
      .catch(err => setLoadError(String(err)))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); loadBeta(); }, [load, loadBeta]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    await fetch(`/api/admin/crm/users/${userId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ note: newNote }),
    });
    setNewNote(''); setAddingNote(false); load();
  };

  const deleteNote = async (noteId: number) => {
    if (!confirm('Delete this note?')) return;
    await fetch(`/api/admin/crm/users/${userId}/notes/${noteId}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  const saveRequest = async () => {
    if (!editRequest) return;
    setSavingReq(true);
    await fetch(`/api/admin/crm/data-requests/${editRequest.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ status: reqStatus, internal_notes: reqNotes }),
    });
    setSavingReq(false); setEditRequest(null); load();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to list
        </Button>
        {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (!data) return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground mb-2">
        <ArrowLeft className="w-4 h-4" /> Back to list
      </Button>
      <div className="p-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-2">
        <p className="font-semibold">Failed to load user</p>
        {loadError && <p className="font-mono text-xs opacity-80">{loadError}</p>}
        <Button size="sm" variant="outline" onClick={load} className="mt-2 gap-1.5 border-destructive/30 text-destructive">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    </div>
  );

  const u = data.user as Record<string, unknown>;
  const uBlockReason: string | null = u.block_reason != null ? String(u.block_reason) : null;
  const uPauseReason: string | null = u.pause_reason != null ? String(u.pause_reason) : null;
  const pendingDataReqs = data.dataRequests.filter(r => r.status === 'pending').length;
  const openComplaints = data.complaints.filter(c => c.status === 'open').length;
  const openIssues = data.issueReports.filter(i => i.status === 'open').length;

  return (
    <div className="space-y-5 pb-20">
      {/* SAR export PIN challenge */}
      <PinChallenge
        open={sarPinPending}
        action="sar_export"
        actionLabel="export a Subject Access Request PDF for this user"
        onSuccess={(token) => { setSarPinPending(false); executeSarDownload(token); }}
        onCancel={() => setSarPinPending(false)}
      />
      {/* Lifetime PIN challenge */}
      <PinChallenge
        open={lifetimePending !== null}
        action="billing_control"
        actionLabel={lifetimePending === 'grant' ? 'grant lifetime access to this user' : 'revoke lifetime access from this user'}
        onSuccess={executeLifetime}
        onCancel={() => setLifetimePending(null)}
      />
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground mt-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {String(u.name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{String(u.name)}</h2>
              <p className="text-sm text-muted-foreground">{String(u.email)}</p>
            </div>
            <div className="flex gap-2 flex-wrap ml-auto items-center">
              {u.lifetime_access ? <Badge className="bg-blue-500/10 text-blue-400 border-0">Lifetime</Badge> : null}
              {u.is_paused ? (
                <Badge className="bg-orange-500/10 text-orange-400 border-0">Paused</Badge>
              ) : (
                <Badge className="bg-green-500/10 text-green-400 border-0">Active</Badge>
              )}
              {u.role === 'admin' && <Badge className="bg-red-500/10 text-red-400 border-0">Admin</Badge>}
              <Button
                size="sm" onClick={downloadSarPdf} disabled={generatingSarPdf}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-7 px-3 text-xs"
                title="Generate Subject Access Request PDF"
              >
                {generatingSarPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                {generatingSarPdf ? 'Generating…' : 'SAR PDF'}
              </Button>
            </div>
          </div>
          {sarPdfError && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono break-all">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{sarPdfError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <Lock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-400/90 leading-relaxed">
          <strong>Data Protection Notice:</strong> This information is confidential and must only be used for legitimate business purposes in accordance with UK GDPR. Do not share, copy, or process this data beyond what is necessary for your role.
        </p>
      </div>

      {/* Alert banners for open items */}
      {(pendingDataReqs > 0 || openComplaints > 0 || openIssues > 0) && (
        <div className="flex flex-wrap gap-2">
          {pendingDataReqs > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
              <TriangleAlert className="w-3.5 h-3.5" /> {pendingDataReqs} pending data request{pendingDataReqs > 1 ? 's' : ''}
            </div>
          )}
          {openComplaints > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              <TriangleAlert className="w-3.5 h-3.5" /> {openComplaints} open complaint{openComplaints > 1 ? 's' : ''}
            </div>
          )}
          {openIssues > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <Flag className="w-3.5 h-3.5" /> {openIssues} open issue report{openIssues > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="consent">Consent</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="enquiries" className="relative">
            Enquiries
            {data.enquiryCount > 0 && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">{data.enquiryCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="requests" className="relative">
            Data Requests
            {pendingDataReqs > 0 && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{pendingDataReqs}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="issues" className="relative">
            Issues
            {openIssues > 0 && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">{openIssues}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="complaints" className="relative">
            Complaints
            {openComplaints > 0 && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{openComplaints}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="beta" className="text-blue-400">Beta</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="controls" className="text-orange-400">Controls</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Profiles', value: data.profiles.length, icon: User, color: 'text-primary' },
              { label: 'Links', value: data.linkCount, icon: Link2, color: 'text-blue-400' },
              { label: 'Enquiries', value: data.enquiryCount, icon: MessageCircle, color: 'text-green-400' },
              { label: 'Messages', value: data.directMessages.length, icon: Inbox, color: 'text-purple-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-4">
                  <Icon className={`w-5 h-5 ${color} mb-2`} />
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm">Account Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Mail, label: 'Email', value: String(u.email), valueClass: '' },
                { icon: Phone, label: 'Phone', value: u.phone ? String(u.phone) : '—', valueClass: '' },
                { icon: CreditCard, label: 'Plan', value: String(u.plan_name ?? '—'), valueClass: u.plan_name ? '' : 'italic text-muted-foreground' },
                { icon: Calendar, label: 'Joined', value: fmtDate(String(u.created_at)), valueClass: '' },
                { icon: Clock, label: 'Last Login', value: fmtDateTime(u.last_login_at ? String(u.last_login_at) : null), valueClass: '' },
              ].map(({ icon: Icon, label, value, valueClass }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground w-20">{label}</span>
                  <span className={`text-sm text-foreground ${valueClass}`}>{value}</span>
                </div>
              ))}
              {/* Consent summary row */}
              <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground w-20">Consent</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'terms_consent', label: 'T&C' },
                    { key: 'privacy_consent', label: 'Privacy' },
                    { key: 'marketing_consent', label: 'Marketing' },
                    { key: 'crm_consent', label: 'CRM' },
                  ].map(({ key, label }) => (
                    <span key={key} className={`text-xs px-1.5 py-0.5 rounded font-medium ${u[key] ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Telephone Support PIN */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> Telephone Support PIN
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.supportPin ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Current PIN (quote this to verify the caller)</p>
                      <p className="text-3xl font-bold tracking-[0.3em] text-foreground font-mono select-all">{data.supportPin.pin}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Expires</p>
                      <p className="text-xs font-medium text-blue-400">
                        {fmtTime(data.supportPin.expires_at, true)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(data.supportPin.expires_at, 'short')}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Ask the caller to read out their PIN. If it matches above, their identity is confirmed. PINs rotate every 30 minutes.</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
                  <p className="text-sm text-muted-foreground">No active PIN</p>
                  <p className="text-xs text-muted-foreground mt-1">This user has not yet generated a support PIN. Ask them to visit Dashboard → Settings to generate one before calling.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {data.profiles.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-sm">Profiles ({data.profiles.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.profiles.map(p => {
                  const profilePath = p.profile_type === 'business' && p.biz_slug ? `/profile/${p.biz_slug}` : `/profile/${p.username}`;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.display_name || p.username}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.profile_type} · {profilePath}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={profilePath} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                        <Badge className={`text-xs border-0 ${p.is_published ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {p.is_published ? 'Live' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Consent ── */}
        <TabsContent value="consent" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Privacy, Terms and Communication Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Required — Legal Acknowledgements</p>
                <div className="space-y-2">
                  {[
                    { key: 'terms_consent', label: 'Terms & Conditions', at: 'terms_consent_at', statusLabel: 'Accepted' },
                    { key: 'privacy_consent', label: 'Privacy Policy', at: 'privacy_consent_at', statusLabel: 'Acknowledged' },
                    { key: 'crm_consent', label: 'Essential Account & Activity Records', at: 'crm_consent_at', statusLabel: 'Applicable' },
                  ].map(({ key, label, at, statusLabel }) => (
                    <div key={key} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <ConsentDot value={u[key] as number} />
                          <span className="text-sm text-foreground font-medium">{label}</span>
                          <span className="text-xs text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded">Required</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${u[key] ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {u[key] ? statusLabel : 'Not recorded'}
                        </span>
                      </div>
                      {!!u[at] && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Recorded: {fmtDateTime(String(u[at] as string))}
                          {!!u.consent_version && <span className="ml-2 font-mono">v{String(u.consent_version)}</span>}
                          {!!u.consent_ip && <span className="ml-2">· IP: {String(u.consent_ip)}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Optional — Communication Preferences</p>
                <div className="space-y-0">
                  {[
                    { key: 'marketing_consent', label: 'Marketing Emails', at: 'marketing_consent_at' },
                    { key: 'data_improve_consent', label: 'Service Improvement', at: 'data_improve_consent_at' },
                    { key: 'updates_consent', label: 'Product Updates', at: 'updates_consent_at' },
                  ].map(({ key, label, at }) => (
                    <div key={key} className="flex items-start justify-between py-2.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <ConsentDot value={u[key] as number} />
                        <div>
                          <span className="text-sm text-foreground">{label}</span>
                          {!!u[at] && (
                            <p className="text-xs text-muted-foreground">
                              {u[key] ? 'Enabled' : 'Disabled'}: {fmtDateTime(String(u[at] as string))}
                              {!!u.consent_version && <span className="ml-1 font-mono">v{String(u.consent_version)}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${u[key] ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {u[key] ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {!!u.consent_ip && (
                <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                  IP at initial consent: <span className="font-mono text-foreground">{String(u.consent_ip)}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Billing ── */}
        <TabsContent value="billing" className="space-y-4">
          {data.subscriptions.length === 0 ? (
            <EmptyState icon={CreditCard} label="No subscription history." />
          ) : data.subscriptions.map((s, i) => {
            const sub = s as Record<string, unknown>;
            return (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{String(sub.plan_name ?? 'Unknown plan')}</p>
                    <Badge className={`text-xs border-0 ${STATUS_COLORS[String(sub.status)] ?? 'bg-muted text-muted-foreground'}`}>{String(sub.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Interval: {String(sub.billing_interval ?? '—')}</span>
                    <span>Started: {fmtDate(sub.started_at ? String(sub.started_at as string) : null)}</span>
                    <span>Period end: {fmtDate(sub.current_period_end ? String(sub.current_period_end as string) : null)}</span>
                    {!!sub.cancelled_at && <span>Cancelled: {fmtDate(String(sub.cancelled_at as string))}</span>}
                  </div>
                  {!!sub.stripe_subscription_id && (
                    <p className="text-xs text-muted-foreground font-mono">Stripe: {String(sub.stripe_subscription_id)}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* ── Lifetime access controls ── */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Infinity className="w-4 h-4 text-blue-400" /> Lifetime Access
                {(data.user as Record<string, unknown>).lifetime_access ? (
                  <Badge className="ml-1 bg-blue-500/10 text-blue-400 border-0 text-xs">Active</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Grant permanent full access on the selected plan — no subscription required. Use for one-time purchases or special arrangements.</p>
              {lifetimeMsg && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{lifetimeMsg}</p>}
              {lifetimeErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{lifetimeErr}</p>}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Reason (optional — logged in audit)</label>
                <input
                  value={lifetimeReason}
                  onChange={e => setLifetimeReason(e.target.value)}
                  placeholder="e.g. One-time purchase, special arrangement…"
                  className="w-full text-xs h-8 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={lifetimePlanId} onValueChange={setLifetimePlanId}>
                  <SelectTrigger className="w-44 text-xs h-8">
                    <SelectValue placeholder="Select plan for lifetime…" />
                  </SelectTrigger>
                  <SelectContent>
                    {lifetimePlans.map(p => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline"
                  disabled={lifetimeBusy || !lifetimePlanId}
                  onClick={() => setLifetimePending('grant')}
                  className="text-xs h-8 gap-1.5 border-blue-500/30 text-blue-400"
                >
                  <Infinity className="w-3.5 h-3.5" /> Grant lifetime access
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={lifetimeBusy}
                  onClick={() => {
                    if (!confirm('Remove lifetime access? The user will be moved to the Free plan.')) return;
                    setLifetimePending('revoke');
                  }}
                  className="text-xs h-8 gap-1.5 border-red-500/30 text-red-400"
                >
                  <Ban className="w-3.5 h-3.5" /> Revoke lifetime access
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Enquiries ── */}
        <TabsContent value="enquiries" className="space-y-3">
          <p className="text-xs text-muted-foreground">{data.enquiries.length} enquir{data.enquiries.length !== 1 ? 'ies' : 'y'} received across all profiles</p>
          {data.enquiries.length === 0 ? (
            <EmptyState icon={MessageCircle} label="No enquiries received yet." />
          ) : data.enquiries.map(eq => (
            <Card key={eq.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{eq.sender_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{eq.sender_email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{fmtDateTime(eq.created_at)}</p>
                    <p className="text-xs text-primary mt-0.5">{eq.profile_name}</p>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{eq.message}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Direct Messages — removed feature, kept for legacy data display only ── */}
        <TabsContent value="messages" className="space-y-3">
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground">
            Direct messaging has been removed from Sousa Murray Profiles. Any records below are legacy data only.
          </div>
          {data.directMessages.length === 0 ? (
            <EmptyState icon={Inbox} label="No direct message records." />
          ) : data.directMessages.map(msg => (
            <Card key={msg.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{msg.sender_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{msg.sender_email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{fmtDateTime(msg.created_at)}</p>
                    <p className="text-xs text-primary mt-0.5">{msg.profile_name}</p>
                    <Badge className="text-xs border-0 bg-muted text-muted-foreground mt-1">{msg.sender_type}</Badge>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                <p className="text-xs text-muted-foreground font-mono mt-2">Thread: {msg.thread_id}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Data Requests ── */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div>
              <p className="text-sm font-semibold text-foreground">Subject Access Request (SAR)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Generate a full PDF report of all data held about this user — required for UK GDPR Article 15 compliance.</p>
            </div>
            <Button onClick={downloadSarPdf} disabled={generatingSarPdf} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 flex-shrink-0 ml-4" size="sm">
              {generatingSarPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {generatingSarPdf ? 'Generating PDF…' : 'Generate SAR PDF'}
            </Button>
          </div>
          {data.dataRequests.length === 0 ? (
            <EmptyState icon={ScrollText} label="No data requests submitted." />
          ) : data.dataRequests.map(req => (
            <Card key={req.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-foreground">{REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}</p>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground'}`}>{req.status.replace('_', ' ')}</Badge>
                    </div>
                    {req.description && <p className="text-xs text-muted-foreground mb-1">{req.description}</p>}
                    <p className="text-xs text-muted-foreground">Submitted: {fmtDateTime(req.created_at)}</p>
                    {req.assigned_name && <p className="text-xs text-muted-foreground">Assigned: {req.assigned_name}</p>}
                    {req.internal_notes && <p className="text-xs text-muted-foreground mt-1 italic">Notes: {req.internal_notes}</p>}
                  </div>
                  <Button size="sm" variant="outline" className="border-border text-xs gap-1"
                    onClick={() => { setEditRequest(req); setReqStatus(req.status); setReqNotes(req.internal_notes ?? ''); }}>
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {editRequest && (
            <Card className="bg-card border-primary/30 border">
              <CardHeader><CardTitle className="text-sm">Update Request: {REQUEST_TYPE_LABELS[editRequest.request_type]}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={reqStatus} onValueChange={setReqStatus}>
                  <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Internal notes (not visible to customer)…" value={reqNotes} onChange={e => setReqNotes(e.target.value)} className="bg-background border-border text-sm" rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveRequest} disabled={savingReq} className="bg-primary gap-1.5">
                    {savingReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                  </Button>
                  <Button size="sm" variant="outline" className="border-border" onClick={() => setEditRequest(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Support ── */}
        <TabsContent value="support" className="space-y-3">
          {data.supportRequests.length === 0 ? (
            <EmptyState icon={MessageCircle} label="No support requests from this customer." />
          ) : data.supportRequests.map(req => (
            <Card key={req.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-foreground">{req.subject || '—'}</p>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[req.status] ?? 'bg-muted text-muted-foreground'}`}>{req.status.replace('_', ' ')}</Badge>
                      {req.priority && (
                        <Badge className={`text-xs border-0 ${req.priority === 'high' ? 'bg-red-500/10 text-red-400' : req.priority === 'medium' ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                          {req.priority} priority
                        </Badge>
                      )}
                      {req.category && <Badge className="text-xs border-0 bg-muted text-muted-foreground capitalize">{req.category}</Badge>}
                    </div>
                    {req.message && <p className="text-xs text-muted-foreground leading-relaxed mb-2 whitespace-pre-wrap">{req.message}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Submitted {fmtDateTime(req.created_at)}</span>
                      {req.updated_at && req.updated_at !== req.created_at && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated {fmtDateTime(req.updated_at)}</span>
                      )}
                      {req.resolved_at && <span className="flex items-center gap-1 text-green-400"><Check className="w-3 h-3" /> Resolved {fmtDateTime(req.resolved_at)}</span>}
                      {req.assigned_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> Assigned to {req.assigned_name}</span>}
                    </div>
                    {req.internal_notes && (
                      <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-400/80 font-medium mb-0.5">Internal notes</p>
                        <p className="text-xs text-muted-foreground">{req.internal_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Issue Reports ── */}
        <TabsContent value="issues" className="space-y-3">
          <p className="text-xs text-muted-foreground">{data.issueReports.length} issue report{data.issueReports.length !== 1 ? 's' : ''} submitted</p>
          {data.issueReports.length === 0 ? (
            <EmptyState icon={Flag} label="No issue reports submitted." />
          ) : data.issueReports.map(issue => (
            <Card key={issue.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-foreground">{issue.title}</p>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[issue.status] ?? 'bg-muted text-muted-foreground'}`}>{issue.status}</Badge>
                      {issue.priority && (
                        <Badge className={`text-xs border-0 ${issue.priority === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-muted text-muted-foreground'}`}>{issue.priority}</Badge>
                      )}
                      {issue.category && <Badge className="text-xs border-0 bg-muted text-muted-foreground capitalize">{issue.category}</Badge>}
                    </div>
                    {issue.description && <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Submitted: {fmtDateTime(issue.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Complaints ── */}
        <TabsContent value="complaints" className="space-y-3">
          <p className="text-xs text-muted-foreground">{data.complaints.length} complaint{data.complaints.length !== 1 ? 's' : ''} on record</p>
          {data.complaints.length === 0 ? (
            <EmptyState icon={TriangleAlert} label="No complaints on record." />
          ) : data.complaints.map(c => (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-foreground font-mono">{c.reference}</p>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[c.status] ?? 'bg-muted text-muted-foreground'}`}>{c.status}</Badge>
                      {c.category && <Badge className="text-xs border-0 bg-muted text-muted-foreground capitalize">{c.category}</Badge>}
                      {c.escalation_status && c.escalation_status !== 'none' && (
                        <Badge className="text-xs border-0 bg-red-500/10 text-red-400">Escalated: {c.escalation_status}</Badge>
                      )}
                    </div>
                    {c.summary && <p className="text-xs text-muted-foreground leading-relaxed mb-1">{c.summary}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Submitted: {fmtDateTime(c.created_at)}</span>
                      {c.handler_name && <span>Handler: {c.handler_name}</span>}
                      {c.resolution_date && <span className="text-green-400">Resolved: {fmtDate(c.resolution_date)}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Feature Access ── */}
        <TabsContent value="features" className="space-y-4">
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant={featureTab === 'overrides' ? 'default' : 'outline'} className="border-border text-xs" onClick={() => setFeatureTab('overrides')}>
              Overrides ({data.featureOverrides.length})
            </Button>
            <Button size="sm" variant={featureTab === 'all' ? 'default' : 'outline'} className="border-border text-xs" onClick={() => setFeatureTab('all')}>
              All Features ({data.allFeatures.length})
            </Button>
          </div>

          {featureTab === 'overrides' && (
            data.featureOverrides.length === 0 ? (
              <EmptyState icon={Layers} label="No feature overrides set for this user." />
            ) : (
              <div className="space-y-2">
                {data.featureOverrides.map(f => (
                  <Card key={f.id} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{f.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{f.slug} · {f.category}</p>
                          {f.override_by && <p className="text-xs text-muted-foreground mt-0.5">Set by {f.override_by} · {fmtDate(f.override_at)}</p>}
                        </div>
                        <Badge className={`text-xs border-0 ${ACCESS_COLORS[f.override_access ?? ''] ?? 'bg-muted text-muted-foreground'}`}>
                          {f.override_access?.replace('_', ' ') ?? '—'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}

          {featureTab === 'all' && (
            data.allFeatures.length === 0 ? (
              <EmptyState icon={Layers} label="No feature data available." />
            ) : (
              <div className="space-y-1">
                {/* Group by category */}
                {Array.from(new Set(data.allFeatures.map(f => f.category))).map(cat => (
                  <div key={cat} className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">{cat}</p>
                    <div className="space-y-1">
                      {data.allFeatures.filter(f => f.category === cat).map(f => (
                        <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10 border border-border/40">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{f.name}</p>
                            {f.override_access && (
                              <p className="text-xs text-orange-400">Override: {f.override_access.replace('_', ' ')} by {f.override_by}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {f.plan_access && (
                              <span className="text-xs text-muted-foreground">Plan: {f.plan_access.replace('_', ' ')}</span>
                            )}
                            <Badge className={`text-xs border-0 ${ACCESS_COLORS[f.effective_access] ?? 'bg-muted text-muted-foreground'}`}>
                              {f.effective_access.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </TabsContent>

        {/* ── Visitor Reports ── */}
        <TabsContent value="reports" className="space-y-3">
          <p className="text-xs text-muted-foreground">{data.visitorReports.length} visitor report{data.visitorReports.length !== 1 ? 's' : ''} against this user's profiles</p>
          {data.visitorReports.length === 0 ? (
            <EmptyState icon={BarChart2} label="No visitor reports against this user's profiles." />
          ) : data.visitorReports.map(r => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-foreground capitalize">{r.category}</p>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[r.status] ?? 'bg-muted text-muted-foreground'}`}>{r.status}</Badge>
                      {r.profile_name && <Badge className="text-xs border-0 bg-muted text-muted-foreground">{r.profile_name}</Badge>}
                    </div>
                    {r.details && <p className="text-xs text-muted-foreground leading-relaxed mb-1">{r.details}</p>}
                    {r.reporter_name && <p className="text-xs text-muted-foreground">Reporter: {r.reporter_name} {r.reporter_email ? `(${r.reporter_email})` : ''}</p>}
                    {r.action_taken && <p className="text-xs text-blue-400 mt-1">Action: {r.action_taken}</p>}
                    {r.outcome && <p className="text-xs text-green-400">Outcome: {r.outcome}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Reported: {fmtDateTime(r.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Beta Access ── */}
        <TabsContent value="beta" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-blue-400" /> Email Signature Beta Access
              </CardTitle>
              <p className="text-xs text-muted-foreground">This is a JA Group Services Ltd beta feature. Access must be manually activated per user. It is never granted automatically by any plan or subscription.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {betaLoading ? <Skeleton className="h-12 rounded-xl" /> : (
                <>
                  <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${betaEnabled ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30 border-border'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${betaEnabled ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                    <div>
                      <p className={`text-sm font-medium ${betaEnabled ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {betaEnabled ? 'Beta Access Active' : 'Beta Access Not Activated'}
                      </p>
                      {betaEnabled && betaGrantedBy && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Activated by {betaGrantedBy}{betaGrantedAt ? ` on ${fmtDate(betaGrantedAt)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border">
                    <div>
                      <Label className="text-sm font-medium text-foreground">Email Signature Beta Access</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{betaEnabled ? 'User can access Email Signature Generator' : 'User cannot access Email Signature Generator'}</p>
                    </div>
                    <Switch checked={betaEnabled} onCheckedChange={v => setBetaEnabled(v)} disabled={betaSaving} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Admin Note (reason for activation)</Label>
                    <Textarea value={betaNote} onChange={e => setBetaNote(e.target.value)} placeholder="e.g. Activated for testing, Internal beta, Approved by JA Group Services Ltd" className="bg-background border-border resize-none text-sm" rows={3} />
                    <p className="text-xs text-muted-foreground">This note is recorded in the audit log and visible to admins only.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => saveBeta(betaEnabled)} disabled={betaSaving}
                      className={betaEnabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'} size="sm">
                      {betaSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : betaSaved ? <Check className="w-3.5 h-3.5 mr-1.5" /> : null}
                      {betaSaved ? 'Saved' : betaEnabled ? 'Activate Beta Access' : 'Deactivate Beta Access'}
                    </Button>
                    {betaSaved && <span className="text-xs text-green-400">Change saved and audit logged</span>}
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400/90 space-y-1">
                    <p className="font-semibold">Beta Feature Disclaimer</p>
                    <p>This feature is currently provided as beta access by JA Group Services Ltd and may be changed, limited, or withdrawn during testing. Activating this for a user does not constitute a contractual commitment to continued access.</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Admin Notes ── */}
        <TabsContent value="notes" className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <Textarea placeholder="Add an internal note about this customer…" value={newNote} onChange={e => setNewNote(e.target.value)} className="bg-background border-border text-sm" rows={3} />
              <Button size="sm" onClick={addNote} disabled={addingNote || !newNote.trim()} className="bg-primary gap-1.5">
                {addingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Note
              </Button>
            </CardContent>
          </Card>
          {data.adminNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
          ) : data.adminNotes.map(note => (
            <Card key={note.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-foreground leading-relaxed">{note.note}</p>
                    <p className="text-xs text-muted-foreground mt-2">{note.admin_name} · {fmtDateTime(note.created_at)}</p>
                  </div>
                  <button onClick={() => deleteNote(note.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Audit Log ── */}
        <TabsContent value="audit" className="space-y-3">
          <p className="text-xs text-muted-foreground">{data.auditEntries.length} event{data.auditEntries.length !== 1 ? 's' : ''} recorded for this account</p>
          {data.auditEntries.length === 0 ? (
            <EmptyState icon={ScrollText} label="No audit entries for this user." />
          ) : (
            <div className="relative">
              <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border/50" />
              <div className="space-y-1 pl-10">
                {data.auditEntries.map((entry, i) => <AuditRow key={entry.id ?? i} entry={entry} />)}
              </div>
            </div>
          )}
        </TabsContent>
        {/* ── Account Controls ── */}
        <TabsContent value="controls" className="space-y-4">
          {/* Current status */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-4 rounded-xl border ${u.is_blocked ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/20 border-border'}`}>
              <p className="text-xs text-muted-foreground mb-1">Block Status</p>
              <p className={`text-sm font-semibold ${u.is_blocked ? 'text-red-400' : 'text-green-400'}`}>
                {u.is_blocked ? 'Blocked' : 'Not blocked'}
              </p>
              {u.is_blocked && uBlockReason ? <p className="text-xs text-muted-foreground mt-1">{uBlockReason}</p> : null}
            </div>
            <div className={`p-4 rounded-xl border ${u.is_paused ? 'bg-orange-500/10 border-orange-500/30' : 'bg-muted/20 border-border'}`}>
              <p className="text-xs text-muted-foreground mb-1">Pause Status</p>
              <p className={`text-sm font-semibold ${u.is_paused ? 'text-orange-400' : 'text-green-400'}`}>
                {u.is_paused ? 'Paused' : 'Active'}
              </p>
              {u.is_paused && uPauseReason ? <p className="text-xs text-muted-foreground mt-1">{uPauseReason}</p> : null}
            </div>
          </div>

          {controlsSaved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <Check className="w-4 h-4 flex-shrink-0" /> {controlsSaved}
            </div>
          )}

          {/* Block / Unblock */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-red-400"><Lock className="w-4 h-4" /> Block / Unblock Account</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Blocking prevents the user from logging in and using the dashboard. Their public profiles can optionally be hidden.
              </p>
              {!u.is_blocked ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Reason (required)</Label>
                    <Input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="e.g. Violation of terms of service" className="bg-background border-border text-sm" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={blockHideProfiles} onCheckedChange={setBlockHideProfiles} />
                    <Label className="text-sm text-foreground">Hide all public profiles</Label>
                  </div>
                  <Button
                    onClick={doBlock}
                    disabled={blockLoading || !blockReason.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                    size="sm"
                  >
                    {blockLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    Block Account
                  </Button>
                </>
              ) : (
                <Button onClick={doUnblock} disabled={blockLoading} className="bg-green-600 hover:bg-green-700 text-white gap-1.5" size="sm">
                  {blockLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Unblock Account
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pause / Resume */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-orange-400"><AlertCircle className="w-4 h-4" /> Pause / Resume Account</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Pausing restricts the user's dashboard access without fully blocking them. Their profiles remain visible unless manually unpublished.
              </p>
              {!u.is_paused ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                    <Input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="e.g. Payment issue — pending resolution" className="bg-background border-border text-sm" />
                  </div>
                  <Button onClick={() => doPause(true)} disabled={pauseLoading} className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5" size="sm">
                    {pauseLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    Pause Account
                  </Button>
                </>
              ) : (
                <Button onClick={() => doPause(false)} disabled={pauseLoading} className="bg-green-600 hover:bg-green-700 text-white gap-1.5" size="sm">
                  {pauseLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Resume Account
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Assisted Access */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-blue-400"><Shield className="w-4 h-4" /> Assisted Access</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Request temporary, consent-based access to this customer's account. The customer must approve before you can enter. All actions are audited.
              </p>
              <Button onClick={doAssistedAccess} variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-1.5" size="sm">
                <Shield className="w-3.5 h-3.5" /> Request Assisted Access
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ── Main CRM list ─────────────────────────────────────────────────────────

export default function AdminCRM() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // ── Telephone PIN Verify ──────────────────────────────────────────────────
  const [pinInput, setPinInput] = useState('');
  const [pinVerifyResult, setPinVerifyResult] = useState<{
    user: {
      id: number; name: string; email: string; plan_name: string | null;
      plan_slug: string | null; customer_number: string | null;
    };
    expiresAt: string; secondsRemaining: number;
  } | null>(null);
  const [pinVerifyLoading, setPinVerifyLoading] = useState(false);
  const [pinVerifyError, setPinVerifyError] = useState('');
  const [showPinLookup, setShowPinLookup] = useState(false);

  const doPinVerify = async () => {
    const cleaned = pinInput.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) { setPinVerifyError('Please enter the full 6-digit PIN.'); return; }
    setPinVerifyLoading(true); setPinVerifyError(''); setPinVerifyResult(null);
    try {
      const res = await fetch('/api/admin/support-pin-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ pin: cleaned }),
      });
      const d = await res.json();
      if (d.success) { setPinVerifyResult(d); } else { setPinVerifyError(d.error || 'PIN not recognised.'); }
    } catch { setPinVerifyError('Network error — please try again.'); }
    setPinVerifyLoading(false);
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ search, plan: planFilter, status: statusFilter, consent: consentFilter, page: String(page), limit: String(LIMIT) });
    fetch(`/api/admin/crm/users?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setUsers(d.data); setTotal(d.total); } })
      .finally(() => setLoading(false));
  }, [search, planFilter, statusFilter, consentFilter, page]);

  useEffect(() => { load(); }, [load]);

  if (selectedUser !== null) {
    return <UserDetail userId={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Customer CRM — Admin</title>
        <meta name="description" content="Admin CRM: manage customers, consent, billing and data requests." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/crm" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer CRM</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            All customers — plan, billing, consent, data requests. Login via JA Group Services ID.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => { setShowPinLookup(p => !p); setPinVerifyResult(null); setPinVerifyError(''); setPinInput(''); }}
            className={`border-border gap-1.5 ${showPinLookup ? 'bg-primary/10 border-primary/40 text-primary' : ''}`}
          >
            <Phone className="w-3.5 h-3.5" /> PIN Verify
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Telephone PIN Verify panel */}
      {showPinLookup && (
        <div className="mb-6 p-5 rounded-2xl bg-card border border-primary/20 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Telephone Support — PIN Verification</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Ask the caller to read out their 6-digit Support PIN from Dashboard → Settings. Enter it below to confirm which account they belong to.</p>
          <div className="flex gap-2">
            <input
              type="text" inputMode="numeric" maxLength={6} value={pinInput}
              onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPinInput(v); setPinVerifyResult(null); setPinVerifyError(''); }}
              onKeyDown={e => e.key === 'Enter' && doPinVerify()}
              placeholder="Enter 6-digit PIN…"
              className="w-44 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono tracking-[0.25em] placeholder:text-muted-foreground placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button onClick={doPinVerify} disabled={pinVerifyLoading || pinInput.replace(/\D/g, '').length !== 6} className="bg-primary gap-2 px-5">
              {pinVerifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Verify Caller
            </Button>
          </div>
          {pinVerifyError && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {pinVerifyError}
            </div>
          )}
          {pinVerifyResult && (
            <div className="mt-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-500 mb-0.5">Identity Verified</p>
                    <p className="text-base font-bold text-foreground">{pinVerifyResult.user.name || '(no name)'}</p>
                    <p className="text-sm text-muted-foreground">{pinVerifyResult.user.email}</p>
                    {pinVerifyResult.user.customer_number && (
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        UCN {pinVerifyResult.user.customer_number}
                      </p>
                    )}
                    {pinVerifyResult.user.plan_name && <p className="text-xs text-muted-foreground mt-0.5">Plan: {pinVerifyResult.user.plan_name}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">PIN valid for</p>
                  <p className="text-lg font-bold text-foreground font-mono">{Math.floor(pinVerifyResult.secondsRemaining / 60)}m {pinVerifyResult.secondsRemaining % 60}s</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-green-500/20 flex items-center justify-between">
                <p className="text-xs text-green-500/80">✓ This caller's identity is confirmed. You may now discuss their account.</p>
                <button onClick={() => setSelectedUser(pinVerifyResult.user.id)} className="text-xs text-primary hover:underline">Open full profile →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
        <Lock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-400/90 leading-relaxed">
          <strong>Data Protection Notice:</strong> Customer data displayed here is confidential and subject to UK GDPR. Access is logged. Only use this data for legitimate business purposes. Do not export, share, or process beyond what is necessary for your role.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 bg-background border-border" />
        </div>
        <Select value={planFilter} onValueChange={v => { setPlanFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="All plans" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="lifetime">Lifetime</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="lifetime">Lifetime</SelectItem>
          </SelectContent>
        </Select>
        <Select value={consentFilter} onValueChange={v => { setConsentFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="All consent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All consent</SelectItem>
            <SelectItem value="marketing_yes">Marketing: Yes</SelectItem>
            <SelectItem value="marketing_no">Marketing: No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <p className="text-xs text-muted-foreground mb-4">Showing {users.length} of {total} customers</p>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No customers found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <Card key={user.id} className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer" onClick={() => setSelectedUser(user.id)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{user.name}</p>
                      {user.is_paused ? (
                        <Badge className="text-xs border-0 bg-orange-500/10 text-orange-400">Paused</Badge>
                      ) : user.lifetime_access ? (
                        <Badge className="text-xs border-0 bg-blue-500/10 text-blue-400">Lifetime</Badge>
                      ) : null}
                      {user.pending_requests > 0 && (
                        <Badge className="text-xs border-0 bg-red-500/10 text-red-400">
                          {user.pending_requests} request{user.pending_requests > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.customer_number && (
                      <p className="text-xs text-muted-foreground font-mono">
                        UCN {user.customer_number}
                      </p>
                    )}
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className={`text-xs font-medium ${user.plan_name ? 'text-foreground' : 'text-muted-foreground italic'}`}>{user.plan_name ?? 'No plan'}</p>
                    <p className="text-xs text-muted-foreground">{user.profile_count} profile{user.profile_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="hidden lg:flex items-center gap-1" title="Marketing consent">
                    <ConsentDot value={user.marketing_consent} />
                  </div>
                  <div className="hidden lg:block text-right">
                    <p className="text-xs text-muted-foreground">{fmtDate(user.created_at)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button variant="outline" size="sm" className="border-border" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / LIMIT)}</span>
          <Button variant="outline" size="sm" className="border-border" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
