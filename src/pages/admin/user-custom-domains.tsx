import { useEffect, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { ArrowLeft, ExternalLink, Globe2, Loader2, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { useAdminAuth } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface DomainRecord {
  id: number;
  domain: string;
  status: string;
  dns_status: string;
  ssl_status: string;
  profile_id: number | null;
  profile_name: string | null;
  profile_username: string | null;
  cname_target: string | null;
  failure_reason: string | null;
  created_at: string;
  activated_at: string | null;
  last_checked_at: string | null;
  removed_at: string | null;
}

interface Entitlement { allowed: boolean; plan_name: string | null; plan_slug: string | null; }

function statusClass(status: string) {
  if (status === 'active') return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (status === 'removed') return 'bg-muted text-muted-foreground border-border';
  if (status === 'failed') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
}

export default function AdminUserCustomDomainsPage({ userId }: { userId: number }) {
  const { adminUser, loading: authLoading, loginAdmin } = useAdminAuth();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!authLoading && !adminUser) loginAdmin();
  }, [authLoading, adminUser, loginAdmin]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/custom-domains`, { credentials: 'include' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not load custom domains.');
      setDomains(body.data ?? []);
      setEntitlement(body.entitlement ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load custom domains.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (adminUser) load(); }, [adminUser, userId]);

  const check = async (id: number) => {
    setBusy(id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/custom-domains/${id}/check`, { method: 'POST', credentials: 'include' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not refresh the domain.');
      setMessage(`${body.data.domain}: ${body.data.status === 'active' ? 'connected and secure' : 'still pending validation'}.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not refresh the domain.'); }
    finally { setBusy(null); }
  };

  const disconnect = async (domain: DomainRecord) => {
    if (!confirm(`Disconnect ${domain.domain} from this customer?`)) return;
    setBusy(domain.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/users/${userId}/custom-domains/${domain.id}`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not disconnect the domain.');
      setMessage(`${domain.domain} disconnected.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not disconnect the domain.'); }
    finally { setBusy(null); }
  };

  if (authLoading || loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet><title>Customer Custom Domains — Admin</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <header className="border-b border-border bg-card/60">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href={`/admin/users/${userId}`} className="p-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></a>
            <div><p className="font-semibold">Custom Domains</p><p className="text-xs text-muted-foreground">User & CRM · Customer #{userId}</p></div>
          </div>
          <Globe2 className="w-5 h-5 text-primary" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Plan entitlement</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>{entitlement?.plan_name || 'No plan assigned'}</span>
              <Badge className={entitlement?.allowed ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}>
                {entitlement?.allowed ? 'Custom Domains enabled' : 'Not included'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500 flex gap-2"><TriangleAlert className="w-4 h-4 mt-0.5" />{error}</div>}
        {message && <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-500">{message}</div>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administrative reason</CardTitle>
            <CardDescription>Used if Head Office disconnects a domain. The action is also written to the audit log.</CardDescription>
          </CardHeader>
          <CardContent><Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Optional reason for administrative changes" /></CardContent>
        </Card>

        {domains.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground"><Globe2 className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">This customer has no custom-domain history.</p></CardContent></Card>
        ) : domains.map(domain => (
          <Card key={domain.id} className={domain.removed_at ? 'opacity-70' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle className="text-base break-all">{domain.domain}</CardTitle><CardDescription>{domain.profile_name || domain.profile_username || `Profile #${domain.profile_id}`}</CardDescription></div>
                <Badge className={statusClass(domain.status)}>{domain.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-muted/30 p-3"><span className="block text-muted-foreground">Hostname</span><strong>{domain.dns_status || '—'}</strong></div>
                <div className="rounded-lg bg-muted/30 p-3"><span className="block text-muted-foreground">SSL</span><strong>{domain.ssl_status || '—'}</strong></div>
                <div className="rounded-lg bg-muted/30 p-3"><span className="block text-muted-foreground">Created</span><strong>{new Date(domain.created_at).toLocaleDateString('en-GB')}</strong></div>
                <div className="rounded-lg bg-muted/30 p-3"><span className="block text-muted-foreground">Last checked</span><strong>{domain.last_checked_at ? new Date(domain.last_checked_at).toLocaleString('en-GB') : '—'}</strong></div>
              </div>
              {domain.cname_target && <p className="text-xs text-muted-foreground">CNAME target: <code className="text-foreground">{domain.cname_target}</code></p>}
              {domain.failure_reason && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-500">{domain.failure_reason}</div>}
              {!domain.removed_at && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => check(domain.id)} disabled={busy === domain.id} className="gap-1.5">
                    {busy === domain.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh status
                  </Button>
                  {domain.status === 'active' && <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Open</Button></a>}
                  <Button size="sm" variant="outline" onClick={() => disconnect(domain)} disabled={busy === domain.id} className="gap-1.5 text-red-500 border-red-500/20"><Trash2 className="w-3.5 h-3.5" /> Disconnect</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
