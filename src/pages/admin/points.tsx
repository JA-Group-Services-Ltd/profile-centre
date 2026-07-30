/**
 * Admin — Points & Rewards Management
 *
 * Tabs:
 *  1. Store Items  — add / edit / toggle / delete perks in the catalogue
 *  2. User Balances — view every user's balance, achievements, redeemed perks
 *  3. Recent Achievements — last 50 earned achievements across all users (with timestamps)
 *
 * Admins CANNOT redeem points on behalf of users.
 * Points have no monetary value — UK regulatory compliance.
 */
import { useState, useEffect, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Coins, Trophy, Users, TrendingUp, Gift, Search,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Info, CheckCircle2, Clock, Save, X, AlertTriangle,
  RefreshCw, Package,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface StoreItem {
  id: number;
  key: string;
  title: string;
  description: string;
  cost: number;
  category: string;
  icon: string;
  color: string;
  is_active: number;
  repeatable: number;
  sort_order: number;
}

interface UserSummary {
  id: number;
  name: string;
  email: string;
  planName: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  earnedCount: number;
  totalAchievements: number;
  redeemedPerks: string[];
}

interface RecentAchievement {
  user_id: number;
  achievement_key: string;
  achievement_name: string;
  points: number;
  earned_at: string;
}

interface OverviewData {
  users: UserSummary[];
  recentAchievements: RecentAchievement[];
  totals: {
    totalPointsInCirculation: number;
    totalPointsEverEarned: number;
    totalRedemptions: number;
    usersWithPoints: number;
    totalUsers: number;
  };
}

// ── Category options ───────────────────────────────────────────────────────

const CATEGORIES = ['theme', 'badge', 'boost', 'feature', 'other'] as const;
const CATEGORY_COLORS: Record<string, string> = {
  theme:   'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  badge:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  boost:   'bg-pink-500/10 text-pink-400 border-pink-500/20',
  feature: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  other:   'bg-muted text-muted-foreground border-border',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Blank form ─────────────────────────────────────────────────────────────

const BLANK: Omit<StoreItem, 'id'> = {
  key: '', title: '', description: '', cost: 100,
  category: 'feature', icon: 'gift', color: 'text-primary',
  is_active: 1, repeatable: 0, sort_order: 0,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminPointsPage() {
  const [activeTab, setActiveTab] = useState<'store' | 'users' | 'recent'>('store');

  // Store items state
  const [items, setItems] = useState<StoreItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [form, setForm] = useState<Omit<StoreItem, 'id'>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Overview state
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Load store items
  const loadItems = () => {
    setItemsLoading(true);
    setItemsError(null);
    fetch('/api/admin/store-items', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.items); else setItemsError(d.error); })
      .catch(() => setItemsError('Network error'))
      .finally(() => setItemsLoading(false));
  };

  // Load overview (lazy — only when tab is opened)
  const loadOverview = () => {
    setOverviewLoading(true);
    setOverviewError(null);
    fetch('/api/admin/points-overview', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setOverview(d.data); else setOverviewError(d.error); })
      .catch(() => setOverviewError('Network error'))
      .finally(() => setOverviewLoading(false));
  };

  useEffect(() => { loadItems(); }, []);
  useEffect(() => {
    if ((activeTab === 'users' || activeTab === 'recent') && !overview) loadOverview();
  }, [activeTab]);

  // Open add form
  const openAdd = () => {
    setEditingItem(null);
    setForm(BLANK);
    setSaveError(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Open edit form
  const openEdit = (item: StoreItem) => {
    setEditingItem(item);
    setForm({ key: item.key, title: item.title, description: item.description, cost: item.cost,
               category: item.category, icon: item.icon, color: item.color,
               is_active: item.is_active, repeatable: item.repeatable, sort_order: item.sort_order });
    setSaveError(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const closeForm = () => { setShowForm(false); setEditingItem(null); setSaveError(null); };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.title.trim()) { setSaveError('Title is required'); return; }
    if (!form.key.trim() && !editingItem) { setSaveError('Key is required'); return; }
    if (form.cost < 1) { setSaveError('Cost must be at least 1 point'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const url = editingItem ? `/api/admin/store-items/${editingItem.id}` : '/api/admin/store-items';
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        loadItems();
        closeForm();
      } else {
        setSaveError(data.error || 'Save failed');
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const handleToggle = async (item: StoreItem) => {
    setTogglingId(item.id);
    try {
      await fetch(`/api/admin/store-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      loadItems();
    } finally {
      setTogglingId(null);
    }
  };

  // Delete
  const handleDelete = async (item: StoreItem) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone. Existing redemptions are preserved.`)) return;
    setDeletingId(item.id);
    try {
      await fetch(`/api/admin/store-items/${item.id}`, { method: 'DELETE', credentials: 'include' });
      loadItems();
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered users
  const filteredUsers = (overview?.users ?? [])
    .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.balance - a.balance);

  const totals = overview?.totals;

  return (
    <>
      <Helmet>
        <title>Points & Rewards — Admin</title>
        <meta name="description" content="Manage the points store catalogue and view user rewards data." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/points" />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Coins className="w-6 h-6 text-amber-500" /> Points & Rewards
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the store catalogue and view user points data. Redemption is user-initiated only.
        </p>
      </div>

      {/* Compliance notice */}
      <div className="flex items-start gap-2.5 bg-muted/40 border border-border rounded-xl px-4 py-3 mb-6 text-xs text-muted-foreground">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Points have no monetary value and cannot be exchanged for cash or cash equivalents.
          Users cannot purchase points. Perks are platform features only — UK regulatory compliance.
        </span>
      </div>

      {/* Platform totals (shown when overview loaded) */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Coins className="w-6 h-6 text-amber-500 mb-1" />
              <p className="text-2xl font-extrabold text-foreground">{totals.totalPointsInCirculation.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">In circulation</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <TrendingUp className="w-6 h-6 text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{totals.totalPointsEverEarned.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total earned</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Gift className="w-6 h-6 text-purple-400 mb-1" />
              <p className="text-2xl font-bold text-foreground">{totals.totalRedemptions.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Perks redeemed</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <Users className="w-6 h-6 text-blue-400 mb-1" />
              <p className="text-2xl font-bold text-foreground">{totals.usersWithPoints}</p>
              <p className="text-xs text-muted-foreground">Users with points</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([
          { id: 'store',  label: 'Store Catalogue', icon: <Package className="w-4 h-4" /> },
          { id: 'users',  label: 'User Balances',   icon: <Users className="w-4 h-4" /> },
          { id: 'recent', label: 'Achievements',    icon: <Trophy className="w-4 h-4" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Store Catalogue ─────────────────────────────────────────── */}
      {activeTab === 'store' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {items.filter(i => i.is_active).length} active · {items.length} total
            </p>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add perk
            </Button>
          </div>

          {/* Add / Edit form */}
          {showForm && (
            <div ref={formRef}>
              <Card className="border-primary/30 bg-primary/5 mb-6">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground">
                      {editingItem ? `Edit: ${editingItem.title}` : 'Add new perk'}
                    </h2>
                    <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Key — only on create */}
                    {!editingItem && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          Key <span className="text-destructive">*</span>
                          <span className="ml-1 font-normal">(lowercase, underscores only)</span>
                        </label>
                        <Input
                          value={form.key}
                          onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                          placeholder="e.g. theme_ocean"
                          className="text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Title <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Ocean Theme"
                        className="text-sm"
                      />
                    </div>

                    <div className={editingItem ? 'sm:col-span-2' : ''}>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                      <Input
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Short description shown to users"
                        className="text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Cost (points) <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={form.cost}
                        onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value) }))}
                        className="text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                      <select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Sort order</label>
                      <Input
                        type="number"
                        min={0}
                        value={form.sort_order}
                        onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-6 sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!form.is_active}
                          onChange={e => setForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
                          className="rounded"
                        />
                        <span className="text-sm text-foreground">Active (visible to users)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!form.repeatable}
                          onChange={e => setForm(f => ({ ...f, repeatable: e.target.checked ? 1 : 0 }))}
                          className="rounded"
                        />
                        <span className="text-sm text-foreground">Repeatable (can redeem multiple times)</span>
                      </label>
                    </div>
                  </div>

                  {saveError && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {saveError}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                      {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {saving ? 'Saving…' : editingItem ? 'Save changes' : 'Create perk'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={closeForm}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Items list */}
          {itemsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : itemsError ? (
            <p className="text-center text-destructive py-8 text-sm">{itemsError}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No store items yet. Add your first perk above.</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const catColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.other;
                return (
                  <Card key={item.id} className={`border transition-all ${item.is_active ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                            <Badge className={`text-[10px] px-1.5 py-0 border ${catColor}`}>
                              {item.category}
                            </Badge>
                            {!item.is_active && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                            {!!item.repeatable && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-400 border-blue-500/20">
                                Repeatable
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Key: <code className="text-foreground">{item.key}</code>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-base font-bold text-amber-500">{item.cost.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">pts</p>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Toggle active */}
                            <button
                              onClick={() => handleToggle(item)}
                              disabled={togglingId === item.id}
                              title={item.is_active ? 'Deactivate' : 'Activate'}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              {item.is_active
                                ? <ToggleRight className="w-4 h-4 text-green-400" />
                                : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => openEdit(item)}
                              title="Edit"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                              title="Delete"
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      )}

      {/* ── Tab: User Balances ─────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          {overviewLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : overviewError ? (
            <p className="text-center text-destructive py-8 text-sm">{overviewError}</p>
          ) : (
            <>
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} — sorted by balance
              </p>
              <div className="space-y-2">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No users found.</p>
                ) : filteredUsers.map(u => (
                  <Card key={u.id} className="border-border bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                              {u.planName}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-5 flex-shrink-0 flex-wrap">
                          <div className="text-center">
                            <p className="text-lg font-extrabold text-amber-500">{u.balance.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">balance</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-foreground">{u.totalEarned.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">earned</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-foreground">{u.totalSpent.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">spent</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-foreground">{u.earnedCount}/{u.totalAchievements}</p>
                            <p className="text-[10px] text-muted-foreground">achievements</p>
                          </div>
                        </div>
                        {u.redeemedPerks.length > 0 && (
                          <div className="w-full mt-2 pt-2 border-t border-border flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-muted-foreground self-center mr-1">Redeemed:</span>
                            {u.redeemedPerks.map(pk => (
                              <span key={pk} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                                <CheckCircle2 className="w-3 h-3 text-green-400" />
                                {items.find(i => i.key === pk)?.title ?? pk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Recent Achievements ──────────────────────────────────────── */}
      {activeTab === 'recent' && (
        <div>
          {overviewLoading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : overviewError ? (
            <p className="text-center text-destructive py-8 text-sm">{overviewError}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">
                Last 50 achievements earned across all users, most recent first. Timestamps show when each achievement was first earned.
              </p>
              {(overview?.recentAchievements ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No achievements earned yet.</p>
              ) : (
                <div className="space-y-2">
                  {(overview?.recentAchievements ?? []).map((a, i) => {
                    const user = overview?.users.find(u => u.id === a.user_id);
                    return (
                      <Card key={i} className="border-border bg-card">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{a.achievement_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user ? `${user.name} · ${user.email}` : `User #${a.user_id}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 text-right">
                            <div>
                              <p className="text-sm font-bold text-amber-500">+{a.points} pts</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
                                <Clock className="w-3 h-3" />
                                {a.earned_at ? fmtDateTime(a.earned_at) : 'Unknown'}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
