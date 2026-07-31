/**
 * Admin — Feature Manager
 * /admin/features
 *
 * Admin controls every feature/add-on: status, plan rules, pricing,
 * customer overrides, register-interest registrations.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Layers, ChevronDown, ChevronUp, RefreshCw, Loader2,
  CheckCircle2, EyeOff, Clock, Lock,
  Users, Star, Edit2, Save, X,
  ToggleLeft, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlatformFeature {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: string;
  pricing_type: string;
  fixed_price: number | null;
  from_price: number | null;
  coming_soon_text: string | null;
  show_coming_soon: number;
  show_upgrade_prompt: number;
  require_admin_approval: number;
  allow_register_interest: number;
  dashboard_icon_visible: number;
  menu_visible: number;
  request_form_enabled: number;
  portal_comms_enabled: number;
  file_uploads_enabled: number;
  proof_download_enabled: number;
  final_file_enabled: number;
  sort_order: number;
  plan_rule_count: number;
  override_count: number;
  interest_count: number;
}

interface Plan { id: number; name: string; slug: string; }
interface PlanRule { plan_id: number; access_type: string; plan_name: string; plan_slug: string; }

const STATUS_OPTIONS = [
  { value: 'hidden',      label: 'Hidden',       icon: EyeOff,       color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  { value: 'coming_soon', label: 'Coming Soon',  icon: Clock,        color: 'bg-blue-500/10 text-blue-400 dark:bg-blue-500/10 dark:text-blue-400' },
  { value: 'active',      label: 'Active',       icon: CheckCircle2, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'inactive',    label: 'Inactive',     icon: ToggleLeft,   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'disabled',    label: 'Disabled',     icon: Lock,         color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
];

const PRICING_OPTIONS = [
  { value: 'free',          label: 'Free' },
  { value: 'included',      label: 'Included in plan' },
  { value: 'fixed',         label: 'Fixed price' },
  { value: 'from',          label: 'From price' },
  { value: 'quote_required',label: 'Quote required' },
  { value: 'manual',        label: 'Manual (admin quotes)' },
  { value: 'paid_addon',    label: 'Paid add-on' },
];

const ACCESS_OPTIONS = [
  { value: 'hidden',        label: 'Hidden' },
  { value: 'coming_soon',   label: 'Coming Soon' },
  { value: 'included',      label: 'Included' },
  { value: 'paid_addon',    label: 'Paid Add-on' },
  { value: 'quote_required',label: 'Quote Required' },
  { value: 'restricted',    label: 'Restricted' },
];

const CATEGORY_LABELS: Record<string, string> = {
  print: 'Print & Physical',
  qr: 'QR Codes',
  setup: 'Setup Services',
  design: 'Design',
  feature: 'Profile Features',
  account: 'Account',
  support: 'Support',
};

function statusBadge(status: string) {
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  if (!opt) return <Badge className="bg-muted text-muted-foreground border-0 text-xs">{status}</Badge>;
  const Icon = opt.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>
      <Icon className="w-3 h-3" /> {opt.label}
    </span>
  );
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlatformFeature>>({});
  const [_planRules, setPlanRules] = useState<PlanRule[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [planRulesEditing, setPlanRulesEditing] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [interestRows, setInterestRows] = useState<any[]>([]);
  const [showInterest, setShowInterest] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/features', { credentials: 'include' });
      const d = await r.json();
      if (d.success) setFeatures(d.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const expand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setEditingId(null);
    // Load plan rules
    const r = await fetch(`/api/admin/features/${id}`, { credentials: 'include' });
    const d = await r.json();
    if (d.success) {
      setPlanRules(d.data.planRules);
      setAllPlans(d.data.allPlans);
      // Initialise plan rules editing state
      const init: Record<number, string> = {};
      for (const plan of d.data.allPlans) {
        const rule = d.data.planRules.find((r: PlanRule) => r.plan_id === plan.id);
        init[plan.id] = rule?.access_type ?? 'hidden';
      }
      setPlanRulesEditing(init);
    }
  };

  const startEdit = (f: PlatformFeature) => {
    setEditingId(f.id);
    setEditForm({ ...f });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/features/${editingId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const d = await r.json();
      if (d.success) {
        setFeatures(prev => prev.map(f => f.id === editingId ? { ...f, ...d.data } : f));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const savePlanRules = async (featureId: number) => {
    setSavingRules(true);
    try {
      const rules = Object.entries(planRulesEditing).map(([plan_id, access_type]) => ({
        plan_id: Number(plan_id), access_type,
      }));
      await fetch(`/api/admin/features/${featureId}/plan-rules`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      // Refresh feature list to update plan_rule_count
      load();
    } finally {
      setSavingRules(false);
    }
  };

  const quickStatus = async (id: number, status: string) => {
    await fetch(`/api/admin/features/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  const loadInterest = async (id: number) => {
    if (showInterest === id) { setShowInterest(null); return; }
    const r = await fetch(`/api/admin/features/${id}/interest`, { credentials: 'include' });
    const d = await r.json();
    if (d.success) { setInterestRows(d.data); setShowInterest(id); }
  };

  const categories = ['all', ...Array.from(new Set(features.map(f => f.category)))];
  const statuses = ['all', ...Array.from(new Set(features.map(f => f.status)))];

  const filtered = features.filter(f => {
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, PlatformFeature[]>>((acc, f) => {
    const cat = f.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Feature Manager — Admin | Profile Centre</title>
        <meta name="description" content="Admin feature manager — control which features and add-ons are visible to customers." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/features" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Feature Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control which features and add-ons are visible to customers. All features are hidden by default.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-sm">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-semibold">All features are hidden by default.</p>
          <p>Set a feature to <strong>Active</strong> to make it available. Then set plan rules to control which plans can access it. Customer overrides can be set from the CRM.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c} value={c} className="text-xs">
                {c === 'all' ? 'All categories' : (CATEGORY_LABELS[c] ?? c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(s => (
              <SelectItem key={s} value={s} className="text-xs">
                {s === 'all' ? 'All statuses' : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} features</span>
      </div>

      {/* Feature list grouped by category */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catFeatures]) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                {CATEGORY_LABELS[cat] ?? cat}
                <span className="font-normal normal-case tracking-normal">({catFeatures.length})</span>
              </h2>
              <div className="space-y-2">
                {catFeatures.map(feature => (
                  <div key={feature.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Row header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => expand(feature.id)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                        aria-expanded={expandedId === feature.id}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{feature.name}</span>
                            {statusBadge(feature.status)}
                            {feature.plan_rule_count > 0 && (
                              <span className="text-xs text-muted-foreground">{feature.plan_rule_count} plan rule{feature.plan_rule_count !== 1 ? 's' : ''}</span>
                            )}
                            {feature.override_count > 0 && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">{feature.override_count} override{feature.override_count !== 1 ? 's' : ''}</span>
                            )}
                            {feature.interest_count > 0 && (
                              <span className="text-xs text-blue-400 dark:text-blue-400">{feature.interest_count} interested</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{feature.description}</p>
                        </div>
                        {expandedId === feature.id ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      </button>

                      {/* Quick status buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {feature.status !== 'active' && (
                          <Button size="sm" className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => quickStatus(feature.id, 'active')}>
                            Activate
                          </Button>
                        )}
                        {feature.status === 'active' && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => quickStatus(feature.id, 'hidden')}>
                            Hide
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEdit(feature)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expandedId === feature.id && (
                      <div className="border-t border-border px-4 py-4 space-y-5 bg-muted/20">

                        {/* Edit form */}
                        {editingId === feature.id ? (
                          <div className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Status</Label>
                                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Pricing type</Label>
                                <Select value={editForm.pricing_type} onValueChange={v => setEditForm(f => ({ ...f, pricing_type: v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {PRICING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Fixed price (£)</Label>
                                <Input type="number" step="0.01" className="h-8 text-xs" value={editForm.fixed_price ?? ''} onChange={e => setEditForm(f => ({ ...f, fixed_price: e.target.value ? Number(e.target.value) : null }))} placeholder="e.g. 15.00" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">From price (£)</Label>
                                <Input type="number" step="0.01" className="h-8 text-xs" value={editForm.from_price ?? ''} onChange={e => setEditForm(f => ({ ...f, from_price: e.target.value ? Number(e.target.value) : null }))} placeholder="e.g. 15.00" />
                              </div>
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs">Coming Soon text (shown to customers)</Label>
                                <Input className="h-8 text-xs" value={editForm.coming_soon_text ?? ''} onChange={e => setEditForm(f => ({ ...f, coming_soon_text: e.target.value }))} placeholder="e.g. Available soon — register your interest below." />
                              </div>
                            </div>

                            {/* Toggle options */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {([
                                ['show_coming_soon',       'Show Coming Soon card'],
                                ['show_upgrade_prompt',    'Show upgrade prompt'],
                                ['require_admin_approval', 'Require admin approval'],
                                ['allow_register_interest','Allow register interest'],
                                ['dashboard_icon_visible', 'Dashboard icon visible'],
                                ['menu_visible',           'Menu visible'],
                                ['request_form_enabled',   'Request form enabled'],
                                ['portal_comms_enabled',   'Portal comms enabled'],
                                ['file_uploads_enabled',   'File uploads enabled'],
                                ['proof_download_enabled', 'Proof download enabled'],
                                ['final_file_enabled',     'Final file enabled'],
                              ] as [keyof PlatformFeature, string][]).map(([key, label]) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer">
                                  <button
                                    type="button"
                                    onClick={() => setEditForm(f => ({ ...f, [key]: f[key] ? 0 : 1 }))}
                                    className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${editForm[key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                                    aria-pressed={!!editForm[key]}
                                  >
                                    <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${editForm[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                                  </button>
                                  <span className="text-xs text-foreground">{label}</span>
                                </label>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={saveEdit} disabled={saving} className="gap-1.5 text-xs">
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save changes
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-xs gap-1.5">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Read-only summary */
                          <div className="grid sm:grid-cols-3 gap-3 text-xs">
                            <div><span className="text-muted-foreground">Pricing:</span> <span className="font-medium">{PRICING_OPTIONS.find(o => o.value === feature.pricing_type)?.label ?? feature.pricing_type}</span></div>
                            {feature.fixed_price != null && <div><span className="text-muted-foreground">Fixed price:</span> <span className="font-medium">£{feature.fixed_price.toFixed(2)}</span></div>}
                            {feature.from_price != null && <div><span className="text-muted-foreground">From:</span> <span className="font-medium">£{feature.from_price.toFixed(2)}</span></div>}
                            <div><span className="text-muted-foreground">Admin approval:</span> <span className="font-medium">{feature.require_admin_approval ? 'Yes' : 'No'}</span></div>
                            <div><span className="text-muted-foreground">Register interest:</span> <span className="font-medium">{feature.allow_register_interest ? 'Enabled' : 'Disabled'}</span></div>
                            <div><span className="text-muted-foreground">Dashboard icon:</span> <span className="font-medium">{feature.dashboard_icon_visible ? 'Visible' : 'Hidden'}</span></div>
                          </div>
                        )}

                        <Separator />

                        {/* Plan rules */}
                        <div>
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5" /> Plan access rules
                          </h3>
                          {allPlans.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No plans found.</p>
                          ) : (
                            <div className="space-y-2">
                              {allPlans.map(plan => (
                                <div key={plan.id} className="flex items-center gap-3">
                                  <span className="text-xs font-medium text-foreground w-28 flex-shrink-0">{plan.name}</span>
                                  <Select
                                    value={planRulesEditing[plan.id] ?? 'hidden'}
                                    onValueChange={v => setPlanRulesEditing(prev => ({ ...prev, [plan.id]: v }))}
                                  >
                                    <SelectTrigger className="h-7 text-xs flex-1 max-w-48">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACCESS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                              <Button size="sm" onClick={() => savePlanRules(feature.id)} disabled={savingRules} className="mt-2 gap-1.5 text-xs">
                                {savingRules ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save plan rules
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Register interest */}
                        {feature.interest_count > 0 && (
                          <>
                            <Separator />
                            <div>
                              <button
                                onClick={() => loadInterest(feature.id)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <Users className="w-3.5 h-3.5" />
                                {showInterest === feature.id ? 'Hide' : 'Show'} {feature.interest_count} interest registration{feature.interest_count !== 1 ? 's' : ''}
                              </button>
                              {showInterest === feature.id && (
                                <div className="mt-3 space-y-2">
                                  {interestRows.map(row => (
                                    <div key={row.id} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-muted/40">
                                      <span className="font-medium text-foreground">{row.user_name}</span>
                                      <span className="text-muted-foreground">{row.user_email}</span>
                                      <span className="text-muted-foreground ml-auto">{row.plan_name ?? 'No plan'}</span>
                                      <span className="text-muted-foreground">{fmtDate(row.created_at)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
