/**
 * Admin — Users & CRM List
 * /admin/users
 *
 * Shows ALL users (customers + admins). Admin emails are masked server-side.
 * No localStorage — all state is in-memory React only.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Search, UserPlus, Crown, PauseCircle, Infinity,
  Trash2, Globe, Loader2, X,
  Users, TrendingUp, Clock,
  RefreshCw, Ban, Shield,
  Calendar, Eye, AlertTriangle, CheckCircle,
  MoreHorizontal, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PinChallenge from '@/components/admin/PinChallenge';
import CrmPinGate from '@/components/admin/CrmPinGate';

interface User {
  id: number; email: string; name: string; role: string;
  plan_id: number | null; plan_name: string | null; plan_slug: string | null;
  profile_count: number;
  created_at: string; lifetime_access: number; lifetime_plan_id: number | null;
  is_paused: number; pause_reason: string | null;
  subscription_status: string | null; account_status: string | null;
  last_login_at: string | null;
  customer_number: string | null;
}
interface Plan { id: number; name: string; slug: string; }

type FilterType = 'all' | 'lifetime' | 'paused' | 'trial' | 'paid' | 'free' | 'no_plan' | 'blocked';

function statusColor(user: User) {
  if (user.role === 'admin' && !user.plan_id && !user.lifetime_access) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  if (user.lifetime_access) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (user.is_paused) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  if (user.subscription_status === 'past_due') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (user.subscription_status === 'trialing') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  if (user.subscription_status === 'active') return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (user.account_status === 'no_plan') return 'bg-muted text-muted-foreground';
  return 'bg-muted text-muted-foreground';
}

function statusLabel(user: User) {
  if (user.lifetime_access) return 'Lifetime';
  if (user.is_paused) return 'Paused';
  if (user.subscription_status === 'past_due') return 'Past due';
  if (user.subscription_status === 'trialing') return 'Trial';
  if (user.subscription_status === 'active') return 'Active';
  if (user.account_status === 'no_plan') return 'No plan';
  if (user.plan_name) return user.plan_name;
  return 'Free';
}

function UserInitials({ name, email }: { name: string; email: string }) {
  const str = name || email || 'U';
  const initials = str.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
      {initials}
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // Create user
  const [createDialog, setCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPlanId, setCreatePlanId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Global pause
  const [globalPaused, setGlobalPaused] = useState(false);
  const [globalPauseMsg, setGlobalPauseMsg] = useState('');
  const [savingGlobalPause, setSavingGlobalPause] = useState(false);
  const [showGlobalPause, setShowGlobalPause] = useState(false);

  // Per-user pause
  const [pauseDialog, setPauseDialog] = useState<{ open: boolean; user: User | null; pausing: boolean }>({ open: false, user: null, pausing: true });
  const [pauseReason, setPauseReason] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);

  // Delete
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Lifetime
  const [lifetimeDialog, setLifetimeDialog] = useState<{ open: boolean; user: User | null; mode: 'grant' | 'revoke' }>({ open: false, user: null, mode: 'grant' });
  const [lifetimePlanId, setLifetimePlanId] = useState('');
  const [lifetimeLoading, setLifetimeLoading] = useState(false);
  const [lifetimeError, setLifetimeError] = useState('');
  const [lifetimePinPending, setLifetimePinPending] = useState<{ mode: 'grant' | 'revoke'; user: User; planId: string } | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [usersData, plansData, pauseData] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/plans', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/pause', { credentials: 'include' }).then(r => r.json()),
      ]);
      if (usersData.success) setUsers(usersData.data);
      if (plansData.success) setPlans(plansData.data.filter((p: Plan & { is_active: number }) => p.is_active));
      if (pauseData.success) { setGlobalPaused(pauseData.paused); setGlobalPauseMsg(pauseData.message ?? ''); }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveGlobalPause = async (paused: boolean) => {
    setSavingGlobalPause(true);
    await fetch('/api/admin/pause', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ paused, message: globalPauseMsg }),
    });
    setGlobalPaused(paused);
    setSavingGlobalPause(false);
  };

  const confirmPause = async () => {
    if (!pauseDialog.user) return;
    setPauseLoading(true);
    const res = await fetch(`/api/admin/users/${pauseDialog.user.id}/pause`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ paused: pauseDialog.pausing, reason: pauseReason }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers(u => u.map(x => x.id === pauseDialog.user!.id
        ? { ...x, is_paused: pauseDialog.pausing ? 1 : 0, pause_reason: pauseReason || null } : x));
      setPauseDialog({ open: false, user: null, pausing: true });
      setPauseReason('');
    }
    setPauseLoading(false);
  };

  const confirmDelete = async () => {
    if (!deleteDialog.user) return;
    setDeleteLoading(true);
    await fetch(`/api/admin/users/${deleteDialog.user.id}`, { method: 'DELETE', credentials: 'include' });
    setUsers(u => u.filter(x => x.id !== deleteDialog.user!.id));
    setDeleteDialog({ open: false, user: null });
    setDeleteLoading(false);
  };

  const requestLifetimePin = () => {
    if (!lifetimeDialog.user) return;
    if (lifetimeDialog.mode === 'grant' && !lifetimePlanId) { setLifetimeError('Please select a plan first.'); return; }
    setLifetimePinPending({ mode: lifetimeDialog.mode, user: lifetimeDialog.user, planId: lifetimePlanId });
    setLifetimeDialog(d => ({ ...d, open: false }));
  };

  const confirmLifetime = async (token: string) => {
    if (!lifetimePinPending) return;
    const { mode, user, planId } = lifetimePinPending;
    setLifetimePinPending(null);
    setLifetimeLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/lifetime`, {
        method: mode === 'grant' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Pin-Token': token, 'X-Admin-Pin-Action': 'billing_control' },
        credentials: 'include',
        body: mode === 'grant' ? JSON.stringify({ plan_id: parseInt(planId) }) : undefined,
      });
      const data = await res.json();
      if (data.success) setUsers(u => u.map(x => x.id === user.id ? { ...x, ...data.data } : x));
      else setLifetimeError(data.error || 'Failed.');
    } catch { setLifetimeError('Network error.'); }
    finally { setLifetimeLoading(false); }
  };

  const submitCreateUser = async () => {
    if (!createEmail.trim() || !createName.trim()) { setCreateError('Email and name are required.'); return; }
    setCreateLoading(true); setCreateError('');
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: createEmail.trim(), name: createName.trim(), plan_id: createPlanId ? parseInt(createPlanId) : undefined }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers(u => [data.data, ...u]);
      setCreateDialog(false);
      setCreateEmail(''); setCreateName(''); setCreatePlanId('');
    } else {
      setCreateError(data.error || 'Failed to create user.');
    }
    setCreateLoading(false);
  };

  // Stats — all users; admins who are also customers count in both
  const admins = useMemo(() => users.filter(u => u.role === 'admin'), [users]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: admins.length,
    lifetime: users.filter(u => u.lifetime_access).length,
    paused: users.filter(u => u.is_paused).length,
    trial: users.filter(u => u.subscription_status === 'trialing').length,
    paid: users.filter(u => u.subscription_status === 'active').length,
    pastDue: users.filter(u => u.subscription_status === 'past_due').length,
    free: users.filter(u => !u.subscription_status && !u.lifetime_access).length,
  }), [users, admins]);

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'lifetime': return list.filter(u => u.lifetime_access);
      case 'paused':   return list.filter(u => u.is_paused);
      case 'trial':    return list.filter(u => u.subscription_status === 'trialing');
      case 'paid':     return list.filter(u => u.subscription_status === 'active');
      case 'free':     return list.filter(u => !u.subscription_status && !u.lifetime_access);
      case 'no_plan':  return list.filter(u => u.account_status === 'no_plan' || !u.plan_id);
      case 'blocked':  return list.filter(u => (u as User & { is_blocked?: number }).is_blocked);
      default:         return list;
    }
  }, [users, search, filter]);

  const FILTERS: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all',      label: 'All',      count: users.length },
    { key: 'paid',     label: 'Active',   count: stats.paid },
    { key: 'trial',    label: 'Trial',    count: stats.trial },
    { key: 'lifetime', label: 'Lifetime', count: stats.lifetime },
    { key: 'paused',   label: 'Paused',   count: stats.paused },
    { key: 'free',     label: 'Free',     count: stats.free },
    { key: 'no_plan',  label: 'No plan' },
    { key: 'blocked',  label: 'Blocked' },
  ];

  return (
    <CrmPinGate>
    <div className="max-w-6xl mx-auto pb-20 lg:pb-4">
      <Helmet>
        <title>Users & CRM — Admin</title>
        <meta name="description" content="Admin panel: manage all users, plans, and account access." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/users" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <h1 className="sr-only">Users & CRM</h1>

      {/* PIN challenge for lifetime */}
      <PinChallenge
        open={lifetimePinPending !== null}
        action="billing_control"
        actionLabel={lifetimePinPending?.mode === 'grant' ? 'grant lifetime access' : 'revoke lifetime access'}
        onSuccess={confirmLifetime}
        onCancel={() => setLifetimePinPending(null)}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users & CRM</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} user{users.length !== 1 ? 's' : ''} · {admins.length} admin{admins.length !== 1 ? 's' : ''} · {users.length - admins.length} customer{users.length - admins.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing} className="gap-1.5 border-border">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={() => { setCreateEmail(''); setCreateName(''); setCreatePlanId(''); setCreateError(''); setCreateDialog(true); }}
            className="gap-2 bg-primary text-primary-foreground">
            <UserPlus className="w-4 h-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total customers', value: stats.total, icon: Users, color: 'text-primary' },
            { label: 'Active paid', value: stats.paid, icon: TrendingUp, color: 'text-green-400' },
            { label: 'On trial', value: stats.trial, icon: Clock, color: 'text-purple-400' },
            { label: 'Lifetime', value: stats.lifetime, icon: Crown, color: 'text-blue-400' },
          ].map(s => (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Search + filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9 bg-muted/30 border-border"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}>
              {f.label}
              {f.count !== undefined && <span className="ml-1 opacity-70">{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── User list ── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">
              {search ? `No users match "${search}"` : 'No users found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(user => (
            <Card key={user.id} className={`bg-card border-border hover:border-primary/30 transition-colors ${user.role === 'admin' ? 'border-purple-500/20' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <UserInitials name={user.name} email={user.email} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{user.name || '—'}</span>
                      {user.lifetime_access ? <Crown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : null}
                      {user.is_paused ? <PauseCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" /> : null}
                      {user.role === 'admin' && (
                        <Badge className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20 gap-1">
                          <Shield className="w-2.5 h-2.5" /> Admin
                        </Badge>
                      )}
                      <Badge className={`text-xs ${statusColor(user)}`}>{statusLabel(user)}</Badge>
                      {user.plan_name && (
                        <Badge className="text-xs bg-muted text-muted-foreground border-0">{user.plan_name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      {user.customer_number && (
                        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                          UCN {user.customer_number}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        <Globe className="w-3 h-3 inline mr-0.5" />{user.profile_count} profile{user.profile_count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        <Calendar className="w-3 h-3 inline mr-0.5" />Joined {fmtDate(user.created_at)}
                      </span>
                      {user.last_login_at && (
                        <span className="text-xs text-muted-foreground hidden lg:inline">
                          Last login {fmtDate(user.last_login_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Link to={`/admin/users/${user.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs border-border h-8">
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                    </Link>

                    {user.role !== 'admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => { setPauseReason(''); setPauseDialog({ open: true, user, pausing: !user.is_paused }); }}
                            className="text-xs gap-2">
                            {user.is_paused
                              ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Unpause account</>
                              : <><PauseCircle className="w-3.5 h-3.5 text-orange-400" /> Pause account</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { setLifetimeError(''); setLifetimePlanId(''); setLifetimeDialog({ open: true, user, mode: user.lifetime_access ? 'revoke' : 'grant' }); }}
                            className="text-xs gap-2">
                            {user.lifetime_access
                              ? <><Ban className="w-3.5 h-3.5 text-red-400" /> Revoke lifetime</>
                              : <><Infinity className="w-3.5 h-3.5 text-blue-400" /> Grant lifetime</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteDialog({ open: true, user })}
                            className="text-xs gap-2 text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" /> Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Global Pause (collapsible) ── */}
      <Card className={`mt-6 border ${globalPaused ? 'border-orange-500/40 bg-orange-500/5' : 'border-border bg-card'}`}>
        <CardContent className="p-4">
          <button className="flex items-center gap-3 w-full" onClick={() => setShowGlobalPause(v => !v)}>
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Global Plan Pause</p>
              <p className="text-xs text-muted-foreground">
                {globalPaused ? 'Currently active — new signups are blocked' : 'Inactive — signups are open'}
              </p>
            </div>
            {globalPaused && <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">Active</Badge>}
            {showGlobalPause ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showGlobalPause && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="flex items-center gap-3">
                <Switch id="global-pause" checked={globalPaused} onCheckedChange={saveGlobalPause} disabled={savingGlobalPause} />
                <Label htmlFor="global-pause" className="text-sm cursor-pointer">
                  {globalPaused ? 'Pause active — disable to allow signups' : 'Enable to block new signups'}
                </Label>
              </div>
              <Input
                value={globalPauseMsg}
                onChange={e => setGlobalPauseMsg(e.target.value)}
                placeholder="Message shown to users during pause (optional)…"
                className="text-sm bg-muted/30 border-border"
              />
              <Button size="sm" variant="outline" onClick={() => saveGlobalPause(globalPaused)} disabled={savingGlobalPause} className="border-border">
                {savingGlobalPause ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Save message
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ── */}

      {/* Create user */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Add Customer</DialogTitle>
            <DialogDescription>Create a new customer account manually. They will receive an invitation to set up their profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {createError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{createError}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full name <span className="text-destructive">*</span></Label>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Jane Smith" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email address <span className="text-destructive">*</span></Label>
              <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="jane@example.com" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Initial plan (optional)</Label>
              <Select value={createPlanId} onValueChange={setCreatePlanId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Free (default)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-sm">Free (default)</SelectItem>
                  {plans.map(p => <SelectItem key={p.id} value={String(p.id)} className="text-sm">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={submitCreateUser} disabled={createLoading || !createEmail.trim() || !createName.trim()}>
              {createLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Create customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause/unpause */}
      <Dialog open={pauseDialog.open} onOpenChange={open => !open && setPauseDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pauseDialog.pausing
                ? <><PauseCircle className="w-5 h-5 text-orange-400" /> Pause account</>
                : <><CheckCircle className="w-5 h-5 text-green-400" /> Unpause account</>}
            </DialogTitle>
            <DialogDescription>
              {pauseDialog.pausing
                ? `Pausing ${pauseDialog.user?.name || pauseDialog.user?.email}'s account will prevent them from accessing the dashboard.`
                : `Unpausing will restore full access for ${pauseDialog.user?.name || pauseDialog.user?.email}.`}
            </DialogDescription>
          </DialogHeader>
          {pauseDialog.pausing && (
            <div className="py-2">
              <Label className="text-xs font-medium">Reason (optional — shown to user)</Label>
              <Input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="e.g. Payment issue, policy review…" className="mt-1.5 text-sm" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialog(d => ({ ...d, open: false }))} className="border-border">Cancel</Button>
            <Button onClick={confirmPause} disabled={pauseLoading}
              className={pauseDialog.pausing ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}>
              {pauseLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {pauseDialog.pausing ? 'Pause account' : 'Unpause account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteDialog.open} onOpenChange={open => !open && setDeleteDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" /> Delete user</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteDialog.user?.name || deleteDialog.user?.email}</strong> and all their data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(d => ({ ...d, open: false }))} className="border-border">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lifetime grant/revoke */}
      <Dialog open={lifetimeDialog.open} onOpenChange={open => !open && setLifetimeDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lifetimeDialog.mode === 'grant'
                ? <><Crown className="w-5 h-5 text-blue-400" /> Grant lifetime access</>
                : <><Ban className="w-5 h-5 text-red-400" /> Revoke lifetime access</>}
            </DialogTitle>
            <DialogDescription>
              {lifetimeDialog.mode === 'grant'
                ? `Grant ${lifetimeDialog.user?.name || lifetimeDialog.user?.email} permanent full access — no subscription required.`
                : `Remove lifetime access from ${lifetimeDialog.user?.name || lifetimeDialog.user?.email}.`}
            </DialogDescription>
          </DialogHeader>
          {lifetimeError && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{lifetimeError}</p>}
          {lifetimeDialog.mode === 'grant' && (
            <div className="py-2">
              <Label className="text-xs font-medium">Plan to grant <span className="text-destructive">*</span></Label>
              <Select value={lifetimePlanId} onValueChange={setLifetimePlanId}>
                <SelectTrigger className="mt-1.5 text-sm"><SelectValue placeholder="Select a plan…" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.slug !== 'free').map(p => <SelectItem key={p.id} value={String(p.id)} className="text-sm">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLifetimeDialog(d => ({ ...d, open: false }))} className="border-border">Cancel</Button>
            <Button onClick={requestLifetimePin} disabled={lifetimeLoading}
              className={lifetimeDialog.mode === 'revoke' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}>
              {lifetimeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {lifetimeDialog.mode === 'grant' ? 'Grant lifetime' : 'Revoke lifetime'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </CrmPinGate>
  );
}
