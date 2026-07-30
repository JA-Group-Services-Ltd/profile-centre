/**
 * Dashboard — Close My Account
 * /dashboard/account-closure
 *
 * Customers can submit an account closure request.
 * Admin must confirm before the account is actually closed.
 */
import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, Loader2,
  Trash2, Shield, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';

interface ClosureRequest {
  id: number;
  status: string;
  reason: string | null;
  admin_note: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: 'Pending review',  color: 'bg-blue-500/10 text-blue-400',  icon: Clock },
  confirmed: { label: 'Confirmed — account suspended', color: 'bg-red-500/10 text-red-400', icon: XCircle },
  rejected:  { label: 'Rejected',        color: 'bg-green-500/10 text-green-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled',       color: 'bg-muted text-muted-foreground',  icon: XCircle },
};


export default function AccountClosurePage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState<ClosureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/account/closure-request', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setExisting(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!confirmed) { setError('Please confirm you understand this action.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/account/closure-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to submit');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your account closure request?')) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/account/closure-request', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Close Account — Dashboard</title>
        <meta name="description" content="Submit an account closure request." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/account-closure" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/dashboard/settings')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Close Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Request permanent account closure</p>
        </div>
      </div>

      {/* Warning banner */}
      <Card className="bg-destructive/5 border-destructive/20 mb-5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-destructive">This action is permanent</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
              <li>Your profile and all links will be permanently deleted</li>
              <li>Your QR codes will stop working</li>
              <li>Any active subscription will be cancelled</li>
              <li>Your data will be removed within 30 days of confirmation</li>
              <li>This cannot be undone once confirmed by our team</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : existing && existing.status !== 'cancelled' && existing.status !== 'rejected' ? (
        /* Existing request status */
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Your Closure Request</CardTitle>
            <CardDescription>Submitted {fmtDate(existing.created_at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const cfg = STATUS_CONFIG[existing.status ?? 'pending'] ?? STATUS_CONFIG.pending;
              const Icon = cfg?.icon ?? Clock;
              const colorParts = (cfg?.color ?? 'bg-muted text-muted-foreground').split(' ');
              return (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${colorParts[0]}`}>
                  <Icon className={`w-4 h-4 ${colorParts[1] ?? ''}`} />
                  <span className={`text-sm font-medium ${colorParts[1] ?? ''}`}>{cfg?.label ?? existing.status}</span>
                </div>
              );
            })()}

            {existing.reason && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your reason</p>
                <p className="text-sm text-foreground italic">"{existing.reason}"</p>
              </div>
            )}

            {existing.admin_note && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Note from our team</p>
                <p className="text-sm text-foreground">{existing.admin_note}</p>
                {existing.confirmed_by_name && (
                  <p className="text-xs text-muted-foreground mt-1">— {existing.confirmed_by_name}, {fmtDate(existing.confirmed_at)}</p>
                )}
              </div>
            )}

            {existing.status === 'pending' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Your request is under review. We aim to respond within 5 business days.
                  You can cancel this request at any time before it is confirmed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="border-border gap-1.5"
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Cancel my request
                </Button>
              </div>
            )}

            {existing.status === 'confirmed' && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400 font-medium">Your account has been suspended</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your data will be permanently deleted within 30 days. If you believe this was a mistake, please contact support immediately.
                </p>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={load} className="border-border gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh status
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Submit form */
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Request Account Closure
            </CardTitle>
            <CardDescription>
              Your request will be reviewed by our team. You will receive a response within 5 business days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {existing?.status === 'rejected' && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-400 font-medium">Previous request was rejected</p>
                {existing.admin_note && <p className="text-xs text-muted-foreground mt-1">{existing.admin_note}</p>}
                <p className="text-xs text-muted-foreground mt-1">You can submit a new request below.</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Reason for closing (optional but helpful)
              </label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Tell us why you're leaving — your feedback helps us improve…"
                className="bg-background border-border text-sm"
                rows={4}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I understand that closing my account is <strong className="text-foreground">permanent and irreversible</strong>.
                All my profiles, links, QR codes, and data will be permanently deleted.
                Any active subscription will be cancelled with no refund for unused time.
              </span>
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
              <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your request will be reviewed by a human. We may contact you to confirm your identity before proceeding.
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !confirmed}
              className="w-full bg-destructive hover:bg-destructive/90 gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Submit Closure Request
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
