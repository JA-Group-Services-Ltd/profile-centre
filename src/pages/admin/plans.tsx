import { useState, useEffect } from 'react';
import { Edit2, Check, X, Plus, Infinity, CreditCard, Trash2, Users, ChevronDown, ChevronUp, Globe, EyeOff } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Plan {
  id: number; name: string; slug: string;
  price_monthly: number; price_yearly: number;
  max_profiles: number; max_links: number; max_seats: number;
  has_qr_download: number; has_contact_form: number;
  has_advanced_analytics: number; has_vcard_download: number;
  has_custom_themes: number; remove_branding: number;
  has_lifetime: number; has_messaging: number; is_active: number; is_public: number;
  max_themes: number;
  stripe_price_monthly: string | null; stripe_price_yearly: string | null; stripe_price_lifetime: string | null;
  stripe_product_id: string | null;
}

const BOOL_FEATURES = [
  { key: 'has_qr_download', label: 'QR Download' },
  { key: 'has_contact_form', label: 'Contact Form' },
  { key: 'has_advanced_analytics', label: 'Advanced Analytics' },
  { key: 'has_vcard_download', label: 'vCard Download' },
  { key: 'has_custom_themes', label: 'Custom Themes' },
  { key: 'remove_branding', label: 'Remove Branding' },
  { key: 'has_profile_link_customisation', label: 'Profile Link Customisation' },
  { key: 'has_lifetime', label: 'Lifetime Option' },
];

