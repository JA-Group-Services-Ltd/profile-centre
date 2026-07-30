/**
 * Admin — Comprehensive Audit Log
 * Shows all platform actions: admin, user, visitor, system, cookie consent, auth.
 * Supports filtering, search, and PDF export.
 */
import { useState, useEffect, useRef } from 'react';
import { fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  ScrollText, Search, Download, RefreshCw, ChevronLeft, ChevronRight,
  User, Settings, MessageCircle, CreditCard, Cookie,
  LogIn, AlertCircle, Trash2, Filter,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_type: string;
  tenant: string | null;
  auth_provider: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_label: string | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  result: string | null;
  created_at: string;
}

const ACTOR_TYPE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400',
  user: 'bg-blue-500/10 text-blue-400',
  visitor: 'bg-green-500/10 text-green-400',
  system: 'bg-purple-500/10 text-purple-400',
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  login: LogIn,
  register: User,
  cookie_consent: Cookie,
  create: Settings,
  update: Settings,
  delete: AlertCircle,
  message: MessageCircle,
  checkout: CreditCard,
};

function ActionIcon({ action }: { action: string }) {
  const Icon = ACTION_ICONS[action] ?? ScrollText;
  return <Icon className="w-3.5 h-3.5" />;
}

const PAGE_SIZE = 50;

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [actorType, setActorType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [exporting, setExporting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (pg = page, s = search, at = actorType, rt = resourceType) => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(pg * PAGE_SIZE),
    });
    if (s) params.set('search', s);
    if (at) params.set('actor_type', at);
    if (rt) params.set('resource_type', rt);

    const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) { setEntries(data.data); setTotal(data.total); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, actorType, resourceType]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(0); load(0, val, actorType, resourceType); }, 400);
  };

  const handleFilter = (type: 'actor' | 'resource', val: string) => {
    setPage(0);
    if (type === 'actor') { setActorType(val); load(0, search, val, resourceType); }
    else { setResourceType(val); load(0, search, actorType, val); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      // Fetch all matching entries for export
      const params = new URLSearchParams({ limit: '2000', offset: '0' });
      if (search) params.set('search', search);
      if (actorType) params.set('actor_type', actorType);
      if (resourceType) params.set('resource_type', resourceType);
      const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.success) return;

      const rows: AuditEntry[] = data.data;
      const now = fmtDateTime(new Date());

      // Build HTML for print
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Audit Log Export — ${now}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p.meta { color: #666; margin-bottom: 16px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
    .admin { background: #fee2e2; color: #b91c1c; }
    .user { background: #dbeafe; color: #1d4ed8; }
    .visitor { background: #dcfce7; color: #15803d; }
    .system { background: #f3e8ff; color: #7c3aed; }
  </style>
</head>
<body>
  <h1>JA Profile Studio — Audit Log</h1>
  <p class="meta">Exported: ${now} · ${rows.length} entries${search ? ` · Search: "${search}"` : ''}${actorType ? ` · Actor: ${actorType}` : ''}${resourceType ? ` · Resource: ${resourceType}` : ''}</p>
  <table>
    <thead>
      <tr>
        <th>Date/Time</th>
        <th>Actor</th>
        <th>Type</th>
        <th>Action</th>
        <th>Resource</th>
        <th>Details</th>
        <th>IP</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${fmtDateTime(r.created_at)}</td>
          <td>${r.actor_name ?? '—'}<br/><span style="color:#666;font-size:9px">${r.actor_email ?? ''}</span></td>
          <td><span class="badge ${r.actor_type}">${r.actor_type === 'user' ? 'Customer' : r.actor_type}</span></td>
          <td>${r.action}</td>
          <td>${r.resource_type}${r.resource_id ? ` #${r.resource_id}` : ''}${r.resource_label ? `<br/><span style="color:#666;font-size:9px">${r.resource_label}</span>` : ''}</td>
          <td style="max-width:200px;word-break:break-word">${r.details ?? '—'}</td>
          <td style="font-size:9px">${r.ip_address ?? '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        win.location.href = url;
        win.addEventListener('load', () => { URL.revokeObjectURL(url); win.print(); }, { once: true });
        win.focus();
      }
    } finally {
      setExporting(false);
    }
  };

  const clearLog = async () => {
    setClearing(true);
    try {
      await fetch('/api/admin/audit/clear', { method: 'DELETE', credentials: 'include' });
      setPage(0);
      setSearch('');
      setActorType('');
      setResourceType('');
      await load(0, '', '', '');
    } finally {
      setClearing(false);
      setClearOpen(false);
    }
  };

  const formatDate = (dt: string) => fmtDateTime(dt);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Audit Log — Admin</title>
        <meta name="description" content="Complete record of all platform actions." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/audit" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Complete record of all platform actions — {total.toLocaleString()} total entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} className="border-border gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={exportPDF} disabled={exporting} className="bg-primary gap-1.5">
            <Download className="w-3.5 h-3.5" /> {exporting ? 'Preparing…' : 'Export PDF'}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setClearOpen(true)} className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Clear Log
          </Button>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Audit Log?</DialogTitle>
            <DialogDescription>
              This will permanently delete all {total.toLocaleString()} audit log entries. This action cannot be undone. Export a PDF first if you need a record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>Cancel</Button>
            <Button variant="destructive" onClick={clearLog} disabled={clearing}>
              {clearing ? 'Clearing…' : 'Yes, clear all entries'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search actor, action, resource, details…"
                className="pl-9 bg-background border-border"
              />
            </div>
            <Select value={actorType || 'all'} onValueChange={v => handleFilter('actor', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40 bg-background border-border">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Actor type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All actors</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="visitor">Visitor</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceType || 'all'} onValueChange={v => handleFilter('resource', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44 bg-background border-border">
                <SelectValue placeholder="Resource type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All resources</SelectItem>
                <SelectItem value="auth">Auth / Login</SelectItem>
                <SelectItem value="cookie">Cookie Consent</SelectItem>
                <SelectItem value="consent">Terms / Consent</SelectItem>
                <SelectItem value="profile">Profile</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="legal_policy">Legal Policy</SelectItem>
                <SelectItem value="admin_settings">Settings</SelectItem>
                <SelectItem value="admin_user">Admin User Mgmt</SelectItem>
                <SelectItem value="closure_request">Account Closure</SelectItem>
                <SelectItem value="data_request">Data Request</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No audit entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date / Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Actor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type / Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Resource</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Details</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Result</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                            ${entry.actor_type === 'admin' ? 'bg-red-500/20 text-red-400' :
                              entry.actor_type === 'user' ? 'bg-blue-500/20 text-blue-400' :
                              entry.actor_type === 'visitor' ? 'bg-green-500/20 text-green-400' :
                              'bg-purple-500/20 text-purple-400'}`}>
                            {entry.actor_name ? entry.actor_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{entry.actor_name ?? '—'}</p>
                            {entry.actor_email && <p className="text-xs text-muted-foreground">{entry.actor_email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`border-0 text-xs ${ACTOR_TYPE_COLORS[entry.actor_type] ?? 'bg-muted text-muted-foreground'}`}>
                          {entry.actor_type === 'user' ? 'Customer' : entry.actor_type}
                        </Badge>
                        {entry.tenant && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-28">
                            {entry.tenant === 'customer_ciam' ? 'Customer CIAM' :
                             entry.tenant === 'admin_workforce' ? 'Admin Workforce' :
                             entry.tenant}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <ActionIcon action={entry.action} />
                          {entry.action}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-foreground">{entry.resource_type}</p>
                        {entry.resource_id && <p className="text-xs text-muted-foreground">#{entry.resource_id}</p>}
                        {entry.resource_label && <p className="text-xs text-muted-foreground truncate max-w-32">{entry.resource_label}</p>}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-muted-foreground truncate">{entry.details ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`border-0 text-xs ${
                          entry.result === 'success' ? 'bg-green-500/10 text-green-400' :
                          entry.result === 'failed'  ? 'bg-red-500/10 text-red-400' :
                          entry.result === 'blocked' ? 'bg-blue-500/10 text-blue-400' :
                          entry.result === 'error'   ? 'bg-destructive/10 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {entry.result ?? 'success'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {entry.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} · {total.toLocaleString()} entries
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="border-border gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="border-border gap-1">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
