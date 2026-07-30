/**
 * Admin — Add-ons Management
 * /admin/addons
 *
 * Create and manage add-on products, assign them to customers,
 * and track per-customer add-on assignments.
 */
import { useState, useEffect, useCallback } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Package, Plus, Trash2, Edit2, Users, Check, X,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Addon {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  billing_interval: string | null;
  is_active: number;
  customer_count?: number;
  created_at: string;
}

interface AddonCustomer {
  user_id: number;
  email: string;
  name: string;
  assigned_at: string;
  expires_at: string | null;
  notes: string | null;
}

interface User {
  id: number;
  email: string;
  name: string;
}


function fmtPrice(p: number | null) {
  if (p === null || p === undefined) return 'Free';
  if (p === 0) return 'Free';
  return `£${(p / 100).toFixed(2)}`;
}

export default function AdminAddons() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Record<number, AddonCustomer[]>>({});
  const [customersLoading, setCustomersLoading] = useState<Record<number, boolean>>({});

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createInterval, setCreateInterval] = useState('monthly');
  const [createLoading, setCreateLoading] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);

  // Assign
  const [assignAddonId, setAssignAddonId] = useState<number | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignUsers, setAssignUsers] = useState<User[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignErr, setAssignErr] = useState('');
  const [assignMsg, setAssignMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/addons', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setAddons(d.addons ?? []);
        else setErr(d.error ?? 'Failed to load add-ons');
      })
      .catch(() => setErr('Network error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCustomers = (addonId: number) => {
    if (customers[addonId]) return;
    setCustomersLoading(p => ({ ...p, [addonId]: true }));
    fetch(`/api/admin/addons/${addonId}/customers`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setCustomers(p => ({ ...p, [addonId]: d.customers ?? [] }));
      })
      .finally(() => setCustomersLoading(p => ({ ...p, [addonId]: false })));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadCustomers(id);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createSlug.trim()) { setCreateErr('Name and slug are required.'); return; }
    setCreateLoading(true); setCreateErr('');
    const r = await fetch('/api/admin/addons', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createName.trim(),
        slug: createSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        description: createDesc.trim() || null,
        price: createPrice ? Math.round(parseFloat(createPrice) * 100) : 0,
        billing_interval: createInterval,
      }),
    });
    const d = await r.json();
    setCreateLoading(false);
    if (d.success) {
      setShowCreate(false);
      setCreateName(''); setCreateSlug(''); setCreateDesc(''); setCreatePrice('');
      load();
    } else {
      setCreateErr(d.error ?? 'Failed to create add-on');
    }
  };

  const startEdit = (a: Addon) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditDesc(a.description ?? '');
    setEditPrice(a.price !== null ? (a.price / 100).toFixed(2) : '');
    setEditActive(!!a.is_active);
  };

  const saveEdit = async (id: number) => {
    setEditLoading(true);
    const r = await fetch(`/api/admin/addons/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDesc.trim() || null,
        price: editPrice ? Math.round(parseFloat(editPrice) * 100) : 0,
        is_active: editActive ? 1 : 0,
      }),
    });
    const d = await r.json();
    setEditLoading(false);
    if (d.success) { setEditingId(null); load(); }
  };

  const deleteAddon = async (id: number, name: string) => {
    if (!confirm(`Delete add-on "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/addons/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  const searchUsers = async (q: string) => {
    setAssignSearch(q);
    if (q.length < 2) { setAssignUsers([]); return; }
    const r = await fetch(`/api/admin/notifications/user-search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d = await r.json();
    if (d.success) setAssignUsers(d.users ?? []);
  };

  const handleAssign = async () => {
    if (!assignAddonId || !assignUserId) { setAssignErr('Select a user first.'); return; }
    setAssignLoading(true); setAssignErr(''); setAssignMsg('');
    const r = await fetch('/api/admin/addons/assign', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addon_id: assignAddonId, user_id: Number(assignUserId), notes: assignNotes || null }),
    });
    const d = await r.json();
    setAssignLoading(false);
    if (d.success) {
      setAssignMsg('Add-on assigned successfully.');
      setAssignUserId(''); setAssignSearch(''); setAssignUsers([]); setAssignNotes('');
      setCustomers(p => { const n = { ...p }; delete n[assignAddonId]; return n; });
      loadCustomers(assignAddonId);
    } else {
      setAssignErr(d.error ?? 'Failed to assign');
    }
  };

  const removeAssignment = async (addonId: number, userId: number) => {
    if (!confirm('Remove this add-on from the customer?')) return;
    await fetch(`/api/admin/addons/assign/${userId}/${addonId}`, { method: 'DELETE', credentials: 'include' });
    setCustomers(p => { const n = { ...p }; delete n[addonId]; return n; });
    loadCustomers(addonId);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0 space-y-6">
      <Helmet>
        <title>Add-ons — Admin Portal</title>
        <meta name="description" content="Manage add-on products and customer assignments." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/addons" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Add-ons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage add-on products, assign to customers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Add-on
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{err}</p>}

      {/* Create form */}
      {showCreate && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">New Add-on</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {createErr && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{createErr}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
                <Input value={createName} onChange={e => { setCreateName(e.target.value); setCreateSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }} placeholder="e.g. Priority Support" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Slug *</label>
                <Input value={createSlug} onChange={e => setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="e.g. priority-support" className="h-8 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Price (£)</label>
                <Input type="number" min="0" step="0.01" value={createPrice} onChange={e => setCreatePrice(e.target.value)} placeholder="0.00 = free" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Billing interval</label>
                <Select value={createInterval} onValueChange={setCreateInterval}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Description</label>
              <Textarea value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What does this add-on include?" rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setCreateErr(''); }}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={createLoading} className="gap-1.5">
                {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add-ons list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : addons.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No add-ons yet. Create your first one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addons.map(a => (
            <Card key={a.id} className="bg-card border-border">
              <CardContent className="p-4">
                {editingId === a.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
                        <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">Price (£)</label>
                        <Input type="number" min="0" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium block mb-1">Description</label>
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className="text-sm resize-none" />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="rounded" />
                        Active
                      </label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => saveEdit(a.id)} disabled={editLoading} className="gap-1.5">
                        {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{a.name}</p>
                          <Badge className={`text-xs border-0 ${a.is_active ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                            {a.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge className="text-xs border-0 bg-primary/10 text-primary">{fmtPrice(a.price)}</Badge>
                          {a.billing_interval && <Badge className="text-xs border-0 bg-muted text-muted-foreground">{a.billing_interval}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{a.slug}</p>
                        {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Created {fmtDate(a.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(a)} className="h-7 w-7 p-0">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteAddon(a.id, a.name)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(a.id)} className="h-7 w-7 p-0">
                          {expandedId === a.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: customers + assign */}
                    {expandedId === a.id && (
                      <div className="mt-4 pt-4 border-t border-border space-y-4">
                        {/* Assign to user */}
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Assign to customer</p>
                          {assignMsg && assignAddonId === a.id && <p className="text-xs text-green-400 bg-green-500/10 rounded px-3 py-2 mb-2">{assignMsg}</p>}
                          {assignErr && assignAddonId === a.id && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2 mb-2">{assignErr}</p>}
                          <div className="flex gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-48">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input
                                value={assignSearch}
                                onChange={e => { setAssignAddonId(a.id); searchUsers(e.target.value); }}
                                placeholder="Search by name or email…"
                                className="h-8 text-xs pl-8"
                              />
                            </div>
                            {assignUsers.length > 0 && assignAddonId === a.id && (
                              <Select value={assignUserId} onValueChange={setAssignUserId}>
                                <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Select user" /></SelectTrigger>
                                <SelectContent>
                                  {assignUsers.map(u => (
                                    <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.name} — {u.email}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="Notes (optional)" className="h-8 text-xs w-40" />
                            <Button size="sm" onClick={() => { setAssignAddonId(a.id); handleAssign(); }} disabled={assignLoading || !assignUserId} className="h-8 text-xs gap-1">
                              {assignLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Assign
                            </Button>
                          </div>
                        </div>

                        {/* Customers list */}
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-2">Current customers</p>
                          {customersLoading[a.id] ? (
                            <p className="text-xs text-muted-foreground">Loading…</p>
                          ) : !customers[a.id] || customers[a.id].length === 0 ? (
                            <p className="text-xs text-muted-foreground">No customers assigned yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {customers[a.id].map(c => (
                                <div key={c.user_id} className="flex items-center justify-between gap-3 bg-muted/30 rounded-lg px-3 py-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                    <p className="text-xs text-muted-foreground">Assigned {fmtDate(c.assigned_at)}{c.expires_at ? ` · Expires ${fmtDate(c.expires_at)}` : ''}</p>
                                    {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => removeAssignment(a.id, c.user_id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