const DEFAULT_NEW_PLAN = {
  name: '', slug: '',
  price_monthly: '', price_yearly: '',
  max_profiles: '1', max_links: '5', max_seats: '1', max_themes: '-1',
  has_qr_download: false, has_contact_form: false, has_advanced_analytics: false,
  has_vcard_download: false, has_custom_themes: false, remove_branding: false,
  has_profile_link_customisation: false, has_lifetime: false, has_messaging: false,
  is_public: false,
  stripe_price_monthly: '', stripe_price_yearly: '', stripe_price_lifetime: '', stripe_product_id: '',
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Plan>>({});
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlan, setNewPlan] = useState({ ...DEFAULT_NEW_PLAN });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch('/api/admin/plans', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditData({ ...plan });
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editData),
    });
    const data = await res.json();
    if (data.success) {
      setPlans(p => p.map(x => x.id === id ? data.data : x));
      setEditingId(null);
    }
    setSaving(false);
  };

  const toggleActive = async (plan: Plan) => {
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_active: plan.is_active ? 0 : 1 }),
    });
    const data = await res.json();
    if (data.success) setPlans(p => p.map(x => x.id === plan.id ? data.data : x));
  };

  const togglePublic = async (plan: Plan) => {
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_public: plan.is_public ? 0 : 1 }),
    });
    const data = await res.json();
    if (data.success) setPlans(p => p.map(x => x.id === plan.id ? data.data : x));
  };

  const createPlan = async () => {
    if (!newPlan.name || !newPlan.slug) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/api/admin/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: newPlan.name,
        slug: newPlan.slug,
        price_monthly: parseFloat(newPlan.price_monthly) || 0,
        price_yearly: parseFloat(newPlan.price_yearly) || 0,
        max_profiles: parseInt(newPlan.max_profiles) || 1,
        max_links: parseInt(newPlan.max_links) || 5,
        max_seats: parseInt(newPlan.max_seats) || 1,
        max_themes: parseInt(newPlan.max_themes) || -1,
        has_qr_download: newPlan.has_qr_download ? 1 : 0,
        has_contact_form: newPlan.has_contact_form ? 1 : 0,
        has_advanced_analytics: newPlan.has_advanced_analytics ? 1 : 0,
        has_vcard_download: newPlan.has_vcard_download ? 1 : 0,
        has_custom_themes: newPlan.has_custom_themes ? 1 : 0,
        remove_branding: newPlan.remove_branding ? 1 : 0,
        has_profile_link_customisation: newPlan.has_profile_link_customisation ? 1 : 0,
        has_lifetime: newPlan.has_lifetime ? 1 : 0,
        has_messaging: newPlan.has_messaging ? 1 : 0,
        is_public: newPlan.is_public ? 1 : 0,
        stripe_price_monthly: newPlan.stripe_price_monthly || null,
        stripe_price_yearly: newPlan.stripe_price_yearly || null,
        stripe_price_lifetime: newPlan.stripe_price_lifetime || null,
        stripe_product_id: newPlan.stripe_product_id || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setPlans(p => [...p, data.data]);
      setShowCreate(false);
      setNewPlan({ ...DEFAULT_NEW_PLAN });
      setShowAdvanced(false);
    } else {
      setCreateError(data.error || 'Failed to create plan');
    }
    setCreating(false);
  };

  const deletePlan = async (plan: Plan) => {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    setDeletingId(plan.id);
    setDeleteError(null);
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      setPlans(p => p.filter(x => x.id !== plan.id));
    } else {
      setDeleteError(data.error || 'Failed to delete plan');
    }
    setDeletingId(null);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto">
      <Skeleton className="h-8 w-48 mb-8" />
      <div className="grid sm:grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Manage Plans — Admin</title>
        <meta name="description" content="Configure subscription plans, pricing and Stripe product IDs." />
        <link rel="canonical" href="/admin/plans" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Plans</h1>
          <p className="text-muted-foreground mt-1">Configure subscription plans, pricing and Stripe product IDs</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreateError(null); }} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      {/* ── Create Plan ─────────────────────────────────────────────────────── */}
      {showCreate && (
        <Card className="bg-card border-border mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create New Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {createError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{createError}</div>
            )}

            {/* Basic info */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Plan Name *</Label>
                <Input value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Enterprise" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Slug * (URL-safe, unique)</Label>
                <Input value={newPlan.slug} onChange={e => setNewPlan(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  placeholder="e.g. enterprise" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Monthly Price (£)</Label>
                <Input type="number" min="0" step="0.01" value={newPlan.price_monthly}
                  onChange={e => setNewPlan(p => ({ ...p, price_monthly: e.target.value }))}
                  placeholder="0" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Yearly Price (£)</Label>
                <Input type="number" min="0" step="0.01" value={newPlan.price_yearly}
                  onChange={e => setNewPlan(p => ({ ...p, price_yearly: e.target.value }))}
                  placeholder="0" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max Profiles</Label>
                <Input type="number" min="1" value={newPlan.max_profiles}
                  onChange={e => setNewPlan(p => ({ ...p, max_profiles: e.target.value }))}
                  placeholder="1" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max Links</Label>
                <Input type="number" min="1" value={newPlan.max_links}
                  onChange={e => setNewPlan(p => ({ ...p, max_links: e.target.value }))}
                  placeholder="5" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Max Seats</Label>
                <Input type="number" min="1" value={newPlan.max_seats}
                  onChange={e => setNewPlan(p => ({ ...p, max_seats: e.target.value }))}
                  placeholder="1" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max Themes (1 = free only, -1 = all)</Label>
                <Input type="number" value={newPlan.max_themes}
                  onChange={e => setNewPlan(p => ({ ...p, max_themes: e.target.value }))}
                  placeholder="-1" className="bg-background border-border" />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Feature toggles */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Features</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {BOOL_FEATURES.map(f => (
                  <div key={f.key} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <Switch
                      checked={!!(newPlan as Record<string, unknown>)[f.key]}
                      onCheckedChange={v => setNewPlan(p => ({ ...p, [f.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Visibility */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-foreground">Show on public pricing page</p>
                <p className="text-xs text-muted-foreground">When enabled, this plan appears on the public /pricing page immediately</p>
              </div>
              <Switch
                checked={!!newPlan.is_public}
                onCheckedChange={v => setNewPlan(p => ({ ...p, is_public: v }))}
              />
            </div>

            <Separator className="bg-border" />

            {/* Stripe IDs — collapsible */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Stripe Price IDs (optional)
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Monthly Price ID</Label>
                    <Input value={newPlan.stripe_price_monthly}
                      onChange={e => setNewPlan(p => ({ ...p, stripe_price_monthly: e.target.value }))}
                      placeholder="price_..." className="bg-background border-border h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Yearly Price ID</Label>
                    <Input value={newPlan.stripe_price_yearly}
                      onChange={e => setNewPlan(p => ({ ...p, stripe_price_yearly: e.target.value }))}
                      placeholder="price_..." className="bg-background border-border h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Lifetime Price ID</Label>
                    <Input value={newPlan.stripe_price_lifetime}
                      onChange={e => setNewPlan(p => ({ ...p, stripe_price_lifetime: e.target.value }))}
                      placeholder="price_..." className="bg-background border-border h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Product ID</Label>
                    <Input value={newPlan.stripe_product_id}
                      onChange={e => setNewPlan(p => ({ ...p, stripe_product_id: e.target.value }))}
                      placeholder="prod_..." className="bg-background border-border h-8 text-xs font-mono" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={createPlan} disabled={creating || !newPlan.name || !newPlan.slug}
                className="bg-primary hover:bg-primary/90">
                {creating ? 'Creating…' : 'Create Plan'}
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setNewPlan({ ...DEFAULT_NEW_PLAN }); setShowAdvanced(false); setCreateError(null); }} className="border-border">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {deleteError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className={`bg-card border-border ${!plan.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {!!plan.has_lifetime && (
                    <Badge className="bg-blue-500/10 text-blue-400 border-0 text-xs gap-1">
                      <Infinity className="w-3 h-3" /> Lifetime
                    </Badge>
                  )}
                  {plan.price_monthly === 0 && (
                    <Badge className="bg-muted text-muted-foreground border-0 text-xs">Free</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Public visibility toggle */}
                  <button
                    onClick={() => togglePublic(plan)}
                    title={plan.is_public ? 'Shown on public pricing page — click to hide' : 'Hidden from public pricing page — click to show'}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      plan.is_public
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {plan.is_public ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {plan.is_public ? 'Public' : 'Hidden'}
                  </button>
                  <Switch checked={!!plan.is_active} onCheckedChange={() => toggleActive(plan)} />
                  {editingId === plan.id ? (
                    <>
                      <button onClick={() => saveEdit(plan.id)} disabled={saving}
                        className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(plan)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deletePlan(plan)} disabled={deletingId === plan.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {editingId === plan.id ? (
                <>
                  {/* Pricing */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Pricing</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Monthly (£)</Label>
                        <Input type="number" value={editData.price_monthly ?? plan.price_monthly}
                          onChange={e => setEditData(d => ({ ...d, price_monthly: parseFloat(e.target.value) }))}
                          className="mt-1 h-8 text-sm bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Yearly (£)</Label>
                        <Input type="number" value={editData.price_yearly ?? plan.price_yearly}
                          onChange={e => setEditData(d => ({ ...d, price_yearly: parseFloat(e.target.value) }))}
                          className="mt-1 h-8 text-sm bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max Profiles</Label>
                        <Input type="number" value={editData.max_profiles ?? plan.max_profiles}
                          onChange={e => setEditData(d => ({ ...d, max_profiles: parseInt(e.target.value) }))}
                          className="mt-1 h-8 text-sm bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max Links</Label>
                        <Input type="number" value={editData.max_links ?? plan.max_links}
                          onChange={e => setEditData(d => ({ ...d, max_links: parseInt(e.target.value) }))}
                          className="mt-1 h-8 text-sm bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> Max Seats
                        </Label>
                        <Input type="number" value={editData.max_seats ?? plan.max_seats ?? 1}
                          onChange={e => setEditData(d => ({ ...d, max_seats: parseInt(e.target.value) }))}
                          className="mt-1 h-8 text-sm bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max Themes (1=free only, -1=all)</Label>
                        <Input type="number" value={editData.max_themes ?? plan.max_themes ?? -1}
                          onChange={e => setEditData(d => ({ ...d, max_themes: parseInt(e.target.value) }))}
                          className="mt-1 h-8 text-sm bg-background border-border" />
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Stripe Price IDs */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Stripe Price IDs
                    </p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Monthly Price ID</Label>
                        <Input value={editData.stripe_price_monthly ?? plan.stripe_price_monthly ?? ''}
                          onChange={e => setEditData(d => ({ ...d, stripe_price_monthly: e.target.value }))}
                          placeholder="price_..." className="mt-1 h-8 text-xs bg-background border-border font-mono" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Yearly Price ID</Label>
                        <Input value={editData.stripe_price_yearly ?? plan.stripe_price_yearly ?? ''}
                          onChange={e => setEditData(d => ({ ...d, stripe_price_yearly: e.target.value }))}
                          placeholder="price_..." className="mt-1 h-8 text-xs bg-background border-border font-mono" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Lifetime Price ID</Label>
                        <Input value={editData.stripe_price_lifetime ?? plan.stripe_price_lifetime ?? ''}
                          onChange={e => setEditData(d => ({ ...d, stripe_price_lifetime: e.target.value }))}
                          placeholder="price_..." className="mt-1 h-8 text-xs bg-background border-border font-mono" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Product ID</Label>
                        <Input value={editData.stripe_product_id ?? plan.stripe_product_id ?? ''}
                          onChange={e => setEditData(d => ({ ...d, stripe_product_id: e.target.value }))}
                          placeholder="prod_..." className="mt-1 h-8 text-xs bg-background border-border font-mono" />
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Features */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Features</p>
                    <div className="space-y-2">
                      {BOOL_FEATURES.map(f => (
                        <div key={f.key} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{f.label}</span>
                          <Switch
                            checked={!!(editData[f.key as keyof Plan] ?? plan[f.key as keyof Plan])}
                            onCheckedChange={v => setEditData(d => ({ ...d, [f.key]: v ? 1 : 0 }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Pricing display */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monthly</span>
                      <span className="text-foreground font-medium">{plan.price_monthly === 0 ? 'Free' : `£${plan.price_monthly}/mo`}</span>
                    </div>
                    {plan.price_yearly > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Yearly</span>
                        <span className="text-foreground">£{plan.price_yearly}/yr</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profiles</span>
                      <span className="text-foreground">{plan.max_profiles >= 999 ? 'Unlimited' : plan.max_profiles}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Links</span>
                      <span className="text-foreground">{plan.max_links >= 999 ? 'Unlimited' : plan.max_links}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Seats</span>
                      <span className="text-foreground">{(plan.max_seats ?? 1) >= 999 ? 'Unlimited' : (plan.max_seats ?? 1)}</span>
                    </div>
                    {/* Messaging and Custom Domain removed from product */}
                  </div>

                  {/* Stripe IDs */}
                  {(plan.stripe_price_monthly || plan.stripe_price_yearly || plan.stripe_price_lifetime) && (
                    <>
                      <Separator className="bg-border" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                          <CreditCard className="w-3 h-3" /> Stripe IDs
                        </p>
                        {plan.stripe_price_monthly && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Monthly</span>
                            <span className="font-mono text-foreground/70 truncate max-w-[140px]">{plan.stripe_price_monthly}</span>
                          </div>
                        )}
                        {plan.stripe_price_yearly && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Yearly</span>
                            <span className="font-mono text-foreground/70 truncate max-w-[140px]">{plan.stripe_price_yearly}</span>
                          </div>
                        )}
                        {plan.stripe_price_lifetime && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Lifetime</span>
                            <span className="font-mono text-foreground/70 truncate max-w-[140px]">{plan.stripe_price_lifetime}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <Separator className="bg-border" />

                  {/* Features */}
                  <div className="space-y-1.5">
                    {BOOL_FEATURES.map(f => (
                      <div key={f.key} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{f.label}</span>
                        <span className={`text-xs font-medium ${plan[f.key as keyof Plan] ? 'text-green-400' : 'text-muted-foreground/40'}`}>
                          {plan[f.key as keyof Plan] ? '✓' : '✗'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

