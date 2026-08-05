/**
 * LifetimeAccessPanel
 * Full controlled-discretionary lifetime access management panel.
 * Implements the Sousa Murray Profiles Lifetime Access Instruction.
 */
import { useState, useEffect } from 'react';
import {
  Infinity, Crown, Ban, AlertTriangle, CheckCircle,
  Clock, User, FileText, ChevronDown, ChevronUp, Info,
  Calendar, ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PinChallenge from '@/components/admin/PinChallenge';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Plan { id: number; name: string; slug: string; }

interface LifetimeLogEntry {
  id: number;
  action: 'granted' | 'updated' | 'reviewed' | 'withdrawn';
  reason_category?: string;
  internal_note?: string;
  customer_note?: string;
  granted_by?: string;
  review_date?: string;
  can_be_withdrawn?: number;
  fallback_plan_slug?: string;
  withdrawal_reason?: string;
  notify_user?: number;
  actor_name?: string;
  created_at: string;
}

interface LifetimeUser {
  lifetime_access: number;
  lifetime_granted_at?: string | null;
  lifetime_granted_by?: string | null;
  lifetime_reason_category?: string | null;
  lifetime_internal_note?: string | null;
  lifetime_review_date?: string | null;
  lifetime_customer_note?: string | null;
  lifetime_can_be_withdrawn?: number;
  plan_name?: string | null;
}

interface Props {
  userId: number;
  user: LifetimeUser;
  onRefresh: () => void;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const REASON_CATEGORIES: { value: string; label: string }[] = [
  { value: 'founder_goodwill',              label: 'Founder / Customer Goodwill' },
  { value: 'manual_compensation',           label: 'Manual Compensation' },
  { value: 'service_issue_resolution',      label: 'Service Issue Resolution' },
  { value: 'internal_test_account',         label: 'Internal / Test Account' },
  { value: 'approved_organisation_support', label: 'Approved Organisation Support' },
  { value: 'special_business_agreement',    label: 'Special Business Agreement' },
  { value: 'migration_old_arrangement',     label: 'Migration from Old Arrangement' },
  { value: 'staff_admin_approved_exception',label: 'Staff / Admin Approved Exception' },
];

const WITHDRAWAL_REASONS: { value: string; label: string }[] = [
  { value: 'misuse',                  label: 'Misuse of Sousa Murray Profiles' },
  { value: 'breach_of_terms',         label: 'Breach of Terms' },
  { value: 'account_abuse',           label: 'Account Abuse' },
  { value: 'mistaken_grant',          label: 'Mistaken Grant' },
  { value: 'change_in_eligibility',   label: 'Change in Eligibility' },
  { value: 'business_agreement_ended',label: 'Business Agreement Ended' },
  { value: 'security_concern',        label: 'Security Concern' },
  { value: 'legal_compliance',        label: 'Legal / Compliance Issue' },
  { value: 'account_closure',         label: 'Account Closure' },
  { value: 'admin_correction',        label: 'Admin Correction' },
];

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function categoryLabel(cat?: string | null) {
  return REASON_CATEGORIES.find(r => r.value === cat)?.label ?? cat ?? '—';
}

function actionBadge(action: string) {
  const map: Record<string, string> = {
    granted:   'bg-green-500/10 text-green-400 border-green-500/20',
    updated:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    reviewed:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
    withdrawn: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return <Badge className={`text-xs capitalize ${map[action] ?? 'bg-muted text-muted-foreground'}`}>{action}</Badge>;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function LifetimeAccessPanel({ userId, user, onRefresh }: Props) {
  const isActive = !!user.lifetime_access;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [log, setLog] = useState<LifetimeLogEntry[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showRevokeForm, setShowRevokeForm] = useState(false);

  // Grant form state
  const [grantPlanId, setGrantPlanId] = useState('');
  const [grantCategory, setGrantCategory] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [grantCustomerNote, setGrantCustomerNote] = useState('');
  const [grantReviewDate, setGrantReviewDate] = useState('');
  const [grantCanWithdraw, setGrantCanWithdraw] = useState(true);

  // Revoke form state
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeNote, setRevokeNote] = useState('');
  const [revokeFallback, setRevokeFallback] = useState('free');
  const [revokeNotify, setRevokeNotify] = useState(false);

  // UI state
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pendingAction, setPendingAction] = useState<'grant' | 'revoke' | null>(null);

  useEffect(() => {
    fetch('/api/plans?include_lifetime=1', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.plans ?? []); })
      .catch(() => {});
  }, []);

  const loadLog = () => {
    if (logLoaded) return;
    fetch(`/api/admin/users/${userId}/lifetime-log`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setLog(d.data ?? []); setLogLoaded(true); } })
      .catch(() => {});
  };

  const toggleLog = () => {
    if (!showLog) loadLog();
    setShowLog(v => !v);
  };

  const executeHighRisk = async (token: string) => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setBusy(true); setMsg(''); setErr('');
    try {
      if (action === 'grant') {
        const r = await fetch(`/api/admin/users/${userId}/lifetime`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'billing_control' },
          body: JSON.stringify({
            plan_id: Number(grantPlanId),
            reason_category: grantCategory,
            internal_note: grantNote,
            customer_note: grantCustomerNote || undefined,
            review_date: grantReviewDate || undefined,
            can_be_withdrawn: grantCanWithdraw ? 1 : 0,
          }),
        });
        const d = await r.json();
        if (d.success) {
          setMsg('Lifetime access granted and logged.');
          setShowGrantForm(false);
          setLogLoaded(false);
          onRefresh();
        } else setErr(d.error || 'Failed to grant lifetime access');
      } else if (action === 'revoke') {
        const r = await fetch(`/api/admin/users/${userId}/lifetime`, {
          method: 'DELETE', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'billing_control' },
          body: JSON.stringify({
            withdrawal_reason: revokeReason,
            internal_note: revokeNote || undefined,
            fallback_plan_slug: revokeFallback,
            notify_user: revokeNotify ? 1 : 0,
          }),
        });
        const d = await r.json();
        if (d.success) {
          setMsg('Lifetime access withdrawn and logged.');
          setShowRevokeForm(false);
          setLogLoaded(false);
          onRefresh();
        } else setErr(d.error || 'Failed to withdraw lifetime access');
      }
    } catch { setErr('Network error'); }
    finally { setBusy(false); }
  };

  const canGrant = grantPlanId && grantCategory && grantNote.trim().length >= 5;
  const canRevoke = revokeReason.trim().length >= 3;

  return (
    <>
      <PinChallenge
        open={pendingAction !== null}
        action="billing_control"
        actionLabel={pendingAction === 'grant' ? 'grant lifetime access to this user' : 'withdraw lifetime access from this user'}
        onSuccess={executeHighRisk}
        onCancel={() => setPendingAction(null)}
      />

      <div className="space-y-4">
        {/* Instruction notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300 leading-relaxed">
            Lifetime access is a <strong>discretionary, admin-granted status</strong> from JA Group Services Ltd. Grant only for approved cases. Record the reason and approval note. Lifetime access may be withdrawn where appropriate.
          </p>
        </div>

        {msg && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</p>}
        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

        {/* Current status card */}
        {isActive ? (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Infinity className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-foreground">Lifetime access active</span>
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">Active</Badge>
              </div>
              {user.lifetime_can_be_withdrawn !== 0 && (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" /> Withdrawable
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">Granted</span>
                  <p className="text-foreground">{fmtDate(user.lifetime_granted_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">Granted by</span>
                  <p className="text-foreground">{user.lifetime_granted_by ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <Crown className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">Reason category</span>
                  <p className="text-foreground">{categoryLabel(user.lifetime_reason_category)}</p>
                </div>
              </div>
              {user.lifetime_review_date && (
                <div className="flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Review date</span>
                    <p className="text-foreground">{fmtDate(user.lifetime_review_date)}</p>
                  </div>
                </div>
              )}
            </div>
            {user.lifetime_internal_note && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/30 border border-border">
                <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Internal note</p>
                  <p className="text-xs text-foreground">{user.lifetime_internal_note}</p>
                </div>
              </div>
            )}
            {user.lifetime_customer_note && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/30 border border-border">
                <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Customer-facing note</p>
                  <p className="text-xs text-foreground">{user.lifetime_customer_note}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center gap-3">
            <Ban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">No lifetime access active on this account.</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isActive && (
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => { setShowGrantForm(v => !v); setShowRevokeForm(false); setMsg(''); setErr(''); }}
              className="text-xs h-8 gap-1.5 border-blue-500/30 text-blue-400">
              <Infinity className="w-3.5 h-3.5" />
              {showGrantForm ? 'Cancel grant' : 'Grant lifetime access'}
            </Button>
          )}
          {isActive && (
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => { setShowRevokeForm(v => !v); setShowGrantForm(false); setMsg(''); setErr(''); }}
              className="text-xs h-8 gap-1.5 border-red-500/30 text-red-400">
              <Ban className="w-3.5 h-3.5" />
              {showRevokeForm ? 'Cancel withdrawal' : 'Withdraw lifetime access'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={toggleLog}
            className="text-xs h-8 gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {showLog ? 'Hide history' : 'View history'}
            {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>

        {/* Grant form */}
        {showGrantForm && !isActive && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Infinity className="w-3.5 h-3.5" /> Grant Lifetime Access
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Plan *</label>
                <Select value={grantPlanId} onValueChange={setGrantPlanId}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select plan…" /></SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.slug !== 'free').map(p => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Reason category *</label>
                <Select value={grantCategory} onValueChange={setGrantCategory}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {REASON_CATEGORIES.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Internal note * <span className="text-muted-foreground font-normal">(min 5 chars — not shown to user)</span></label>
              <Textarea value={grantNote} onChange={e => setGrantNote(e.target.value)}
                placeholder="Approved by [name]. Reason: [details]…"
                className="text-xs min-h-[60px] resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Review date <span className="font-normal">(optional)</span></label>
                <Input type="date" value={grantReviewDate} onChange={e => setGrantReviewDate(e.target.value)}
                  className="text-xs h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Customer-facing note <span className="font-normal">(optional)</span></label>
                <Input value={grantCustomerNote} onChange={e => setGrantCustomerNote(e.target.value)}
                  placeholder="Shown in billing section if set…"
                  className="text-xs h-8" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="can-withdraw" checked={grantCanWithdraw}
                onChange={e => setGrantCanWithdraw(e.target.checked)}
                className="rounded border-border" />
              <label htmlFor="can-withdraw" className="text-xs text-muted-foreground">
                This access can be withdrawn by JA Group Services Ltd where appropriate
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" disabled={busy || !canGrant}
                onClick={() => setPendingAction('grant')}
                className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                <CheckCircle className="w-3.5 h-3.5" /> Confirm grant (requires high-risk PIN)
              </Button>
            </div>
          </div>
        )}

        {/* Revoke form */}
        {showRevokeForm && isActive && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" /> Withdraw Lifetime Access
            </p>
            <div className="p-2 rounded-lg bg-red-500/8 border border-red-500/15">
              <p className="text-xs text-red-300">
                Withdrawing lifetime access will move this user to the selected fallback plan immediately. This action is logged and audited.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Withdrawal reason *</label>
                <Select value={revokeReason} onValueChange={setRevokeReason}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {WITHDRAWAL_REASONS.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Move user to</label>
                <Select value={revokeFallback} onValueChange={setRevokeFallback}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.slug} value={p.slug} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Internal note <span className="font-normal">(optional)</span></label>
              <Textarea value={revokeNote} onChange={e => setRevokeNote(e.target.value)}
                placeholder="Additional context for the audit record…"
                className="text-xs min-h-[50px] resize-none" />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="notify-user" checked={revokeNotify}
                onChange={e => setRevokeNotify(e.target.checked)}
                className="rounded border-border" />
              <label htmlFor="notify-user" className="text-xs text-muted-foreground">
                Notify user of this change
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="destructive" disabled={busy || !canRevoke}
                onClick={() => setPendingAction('revoke')}
                className="text-xs h-8 gap-1.5">
                <Ban className="w-3.5 h-3.5" /> Confirm withdrawal (requires high-risk PIN)
              </Button>
            </div>
          </div>
        )}

        {/* History log */}
        {showLog && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lifetime access history</p>
            {log.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No history recorded.</p>
            ) : (
              <div className="space-y-2">
                {log.map(entry => (
                  <div key={entry.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {actionBadge(entry.action)}
                      <span className="text-xs text-muted-foreground">{fmtDate(entry.created_at)}</span>
                    </div>
                    {entry.reason_category && (
                      <p className="text-xs text-foreground">
                        <span className="text-muted-foreground">Reason: </span>{categoryLabel(entry.reason_category)}
                      </p>
                    )}
                    {entry.withdrawal_reason && (
                      <p className="text-xs text-foreground">
                        <span className="text-muted-foreground">Withdrawal reason: </span>
                        {WITHDRAWAL_REASONS.find(r => r.value === entry.withdrawal_reason)?.label ?? entry.withdrawal_reason}
                      </p>
                    )}
                    {entry.internal_note && (
                      <p className="text-xs text-foreground">
                        <span className="text-muted-foreground">Note: </span>{entry.internal_note}
                      </p>
                    )}
                    {entry.fallback_plan_slug && (
                      <p className="text-xs text-foreground">
                        <span className="text-muted-foreground">Moved to: </span>{entry.fallback_plan_slug}
                        {entry.notify_user ? ' · User notified' : ''}
                      </p>
                    )}
                    {entry.review_date && (
                      <p className="text-xs text-foreground">
                        <span className="text-muted-foreground">Review date: </span>{fmtDate(entry.review_date)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">By {entry.actor_name ?? entry.granted_by ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
