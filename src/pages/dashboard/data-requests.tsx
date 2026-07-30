/**
 * Dashboard — My Data Requests
 * /dashboard/data-requests
 *
 * Customers can submit UK GDPR data subject requests and view their status.
 * Consent management is also accessible here.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate as _fmtDate, fmtDateTime as _fmtDt } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  FileText, Plus, CheckCircle2, Clock, XCircle, Loader2,
  Shield, Edit3, Trash2, Share2, Link2,
  RefreshCw, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────

interface DataRequest {
  id: number;
  request_type: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ConsentRecord {
  marketing_consent: number | null;
  marketing_consent_at: string | null;
  referral_consent: number | null;
  referral_consent_at: string | null;
  terms_consent: number | null;
  terms_consent_at: string | null;
  privacy_consent: number | null;
  privacy_consent_at: string | null;
  data_improve_consent: number | null;
  data_improve_consent_at: string | null;
  updates_consent: number | null;
  updates_consent_at: string | null;
  crm_consent: number | null;
  crm_consent_at: string | null;
  consent_version: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

const REQUEST_TYPES = [
  {
    value: 'data_copy',
    label: 'Subject Access Request (SAR)',
    description: 'Request a full copy of all personal data we hold about you. We will respond within 30 days with a verified PDF report.',
    icon: FileText,
  },
  {
    value: 'data_correction',
    label: 'Correct inaccurate data',
    description: 'Ask us to correct any inaccurate or incomplete information.',
    icon: Edit3,
  },
  {
    value: 'data_deletion',
    label: 'Delete my account & data',
    description: 'Request permanent deletion of your account and all associated data.',
    icon: Trash2,
  },
  {
    value: 'consent_withdrawal',
    label: 'Withdraw consent',
    description: 'Withdraw previously given consent for data processing.',
    icon: Shield,
  },
  {
    value: 'marketing_change',
    label: 'Change marketing preferences',
    description: 'Update your marketing email and communication preferences.',
    icon: Share2,
  },
  {
    value: 'document_export',
    label: 'Export my documents/files',
    description: 'Request an export of your profile cards, links, and documents.',
    icon: FileText,
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:     { label: 'Pending',     color: 'bg-blue-500/10 text-blue-400',  icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400',    icon: Loader2 },
  completed:   { label: 'Completed',   color: 'bg-green-500/10 text-green-400',  icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    color: 'bg-red-500/10 text-red-400',      icon: XCircle },
};

function normaliseDate(dt: string): string {
  const withT = dt.replace(' ', 'T');
  const dotIdx = withT.indexOf('.');
  return dotIdx !== -1 ? withT.slice(0, dotIdx) : withT;
}

function fmtDate(dt: string | null) {
  if (!dt) return '—';
  const d = new Date(normaliseDate(dt));
  if (isNaN(d.getTime())) return '—';
  return _fmtDate(d);
}

function fmtDateTime(dt: string | null) {
  if (!dt) return '—';
  const d = new Date(normaliseDate(dt));
  if (isNaN(d.getTime())) return '—';
  return _fmtDt(d);
}

// ── Consent panel ─────────────────────────────────────────────────────────

function ConsentPanel() {
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/me/consent', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setConsent(d.data); });
  }, []);

  const toggle = async (field: keyof ConsentRecord, value: boolean) => {
    if (!consent) return;
    setSaving(true);
    const updated = { ...consent, [field]: value ? 1 : 0 };
    setConsent(updated);
    await fetch('/api/me/consent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ [field]: value ? 1 : 0 }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const REQUIRED_ITEMS = [
    {
      label: 'Terms & Conditions',
      statusLabel: 'Accepted',
      valueKey: 'terms_consent' as const,
      atKey: 'terms_consent_at' as const,
    },
    {
      label: 'Privacy Policy',
      statusLabel: 'Acknowledged',
      valueKey: 'privacy_consent' as const,
      atKey: 'privacy_consent_at' as const,
    },
    {
      label: 'Essential Account & Activity Records',
      statusLabel: 'Applicable',
      valueKey: 'crm_consent' as const,
      atKey: 'crm_consent_at' as const,
      note: 'Required for account administration, support, audit logging, security and service operation.',
    },
  ];

  const OPTIONAL_ITEMS = [
    {
      label: 'Service Improvement',
      description: 'Allow anonymised usage data to help improve the platform.',
      valueKey: 'data_improve_consent' as const,
      atKey: 'data_improve_consent_at' as const,
    },
    {
      label: 'Product Updates',
      description: 'Receive emails about new features and platform announcements.',
      valueKey: 'updates_consent' as const,
      atKey: 'updates_consent_at' as const,
    },
  ];

  return (
    <Card className="bg-card border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Privacy, Terms and Communication Preferences</span>
          {saved && <span className="text-xs text-green-400 ml-2">Saved</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <CardContent className="pt-0 pb-5 px-5 border-t border-border/50 space-y-5">

          {/* Required */}
          <div className="space-y-3 pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required — Legal Acknowledgements</p>
            <p className="text-xs text-muted-foreground -mt-1">These cannot be withdrawn without closing your account.</p>
            {REQUIRED_ITEMS.map(({ label, statusLabel, valueKey, atKey, note }) => {
              const val = consent?.[valueKey];
              const at = consent?.[atKey];
              return (
                <div key={valueKey} className="rounded-xl border border-border bg-muted/10 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium border-0 ${
                      val ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {val ? statusLabel : 'Not recorded'}
                    </span>
                  </div>
                  {note && <p className="text-xs text-muted-foreground">{note}</p>}
                  {at && (
                    <p className="text-xs text-muted-foreground">
                      Recorded: {fmtDateTime(at)}
                      {consent?.consent_version && <span className="ml-2 font-mono">v{consent.consent_version}</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Optional */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Optional — You Can Change These Any Time</p>
            {OPTIONAL_ITEMS.map(({ label, description, valueKey, atKey }) => {
              const val = !!(consent?.[valueKey]);
              const at = consent?.[atKey];
              return (
                <div key={valueKey} className="flex items-start justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        val ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {val ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    {at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {val ? 'Enabled' : 'Disabled'}: {fmtDateTime(at)}
                        {consent?.consent_version && <span className="ml-2 font-mono">v{consent.consent_version}</span>}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={val}
                    onCheckedChange={v => toggle(valueKey, v)}
                    disabled={saving}
                  />
                </div>
              );
            })}
          </div>

          {consent?.consent_version && (
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
              Preferences version: <span className="font-mono">{consent.consent_version}</span>
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DataRequestsPage() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [preferredContact, setPreferredContact] = useState('email');
  const [declaration, setDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await fetch('/api/me/data-requests', { credentials: 'include' });
      const d = await r.json();
      if (d.success) setRequests(d.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!requestType) { setSubmitError('Please select a request type.'); return; }
    if (!reason.trim()) { setSubmitError('Please provide a reason for your request.'); return; }
    if (!declaration) { setSubmitError('Please confirm the declaration before submitting.'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/me/data-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          request_type: requestType,
          description: [
            reason ? `Reason: ${reason}` : '',
            description ? `Additional details: ${description}` : '',
            `Preferred contact: ${preferredContact}`,
          ].filter(Boolean).join('\n\n'),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to submit');
      setSubmitSuccess(true);
      setShowForm(false);
      setRequestType('');
      setDescription('');
      setReason('');
      setPreferredContact('email');
      setDeclaration(false);
      load(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>My Data & Privacy — JA Profile Studio</title>
        <meta name="description" content="Manage your data rights, consent preferences and GDPR requests." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/data-requests" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Data & Privacy</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your data rights, consent preferences, and submit requests under UK GDPR
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing} className="border-border gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Your rights info */}
      <Card className="bg-primary/5 border-primary/20 mb-5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-foreground/80 leading-relaxed space-y-1">
            <p className="font-semibold text-foreground">Your rights under UK GDPR</p>
            <p>You have the right to access, correct, delete, and export your personal data. You can also withdraw optional consent at any time. Submit a request below and we will respond within 30 days. For a Subject Access Request (SAR), our team will prepare a verified PDF report of all data we hold about you.</p>
          </div>
        </CardContent>
      </Card>

      {/* Consent panel */}
      <div className="mb-5">
        <ConsentPanel />
      </div>

      {/* Submit new request */}
      <Card className="bg-card border-border mb-5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Submit a Data Request</CardTitle>
              <CardDescription>Exercise your rights — we'll respond within 30 days</CardDescription>
            </div>
            <Button
              size="sm"
              variant={showForm ? 'outline' : 'default'}
              className={showForm ? 'border-border' : 'bg-primary'}
              onClick={() => { setShowForm(f => !f); setSubmitSuccess(false); setSubmitError(''); setReason(''); setDeclaration(false); }}
            >
              <Plus className="w-4 h-4 mr-1" />
              {showForm ? 'Cancel' : 'New Request'}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="space-y-4 border-t border-border/50 pt-4">
            {/* Request type cards */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">What would you like to request?</p>
              <div className="grid gap-2">
                {REQUEST_TYPES.map(rt => {
                  const Icon = rt.icon;
                  return (
                    <button
                      key={rt.value}
                      onClick={() => setRequestType(rt.value)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        requestType === rt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        requestType === rt.value ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        <Icon className={`w-4 h-4 ${requestType === rt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${requestType === rt.value ? 'text-primary' : 'text-foreground'}`}>
                          {rt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{rt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Reason for request <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Please explain why you are making this request and what you expect us to do…"
                className="bg-background border-border text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Additional details (optional)
              </label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Any other information that may help us process your request…"
                className="bg-background border-border text-sm"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Preferred contact method for our response
              </label>
              <Select value={preferredContact} onValueChange={setPreferredContact}>
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email (registered account email)</SelectItem>
                  <SelectItem value="dashboard">Dashboard notification only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-start gap-3">
                <Switch
                  checked={declaration}
                  onCheckedChange={setDeclaration}
                  id="sar-declaration"
                  className="mt-0.5"
                />
                <label htmlFor="sar-declaration" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  <strong className="text-foreground">Declaration:</strong> I confirm that this request relates to my own personal data and account. I understand that JA Group Services Ltd may need to verify my identity before processing this request, and that we will respond within 30 days as required by UK GDPR.
                </label>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !requestType || !reason.trim() || !declaration}
              className="bg-primary w-full gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Submit Request
            </Button>
          </CardContent>
        )}
      </Card>

      {submitSuccess && (
        <div className="mb-5 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-400">Request submitted successfully</p>
            <p className="text-xs text-muted-foreground">We'll respond within 30 days. You can track the status below.</p>
          </div>
        </div>
      )}

      {/* Request history */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">My Requests</h2>
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Use the form above to exercise your data rights.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const typeInfo = REQUEST_TYPES.find(t => t.value === req.request_type);
              return (
                <Card key={req.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        {typeInfo && <typeInfo.icon className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold text-foreground">
                            {typeInfo?.label ?? req.request_type}
                          </p>
                          <Badge className={`text-xs border-0 ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground italic mb-1">"{req.description}"</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>Submitted: {fmtDate(req.created_at)}</span>
                          {req.completed_at && <span>Completed: {fmtDate(req.completed_at)}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
