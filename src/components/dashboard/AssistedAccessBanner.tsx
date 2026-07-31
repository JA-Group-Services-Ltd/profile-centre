/**
 * AssistedAccessBanner
 *
 * Shown in the customer dashboard when there is a pending or active
 * assisted access request from an admin.
 *
 * - Pending: customer can approve or reject
 * - Active: customer sees a banner and can revoke at any time
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { Shield, Check, X, LogOut, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessRequest {
  id: number;
  admin_name: string | null;
  admin_email: string | null;
  reason: string;
  access_areas: string;
  status: string;
  approved_at: string | null;
  created_at: string;
  session_expires_at: string | null;
}


export default function AssistedAccessBanner() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch('/api/assisted-access/pending', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setRequests(d.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const act = async (id: number, action: 'approve' | 'reject' | 'revoke') => {
    setActing(id);
    await fetch(`/api/assisted-access/${id}/${action}`, { method: 'POST', credentials: 'include' });
    setActing(null);
    load();
  };

  if (loading || requests.length === 0) return null;

  const pending = requests.filter(r => r.status === 'pending');
  const active = requests.filter(r => r.status === 'active' || r.status === 'approved');

  return (
    <div className="space-y-3 mb-4">
      {/* Active session banner */}
      {active.map(r => {
        const areas: string[] = (() => { try { return JSON.parse(r.access_areas); } catch { return []; } })();
        return (
          <div key={r.id} className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-400">Admin Assisted Access Active</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <strong>{r.admin_name || r.admin_email || 'A Profile Centre admin'}</strong> is currently viewing your account.
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {areas.map(a => (
                    <span key={a} className="text-xs bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">{a.replace(/_/g, ' ')}</span>
                  ))}
                </div>
                {r.session_expires_at && (
                  <p className="text-xs text-muted-foreground mt-1">Session expires: {fmtDate(r.session_expires_at)}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 flex-shrink-0"
                onClick={() => act(r.id, 'revoke')}
                disabled={acting === r.id}
              >
                {acting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Revoke Access
              </Button>
            </div>
          </div>
        );
      })}

      {/* Pending approval requests */}
      {pending.map(r => {
        const areas: string[] = (() => { try { return JSON.parse(r.access_areas); } catch { return []; } })();
        return (
          <div key={r.id} className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Assisted Access Request</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <strong>{r.admin_name || r.admin_email || 'A Profile Centre admin'}</strong> has requested temporary access to your account.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Reason</p>
                  <p className="text-sm text-foreground">{r.reason}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Requested access to:</p>
                  <div className="flex flex-wrap gap-1">
                    {areas.map(a => (
                      <span key={a} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{a.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expanded ? 'Hide details' : 'What does this mean?'}
                </button>
                {expanded && (
                  <div className="mt-2 p-3 rounded-xl bg-muted/20 border border-border/50 text-xs text-muted-foreground space-y-1.5">
                    <p>If you approve, the admin will be able to view and interact with the areas listed above on your behalf.</p>
                    <p>Dangerous actions (deleting your account, changing your email/password, changing payment details) are <strong>always blocked</strong> during assisted sessions.</p>
                    <p>You can revoke access at any time. The session automatically expires after 2 hours.</p>
                    <p>All actions taken during the session are recorded in your audit log.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3 ml-12">
              <Button
                size="sm"
                onClick={() => act(r.id, 'approve')}
                disabled={acting === r.id}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
              >
                {acting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(r.id, 'reject')}
                disabled={acting === r.id}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
              >
                {acting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
