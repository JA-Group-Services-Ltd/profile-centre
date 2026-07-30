/**
 * Admin — Reports & Moderation
 * View and manage platform issue reports and profile reports.
 * Profile reports show profile type (personal/business), reported URL,
 * profile owner details, auto-scan results, and suspend/hide actions.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  AlertTriangle, CheckCircle, Clock, RefreshCw, Search, ChevronDown, ChevronUp,
  ExternalLink, Archive, Trash2, User, Building2, ShieldAlert, ShieldOff,
  EyeOff, Eye, Flag, ScanLine, RotateCcw, ShieldCheck, ShieldX,
  AlertCircle, Info, Zap, FileText, MessageSquare,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface IssueReport {
  id: number;
  name: string;
  email: string;
  issue_type: string;
  subject: string | null;
  description: string;
  page_url: string | null;
  status: 'new' | 'open' | 'reviewing' | 'in_progress' | 'action_taken' | 'resolved' | 'dismissed' | 'closed';
  admin_notes: string | null;
  reported_user_id?: number | null;
  reported_profile_id?: number | null;
  report_reason?: string | null;
  ip_address?: string | null;
  reporter_ip?: string | null;
  profile_type?: string | null;
  reported_url?: string | null;
  // Profile owner details (joined from profiles + users)
  profile_username?: string | null;
  profile_biz_slug?: string | null;
  profile_display_name?: string | null;
  profile_profile_type?: string | null;
  profile_is_suspended?: number | null;
  profile_is_hidden?: number | null;
  profile_suspension_reason?: string | null;
  profile_owner_email?: string | null;
  profile_owner_name?: string | null;
  // Auto-scan fields
  scan_status?: 'pending' | 'completed' | 'failed' | null;
  scan_risk_level?: 'low' | 'medium' | 'high' | 'critical' | null;
  scan_summary?: string | null;
  scan_completed_at?: string | null;
  scan_id?: number | null;
  scan_override_risk?: string | null;
  scan_override_by?: string | null;
  scan_reviewed?: number | null;
  scan_reviewed_by?: string | null;
  scan_internal_notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface ScanEvidence {
  field: string;
  snippet: string;
  rule: string;
}

interface ScanDetail {
  id: number;
  profile_id: number;
  risk_level: string;
  risk_score: number;
  issue_categories: string[];
  summary: string;
  evidence: ScanEvidence[];
  recommended_action: string;
  triggered_by: string;
  auto_hidden: number;
  created_at: string;
}

// ─── Risk level helpers ───────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  low:      'bg-green-500/10 text-green-400 border-green-500/20',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  failed:   'bg-muted text-muted-foreground border-border',
  dismissed:'bg-muted text-muted-foreground border-border',
};

const RISK_ICONS: Record<string, React.ReactNode> = {
  low:      <ShieldCheck className="w-3 h-3" />,
  medium:   <AlertCircle className="w-3 h-3" />,
  high:     <AlertTriangle className="w-3 h-3" />,
  critical: <ShieldX className="w-3 h-3" />,
  pending:  <ScanLine className="w-3 h-3" />,
  failed:   <AlertCircle className="w-3 h-3" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  spam_scam:          'Spam / Scam',
  impersonation:      'Impersonation',
  harassment_abuse:   'Harassment / Abuse',
  adult_unsafe:       'Adult / Unsafe',
  illegal_content:    'Illegal Content',
  misleading_claims:  'Misleading Claims',
  suspicious_links:   'Suspicious Links',
  financial_fraud:    'Financial Fraud',
  platform_tampering: 'Platform Tampering',
  hidden_content:     'Hidden Content',
};

const STATUS_COLORS: Record<string, string> = {
  new:          'bg-red-500/10 text-red-400',
  open:         'bg-red-500/10 text-red-400',
  reviewing:    'bg-blue-500/10 text-blue-400',
  in_progress:  'bg-blue-500/10 text-blue-400',
  action_taken: 'bg-orange-500/10 text-orange-400',
  resolved:     'bg-green-500/10 text-green-400',
  dismissed:    'bg-muted text-muted-foreground',
  closed:       'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  new:          'New',
  open:         'Open',
  reviewing:    'Reviewing',
  in_progress:  'In Progress',
  action_taken: 'Action Taken',
  resolved:     'Resolved',
  dismissed:    'Dismissed',
  closed:       'Closed',
};

const REASON_LABELS: Record<string, string> = {
  spam_scam:              'Spam / Scam',
  impersonation:          'Impersonation',
  harassment_abuse:       'Harassment / Abuse',
  illegal_content:        'Illegal Content',
  adult_unsafe_content:   'Adult / Unsafe Content',
  misleading_information: 'Misleading Information',
  privacy_issue:          'Privacy Issue',
  intellectual_property:  'IP Issue',
  other:                  'Other',
};

const TYPE_LABELS: Record<string, string> = {
  profile_report: 'Profile Report',
  bug:            'Bug',
  display:        'Display',
  performance:    'Performance',
  account:        'Account',
  billing:        'Billing',
  security:       'Security',
  other:          'Other',
};

export default function AdminIssueReports() {
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<IssueReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<IssueReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moderating, setModerating] = useState<number | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<IssueReport | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scan state
  const [scanDetails, setScanDetails] = useState<Record<number, ScanDetail | null>>({});
  const [scanLoading, setScanLoading] = useState<Record<number, boolean>>({});
  const [rescanning, setRescanning] = useState<Record<number, boolean>>({});
  const [scanDialog, setScanDialog] = useState<{ reportId: number; scan: ScanDetail } | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<{ scanId: number; reportId: number; current: string } | null>(null);
  const [overrideRisk, setOverrideRisk] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setLoadError(null);
    fetch('/api/admin/issue-reports', { credentials: 'include' })
      .then(async r => {
        if (r.status === 401 || r.status === 403) {
          setLoadError('Session expired or access denied. Please re-enter your admin PIN.');
          return;
        }
        const d = await r.json();
        if (d.success && Array.isArray(d.data)) {
          setReports(d.data);
        } else {
          setLoadError(d.error ?? 'Failed to load reports.');
        }
      })
      .catch(() => setLoadError('Network error — could not reach the server.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load(false);
    intervalRef.current = setInterval(() => load(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const openEdit = (r: IssueReport) => {
    setEditDialog(r);
    setEditStatus(r.status);
    setEditNotes(r.admin_notes ?? '');
    setError(null);
  };

  const saveEdit = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/issue-reports/${editDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: editStatus, admin_notes: editNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Server error ${res.status}`);
        setSaving(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setReports(prev => prev.map(r => r.id === editDialog.id
          ? { ...r, status: editStatus as IssueReport['status'], admin_notes: editNotes }
          : r
        ));
        setEditDialog(null);
      } else {
        setError(data.error ?? 'Failed to save changes.');
      }
    } catch {
      setError('Network error — could not save changes.');
    }
    setSaving(false);
  };

  const archiveReport = async (r: IssueReport) => {
    await fetch(`/api/admin/issue-reports/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'closed', admin_notes: (r.admin_notes ? r.admin_notes + '\n' : '') + '[Archived by admin]' }),
    });
    setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: 'closed' as IssueReport['status'] } : x));
  };

  const deleteReport = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await fetch(`/api/admin/issue-reports/${deleteConfirm.id}`, {
      method: 'DELETE', credentials: 'include',
    });
    setReports(prev => prev.filter(r => r.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    setDeleting(false);
  };

  const moderateProfile = async (r: IssueReport, action: 'suspend' | 'unsuspend' | 'hide' | 'unhide', reason?: string) => {
    if (!r.reported_profile_id) return;
    setModerating(r.id);
    try {
      const res = await fetch(`/api/admin/profiles/${r.reported_profile_id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason || '' }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state to reflect new profile status
        setReports(prev => prev.map(x => {
          if (x.reported_profile_id !== r.reported_profile_id) return x;
          return {
            ...x,
            profile_is_suspended: action === 'suspend' ? 1 : action === 'unsuspend' ? 0 : x.profile_is_suspended,
            profile_is_hidden:    action === 'hide'    ? 1 : action === 'unhide'    ? 0 : x.profile_is_hidden,
            profile_suspension_reason: action === 'suspend' ? (reason || '') : action === 'unsuspend' ? null : x.profile_suspension_reason,
          };
        }));
        // Auto-update report status to action_taken when suspending/hiding
        if (action === 'suspend' || action === 'hide') {
          await fetch(`/api/admin/issue-reports/${r.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'action_taken', admin_notes: (r.admin_notes ? r.admin_notes + '\n' : '') + `[Profile ${action}ed by admin]` }),
          });
          setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: 'action_taken' as IssueReport['status'] } : x));
        }
      }
    } finally {
      setModerating(null);
      setSuspendDialog(null);
      setSuspendReason('');
    }
  };

  // ── Scan functions ──────────────────────────────────────────────────────────

  const loadScanDetail = async (reportId: number) => {
    if (scanDetails[reportId] !== undefined) return;
    setScanLoading(prev => ({ ...prev, [reportId]: true }));
    try {
      const res = await fetch(`/api/admin/scans/${reportId}`, { credentials: 'include' });
      const data = await res.json();
      setScanDetails(prev => ({ ...prev, [reportId]: data.success && data.scan ? data.scan as ScanDetail : null }));
    } catch {
      setScanDetails(prev => ({ ...prev, [reportId]: null }));
    } finally {
      setScanLoading(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const rescan = async (reportId: number) => {
    setRescanning(prev => ({ ...prev, [reportId]: true }));
    try {
      const res = await fetch(`/api/admin/scans/${reportId}/rescan`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.scan) {
        setScanDetails(prev => ({ ...prev, [reportId]: data.scan as ScanDetail }));
        setReports(prev => prev.map(r => r.id === reportId
          ? { ...r, scan_risk_level: data.scan.risk_level, scan_status: 'completed', scan_summary: data.scan.summary }
          : r
        ));
      }
    } finally {
      setRescanning(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const doScanAction = async (
    action: 'override' | 'dismiss' | 'review',
    scanId: number,
    reportId: number,
    body: Record<string, string> = {},
  ) => {
    const res = await fetch(`/api/admin/scans/${scanId}/${action}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      setScanDetails(prev => ({ ...prev, [reportId]: undefined as unknown as ScanDetail }));
      await loadScanDetail(reportId);
      if (action === 'dismiss') setReports(prev => prev.map(r => r.id === reportId ? { ...r, scan_override_risk: 'dismissed', scan_reviewed: 1 } : r));
      if (action === 'review')  setReports(prev => prev.map(r => r.id === reportId ? { ...r, scan_reviewed: 1 } : r));
      if (action === 'override') setReports(prev => prev.map(r => r.id === reportId ? { ...r, scan_override_risk: body.risk_level } : r));
    }
    return data.success;
  };

  const saveOverride = async () => {
    if (!overrideDialog) return;
    setOverrideSaving(true);
    const ok = await doScanAction('override', overrideDialog.scanId, overrideDialog.reportId, {
      risk_level: overrideRisk, internal_notes: overrideNotes,
    });
    if (ok) setOverrideDialog(null);
    setOverrideSaving(false);
  };

  const effectiveRisk = (r: IssueReport): string | null => {
    if (r.scan_override_risk === 'dismissed') return 'dismissed';
    if (r.scan_override_risk) return r.scan_override_risk;
    return r.scan_risk_level ?? null;
  };

  const filtered = reports.filter(r => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.subject ?? '').toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      (r.profile_display_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.profile_owner_email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType   = typeFilter   === 'all' || r.issue_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const counts = {
    new:             reports.filter(r => r.status === 'new' || r.status === 'open').length,
    reviewing:       reports.filter(r => r.status === 'reviewing' || r.status === 'in_progress').length,
    action_taken:    reports.filter(r => r.status === 'action_taken').length,
    profile_reports: reports.filter(r => r.issue_type === 'profile_report').length,
    personal:        reports.filter(r => r.issue_type === 'profile_report' && (r.profile_type === 'personal' || r.profile_profile_type === 'personal')).length,
    business:        reports.filter(r => r.issue_type === 'profile_report' && (r.profile_type === 'business' || r.profile_profile_type === 'business')).length,
  };

  const profileTypeLabel = (r: IssueReport) => {
    const pt = r.profile_profile_type ?? r.profile_type;
    if (pt === 'business') return 'Business';
    if (pt === 'personal') return 'Personal';
    return null;
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Reports &amp; Moderation — Admin</title>
        <meta name="description" content="Review and manage platform issue reports and profile reports." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/issue-reports" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports &amp; Moderation</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {reports.length} total ·{' '}
            <span className="text-red-400">{counts.new} new</span>
            {counts.reviewing > 0 && <> · <span className="text-blue-400">{counts.reviewing} reviewing</span></>}
            {counts.action_taken > 0 && <> · <span className="text-orange-400">{counts.action_taken} action taken</span></>}
            {counts.profile_reports > 0 && (
              <> · <span className="text-muted-foreground">
                {counts.profile_reports} profile reports
                {(counts.personal > 0 || counts.business > 0) && (
                  <> ({counts.personal} personal, {counts.business} business)</>
                )}
              </span></>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || refreshing} className="border-border gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="mb-4 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-400">{loadError}</p>
          </div>
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 text-xs"
            onClick={() => load(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'New',             count: counts.new,             color: 'text-red-400',            bg: 'bg-red-500/10',    icon: AlertTriangle },
          { label: 'Reviewing',       count: counts.reviewing,       color: 'text-blue-400',           bg: 'bg-blue-500/10',   icon: Clock },
          { label: 'Action Taken',    count: counts.action_taken,    color: 'text-orange-400',         bg: 'bg-orange-500/10', icon: CheckCircle },
          { label: 'Profile Reports', count: counts.profile_reports, color: 'text-muted-foreground',   bg: 'bg-muted',         icon: Flag },
        ].map(({ label, count, color, bg, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
            className="pl-9 bg-background border-border" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="profile_report">Profile reports</SelectItem>
            <SelectItem value="bug">Bug reports</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="action_taken">Action Taken</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No reports found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(r => {
                const isProfileReport = r.issue_type === 'profile_report';
                const ptLabel = profileTypeLabel(r);
                const isSuspended = !!r.profile_is_suspended;
                const isHidden    = !!r.profile_is_hidden;

                return (
                  <div key={r.id}>
                    <div
                      className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => {
                        const next = expanded === r.id ? null : r.id;
                        setExpanded(next);
                        if (next && r.issue_type === 'profile_report') loadScanDetail(next);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex-shrink-0 mt-0.5">
                            {(r.status === 'new' || r.status === 'open') ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
                             (r.status === 'reviewing' || r.status === 'in_progress') ? <Clock className="w-4 h-4 text-blue-400" /> :
                             r.status === 'action_taken' ? <CheckCircle className="w-4 h-4 text-orange-400" /> :
                             <CheckCircle className="w-4 h-4 text-green-400" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">
                                {r.subject || r.description.slice(0, 60)}
                              </p>
                              <Badge className={`text-xs border-0 ${STATUS_COLORS[r.status] ?? 'bg-muted text-muted-foreground'}`}>
                                {STATUS_LABELS[r.status] ?? r.status}
                              </Badge>
                              <Badge className="text-xs border-0 bg-muted text-muted-foreground">
                                {TYPE_LABELS[r.issue_type] ?? r.issue_type}
                              </Badge>
                              {/* Profile type badge */}
                              {isProfileReport && ptLabel && (
                                <Badge className={`text-xs border-0 gap-1 ${ptLabel === 'Business' ? 'bg-purple-500/10 text-purple-400' : 'bg-sky-500/10 text-sky-400'}`}>
                                  {ptLabel === 'Business' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                  {ptLabel}
                                </Badge>
                              )}
                              {r.report_reason && (
                                <Badge className="text-xs border-0 bg-orange-500/10 text-orange-400">
                                  {REASON_LABELS[r.report_reason] ?? r.report_reason}
                                </Badge>
                              )}
                              {isSuspended && (
                                <Badge className="text-xs border-0 bg-red-500/10 text-red-400 gap-1">
                                  <ShieldAlert className="w-3 h-3" /> Suspended
                                </Badge>
                              )}
                              {isHidden && !isSuspended && (
                                <Badge className="text-xs border-0 bg-amber-500/10 text-amber-400 gap-1">
                                  <EyeOff className="w-3 h-3" /> Hidden
                                </Badge>
                              )}
                              {/* Scan risk badge */}
                              {isProfileReport && (() => {
                                const risk = effectiveRisk(r);
                                const scanStatus = r.scan_status;
                                if (scanStatus === 'pending') return (
                                  <Badge className="text-xs border gap-1 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    <ScanLine className="w-3 h-3" /> Scanning…
                                  </Badge>
                                );
                                if (scanStatus === 'failed') return (
                                  <Badge className="text-xs border gap-1 bg-muted text-muted-foreground border-border">
                                    <AlertCircle className="w-3 h-3" /> Scan failed
                                  </Badge>
                                );
                                if (risk) return (
                                  <Badge className={`text-xs border gap-1 ${RISK_COLORS[risk] ?? 'bg-muted text-muted-foreground border-border'}`}>
                                    {RISK_ICONS[risk]}
                                    {risk === 'dismissed' ? 'False positive' : `${risk.charAt(0).toUpperCase() + risk.slice(1)} risk`}
                                    {r.scan_reviewed ? ' ✓' : ''}
                                  </Badge>
                                );
                                return null;
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {r.name} · {r.email} · {fmtDate(r.created_at)}
                              {isProfileReport && r.profile_display_name && (
                                <> · Profile: <span className="text-foreground">{r.profile_display_name}</span></>
                              )}
                              {isProfileReport && r.profile_owner_email && (
                                <> · Owner: <span className="text-foreground">{r.profile_owner_email}</span></>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="outline" className="border-border h-7 text-xs"
                            onClick={e => { e.stopPropagation(); openEdit(r); }}>
                            Update
                          </Button>
                          {r.status !== 'closed' && (
                            <Button size="sm" variant="outline"
                              className="border-muted text-muted-foreground hover:bg-muted h-7 w-7 p-0"
                              title="Archive (mark as closed)"
                              onClick={e => { e.stopPropagation(); archiveReport(r); }}>
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                            title="Delete permanently"
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(r); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          {expanded === r.id
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {expanded === r.id && (
                      <div className="px-4 pb-4 bg-muted/10 border-t border-border/50">
                        <div className="pt-3 space-y-3">
                          {/* Profile report details */}
                          {isProfileReport && (
                            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-2">
                              <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                                <Flag className="w-3.5 h-3.5" /> Profile Report Details
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Profile type: </span>
                                  <span className="text-foreground font-medium capitalize">{r.profile_profile_type ?? r.profile_type ?? '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Profile name: </span>
                                  <span className="text-foreground font-medium">{r.profile_display_name ?? '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Profile owner: </span>
                                  <span className="text-foreground font-medium">{r.profile_owner_name ?? '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Owner email: </span>
                                  <span className="text-foreground font-medium">{r.profile_owner_email ?? '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Profile ID: </span>
                                  <span className="text-foreground font-medium">{r.reported_profile_id ?? '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">User ID: </span>
                                  <span className="text-foreground font-medium">{r.reported_user_id ?? '—'}</span>
                                </div>
                              </div>
                              {(r.reported_url ?? r.page_url) && (
                                <div>
                                  <span className="text-xs text-muted-foreground">Reported URL: </span>
                                  <a
                                    href={r.reported_url ?? r.page_url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {r.reported_url ?? r.page_url} <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                              {/* Profile moderation actions */}
                              {r.reported_profile_id && (
                                <div className="pt-2 border-t border-orange-500/10">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Profile moderation actions</p>
                                  <div className="flex flex-wrap gap-2">
                                    {!isSuspended ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7 gap-1.5"
                                        disabled={moderating === r.id}
                                        onClick={e => { e.stopPropagation(); setSuspendDialog(r); setSuspendReason(''); }}
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5" /> Suspend profile
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-7 gap-1.5"
                                        disabled={moderating === r.id}
                                        onClick={e => { e.stopPropagation(); moderateProfile(r, 'unsuspend'); }}
                                      >
                                        <ShieldOff className="w-3.5 h-3.5" /> Lift suspension
                                      </Button>
                                    )}
                                    {!isHidden ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-7 gap-1.5"
                                        disabled={moderating === r.id}
                                        onClick={e => { e.stopPropagation(); moderateProfile(r, 'hide'); }}
                                      >
                                        <EyeOff className="w-3.5 h-3.5" /> Hide profile
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-7 gap-1.5"
                                        disabled={moderating === r.id}
                                        onClick={e => { e.stopPropagation(); moderateProfile(r, 'unhide'); }}
                                      >
                                        <Eye className="w-3.5 h-3.5" /> Restore visibility
                                      </Button>
                                    )}
                                    {r.reported_url && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-border text-muted-foreground text-xs h-7 gap-1.5"
                                        asChild
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <a href={r.reported_url} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="w-3.5 h-3.5" /> View profile
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                  {isSuspended && r.profile_suspension_reason && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Suspension reason: <span className="text-foreground">{r.profile_suspension_reason}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{r.description}</p>
                          </div>

                          {/* ── Auto-scan panel ─────────────────────────────── */}
                          {isProfileReport && (
                            <div className="p-3 rounded-xl bg-card border border-border space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <ScanLine className="w-3.5 h-3.5 text-primary" /> Auto-scan results
                                </p>
                                <div className="flex items-center gap-2">
                                  {scanDetails[r.id] && (
                                    <Button size="sm" variant="outline" className="border-border h-6 text-xs gap-1 px-2"
                                      onClick={e => { e.stopPropagation(); const s = scanDetails[r.id]; if (s) setScanDialog({ reportId: r.id, scan: s }); }}>
                                      <FileText className="w-3 h-3" /> Full report
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="border-border h-6 text-xs gap-1 px-2"
                                    disabled={rescanning[r.id]}
                                    onClick={e => { e.stopPropagation(); rescan(r.id); }}>
                                    <RotateCcw className={`w-3 h-3 ${rescanning[r.id] ? 'animate-spin' : ''}`} />
                                    {rescanning[r.id] ? 'Scanning…' : 'Re-scan'}
                                  </Button>
                                </div>
                              </div>

                              {scanLoading[r.id] ? (
                                <div className="space-y-1.5"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
                              ) : (() => {
                                const scan = scanDetails[r.id];
                                const risk = effectiveRisk(r);
                                if (r.scan_status === 'pending') return <p className="text-xs text-blue-400 flex items-center gap-1.5"><ScanLine className="w-3.5 h-3.5 animate-pulse" /> Scan in progress…</p>;
                                if (r.scan_status === 'failed') return <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Scan failed — click Re-scan to retry.</p>;
                                if (!r.scan_status || !risk) return <p className="text-xs text-muted-foreground">No scan data yet. Click Re-scan to run a manual scan.</p>;
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_COLORS[risk] ?? 'bg-muted text-muted-foreground border-border'}`}>
                                        {RISK_ICONS[risk]}
                                        {risk === 'dismissed' ? 'False positive' : `${risk.charAt(0).toUpperCase() + risk.slice(1)} risk`}
                                      </span>
                                      {r.scan_override_risk && <span className="text-xs text-muted-foreground">(overridden by {r.scan_override_by})</span>}
                                      {r.scan_reviewed ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Reviewed by {r.scan_reviewed_by}</span> : null}
                                    </div>
                                    {r.scan_summary && <p className="text-xs text-muted-foreground leading-relaxed">{r.scan_summary}</p>}
                                    {scan && scan.issue_categories.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {scan.issue_categories.map(cat => (
                                          <span key={cat} className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-medium">{CATEGORY_LABELS[cat] ?? cat}</span>
                                        ))}
                                      </div>
                                    )}
                                    {scan?.recommended_action && (
                                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/50">
                                        <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-foreground">{scan.recommended_action}</p>
                                      </div>
                                    )}
                                    {scan?.auto_hidden ? <p className="text-xs text-red-400 flex items-center gap-1.5"><EyeOff className="w-3.5 h-3.5" /> Profile was automatically hidden due to critical risk.</p> : null}
                                    {r.scan_internal_notes && (
                                      <div className="flex items-start gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground">{r.scan_internal_notes}</p>
                                      </div>
                                    )}
                                    {scan && (
                                      <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                                        {!r.scan_reviewed && (
                                          <Button size="sm" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10 h-6 text-xs gap-1 px-2"
                                            onClick={e => { e.stopPropagation(); doScanAction('review', scan.id, r.id); }}>
                                            <CheckCircle className="w-3 h-3" /> Mark reviewed
                                          </Button>
                                        )}
                                        {risk !== 'dismissed' && (
                                          <Button size="sm" variant="outline" className="border-muted text-muted-foreground hover:bg-muted h-6 text-xs gap-1 px-2"
                                            onClick={e => { e.stopPropagation(); doScanAction('dismiss', scan.id, r.id); }}>
                                            <ShieldCheck className="w-3 h-3" /> Dismiss (false positive)
                                          </Button>
                                        )}
                                        <Button size="sm" variant="outline" className="border-border text-muted-foreground h-6 text-xs gap-1 px-2"
                                          onClick={e => { e.stopPropagation(); setOverrideDialog({ scanId: scan.id, reportId: r.id, current: risk ?? 'low' }); setOverrideRisk(risk ?? 'low'); setOverrideNotes(''); }}>
                                          <Info className="w-3 h-3" /> Override risk
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Page URL</p>
                              <a href={r.page_url ?? '#'} target="_blank" rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1">
                                {r.page_url} <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          {r.admin_notes && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Admin Notes</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{r.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={open => !open && setEditDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Update Report #{editDialog?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editDialog?.issue_type === 'profile_report' && (
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" /> Profile report
                </p>
                <p>
                  Type: <span className="font-medium capitalize">{editDialog.profile_profile_type ?? editDialog.profile_type ?? '—'}</span>
                  {editDialog.report_reason && <> · Reason: <span className="font-medium">{REASON_LABELS[editDialog.report_reason] ?? editDialog.report_reason}</span></>}
                </p>
                {editDialog.profile_display_name && (
                  <p>Profile: <span className="font-medium">{editDialog.profile_display_name}</span>
                    {editDialog.profile_owner_email && <> · Owner: <span className="font-medium">{editDialog.profile_owner_email}</span></>}
                  </p>
                )}
                {editDialog.reported_user_id && (
                  <p>User ID: {editDialog.reported_user_id} · Profile ID: {editDialog.reported_profile_id}</p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Status</p>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="action_taken">Action Taken</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Internal notes (not visible to reporter)</p>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Add internal moderation notes…"
                className="bg-background border-border resize-none"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            {error && (
              <p className="text-xs text-red-400 flex-1 text-left">{error}</p>
            )}
            <Button variant="outline" onClick={() => setEditDialog(null)} className="border-border">Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={!!suspendDialog} onOpenChange={open => !open && setSuspendDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" /> Suspend Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Suspending this profile will unpublish it and hide it from public view.
              The profile owner will not be able to republish until the suspension is lifted.
            </p>
            {suspendDialog?.profile_display_name && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-sm">
                <span className="text-muted-foreground">Profile: </span>
                <span className="text-foreground font-medium">{suspendDialog.profile_display_name}</span>
                {suspendDialog.profile_profile_type && (
                  <span className="ml-2 text-muted-foreground capitalize">({suspendDialog.profile_profile_type})</span>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Reason for suspension (internal)</p>
              <Textarea
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder="e.g. Reported for spam — pending review"
                className="bg-background border-border resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog(null)} className="border-border">Cancel</Button>
            <Button
              onClick={() => suspendDialog && moderateProfile(suspendDialog, 'suspend', suspendReason)}
              disabled={moderating === suspendDialog?.id}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {moderating === suspendDialog?.id ? 'Suspending…' : 'Suspend Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Delete Issue Report
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Permanently delete report #{deleteConfirm?.id} from <strong>{deleteConfirm?.name}</strong>?
            This cannot be undone. Use Archive (close) instead if you want to keep a record.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-border">Cancel</Button>
            <Button onClick={deleteReport} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan full report dialog */}
      <Dialog open={!!scanDialog} onOpenChange={open => !open && setScanDialog(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-primary" /> Auto-scan Report — Report #{scanDialog?.reportId}
            </DialogTitle>
          </DialogHeader>
          {scanDialog && (() => {
            const scan = scanDialog.scan;
            const risk = scan.risk_level;
            return (
              <div className="space-y-4 py-2">
                {/* Risk summary */}
                <div className={`p-3 rounded-xl border ${RISK_COLORS[risk] ?? 'bg-muted border-border'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {RISK_ICONS[risk]}
                    <span className="font-semibold capitalize">{risk} risk</span>
                    <span className="text-xs opacity-70">Score: {scan.risk_score}/100</span>
                  </div>
                  <p className="text-xs opacity-90">{scan.summary}</p>
                </div>

                {/* Issue categories */}
                {scan.issue_categories.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Detected issue categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scan.issue_categories.map(cat => (
                        <span key={cat} className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium border border-orange-500/20">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended action */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1.5">Recommended action</p>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{scan.recommended_action}</p>
                  </div>
                </div>

                {/* Evidence */}
                {scan.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Evidence snippets ({scan.evidence.length})</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {scan.evidence.map((ev, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-primary">{ev.field}</span>
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">{CATEGORY_LABELS[ev.rule] ?? ev.rule}</span>
                          </div>
                          <p className="text-muted-foreground font-mono leading-relaxed">{ev.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <div>Scan ID: <span className="text-foreground">#{scan.id}</span></div>
                  <div>Profile ID: <span className="text-foreground">{scan.profile_id}</span></div>
                  <div>Triggered by: <span className="text-foreground capitalize">{scan.triggered_by.replace(/_/g, ' ')}</span></div>
                  <div>Scanned at: <span className="text-foreground">{fmtDateTime(scan.created_at)}</span></div>
                  {scan.auto_hidden ? <div className="col-span-2 text-red-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Profile was auto-hidden</div> : null}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanDialog(null)} className="border-border">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override risk dialog */}
      <Dialog open={!!overrideDialog} onOpenChange={open => !open && setOverrideDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Override Scan Risk Level
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Override the auto-detected risk level. This is recorded in the audit log and does not re-run the scan.
            </p>
            <div>
              <Label className="text-xs text-muted-foreground">New risk level</Label>
              <Select value={overrideRisk} onValueChange={setOverrideRisk}>
                <SelectTrigger className="mt-1.5 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Internal notes (optional)</Label>
              <Textarea
                value={overrideNotes}
                onChange={e => setOverrideNotes(e.target.value)}
                placeholder="Reason for override…"
                className="mt-1.5 bg-background border-border resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialog(null)} className="border-border">Cancel</Button>
            <Button onClick={saveOverride} disabled={overrideSaving} className="bg-primary">
              {overrideSaving ? 'Saving…' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
