import { useEffect, useMemo, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { ExternalLink, Eye, FileText, Loader2, Save, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const SITE = 'https://sousamurrayprofiles.jagroupservices.co.uk';

const POLICY_KEYS = [
  'terms',
  'privacy',
  'cookies',
  'acceptable_use',
  'refunds',
  'complaints',
  'accessibility',
  'eligibility',
  'data_retention',
  'reporting',
  'security',
  'data_rights',
] as const;

type PolicyKey = typeof POLICY_KEYS[number];

type PolicyDoc = {
  key?: string;
  title: string;
  version: string;
  effective_date: string;
  content: string;
  is_published: boolean;
  last_updated: string;
};

type PolicyCollection = Record<PolicyKey, PolicyDoc>;

const LABELS: Record<PolicyKey, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookies: 'Cookie & Storage',
  acceptable_use: 'Acceptable Use',
  refunds: 'Refunds & Cancellations',
  complaints: 'Complaints',
  accessibility: 'Accessibility',
  eligibility: 'Eligibility',
  data_retention: 'Data Retention',
  reporting: 'Reporting & Moderation',
  security: 'Security',
  data_rights: 'Data Subject Rights',
};

const PUBLIC_PATH: Record<PolicyKey, string> = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  cookies: '/legal/cookies',
  acceptable_use: '/legal/acceptable-use',
  refunds: '/legal/refunds',
  complaints: '/legal/complaints',
  accessibility: '/legal/accessibility',
  eligibility: '/legal/eligibility',
  data_retention: '/legal/data-retention',
  reporting: '/legal/reporting',
  security: '/legal/security',
  data_rights: '/legal/data-rights',
};

function isHtml(content: string) {
  return content.trimStart().startsWith('<');
}

export default function AdminLegal() {
  const [policies, setPolicies] = useState<Partial<PolicyCollection>>({});
  const [selected, setSelected] = useState<PolicyKey>('terms');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    fetch('/api/admin/legal', {
      credentials: 'include',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error?.message || payload?.message || 'Could not load legal policies.');
        }
        setPolicies(payload.data);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load legal policies.'))
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const current = policies[selected];
  const publishedCount = useMemo(
    () => POLICY_KEYS.filter(key => policies[key]?.is_published).length,
    [policies],
  );

  const updateCurrent = <K extends keyof PolicyDoc>(field: K, value: PolicyDoc[K]) => {
    setPolicies(previous => {
      const existing = previous[selected];
      if (!existing) return previous;
      return { ...previous, [selected]: { ...existing, [field]: value } };
    });
  };

  const save = async () => {
    if (!current || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/admin/legal/${encodeURIComponent(selected)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(current),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.error?.message || payload?.message || 'Could not save this policy.');
      }
      setPolicies(previous => ({ ...previous, [selected]: payload.data }));
      setMessage(`${LABELS[selected]} saved and ${payload.data.is_published ? 'published' : 'kept as a draft'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this policy.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-80 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading legal policies…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 lg:pb-8">
      <Helmet>
        <title>Legal Policies — Sousa Murray Profiles Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-2"><ShieldCheck className="w-4 h-4" /> Governance</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Legal & Policy Editor</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
            Edit the published Sousa Murray Profiles policy set from one place. Public legal pages and this Admin editor use the same D1-backed API and standard fallback catalogue.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">Published:</span>{' '}
          <strong className="text-foreground">{publishedCount}/{POLICY_KEYS.length}</strong>
        </div>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-300/40 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</div>}
      {message && <div className="mb-5 rounded-xl border border-green-300/40 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300" role="status">{message}</div>}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <Card className="border-border h-fit lg:sticky lg:top-24">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Policy library</CardTitle>
            <CardDescription>Select a document to edit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {POLICY_KEYS.map(key => (
              <button
                type="button"
                key={key}
                onClick={() => { setSelected(key); setPreview(false); setError(''); setMessage(''); }}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-3 ${selected === key ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
              >
                <span className="truncate">{LABELS[key]}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${policies[key]?.is_published ? (selected === key ? 'bg-white' : 'bg-green-500') : 'bg-muted-foreground/40'}`} />
              </button>
            ))}
          </CardContent>
        </Card>

        <div>
          {!current ? (
            <Card className="border-border"><CardContent className="p-8 text-sm text-muted-foreground">This policy could not be loaded from the API.</CardContent></Card>
          ) : (
            <Card className="border-border">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <CardTitle>{LABELS[selected]}</CardTitle>
                    <CardDescription className="mt-1">Last updated: {current.last_updated || 'Not recorded'}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={PUBLIC_PATH[selected]} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline" size="sm" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Public page</Button>
                    </a>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPreview(value => !value)}><Eye className="w-3.5 h-3.5" /> {preview ? 'Edit' : 'Preview'}</Button>
                    <Button type="button" size="sm" className="gap-1.5" onClick={() => void save()} disabled={saving || !current.content.trim()}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {saving ? 'Saving…' : 'Save policy'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-[1fr_160px_180px] gap-4">
                  <div className="space-y-2"><Label htmlFor="policy-title">Public title</Label><Input id="policy-title" value={current.title} onChange={event => updateCurrent('title', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="policy-version">Version</Label><Input id="policy-version" value={current.version} onChange={event => updateCurrent('version', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="policy-effective">Effective date</Label><Input id="policy-effective" type="date" value={current.effective_date || ''} onChange={event => updateCurrent('effective_date', event.target.value)} /></div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div><p className="text-sm font-semibold text-foreground">Publication status</p><p className="text-xs text-muted-foreground mt-1">Draft policies are retained in Admin but are not selected as the active public D1 record.</p></div>
                  <button
                    type="button"
                    onClick={() => updateCurrent('is_published', !current.is_published)}
                    role="switch"
                    aria-checked={current.is_published}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${current.is_published ? 'bg-green-600' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${current.is_published ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {preview ? (
                  <div className="rounded-2xl border border-border bg-background p-6 min-h-[480px]">
                    <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground"><FileText className="w-4 h-4" /> Preview of stored content</div>
                    {isHtml(current.content) ? (
                      <div>
                        <div className="rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-foreground mb-4">This is a legacy HTML policy. For safety, Admin shows the stored HTML as source text; the public page sanitises legacy HTML before rendering it.</div>
                        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-foreground leading-relaxed">{current.content}</pre>
                      </div>
                    ) : (
                      <div className="legal-prose">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3"><Label htmlFor="policy-content">Policy content</Label><span className="text-xs text-muted-foreground">Markdown recommended</span></div>
                    <Textarea id="policy-content" value={current.content} onChange={event => updateCurrent('content', event.target.value)} className="min-h-[560px] font-mono text-sm leading-relaxed" spellCheck />
                  </div>
                )}

                <div className="rounded-xl border border-border bg-muted/25 p-4 text-xs text-muted-foreground leading-relaxed">
                  Saving updates the D1 policy record used by <strong className="text-foreground">{SITE}{PUBLIC_PATH[selected]}</strong>. Keep legal changes accurate, dated and approved under the company’s governance process.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
