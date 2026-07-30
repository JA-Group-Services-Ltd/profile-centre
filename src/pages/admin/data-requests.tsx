/**
 * Admin — Data Requests
 * /admin/data-requests
 *
 * Lists all GDPR / UK GDPR data requests submitted by customers.
 * Admins can filter, assign, update status, and add internal notes.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  FileText, RefreshCw, Search,
  Check, Loader2,
  CheckCircle2,
  Clock, XCircle, FileDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import PinChallenge from '@/components/admin/PinChallenge';

interface DataRequest {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  request_type: string;
  description: string | null;
  status: string;
  assigned_to: number | null;
  assigned_name: string | null;
  internal_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  data_copy: 'Copy of Data',
  data_correction: 'Data Correction',
  data_deletion: 'Account Deletion',
  consent_withdrawal: 'Consent Withdrawal',
  marketing_change: 'Marketing Preferences',
  document_export: 'Document Export',
  referral_data: 'Document/File Export',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:     { label: 'Pending',     color: 'bg-blue-500/10 text-blue-400',  icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400',    icon: Loader2 },
  completed:   { label: 'Completed',   color: 'bg-green-500/10 text-green-400',  icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    color: 'bg-red-500/10 text-red-400',      icon: XCircle },
};


function RequestCard({ req, onUpdate }: { req: DataRequest; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(req.status);
  const [assignedName, setAssignedName] = useState(req.assigned_name ?? '');
  const [notes, setNotes] = useState(req.internal_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPinChallenge, setShowPinChallenge] = useState(false);

  const cfg = STATUS_CONFIG[req.status ?? 'pending'] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/admin/crm/data-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, assigned_name: assignedName || null, internal_notes: notes || null }),
    });
    setSaving(false);
    setExpanded(false);
    onUpdate();
  };

  const downloadSarPdf = async (token: string) => {
    setShowPinChallenge(false);
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/admin/sar/${req.user_id}/pdf`, {
        credentials: 'include',
        headers: {
          'X-Admin-Pin-Token': token,
          'X-Admin-Pin-Action': 'sar_export',
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `SAR_${req.user_name}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to generate SAR PDF: ${err}`);
    }
    setGeneratingPdf(false);
  };

  return (
    <>
      <PinChallenge
        open={showPinChallenge}
        action="sar_export"
        actionLabel="export a Subject Access Request PDF"
        onSuccess={(token) => downloadSarPdf(token)}
        onCancel={() => setShowPinChallenge(false)}
      />
    <Card className={`bg-card border-border transition-all ${req.status === 'pending' ? 'border-blue-500/20' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color.replace('text-', 'bg-').replace(/text-\S+/, '')} bg-opacity-10`}>
            <StatusIcon className={`w-4 h-4 ${(cfg.color.split(' ')[1]) ?? ''}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-semibold text-sm text-foreground">
                    {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                  </p>
                  <Badge className={`text-xs border-0 ${cfg.color}`}>{cfg.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{req.user_name} · {req.user_email}</p>
                {req.description && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{req.description}"</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>Submitted: {fmtDateTime(req.created_at)}</span>
                  {req.assigned_name && <span>Assigned: {req.assigned_name}</span>}
                  {req.completed_at && <span>Completed: {fmtDateTime(req.completed_at)}</span>}
                </div>
                {req.internal_notes && !expanded && (
                  <p className="text-xs text-muted-foreground mt-1 italic">Notes: {req.internal_notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPinChallenge(true)}
                    disabled={generatingPdf}
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs gap-1.5 h-7 px-2.5"
                    title="Generate Subject Access Request PDF"
                  >
                    {generatingPdf
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <FileDown className="w-3 h-3" />}
                    {generatingPdf ? 'Generating…' : 'SAR PDF'}
                  </Button>
                  <Button size="sm" variant="outline" className="border-border text-xs gap-1 h-7 px-2.5"
                    onClick={() => setExpanded(e => !e)}>
                    {expanded ? 'Close' : 'Update'}
                  </Button>
                </div>
            </div>

            {expanded && (
              <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="bg-background border-border h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Assigned to</label>
                    <Input
                      value={assignedName}
                      onChange={e => setAssignedName(e.target.value)}
                      placeholder="Staff name…"
                      className="bg-background border-border h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Internal notes (not visible to customer)</label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add internal notes…"
                    className="bg-background border-border text-xs"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} disabled={saving} className="bg-primary gap-1.5 text-xs">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Changes
                  </Button>
                  <Button size="sm" variant="outline" className="border-border text-xs" onClick={() => setExpanded(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

export default function AdminDataRequests() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter, type: typeFilter });
    fetch(`/api/admin/crm/data-requests?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setRequests(d.data); setTotal(d.total); } })
      .finally(() => setLoading(false));
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Data Requests — Admin</title>
        <meta name="description" content="Manage UK GDPR data subject requests including access, correction, deletion and consent withdrawal." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/data-requests" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Data Requests
            {pendingCount > 0 && (
              <Badge className="bg-blue-600 text-white border-0">{pendingCount} pending</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            UK GDPR data subject requests — access, correction, deletion, consent withdrawal
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: total, color: 'text-foreground' },
          { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, color: 'text-blue-400' },
          { label: 'In Progress', value: requests.filter(r => r.status === 'in_progress').length, color: 'text-blue-400' },
          { label: 'Completed', value: requests.filter(r => r.status === 'completed').length, color: 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No data requests found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <RequestCard key={req.id} req={req} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}
