import { useState, useEffect, useCallback, useRef } from 'react';
import { fmtDate } from '@/lib/date';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Users, Globe, Mail, Eye, MousePointer, TrendingUp,
  ArrowRight, Shield, ScrollText, FileText, Settings, CreditCard,
  ChevronDown, ChevronUp, Search, Edit2, Check, X, Trash2, Home,
  Infinity, Crown, PauseCircle, PlayCircle, ExternalLink, RefreshCw,
  AlertTriangle, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAdminAuth } from '@/lib/admin-auth';

interface ManagedUser {
  id: number; email: string; name: string; role: string;
  plan_id: number; plan_name: string; profile_count: number;
  created_at: string; lifetime_access: number; lifetime_plan_id: number | null;
  is_paused: number; pause_reason: string | null;
}
interface Plan { id: number; name: string; }

// ── Settings Summary Panel ─────────────────────────────────────────────────────

interface AdminSettingsSummary {
  site_name?: string;
  platform_name?: string;
  allow_registration?: string;
  maintenance_mode?: string;
  analytics_enabled?: string;
  cookie_banner_enabled?: string;
  gdpr_enabled?: string;
  crm_require_pin?: string;
  plans_paused?: string;
  full_crm_security?: string;
  site_status?: string;
}

function SettingsSummary() {
  const [settings, setSettings] = useState<AdminSettingsSummary | null>(null);
  const [siteStatus, setSiteStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (loading) return;
    setLoading(true);
    Promise.all([
      fetch('/api/admin/settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/site-status', { credentials: 'include' }).then(r => r.json()),
    ]).then(([sd, ss]) => {
      if (sd.success) setSettings(sd.data);
      if (ss.success) setSiteStatus(ss.status);
    }).finally(() => setLoading(false));
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !settings) load();
  };

  const flag = (val: string | undefined) => val === '1' || val === 'true';

  const statusItems = settings ? [
    { label: 'Registrations', on: flag(settings.allow_registration), onLabel: 'Open', offLabel: 'Closed' },
    { label: 'Maintenance Mode', on: flag(settings.maintenance_mode), onLabel: 'Active', offLabel: 'Off', warn: flag(settings.maintenance_mode) },
    { label: 'Analytics', on: flag(settings.analytics_enabled), onLabel: 'Enabled', offLabel: 'Disabled' },
    { label: 'Cookie Banner', on: flag(settings.cookie_banner_enabled), onLabel: 'Shown', offLabel: 'Hidden' },
    { label: 'GDPR Features', on: flag(settings.gdpr_enabled), onLabel: 'Enabled', offLabel: 'Disabled' },
    { label: 'CRM PIN Required', on: flag(settings.crm_require_pin), onLabel: 'Yes', offLabel: 'No' },
  ] : [];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handleToggle} className="flex items-center gap-2 group flex-1">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Platform Settings</h2>
          {siteStatus && open && (
            <Badge className={`text-xs border-0 ml-2 ${siteStatus === 'live' ? 'bg-green-500/10 text-green-400' : siteStatus === 'coming_soon' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
              Site: {siteStatus}
            </Badge>
          )}
        </button>
        <div className="flex items-center gap-2">
          {open && (
            <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Refresh settings">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link to="/admin/settings">
            <button className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10">
              <Settings className="w-3.5 h-3.5" /> Edit Settings
            </button>
          </Link>
          <button onClick={handleToggle} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-xs">{open ? 'Collapse' : 'Expand'}</span>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4">
          {loading && !settings ? (
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </CardContent>
            </Card>
          ) : settings ? (
            <>
              {/* Site identity */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site Identity</p>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs border-0 ${siteStatus === 'live' ? 'bg-green-500/10 text-green-400' : siteStatus === 'coming_soon' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {siteStatus ?? '—'}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Platform Name</p>
                      <p className="text-sm font-medium text-foreground">{settings.platform_name || settings.site_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Site Status</p>
                      <p className="text-sm font-medium text-foreground capitalize">{siteStatus ?? '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feature toggles */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Feature Toggles</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {statusItems.map(item => (
                      <div key={item.label} className={`flex items-center justify-between p-3 rounded-xl border ${item.warn ? 'bg-orange-500/10 border-orange-500/30' : item.on ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/20 border-border'}`}>
                        <div className="flex items-center gap-2">
                          {item.warn ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          ) : item.on ? (
                            <ToggleRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          ) : (
                            <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-xs text-foreground">{item.label}</span>
                        </div>
                        <span className={`text-xs font-semibold ${item.warn ? 'text-orange-400' : item.on ? 'text-green-400' : 'text-muted-foreground'}`}>
                          {item.on ? item.onLabel : item.offLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                This is a read-only summary. <Link to="/admin/settings" className="text-primary hover:underline">Go to System Settings</Link> to make changes.
              </p>
            </>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-5 text-center text-sm text-muted-foreground">
                Could not load settings. <button onClick={load} className="text-primary hover:underline">Retry</button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function UsersPanel() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [admins, setAdmins] = useState<ManagedUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ plan_id: '' });
  const [adminEditingId, setAdminEditingId] = useState<number | null>(null);
  const [adminEditPlanId, setAdminEditPlanId] = useState('');
  const [globalPaused, setGlobalPaused] = useState(false);
  const [globalPauseMsg, setGlobalPauseMsg] = useState('');
  const [savingGlobalPause, setSavingGlobalPause] = useState(false);
  const [pauseDialog, setPauseDialog] = useState<{ open: boolean; user: ManagedUser | null; pausing: boolean }>({ open: false, user: null, pausing: true });
  const [pauseReason, setPauseReason] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);
  const [lifetimeDialog, setLifetimeDialog] = useState<{ open: boolean; user: ManagedUser | null; mode: 'grant' | 'revoke' }>({ open: false, user: null, mode: 'grant' });
  const [lifetimePlanId, setLifetimePlanId] = useState('');
  const [lifetimeLoading, setLifetimeLoading] = useState(false);

  const loadUsers = useCallback((force = false) => {
    if (usersLoading) return;
    if (!force && users.length > 0) return;
    setUsersLoading(true);
    Promise.all([
      fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/users?role=admin', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/plans', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/pause', { credentials: 'include' }).then(r => r.json()),
    ]).then(([ud, ad, pd, pauseD]) => {
      if (ud.success) setUsers(ud.data);
      if (ad.success) setAdmins(ad.data);
      if (pd.success) setPlans(pd.data.filter((p: Plan & { is_active: number }) => p.is_active));
      if (pauseD.success) { setGlobalPaused(pauseD.paused); setGlobalPauseMsg(pauseD.message ?? ''); }
    }).finally(() => setUsersLoading(false));
  }, [usersLoading, users.length]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadUsers(false);
  };

  const handleRefresh = () => loadUsers(true);

  const saveGlobalPause = async (paused: boolean) => {
    setSavingGlobalPause(true);
    await fetch('/api/admin/pause', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ paused, message: globalPauseMsg }) });
    setGlobalPaused(paused);
    setSavingGlobalPause(false);
  };

  const saveEdit = async (id: number) => {
    const planIdValue = editData.plan_id === 'none' || !editData.plan_id ? null : parseInt(editData.plan_id);
    const res = await fetch(`/api/admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ plan_id: planIdValue }) });
    const data = await res.json();
    if (data.success) {
      const planName = planIdValue ? (plans.find(p => p.id === planIdValue)?.name ?? null) : null;
      setUsers(u => u.map(x => x.id === id ? { ...x, plan_id: planIdValue as unknown as number, plan_name: planName as unknown as string } : x));
      setEditingId(null);
    }
  };

  const saveAdminPlan = async (id: number) => {
    const planIdValue = adminEditPlanId === 'none' || !adminEditPlanId ? null : parseInt(adminEditPlanId);
    const res = await fetch(`/api/admin/users/${id}/assign-plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ plan_id: planIdValue }) });
    const data = await res.json();
    if (data.success) {
      const planName = planIdValue ? (plans.find(p => p.id === planIdValue)?.name ?? null) : null;
      setAdmins(a => a.map(x => x.id === id ? { ...x, plan_id: planIdValue as unknown as number, plan_name: planName as unknown as string } : x));
      setAdminEditingId(null);
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    setUsers(u => u.filter(x => x.id !== id));
  };

  const confirmPause = async () => {
    if (!pauseDialog.user) return;
    setPauseLoading(true);
    const res = await fetch(`/api/admin/users/${pauseDialog.user.id}/pause`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ paused: pauseDialog.pausing, reason: pauseReason }) });
    const data = await res.json();
    if (data.success) {
      setUsers(u => u.map(x => x.id === pauseDialog.user!.id ? { ...x, is_paused: pauseDialog.pausing ? 1 : 0, pause_reason: pauseReason || null } : x));
      setPauseDialog({ open: false, user: null, pausing: true });
    }
    setPauseLoading(false);
  };

  const confirmLifetime = async () => {
    if (!lifetimeDialog.user) return;
    setLifetimeLoading(true);
    const { user, mode } = lifetimeDialog;
    const res = await fetch(`/api/admin/users/${user.id}/lifetime`, { method: mode === 'grant' ? 'POST' : 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: mode === 'grant' ? JSON.stringify({ plan_id: parseInt(lifetimePlanId) }) : undefined });
    const data = await res.json();
    if (data.success) {
      setUsers(u => u.map(x => x.id === user.id ? { ...x, ...data.data } : x));
      setLifetimeDialog({ open: false, user: null, mode: 'grant' });
    }
    setLifetimeLoading(false);
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const lifetimeCount = users.filter(u => u.lifetime_access).length;

  return (
    <div className="mt-8">
      {/* Section header — click to expand/collapse */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={handleToggle} className="flex items-center gap-2 group flex-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Manage Users</h2>
          {users.length > 0 && (
            <span className="text-xs text-muted-foreground/60">
              — {users.length} customer{users.length !== 1 ? 's' : ''}
              {lifetimeCount > 0 && <span className="text-blue-400 ml-1">· {lifetimeCount} lifetime</span>}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {open && (
            <button onClick={handleRefresh} disabled={usersLoading} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Refresh users">
              <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button onClick={handleToggle} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-xs">{open ? 'Collapse' : 'Expand'}</span>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-6">
          {usersLoading ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Global Pause */}
              <Card className={`border-2 ${globalPaused ? 'border-blue-500/20 bg-blue-500/10' : 'border-border bg-card'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-semibold text-foreground">Global Plan Pause</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Blocks new sign-ups and plan upgrades. Existing users unaffected.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label className="text-sm text-muted-foreground">{globalPaused ? 'Paused' : 'Active'}</Label>
                          <Switch checked={globalPaused} onCheckedChange={v => saveGlobalPause(v)} disabled={savingGlobalPause} className="data-[state=checked]:bg-blue-500/50" />
                        </div>
                      </div>
                      {globalPaused && (
                        <div className="mt-3 flex gap-2">
                          <Input value={globalPauseMsg} onChange={e => setGlobalPauseMsg(e.target.value)} placeholder="Message shown to users" className="bg-background border-border text-sm flex-1" />
                          <Button size="sm" onClick={() => saveGlobalPause(true)} disabled={savingGlobalPause} className="bg-red-600 hover:bg-red-500 text-white shrink-0">Save</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Accounts */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Admin Accounts</h3>
                <Card className="bg-card border-border">
                  <CardContent className="p-0">
                    {admins.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-muted-foreground text-center">No admin accounts found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Name</th>
                              <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Email</th>
                              <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Joined</th>
                              <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Plan</th>
                              <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {admins.map(a => (
                              <tr key={a.id} className="border-b border-border/50">
                                <td className="px-4 py-3 text-sm font-medium text-foreground">{a.name || '—'}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{a.email}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(a.created_at)}</td>
                                <td className="px-4 py-3">
                                  {adminEditingId === a.id ? (
                                    <Select value={adminEditPlanId} onValueChange={setAdminEditPlanId}>
                                      <SelectTrigger className="w-32 h-7 text-xs bg-background border-border"><SelectValue placeholder="Select plan…" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">— No plan —</SelectItem>
                                        {plans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className={`text-sm ${a.plan_name ? 'text-foreground' : 'text-muted-foreground italic'}`}>{a.plan_name || 'No plan'}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    {adminEditingId === a.id ? (
                                      <>
                                        <button onClick={() => saveAdminPlan(a.id)} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setAdminEditingId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <button onClick={() => { setAdminEditingId(a.id); setAdminEditPlanId(a.plan_id ? String(a.plan_id) : 'none'); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground mt-1.5">Admin accounts are managed via the JA Group Services Azure portal. Only plan assignment is permitted here.</p>
              </div>

              {/* Customer Accounts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Accounts</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8 bg-background border-border h-7 text-xs w-48" />
                  </div>
                </div>
                <Card className="bg-card border-border">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">User</th>
                            <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Plan</th>
                            <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Access</th>
                            <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Profiles</th>
                            <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Joined</th>
                            <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(user => (
                            <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {user.lifetime_access ? <Crown className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : null}
                                  {user.is_paused ? <PauseCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" /> : null}
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                    {user.is_paused && user.pause_reason && <p className="text-xs text-orange-400 mt-0.5 truncate max-w-48">{user.pause_reason}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {editingId === user.id ? (
                                  <Select value={editData.plan_id} onValueChange={v => setEditData(d => ({ ...d, plan_id: v }))}>
                                    <SelectTrigger className="w-32 h-7 text-xs bg-background border-border"><SelectValue placeholder="Select plan…" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">— No plan —</SelectItem>
                                      {plans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className={`text-sm ${user.plan_name ? 'text-foreground' : 'text-muted-foreground italic'}`}>{user.plan_name || 'No plan'}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {user.lifetime_access ? (
                                  <Badge className="bg-blue-500/10 text-blue-400 border-0 text-xs gap-1"><Infinity className="w-3 h-3" /> Lifetime</Badge>
                                ) : user.is_paused ? (
                                  <Badge className="bg-orange-500/10 text-orange-400 border-0 text-xs gap-1"><PauseCircle className="w-3 h-3" /> Paused</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Standard</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{user.profile_count}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(user.created_at)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {editingId === user.id ? (
                                    <>
                                      <button onClick={() => saveEdit(user.id)} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10"><Check className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                                    </>
                                  ) : (
                                    <>
                                      {user.lifetime_access ? (
                                        <button onClick={() => { setLifetimeDialog({ open: true, user, mode: 'revoke' }); }} title="Revoke lifetime" className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10"><Infinity className="w-3.5 h-3.5" /></button>
                                      ) : (
                                        <button onClick={() => { setLifetimeDialog({ open: true, user, mode: 'grant' }); setLifetimePlanId(String(user.plan_id)); }} title="Grant lifetime" className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"><Crown className="w-3.5 h-3.5" /></button>
                                      )}
                                      {user.is_paused ? (
                                        <button onClick={() => { setPauseDialog({ open: true, user, pausing: false }); setPauseReason(''); }} title="Unpause" className="p-1.5 rounded-lg text-orange-400 hover:bg-orange-500/10"><PlayCircle className="w-3.5 h-3.5" /></button>
                                      ) : (
                                        <button onClick={() => { setPauseDialog({ open: true, user, pausing: true }); setPauseReason(user.pause_reason ?? ''); }} title="Pause" className="p-1.5 rounded-lg text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10"><PauseCircle className="w-3.5 h-3.5" /></button>
                                      )}
                                      <button onClick={() => { setEditingId(user.id); setEditData({ plan_id: String(user.plan_id) }); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <Link to={`/admin/users/${user.id}`} title="View full user details">
                                        <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><ExternalLink className="w-3.5 h-3.5" /></button>
                                      </Link>
                                      <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No users found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Lifetime Dialog */}
      <Dialog open={lifetimeDialog.open} onOpenChange={open => !open && setLifetimeDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{lifetimeDialog.mode === 'grant' ? 'Grant Lifetime Access' : 'Revoke Lifetime Access'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {lifetimeDialog.mode === 'grant' ? `Grant ${lifetimeDialog.user?.name} permanent access to a plan.` : `Remove lifetime access from ${lifetimeDialog.user?.name}.`}
            </DialogDescription>
          </DialogHeader>
          {lifetimeDialog.mode === 'grant' && (
            <div className="py-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Select Plan</label>
              <Select value={lifetimePlanId} onValueChange={setLifetimePlanId}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Choose a plan…" /></SelectTrigger>
                <SelectContent>{plans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLifetimeDialog(d => ({ ...d, open: false }))} className="border-border">Cancel</Button>
            <Button onClick={confirmLifetime} disabled={lifetimeLoading || (lifetimeDialog.mode === 'grant' && !lifetimePlanId)} className={lifetimeDialog.mode === 'grant' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}>
              {lifetimeLoading ? 'Processing…' : lifetimeDialog.mode === 'grant' ? 'Grant Lifetime Access' : 'Revoke Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Dialog */}
      <Dialog open={pauseDialog.open} onOpenChange={open => !open && setPauseDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {pauseDialog.pausing ? <><PauseCircle className="w-5 h-5 text-orange-400" /> Pause Account</> : <><PlayCircle className="w-5 h-5 text-green-400" /> Unpause Account</>}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {pauseDialog.pausing ? `${pauseDialog.user?.name}'s dashboard access will be blocked.` : `Restore full dashboard access for ${pauseDialog.user?.name}.`}
            </DialogDescription>
          </DialogHeader>
          {pauseDialog.pausing && (
            <div className="py-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Reason (shown to user)</label>
              <Input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="e.g. Payment required — please contact us to reactivate" className="bg-background border-border" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialog(d => ({ ...d, open: false }))} className="border-border">Cancel</Button>
            <Button onClick={confirmPause} disabled={pauseLoading} className={pauseDialog.pausing ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}>
              {pauseLoading ? 'Processing…' : pauseDialog.pausing ? 'Pause Account' : 'Unpause Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  totalEnquiries: number;
  totalViews: number;
  totalClicks: number;
  recentUsers: { id: number; email: string; name: string; role: string; created_at: string }[];
  topProfiles: { username: string; display_name: string; views: number }[];
  viewsByDay: { date: string; count: number }[];
}

const quickLinks = [
  { to: '/admin/users',            label: 'Users & CRM',          icon: Users,       desc: 'Full customer records, billing, notes and audit' },
  { to: '/admin/profiles',         label: 'Manage Profiles',      icon: Globe,       desc: 'Review and moderate public profiles' },
  { to: '/admin/enquiries',        label: 'Enquiries',             icon: Mail,        desc: 'View all contact form submissions' },
  { to: '/admin/plans',            label: 'Plans & Pricing',       icon: CreditCard,  desc: 'Configure subscription plans' },
  { to: '/admin/addons',           label: 'Add-ons',               icon: Crown,       desc: 'Manage add-on products and customer assignments' },
  { to: '/admin/support-requests', label: 'Support Requests',      icon: Shield,      desc: 'Customer support tickets and threaded replies' },
  { to: '/admin/issue-reports',    label: 'Reports & Moderation',  icon: ExternalLink,desc: 'Profile reports, auto-scans and moderation queue' },
  { to: '/admin/compose-email',    label: 'Compose Email',         icon: Mail,        desc: 'Send a direct email to any customer' },
  { to: '/admin/homepage',         label: 'Site Content',          icon: Home,        desc: 'Edit homepage hero, stats, announcement banner' },
  { to: '/admin/settings',         label: 'System Settings',       icon: Settings,    desc: 'Platform configuration, branding and toggles' },
  { to: '/admin/audit',            label: 'Audit Log',             icon: ScrollText,  desc: 'Full record of admin actions' },
  { to: '/admin/legal',            label: 'Legal Policies',        icon: FileText,    desc: 'Terms, privacy and cookie policies' },
  { to: '/admin/analytics',        label: 'Analytics',             icon: TrendingUp,  desc: 'Platform-wide usage statistics' },
  { to: '/admin/features',         label: 'Feature Manager',       icon: ChevronDown, desc: 'Feature flags, plan rules and per-user overrides' },
  { to: '/admin/notifications',    label: 'Push Notifications',    icon: ChevronUp,   desc: 'Send platform-wide or targeted notifications' },
  { to: '/admin/business-cards',   label: 'Business Cards',        icon: Edit2,       desc: 'Manage business card orders and templates' },
];

export default function AdminDashboard() {
  const { adminUser } = useAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    fetch('/api/admin/analytics', { credentials: 'include' })
      .then(r => {
        if (r.status === 401 || r.status === 403) { setAuthError(true); return null; }
        return r.json();
      })
      .then(d => { if (d?.success) setStats(d.data); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    loadStats(false);
    intervalRef.current = setInterval(() => loadStats(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadStats]);

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Total Profiles', value: stats?.totalProfiles ?? 0, icon: Globe, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Total Enquiries', value: stats?.totalEnquiries ?? 0, icon: Mail, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Page Views', value: stats?.totalViews ?? 0, icon: Eye, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Link Clicks', value: stats?.totalClicks ?? 0, icon: MousePointer, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    {
      label: 'Click-Through Rate',
      value: stats ? (stats.totalViews > 0 ? `${((stats.totalClicks / stats.totalViews) * 100).toFixed(1)}%` : '0%') : '—',
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Admin Dashboard — Sousa Murray Profiles</title>
        <meta name="description" content="Admin overview dashboard for Sousa Murray Profiles platform management." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Auth error banner */}
      {authError && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Admin session not found</p>
            <p className="mt-1 text-destructive/80">
              You are not signed in as an admin. Statistics cannot be loaded.{' '}
              <a href="/admin/login" className="underline font-medium">Sign in to the staff portal</a>
            </p>
          </div>
        </div>
      )}
      {/* Welcome */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{greeting}, {(adminUser?.name || adminUser?.email || 'Admin').split(' ')[0]}</h1>
              <p className="text-muted-foreground text-sm">Here's what's happening on your platform today</p>
            </div>
          </div>
          <button
            onClick={() => loadStats(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted border border-border"
            title="Refresh stats (auto-refreshes every 30s)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-5">
              {loading ? <Skeleton className="h-16 w-full" /> : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Quick links */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Access</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {quickLinks.map(link => (
              <Link key={link.to} to={link.to}>
                <Card className="bg-card border-border hover:border-red-300 hover:bg-red-50/50 transition-all cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-colors">
                      <link.icon className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{link.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-red-600 transition-colors flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Users</h2>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {stats?.recentUsers.slice(0, 6).map(u => (
                    <div key={u.id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-red-600 text-xs font-bold">{(u.name || u.email || '?').charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      {u.role === 'admin' && (
                        <Badge className="bg-red-500/10 text-red-400 border-0 text-xs flex-shrink-0">Admin</Badge>
                      )}
                    </div>
                  ))}
                  {!stats?.recentUsers.length && (
                    <p className="text-xs text-muted-foreground text-center py-4">No users yet</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top profiles */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-400" /> Top Profiles by Views
          </CardTitle>
          <Link to="/admin/profiles">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-2">View all profiles</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats?.topProfiles.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <span className="text-xs text-muted-foreground font-mono w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.display_name || p.username}</p>
                    <p className="text-xs text-muted-foreground">/{p.username}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Eye className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{p.views.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {!stats?.topProfiles.length && (
                <p className="text-sm text-muted-foreground col-span-3 text-center py-4">No profile data yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline Users Management Panel */}
      <UsersPanel />

      {/* Settings Summary */}
      <SettingsSummary />
    </div>
  );
}
