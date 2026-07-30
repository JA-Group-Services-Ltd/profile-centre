/**
 * Admin — Account Closure Requests
 * /admin/closure-requests
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Trash2, CheckCircle2, XCircle, Clock, Loader2,
  RefreshCw, User, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

interface ClosureRequest {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  plan_name: string | null;
  reason: string | null;
  status: string;
  admin_note: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: 'Pending',   color: 'bg-blue-500/10 text-blue-400',  icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-red-500/10 text-red-400',      icon: XCircle },
  rejected:  { label: 'Rejected',  color: 'bg-green-500/10 text-green-400',  icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground',  icon: XCircle },
};


export default function AdminClosureRequests() {
  const [requests, setRequests] = useState<ClosureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    fetch('/api/admin/closure-requests', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setRequests(d.data); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load(false);
    intervalRef.current = setInterval(() => load(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const act = async (id: number, action: 'confirm' | 'reject') => {
    if (action === 'confirm' && !confirm('Confirm this closure? The user account will be suspended immediately.')) return;
    setActionId(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/closure-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ admin_note: notes[id] ?? '' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const others = requests.filter(r => r.status !== 'pending');

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Closure Requests — Admin</title>
        <meta name="description" content="Review and action customer account closure requests on JA Profile Studio." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/closure-requests" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Closure Requests</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Review and action customer account closure requests</p>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              {pending.length} pending
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || refreshing} className="border-border gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <Trash2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No closure requests yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Action</p>
              {pending.map(req => <RequestCard key={req.id} req={req} notes={notes} setNotes={setNotes} actionId={actionId} act={act} />)}
              {others.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">History</p>}
            </>
          )}
          {others.map(req => <RequestCard key={req.id} req={req} notes={notes} setNotes={setNotes} actionId={actionId} act={act} />)}
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, notes, setNotes, actionId, act }: {
  req: ClosureRequest;
  notes: Record<number, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  actionId: number | null;
  act: (id: number, action: 'confirm' | 'reject') => void;
}) {
  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const isPending = req.status === 'pending';

  return (
    <Card className={`bg-card border-border ${isPending ? 'border-blue-500/20' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{req.user_name}</p>
              <p className="text-xs text-muted-foreground">{req.user_email}</p>
              {req.plan_name && <p className="text-xs text-muted-foreground">Plan: {req.plan_name}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs border-0 ${cfg.color}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {cfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{fmtDate(req.created_at)}</span>
          </div>
        </div>

        {/* Reason */}
        {req.reason && (
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-0.5">Customer's reason</p>
            <p className="text-sm text-foreground italic">"{req.reason}"</p>
          </div>
        )}

        {/* Admin note (existing) */}
        {req.admin_note && !isPending && (
          <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
            <p className="text-xs text-muted-foreground mb-0.5">Admin note</p>
            <p className="text-sm text-foreground">{req.admin_note}</p>
            {req.confirmed_by_name && (
              <p className="text-xs text-muted-foreground mt-1">— {req.confirmed_by_name}, {fmtDate(req.confirmed_at)}</p>
            )}
          </div>
        )}

        {/* Actions for pending */}
        {isPending && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Admin note (sent to customer)</label>
              <Textarea
                value={notes[req.id] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                placeholder="Optional note explaining your decision…"
                className="bg-background border-border text-sm"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-destructive hover:bg-destructive/90 gap-1.5 flex-1"
                onClick={() => act(req.id, 'confirm')}
                disabled={actionId === req.id}
              >
                {actionId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Confirm & Suspend
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border gap-1.5 flex-1"
                onClick={() => act(req.id, 'reject')}
                disabled={actionId === req.id}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                Reject Request
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
