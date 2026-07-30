/**
 * Admin — Customer CRM Record (redesigned)
 * /admin/users/:userId
 *
 * Sidebar (identity + quick actions) + scrollable content sections.
 * No more 11-tab overflow — sections are always visible, logically grouped.
 */
import { useState, useEffect, useRef } from 'react';
import { fmtDate as _fmtDate, fmtDateTime as _fmtDt } from '@/lib/date';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  ArrowLeft, User, CreditCard, Building2,
  Globe, Mail, Send,
  Infinity, Crown, PauseCircle, ExternalLink, ScrollText,
  AlertTriangle, Link2, FileText, Flag, CheckCircle, XCircle,
  Lock, RefreshCw, Trash2, Plus, ChevronDown, ChevronUp,
  Activity, Key, Layers, ShieldAlert, Shield,
  ClipboardList, HeartHandshake, BadgeCheck, Ban,
  Zap, Calendar, UserX, UserCheck, Eye, Loader2,
  AlertCircle, MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PinChallenge from '@/components/admin/PinChallenge';
import LifetimeAccessPanel from '@/components/admin/LifetimeAccessPanel';

/* ─── Admin Trial & Plan Controls ─────────────────────────────────────────── */
function AdminTrialControls({ userId, onRefresh }: { userId: number; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [extendDays, setExtendDays] = useState('7');
  const [reason, setReason] = useState('');
  const [plans, setPlans] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  type PendingAction =
    | { type: 'assign_plan'; planId: string };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    fetch('/api/plans?include_lifetime=1', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.plans ?? []); })
      .catch(() => {});
  }, []);

  const call = async (path: string, body: object) => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { setMsg('Done.'); onRefresh(); } else setErr(d.error || 'Action failed');
    } catch { setErr('Network error'); }
    finally { setBusy(false); }
  };

  const patch = async (path: string, body: object) => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await fetch(path, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { setMsg('Done.'); onRefresh(); } else setErr(d.error || 'Action failed');
    } catch { setErr('Network error'); }
    finally { setBusy(false); }
  };

  const executeHighRisk = async (token: string) => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setBusy(true); setMsg(''); setErr('');
    try {
      if (action.type === 'assign_plan') {
        const r = await fetch(`/api/admin/users/${userId}/assign-plan`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'assign_plan' },
          body: JSON.stringify({ plan_id: Number(action.planId), reason }),
        });
        const d = await r.json();
        if (d.success) { setMsg('Plan assigned.'); onRefresh(); } else setErr(d.error || 'Action failed');
      }
    } catch { setErr('Network error'); }
    finally { setBusy(false); }
  };

  const challengeAction = 'assign_plan';
  const challengeLabel = pendingAction?.type === 'assign_plan' ? 'assign a new plan to this user' : '';

  return (
    <>
      <PinChallenge open={pendingAction !== null} action={challengeAction} actionLabel={challengeLabel}
        onSuccess={executeHighRisk} onCancel={() => setPendingAction(null)} />

      <div className="space-y-4">
        {msg && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</p>}
        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Reason (optional — logged in audit)</label>
          <Input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Customer request, admin correction…" className="text-xs h-8" />
        </div>

        {/* Trial */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trial</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={365} value={extendDays} onChange={e => setExtendDays(e.target.value)} className="w-20 text-xs h-8" />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => call(`/api/admin/users/${userId}/trial/extend`, { days: Number(extendDays), reason })}
              className="text-xs h-8 gap-1.5 border-blue-500/30 text-blue-400">
              <Calendar className="w-3.5 h-3.5" /> Extend trial
            </Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => call(`/api/admin/users/${userId}/trial/end`, { reason })}
              className="text-xs h-8 gap-1.5 border-orange-500/30 text-orange-400">
              <Zap className="w-3.5 h-3.5" /> End trial now
            </Button>
          </div>
        </div>

        {/* Plan */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => call(`/api/admin/users/${userId}/move-to-free`, { reason })}
              className="text-xs h-8 gap-1.5 border-green-500/30 text-green-400">
              <UserCheck className="w-3.5 h-3.5" /> Move to Free
            </Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => call(`/api/admin/users/${userId}/move-to-no-plan`, { reason })}
              className="text-xs h-8 gap-1.5 border-muted text-muted-foreground">
              <UserX className="w-3.5 h-3.5" /> Move to No Plan
            </Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => call(`/api/admin/users/${userId}/remove-plan`, { reason })}
              className="text-xs h-8 gap-1.5 border-red-500/30 text-red-400">
              <Ban className="w-3.5 h-3.5" /> Remove plan
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-44 text-xs h-8"><SelectValue placeholder="Select a plan…" /></SelectTrigger>
              <SelectContent>{plans.map(p => <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={busy || !selectedPlanId}
              onClick={() => setPendingAction({ type: 'assign_plan', planId: selectedPlanId })}
              className="text-xs h-8 gap-1.5 border-primary/30 text-primary">
              <Key className="w-3.5 h-3.5" /> Assign plan
            </Button>
          </div>
        </div>

        {/* Account status override */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account status override</p>
          <div className="flex items-center gap-2 flex-wrap">
            {(['trial_active', 'plan_selection', 'no_plan', 'free', 'paid_active', 'suspended'] as const).map(s => (
              <Button key={s} size="sm" variant="outline" disabled={busy}
                onClick={() => patch(`/api/admin/users/${userId}/account-status`, { status: s, reason })}
                className="text-xs h-7 px-2.5 border-border text-muted-foreground">
                {s.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Lifetime access */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lifetime access</p>
          <p className="text-xs text-muted-foreground">Manage lifetime access from the dedicated Lifetime Access section below.</p>
        </div>
      </div>
    </>
  );
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface CrmUser {
  id: number; email: string; name: string; role: string; phone?: string;
  plan_id: number | null; plan_name: string | null; plan_slug: string | null;
  max_seats: number | null; has_messaging: number | null;
  price_monthly: number | null; max_profiles: number | null; max_links: number | null;
  lifetime_access: number; created_at: string; last_login_at?: string;
  is_paused: number; pause_reason: string | null;
  subscription_status: string | null; billing_interval: string | null;
  current_period_end: string | null; current_period_start?: string | null;
  stripe_customer_id?: string | null; stripe_subscription_id?: string | null;
  is_suspended?: number;
  // Lifetime access metadata
  lifetime_granted_at?: string | null;
  lifetime_granted_by?: string | null;
  lifetime_reason_category?: string | null;
  lifetime_internal_note?: string | null;
  lifetime_review_date?: string | null;
  lifetime_customer_note?: string | null;
  lifetime_can_be_withdrawn?: number;
}
interface Profile {
  id: number; username: string; display_name: string; profile_type: string;
  is_published: number; biz_slug: string | null; person_slug: string | null;
  business_name?: string | null; created_at: string; updated_at?: string;
}
interface Feature {
  id: number; name: string; slug: string; category: string; description?: string;
  effective_access: string; override_access?: string | null;
  override_by?: string | null; override_at?: string | null;
  plan_access?: string | null;
}
interface Enquiry {
  id: number; sender_name?: string; sender_email?: string; message: string;
  created_at: string; profile_name?: string;
}
interface SupportRequest {
  id: number; subject: string; category?: string; status: string;
  created_at: string; updated_at?: string;
}
interface IssueReport {
  id: number; title?: string; description?: string; category?: string;
  status: string; priority?: string; created_at: string; updated_at?: string;
}
interface VisitorReport {
  id: number; category: string; details?: string;
  reporter_name?: string; reporter_email?: string;
  status: string; admin_notes?: string; action_taken?: string; outcome?: string;
  assigned_to?: string; created_at: string; updated_at?: string;
  profile_name?: string;
}
interface Complaint {
  id: number; reference?: string; category?: string; status: string;
  summary: string; handler_name?: string; escalation_status?: string;
  resolution_date?: string; created_at: string; updated_at?: string;
}
interface DataRequest {
  id: number; request_type: string; description?: string;
  status: string; created_at: string; updated_at?: string; completed_at?: string;
}
interface Subscription {
  id: number; plan_name?: string; status: string; billing_interval?: string;
  started_at: string; cancelled_at?: string; current_period_end?: string;
  stripe_subscription_id?: string;
}
interface AdminNote {
  id: number; admin_name?: string; note: string; created_at: string;
}
interface AuditEntry {
  id?: number; action: string; resource_type?: string; details?: string;
  created_at: string; result?: string; actor_type?: string; actor_id?: number;
}
interface ConsentRecord {
  terms_consent?: number; terms_consent_at?: string;
  privacy_consent?: number; privacy_consent_at?: string;
  marketing_consent?: number; marketing_consent_at?: string;
  updates_consent?: number; updates_consent_at?: string;
  data_improve_consent?: number; data_improve_consent_at?: string;
  crm_consent?: number; crm_consent_at?: string;
  consent_ip?: string; consent_version?: string;
}
interface SupportPin { pin: string; issued_at: string; expires_at: string; }

interface CrmData {
  user: CrmUser; profiles: Profile[]; linkCount: number;
  subscriptions: Subscription[]; subscriptionHistory: Subscription[];
  supportRequests: SupportRequest[]; dataRequests: DataRequest[];
  adminNotes: AdminNote[]; auditEntries: AuditEntry[];
  enquiryCount: number; enquiries: Enquiry[];
  supportPin: SupportPin | null; featureOverrides: Feature[]; allFeatures: Feature[];
  issueReports: IssueReport[]; complaints: Complaint[];
  consent: ConsentRecord; visitorReports: VisitorReport[];
  directMessages?: unknown[];
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function fmt(d?: string | null) { return _fmtDate(d); }
function fmtDt(d?: string | null) { return _fmtDt(d); }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    included: 'bg-green-500/10 text-green-400 border-green-500/20',
    open: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    pending: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    under_review: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    trialing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    past_due: 'bg-red-500/10 text-red-400 border-red-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
    cancelled: 'bg-muted text-muted-foreground',
    closed: 'bg-muted text-muted-foreground',
    resolved: 'bg-muted text-muted-foreground',
    coming_soon: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    escalated: 'bg-red-500/10 text-red-400 border-red-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    lifetime: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  const key = status?.toLowerCase().replace(/\s+/g, '_') ?? '';
  return <Badge className={`text-xs capitalize ${map[key] ?? 'bg-muted text-muted-foreground'}`}>{status?.replace(/_/g, ' ') ?? '—'}</Badge>;
}

function SubBadge({ status, lifetime }: { status: string | null; lifetime: number }) {
  if (lifetime) return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1 text-xs"><Infinity className="w-3 h-3" /> Lifetime</Badge>;
  if (!status) return <Badge className="bg-muted text-muted-foreground border-0 text-xs">Free</Badge>;
  return <StatusBadge status={status} />;
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-25" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, count, id }: {
  title: string; icon: React.ElementType; children: React.ReactNode; count?: number; id?: string;
}) {
  return (
    <Card id={id} className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
          <span>{title}</span>
          {count !== undefined && <Badge className="ml-auto bg-muted text-muted-foreground border-0 text-xs">{count}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground flex-shrink-0 w-36">{label}</span>
      <span className={`text-xs text-right break-all ${mono ? 'font-mono' : ''} text-foreground`}>{value || '—'}</span>
    </div>
  );
}

function ConsentRow({ label, value, date }: { label: string; value?: number | null; date?: string | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {value ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{date ? fmt(date) : '—'}</span>
      </div>
    </div>
  );
}

type SectionId = 'account' | 'billing' | 'profiles' | 'features' | 'enquiries' | 'support' | 'reports' | 'consent' | 'complaints' | 'notes' | 'audit' | 'messages' | 'sar';

const NAV_ITEMS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'account',    label: 'Account',       icon: User },
  { id: 'billing',    label: 'Billing',        icon: CreditCard },
  { id: 'profiles',   label: 'Profiles',       icon: Globe },
  { id: 'features',   label: 'Features',       icon: Layers },
  { id: 'enquiries',  label: 'Enquiries',      icon: Mail },
  { id: 'messages',   label: 'Messages',       icon: MessageSquare },
  { id: 'support',    label: 'Support',        icon: ClipboardList },
  { id: 'reports',    label: 'Reports',        icon: Flag },
  { id: 'consent',    label: 'Consent',        icon: BadgeCheck },
  { id: 'complaints', label: 'Complaints',     icon: HeartHandshake },
  { id: 'notes',      label: 'Notes',          icon: FileText },
  { id: 'audit',      label: 'Audit log',      icon: ScrollText },
  { id: 'sar',        label: 'SAR / Export',   icon: Key },
];

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CrmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('account');
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [auditFilter, setAuditFilter] = useState('');
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const [blockLoading, setBlockLoading] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');
  const [sarLoading, setSarLoading] = useState(false);
  const [sarPinPending, setSarPinPending] = useState<'view' | 'export' | null>(null);
  const [sarData, setSarData] = useState<Record<string, unknown> | null>(null);

  const handleBlock = async (block: boolean) => {
    if (!userId) return;
    setBlockLoading(true); setBlockMsg('');
    try {
      const r = await fetch(`/api/admin/users/${userId}/${block ? 'block' : 'unblock'}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin action', hide_profiles: block }),
      });
      const d = await r.json();
      if (d.success) { setBlockMsg(block ? 'Account blocked.' : 'Account unblocked.'); load(); }
      else setBlockMsg(d.error || 'Action failed');
    } catch { setBlockMsg('Network error'); }
    finally { setBlockLoading(false); }
  };

  const handleSarAction = async (token: string) => {
    if (!userId || !sarPinPending) return;
    const action = sarPinPending;
    setSarPinPending(null);
    setSarLoading(true);
    try {
      if (action === 'view') {
        const r = await fetch(`/api/admin/sar/${userId}/data`, {
          credentials: 'include',
          headers: { 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'sar_view' },
        });
        const d = await r.json();
        if (d.success) setSarData(d.data);
      } else {
        const r = await fetch(`/api/admin/sar/${userId}/pdf`, {
          credentials: 'include',
          headers: { 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'sar_export' },
        });
        if (r.ok) {
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `sar-${userId}.pdf`; a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch { /* silent */ }
    finally { setSarLoading(false); }
  };

  const load = () => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/admin/crm/users/${userId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data);
        else setError(d.error || 'Failed to load customer record');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !userId) return;
    setAddingNote(true);
    try {
      const r = await fetch(`/api/admin/crm/users/${userId}/notes`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      const d = await r.json();
      if (d.success) { setNoteText(''); load(); }
    } finally { setAddingNote(false); }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!userId) return;
    setDeletingNoteId(noteId);
    try {
      await fetch(`/api/admin/crm/users/${userId}/notes/${noteId}`, { method: 'DELETE', credentials: 'include' });
      load();
    } finally { setDeletingNoteId(null); }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto pb-20 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <Skeleton className="h-96 rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="max-w-6xl mx-auto pb-20 text-center py-20">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-destructive opacity-60" />
      <p className="text-destructive">{error || 'Customer record not found'}</p>
      <Button variant="outline" className="mt-4 border-border" onClick={() => navigate('/admin/crm')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to CRM
      </Button>
    </div>
  );

  const {
    user, profiles, linkCount, subscriptions, subscriptionHistory,
    supportRequests, dataRequests, adminNotes, auditEntries,
    enquiries, supportPin, allFeatures, featureOverrides,
    issueReports, complaints, consent, visitorReports,
  } = data;

  const publishedProfiles = profiles.filter(p => p.is_published);
  const activeFeatures = allFeatures.filter(f => f.effective_access === 'included' || f.effective_access === 'override_granted');
  const filteredAudit = auditFilter
    ? auditEntries.filter(e =>
        e.action?.toLowerCase().includes(auditFilter.toLowerCase()) ||
        e.resource_type?.toLowerCase().includes(auditFilter.toLowerCase()) ||
        e.details?.toLowerCase().includes(auditFilter.toLowerCase()))
    : auditEntries;

  const initials = (user.name || user.email || 'U').split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();

  const warnings: string[] = [];
  if (user.is_paused) warnings.push('Account is paused');
  if (user.subscription_status === 'past_due') warnings.push('Subscription past due');
  if (visitorReports?.filter(r => r.status === 'new' || r.status === 'action_required').length > 0)
    warnings.push(`${visitorReports.filter(r => r.status === 'new' || r.status === 'action_required').length} unresolved visitor report(s)`);
  if (complaints?.filter(c => c.status === 'open' || c.status === 'escalated').length > 0)
    warnings.push(`${complaints.filter(c => c.status === 'open' || c.status === 'escalated').length} open complaint(s)`);
  if (supportRequests?.filter(s => s.status === 'open').length > 0)
    warnings.push(`${supportRequests.filter(s => s.status === 'open').length} open support ticket(s)`);

  const counts: Partial<Record<SectionId, number>> = {
    profiles:   profiles.length,
    enquiries:  enquiries.length,
    messages:   (data.directMessages as unknown[])?.length ?? 0,
    support:    supportRequests.length + issueReports.length,
    reports:    visitorReports?.length ?? 0,
    complaints: complaints?.length ?? 0,
    notes:      adminNotes.length,
    audit:      auditEntries.length,
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 lg:pb-4">
      <Helmet>
        <title>{`CRM: ${user.name || user.email} — Admin`}</title>
        <meta name="description" content="Admin-only customer CRM record." />
        <link rel="canonical" href={`https://japrofilestudio.jagroupservices.co.uk/admin/users/${userId}`} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <h1 className="sr-only">{`CRM: ${user.name || user.email}`}</h1>

      <PinChallenge
        open={sarPinPending !== null}
        action={sarPinPending === 'export' ? 'sar_export' : 'sar_view'}
        actionLabel={sarPinPending === 'export' ? 'export SAR PDF for this user' : 'view SAR data for this user'}
        onSuccess={handleSarAction}
        onCancel={() => setSarPinPending(null)}
      />

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground px-2" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="w-4 h-4" /> Users
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground font-medium truncate">{user.name || user.email}</span>
        {user.lifetime_access ? <Crown className="w-4 h-4 text-blue-400 flex-shrink-0" /> : null}
        {user.is_paused ? <PauseCircle className="w-4 h-4 text-orange-400 flex-shrink-0" /> : null}
        {user.is_suspended ? <Ban className="w-4 h-4 text-red-400 flex-shrink-0" /> : null}
        <Badge className="ml-auto bg-muted text-muted-foreground border-0 text-xs font-mono flex-shrink-0">#{user.id}</Badge>
      </div>

      {/* ── Warnings ── */}
      {warnings.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {warnings.map((w, i) => <p key={i} className="text-xs text-orange-400 font-medium">{w}</p>)}
          </div>
        </div>
      )}

      {/* ── Main layout: sidebar + content ── */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-start">

        {/* ── LEFT SIDEBAR ── */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {/* Identity card */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center gap-2 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary">
                  {initials}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{user.name || '—'}</p>
                  <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                  {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {user.role === 'admin' ? (
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs gap-1">
                      <Shield className="w-2.5 h-2.5" /> Admin
                    </Badge>
                  ) : (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs capitalize">{user.role}</Badge>
                  )}
                  <SubBadge status={user.subscription_status} lifetime={user.lifetime_access} />
                  {user.is_paused && <Badge className="bg-orange-500/10 text-orange-400 border-0 text-xs gap-1"><PauseCircle className="w-3 h-3" /> Paused</Badge>}
                  {user.is_suspended && <Badge className="bg-red-500/10 text-red-400 border-0 text-xs gap-1"><Ban className="w-3 h-3" /> Suspended</Badge>}
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Profiles', value: profiles.length, icon: Globe },
                  { label: 'Links', value: linkCount, icon: Link2 },
                  { label: 'Enquiries', value: data.enquiryCount, icon: Mail },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-base font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Key dates */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="text-foreground">{fmt(user.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last login</span>
                  <span className="text-foreground">{user.last_login_at ? fmt(user.last_login_at) : 'Never'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="text-foreground">{user.plan_name || 'No plan'}</span>
                </div>
              </div>

              {/* Support PIN */}
              {supportPin && (
                <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Support PIN</p>
                  <p className="text-xl font-mono font-bold text-primary tracking-widest">{supportPin.pin}</p>
                  <p className="text-xs text-green-400 mt-1">Active · expires {fmt(supportPin.expires_at)}</p>
                </div>
              )}

              {/* Quick actions */}
              <div className="mt-4 space-y-1.5">
                <a href={`/admin/compose-email?to=${encodeURIComponent(user.email)}`}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-xs text-foreground">
                  <Send className="w-3.5 h-3.5 text-primary" /> Compose email
                </a>
                {publishedProfiles.length > 0 && (
                  <a href={`/profile/${publishedProfiles[0].username}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-xs text-foreground">
                    <ExternalLink className="w-3.5 h-3.5 text-primary" /> View live profile
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section nav */}
          <Card className="bg-card border-border">
            <CardContent className="p-2">
              <nav className="space-y-0.5">
                {NAV_ITEMS.map(item => {
                  const count = counts[item.id];
                  const hasAlert = (item.id === 'reports' && (visitorReports?.filter(r => r.status === 'new').length ?? 0) > 0) ||
                    (item.id === 'complaints' && (complaints?.filter(c => c.status === 'open' || c.status === 'escalated').length ?? 0) > 0) ||
                    (item.id === 'support' && (supportRequests?.filter(s => s.status === 'open').length ?? 0) > 0);
                  return (
                    <button key={item.id} onClick={() => setActiveSection(item.id)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                        activeSection === item.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}>
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count !== undefined && count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${hasAlert ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT CONTENT ── */}
        <div className="space-y-4 min-w-0">

          {/* ══ ACCOUNT ══ */}
          {activeSection === 'account' && (
            <div className="space-y-4">
              <SectionCard title="Account Details" icon={User}>
                <Row label="Full name" value={user.name || '—'} />
                <Row label="Email" value={user.email} />
                <Row label="Phone" value={user.phone || 'Not provided'} />
                {user.user_number && (
                  <Row
                    label="JA Profile Studio User Number"
                    value={String(user.user_number).replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}
                    mono
                  />
                )}
                <Row label="Internal Account ID" value={`#${user.id}`} mono />
                <Row label="Role" value={user.role === 'admin' ? 'Admin (can also be a customer)' : user.role} />
                <Row label="Date joined" value={fmt(user.created_at)} />
                <Row label="Last login" value={user.last_login_at ? fmtDt(user.last_login_at) : 'Not recorded'} />
                <Row label="Account status" value={user.is_paused ? 'Paused' : user.is_suspended ? 'Suspended' : 'Active'} />
                {user.pause_reason && <Row label="Pause reason" value={user.pause_reason} />}
              </SectionCard>

              <SectionCard title="Plan & Subscription" icon={CreditCard}>
                <Row label="Current plan" value={user.plan_name ?? 'No plan assigned'} />
                <Row label="Plan slug" value={user.plan_slug ?? '—'} mono />
                <Row label="Subscription status" value={user.subscription_status ?? 'None'} />
                <Row label="Billing interval" value={user.billing_interval ? `${user.billing_interval}ly` : '—'} />
                <Row label="Period end" value={fmt(user.current_period_end)} />
                <Row label="Lifetime access" value={user.lifetime_access ? 'Yes' : 'No'} />
                <Row label="Max profiles" value={user.max_profiles === 999 ? 'Unlimited' : String(user.max_profiles ?? '—')} />
                <Row label="Max links" value={user.max_links === 999 ? 'Unlimited' : String(user.max_links ?? '—')} />
                <Row label="Team seats" value={user.max_seats === 999 ? 'Unlimited' : String(user.max_seats ?? 1)} />
                {user.stripe_customer_id && <Row label="Stripe customer" value={user.stripe_customer_id} mono />}
              </SectionCard>

              {/* Block / Unblock — available for all users including admins */}
              <Card className="bg-card border-border">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ban className="w-4 h-4 text-destructive flex-shrink-0" /> Account Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {blockMsg && (
                      <p className={`text-xs px-3 py-2 rounded-lg border ${blockMsg.includes('error') || blockMsg.includes('failed') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                        {blockMsg}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Blocking suspends the account and hides all profiles. The user will not be able to log in.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {user.is_suspended ? (
                        <Button size="sm" variant="outline" disabled={blockLoading}
                          onClick={() => handleBlock(false)}
                          className="gap-1.5 text-xs border-green-500/30 text-green-400">
                          <UserCheck className="w-3.5 h-3.5" /> Unblock account
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={blockLoading}
                          onClick={() => { if (confirm(`Block ${user.name || user.email}? This will hide all their profiles.`)) handleBlock(true); }}
                          className="gap-1.5 text-xs border-red-500/30 text-red-400">
                          <Ban className="w-3.5 h-3.5" /> Block account
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
            </div>
          )}

          {/* ══ BILLING ══ */}
          {activeSection === 'billing' && (
            <div className="space-y-4">
              <SectionCard title="Current Subscription" icon={CreditCard}>
                <Row label="Plan" value={user.plan_name ?? 'No plan'} />
                <Row label="Status" value={user.subscription_status ?? 'None'} />
                <Row label="Billing" value={user.billing_interval ? `${user.billing_interval}ly` : '—'} />
                <Row label="Period start" value={fmt(user.current_period_start)} />
                <Row label="Period end" value={fmt(user.current_period_end)} />
                <Row label="Lifetime access" value={user.lifetime_access ? 'Yes' : 'No'} />
                {user.stripe_customer_id && <Row label="Stripe customer ID" value={user.stripe_customer_id} mono />}
                {user.stripe_subscription_id && <Row label="Stripe subscription ID" value={user.stripe_subscription_id} mono />}
              </SectionCard>

              <SectionCard title="Trial & Plan Management" icon={Zap}>
                <AdminTrialControls userId={user.id} onRefresh={load} />
              </SectionCard>

              <SectionCard title="Lifetime Access" icon={Infinity}>
                <LifetimeAccessPanel userId={user.id} user={user} onRefresh={load} />
              </SectionCard>

              <SectionCard title="Subscription History" icon={Activity} count={(subscriptionHistory ?? subscriptions).length}>
                {(subscriptionHistory ?? subscriptions).length === 0 ? (
                  <EmptyState icon={Activity} label="No subscription history" />
                ) : (subscriptionHistory ?? subscriptions).map((s: Subscription) => (
                  <div key={s.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-foreground">{s.plan_name ?? 'Unknown plan'}</p>
                      <p className="text-xs text-muted-foreground">
                        Started: {fmt(s.started_at)}
                        {s.cancelled_at ? ` · Cancelled: ${fmt(s.cancelled_at)}` : ''}
                        {s.billing_interval ? ` · ${s.billing_interval}ly` : ''}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ══ PROFILES ══ */}
          {activeSection === 'profiles' && (
            <div className="space-y-3">
              {profiles.length === 0 ? (
                <Card className="bg-card border-border"><CardContent className="p-6"><EmptyState icon={Globe} label="No profiles created yet" /></CardContent></Card>
              ) : profiles.map(p => {
                const slug = p.profile_type === 'business' && p.biz_slug ? p.biz_slug : p.username;
                const url = `/profile/${slug}`;
                return (
                  <Card key={p.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {p.profile_type === 'business' ? <Building2 className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-foreground">{p.display_name || p.username}</p>
                            <StatusBadge status={p.is_published ? 'published' : 'draft'} />
                            <Badge className="text-xs border-0 bg-muted text-muted-foreground capitalize">{p.profile_type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{url}</p>
                          <p className="text-xs text-muted-foreground">Created: {fmt(p.created_at)}{p.updated_at ? ` · Updated: ${fmt(p.updated_at)}` : ''}</p>
                        </div>
                        {p.is_published ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <Link to={`/admin/profile-preview/${p.id}`} target="_blank" rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0">
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ══ FEATURES ══ */}
          {activeSection === 'features' && (
            <div className="space-y-4">
              <SectionCard title="Active Features" icon={CheckCircle} count={activeFeatures.length}>
                {activeFeatures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No features currently active.</p>
                ) : activeFeatures.map((f: Feature) => (
                  <div key={f.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{f.category}</p>
                      {f.override_access && <p className="text-xs text-blue-400">Override by {f.override_by || 'admin'} · {fmt(f.override_at)}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={f.effective_access} />
                      {f.override_access && <Badge className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">Override</Badge>}
                    </div>
                  </div>
                ))}
              </SectionCard>

              {featureOverrides.length > 0 && (
                <SectionCard title="Admin Feature Overrides" icon={ShieldAlert} count={featureOverrides.length}>
                  {featureOverrides.map((f: Feature) => (
                    <div key={f.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-foreground">{f.name}</p>
                        <p className="text-xs text-muted-foreground">Set by {f.override_by || 'admin'} · {fmt(f.override_at)}</p>
                      </div>
                      <StatusBadge status={f.override_access ?? f.effective_access} />
                    </div>
                  ))}
                </SectionCard>
              )}

              <Card className="bg-card border-border">
                <CardHeader className="pb-3 pt-4 px-4">
                  <button className="flex items-center justify-between w-full text-sm font-semibold text-foreground"
                    onClick={() => setShowAllFeatures(v => !v)}>
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      All Platform Features
                      <Badge className="bg-muted text-muted-foreground border-0 text-xs">{allFeatures.length}</Badge>
                    </span>
                    {showAllFeatures ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </CardHeader>
                {showAllFeatures && (
                  <CardContent className="px-4 pb-4">
                    {allFeatures.map((f: Feature) => (
                      <div key={f.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                        <div>
                          <p className="text-xs text-foreground">{f.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{f.category}</p>
                        </div>
                        <StatusBadge status={f.effective_access} />
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            </div>
          )}

          {/* ══ ENQUIRIES ══ */}
          {activeSection === 'enquiries' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
                <Send className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground mb-1">Staff-to-user communication</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    To contact this user, use Compose Email — messages are sent via the Airo email gateway and logged in the audit trail.
                  </p>
                  <a href={`/admin/compose-email?to=${encodeURIComponent(user.email)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Send className="w-3 h-3" /> Compose Email to {user.name || user.email}
                  </a>
                </div>
              </div>

              <SectionCard title="Contact Enquiries Received" icon={Mail} count={enquiries.length}>
                {enquiries.length === 0 ? (
                  <EmptyState icon={Mail} label="No enquiries received yet" />
                ) : enquiries.map((e: Enquiry) => (
                  <div key={e.id} className="py-2.5 border-b border-border/40 last:border-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-xs font-medium text-foreground">{e.sender_name || 'Anonymous'}</p>
                        {e.sender_email && <p className="text-xs text-muted-foreground">{e.sender_email}</p>}
                        {e.profile_name && <p className="text-xs text-muted-foreground">Profile: {e.profile_name}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{fmtDt(e.created_at)}</p>
                    </div>
                    <p className="text-xs text-foreground bg-muted/30 rounded p-2 line-clamp-3">{e.message}</p>
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ══ SUPPORT ══ */}
          {activeSection === 'support' && (
            <div className="space-y-4">
              <SectionCard title="Support Tickets" icon={ClipboardList} count={supportRequests.length}>
                {supportRequests.length === 0 ? (
                  <EmptyState icon={ClipboardList} label="No support tickets found" />
                ) : supportRequests.map((s: SupportRequest) => (
                  <div key={s.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{s.subject}</p>
                      {s.category && <p className="text-xs text-muted-foreground capitalize">{s.category}</p>}
                      <p className="text-xs text-muted-foreground">Opened: {fmt(s.created_at)}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </SectionCard>

              <SectionCard title="Issue Reports" icon={AlertCircle} count={issueReports.length}>
                {issueReports.length === 0 ? (
                  <EmptyState icon={AlertCircle} label="No issue reports found" />
                ) : issueReports.map((r: IssueReport) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="flex-1 min-w-0">
                      {r.title && <p className="text-xs font-medium text-foreground">{r.title}</p>}
                      {r.category && <p className="text-xs text-muted-foreground capitalize">{r.category}</p>}
                      {r.priority && <Badge className="text-xs bg-muted text-muted-foreground border-0 capitalize">{r.priority}</Badge>}
                      <p className="text-xs text-muted-foreground mt-0.5">{fmt(r.created_at)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </SectionCard>

              <SectionCard title="Privacy & Data Requests" icon={Lock} count={dataRequests.length}>
                {dataRequests.length === 0 ? (
                  <EmptyState icon={Lock} label="No data requests found" />
                ) : dataRequests.map((dr: DataRequest) => (
                  <div key={dr.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground capitalize">{dr.request_type.replace(/_/g, ' ')}</p>
                      {dr.description && <p className="text-xs text-muted-foreground line-clamp-2">{dr.description}</p>}
                      <p className="text-xs text-muted-foreground">Submitted: {fmt(dr.created_at)}</p>
                      {dr.completed_at && <p className="text-xs text-green-400">Completed: {fmt(dr.completed_at)}</p>}
                    </div>
                    <StatusBadge status={dr.status} />
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ══ REPORTS ══ */}
          {activeSection === 'reports' && (
            <SectionCard title="Visitor Reports Against This Customer" icon={Flag} count={visitorReports?.length ?? 0}>
              {!visitorReports || visitorReports.length === 0 ? (
                <EmptyState icon={Flag} label="No visitor reports found" />
              ) : visitorReports.map((vr: VisitorReport) => (
                <div key={vr.id} className="py-3 border-b border-border/40 last:border-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-foreground capitalize">{vr.category.replace(/_/g, ' ')}</p>
                        <StatusBadge status={vr.status} />
                      </div>
                      {vr.profile_name && <p className="text-xs text-muted-foreground">Profile: {vr.profile_name}</p>}
                      <p className="text-xs text-muted-foreground">{fmtDt(vr.created_at)}</p>
                    </div>
                  </div>
                  {vr.details && <p className="text-xs text-foreground bg-muted/30 rounded p-2 mb-2 line-clamp-4">{vr.details}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <p className="text-xs text-muted-foreground">Reporter: <span className="text-foreground">{vr.reporter_name || 'Anonymous'}</span></p>
                    {vr.reporter_email && <p className="text-xs text-muted-foreground">Email: <span className="text-foreground">{vr.reporter_email}</span></p>}
                    {vr.action_taken && <p className="text-xs text-muted-foreground">Action: <span className="text-foreground">{vr.action_taken}</span></p>}
                    {vr.outcome && <p className="text-xs text-muted-foreground col-span-2">Outcome: <span className="text-foreground">{vr.outcome}</span></p>}
                  </div>
                  {vr.admin_notes && <p className="text-xs text-muted-foreground mt-1 italic">Admin notes: {vr.admin_notes}</p>}
                </div>
              ))}
            </SectionCard>
          )}

          {/* ══ CONSENT ══ */}
          {activeSection === 'consent' && (
            <div className="space-y-4">
              <SectionCard title="Consent Records" icon={BadgeCheck}>
                <ConsentRow label="Terms of service" value={consent.terms_consent} date={consent.terms_consent_at} />
                <ConsentRow label="Privacy policy" value={consent.privacy_consent} date={consent.privacy_consent_at} />
                <ConsentRow label="Marketing communications" value={consent.marketing_consent} date={consent.marketing_consent_at} />
                <ConsentRow label="Product updates" value={consent.updates_consent} date={consent.updates_consent_at} />
                <ConsentRow label="Data improvement" value={consent.data_improve_consent} date={consent.data_improve_consent_at} />
                <ConsentRow label="CRM / personalisation" value={consent.crm_consent} date={consent.crm_consent_at} />
                {consent.consent_ip && <Row label="Consent IP" value={consent.consent_ip} mono />}
                {consent.consent_version && <Row label="Consent version" value={consent.consent_version} />}
              </SectionCard>
            </div>
          )}

          {/* ══ COMPLAINTS ══ */}
          {activeSection === 'complaints' && (
            <SectionCard title="Complaints" icon={HeartHandshake} count={complaints?.length ?? 0}>
              {!complaints || complaints.length === 0 ? (
                <EmptyState icon={HeartHandshake} label="No complaints on record" />
              ) : complaints.map((c: Complaint) => (
                <div key={c.id} className="py-3 border-b border-border/40 last:border-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.reference && <p className="text-xs font-mono text-muted-foreground">Ref: {c.reference}</p>}
                        {c.category && <Badge className="text-xs bg-muted text-muted-foreground border-0 capitalize">{c.category}</Badge>}
                        <StatusBadge status={c.status} />
                        {c.escalation_status && c.escalation_status !== 'none' && (
                          <Badge className="text-xs bg-red-500/10 text-red-400 border-red-500/20 capitalize">Escalated: {c.escalation_status}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Opened: {fmt(c.created_at)}</p>
                      {c.resolution_date && <p className="text-xs text-green-400">Resolved: {fmt(c.resolution_date)}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-foreground bg-muted/30 rounded p-2">{c.summary}</p>
                  {c.handler_name && <p className="text-xs text-muted-foreground mt-1">Handler: {c.handler_name}</p>}
                </div>
              ))}
            </SectionCard>
          )}

          {/* ══ NOTES ══ */}
          {activeSection === 'notes' && (
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> Add Internal Note
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <Textarea ref={noteRef} value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder="Internal note — not visible to the customer…"
                    className="text-sm resize-none bg-muted/30 border-border min-h-[80px]" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Internal only
                    </p>
                    <Button size="sm" onClick={handleAddNote} disabled={addingNote || !noteText.trim()}>
                      {addingNote ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <SectionCard title="Admin Notes" icon={FileText} count={adminNotes.length}>
                {adminNotes.length === 0 ? (
                  <EmptyState icon={FileText} label="No admin notes yet" />
                ) : adminNotes.map((n: AdminNote) => (
                  <div key={n.id} className="py-3 border-b border-border/40 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium text-foreground">{n.admin_name || 'Admin'}</p>
                          <p className="text-xs text-muted-foreground">{fmtDt(n.created_at)}</p>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{n.note}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive flex-shrink-0 h-7 w-7 p-0"
                        onClick={() => handleDeleteNote(n.id)} disabled={deletingNoteId === n.id}>
                        {deletingNoteId === n.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ══ MESSAGES ══ */}
          {activeSection === 'messages' && (
            <SectionCard title="Direct Messages (Card Enquiries)" icon={MessageSquare} count={data.directMessages?.length ?? 0}>
              {!data.directMessages || data.directMessages.length === 0 ? (
                <EmptyState icon={MessageSquare} label="No direct messages found" />
              ) : (data.directMessages as Array<{
                id: number; thread_id?: string; sender_type: string; sender_name?: string;
                sender_email?: string; message: string; created_at: string; profile_name?: string;
              }>).map(m => (
                <div key={m.id} className="py-2.5 border-b border-border/40 last:border-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-foreground">{m.sender_name || 'Anonymous'}</p>
                        <Badge className={`text-xs border-0 capitalize ${m.sender_type === 'visitor' ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}>{m.sender_type}</Badge>
                      </div>
                      {m.sender_email && <p className="text-xs text-muted-foreground">{m.sender_email}</p>}
                      {m.profile_name && <p className="text-xs text-muted-foreground">Profile: {m.profile_name}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">{fmtDt(m.created_at)}</p>
                  </div>
                  <p className="text-xs text-foreground bg-muted/30 rounded p-2 line-clamp-3">{m.message}</p>
                </div>
              ))}
            </SectionCard>
          )}

          {/* ══ SAR / EXPORT ══ */}
          {activeSection === 'sar' && (
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary flex-shrink-0" /> Subject Access Request (SAR)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <p className="text-xs text-orange-400 font-semibold mb-1">UK GDPR — Article 15</p>
                    <p className="text-xs text-muted-foreground">
                      SAR exports contain all personal data held for this user. Both actions require a PIN challenge and are logged in the audit trail.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Button size="sm" variant="outline" disabled={sarLoading}
                      onClick={() => setSarPinPending('view')}
                      className="gap-1.5 text-xs border-primary/30 text-primary">
                      <Eye className="w-3.5 h-3.5" /> View SAR data
                    </Button>
                    <Button size="sm" variant="outline" disabled={sarLoading}
                      onClick={() => setSarPinPending('export')}
                      className="gap-1.5 text-xs border-blue-500/30 text-blue-400">
                      <Key className="w-3.5 h-3.5" /> Download SAR PDF
                    </Button>
                    {sarLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>

                  {sarData && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-foreground mb-2">SAR Data Preview</p>
                      <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                        {JSON.stringify(sarData, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ══ AUDIT ══ */}
          {activeSection === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input type="text" value={auditFilter} onChange={e => setAuditFilter(e.target.value)}
                  placeholder="Filter by action, resource or detail…"
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                {auditFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setAuditFilter('')} className="text-muted-foreground">
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <SectionCard title="Audit Log" icon={ScrollText} count={filteredAudit.length}>
                {filteredAudit.length === 0 ? (
                  <EmptyState icon={ScrollText} label={auditFilter ? 'No entries match this filter' : 'No audit entries found'} />
                ) : filteredAudit.map((entry: AuditEntry, i: number) => (
                  <div key={entry.id ?? i} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      entry.result === 'success' || !entry.result ? 'bg-green-400' :
                      entry.result === 'failure' ? 'bg-red-400' : 'bg-orange-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-mono font-medium text-foreground">{entry.action}</p>
                        {entry.resource_type && <Badge className="text-xs border-0 bg-muted text-muted-foreground">{entry.resource_type}</Badge>}
                        {entry.actor_type && (
                          <Badge className={`text-xs border-0 capitalize ${
                            entry.actor_type === 'admin' ? 'bg-primary/10 text-primary' :
                            entry.actor_type === 'system' ? 'bg-muted text-muted-foreground' :
                            'bg-blue-500/10 text-blue-400'
                          }`}>{entry.actor_type}</Badge>
                        )}
                      </div>
                      {entry.details && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.details}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0 text-right">{fmtDt(entry.created_at)}</p>
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
