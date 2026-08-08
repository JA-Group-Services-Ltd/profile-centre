import { useEffect, useMemo, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  ArrowLeft, CheckCircle2, Clipboard, ExternalLink, Globe2, Loader2,
  RefreshCw, ShieldCheck, Trash2, TriangleAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface ProfileOption {
  id: number;
  username: string;
  display_name: string | null;
  profile_type: string;
  biz_slug: string | null;
  person_slug: string | null;
  is_published: number;
}

interface DomainRecord {
  id: number;
  profile_id: number | null;
  domain: string;
  status: string;
  dns_status: string;
  ssl_status: string;
  cname_target: string | null;
  ownership_verification: { name?: string; type?: string; value?: string } | null;
  ssl_validation: Array<{ txt_name?: string; txt_value?: string; cname?: string; cname_target?: string; status?: string }>;
  failure_reason: string | null;
  profile_name: string | null;
  profile_username: string | null;
  activated_at: string | null;
  last_checked_at: string | null;
}

interface Entitlement {
  allowed: boolean;
  plan_name: string | null;
  plan_slug: string | null;
}

function statusClass(status: string) {
  if (status === 'active') return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (status === 'failed') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <code className="text-xs sm:text-sm flex-1 break-all">{value}</code>
      <button type="button" onClick={copy} className="text-muted-foreground hover:text-foreground" aria-label="Copy value">
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function CustomDomainsPage() {
  const { user, loading: authLoading } = useAuth();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | 'create' | null>(null);
  const [hostname, setHostname] = useState('');
  const [profileId, setProfileId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user) window.location.href = '/login';
  }, [authLoading, user]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/custom-domains', { credentials: 'include' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not load custom domains.');
      setDomains(body.data ?? []);
      setProfiles(body.profiles ?? []);
      setEntitlement(body.entitlement ?? null);
      if (!profileId && body.profiles?.length) setProfileId(String(body.profiles[0].id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load custom domains.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const selectedProfileHasDomain = useMemo(
    () => domains.some(domain => String(domain.profile_id) === profileId),
    [domains, profileId],
  );

  const connect = async () => {
    if (!profileId || !hostname.trim()) return;
    setBusy('create'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/custom-domains', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: Number(profileId), hostname: hostname.trim() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not connect the domain.');
      setHostname('');
      setMessage('Domain added. Add the CNAME shown below, then press Check connection.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect the domain.');
    } finally { setBusy(null); }
  };

  const check = async (id: number) => {
    setBusy(id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/custom-domains/${id}/check`, { method: 'POST', credentials: 'include' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not check the domain.');
      setMessage(body.data?.status === 'active' ? 'Domain verified and SSL is active.' : 'Checked. Cloudflare is still waiting for DNS or SSL validation.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the domain.');
    } finally { setBusy(null); }
  };

  const disconnect = async (domain: DomainRecord) => {
    if (!confirm(`Disconnect ${domain.domain}? The normal Sousa Murray Profiles URL will keep working.`)) return;
    setBusy(domain.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/custom-domains/${domain.id}`, { method: 'DELETE', credentials: 'include' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not disconnect the domain.');
      setMessage('Custom domain disconnected.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect the domain.');
    } finally { setBusy(null); }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Custom Domains — Sousa Murray Profiles</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/dashboard/overview" className="p-2 rounded-lg hover:bg-muted" aria-label="Back to dashboard"><ArrowLeft className="w-4 h-4" /></a>
            <div>
              <p className="font-semibold">Custom Domains</p>
              <p className="text-xs text-muted-foreground">Sousa Murray Profiles</p>
            </div>
          </div>
          <Globe2 className="w-5 h-5 text-primary" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Use your own web address</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect a subdomain such as <strong>profile.example.co.uk</strong> to one of your public profiles.</p>
        </div>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500 flex gap-2"><TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
        {message && <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-500 flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />{message}</div>}

        {!entitlement?.allowed ? (
          <Card className="border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-orange-500" /> Custom Domains are not included in this plan</CardTitle>
              <CardDescription>Your current plan is {entitlement?.plan_name || 'not assigned'}. An administrator can enable Custom Domains for eligible plans.</CardDescription>
            </CardHeader>
            <CardContent><a href="/dashboard/billing"><Button>View plans</Button></a></CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect a domain</CardTitle>
              <CardDescription>Version 1 supports subdomains. Root domains such as example.co.uk are not supported yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Profile</Label>
                  <Select value={profileId} onValueChange={setProfileId}>
                    <SelectTrigger><SelectValue placeholder="Choose a profile" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={String(profile.id)}>
                          {profile.display_name || profile.username}{profile.is_published ? '' : ' (draft)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Custom domain</Label>
                  <Input value={hostname} onChange={event => setHostname(event.target.value)} placeholder="profile.example.co.uk" autoCapitalize="none" autoCorrect="off" />
                </div>
              </div>
              {selectedProfileHasDomain && <p className="text-xs text-orange-500">This profile already has a custom domain. Disconnect it before adding another.</p>}
              <Button onClick={connect} disabled={busy === 'create' || !profileId || !hostname.trim() || selectedProfileHasDomain} className="gap-2">
                {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />} Connect domain
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {domains.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground"><Globe2 className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No custom domains connected yet.</p></CardContent></Card>
          ) : domains.map(domain => (
            <Card key={domain.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base break-all">{domain.domain}</CardTitle>
                    <CardDescription>{domain.profile_name || domain.profile_username || `Profile #${domain.profile_id}`}</CardDescription>
                  </div>
                  <Badge className={statusClass(domain.status)}>{domain.status === 'active' ? 'Connected' : domain.status === 'failed' ? 'Needs attention' : 'Pending'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-muted/30 p-3"><span className="text-muted-foreground block">Hostname</span><strong>{domain.dns_status || 'pending'}</strong></div>
                  <div className="rounded-lg bg-muted/30 p-3"><span className="text-muted-foreground block">SSL certificate</span><strong>{domain.ssl_status || 'pending'}</strong></div>
                </div>

                {domain.status !== 'active' && domain.cname_target && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">1. Add this CNAME at your DNS provider</p>
                    <div className="grid sm:grid-cols-[120px_1fr] gap-2 text-xs">
                      <div className="rounded-lg border border-border p-2"><span className="text-muted-foreground block">Type</span><strong>CNAME</strong></div>
                      <div className="rounded-lg border border-border p-2"><span className="text-muted-foreground block">Target</span><strong className="break-all">{domain.cname_target}</strong></div>
                    </div>
                    <CopyValue value={domain.cname_target} />
                    <p className="text-xs text-muted-foreground">The Name/Host is the subdomain part you chose. For <strong>profile.example.co.uk</strong>, this is usually <strong>profile</strong>.</p>
                  </div>
                )}

                {domain.ownership_verification?.name && domain.ownership_verification?.value && domain.status !== 'active' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Alternative ownership TXT record</p>
                    <CopyValue value={`${domain.ownership_verification.name} = ${domain.ownership_verification.value}`} />
                  </div>
                )}

                {domain.failure_reason && <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">{domain.failure_reason}</div>}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => check(domain.id)} disabled={busy === domain.id} className="gap-1.5">
                    {busy === domain.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Check connection
                  </Button>
                  {domain.status === 'active' && (
                    <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Open</Button></a>
                  )}
                  <Button size="sm" variant="outline" onClick={() => disconnect(domain)} disabled={busy === domain.id} className="gap-1.5 text-red-500 border-red-500/20"><Trash2 className="w-3.5 h-3.5" /> Disconnect</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
