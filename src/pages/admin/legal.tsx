import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import { FileText, Save, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Clock, Code2, AlignLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface PolicyDoc {
  title: string;
  version: string;
  effective_date: string;
  content: string;
  is_published: boolean;
  last_updated: string;
}

const defaultPolicies: Record<string, PolicyDoc> = {
  terms:          { title: 'Terms of Service',              version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Terms of Service\n\nContent loading from database…` },
  privacy:        { title: 'Privacy Policy',                version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Privacy Policy\n\nContent loading from database…` },
  cookies:        { title: 'Cookie Policy',                 version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Cookie Policy\n\nContent loading from database…` },
  acceptable_use: { title: 'Acceptable Use Policy',         version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Acceptable Use Policy\n\nContent loading from database…` },
  refunds:        { title: 'Refund Policy',                 version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Refund Policy\n\nContent loading from database…` },
  complaints:     { title: 'Complaints Policy',             version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Complaints Policy\n\nContent loading from database…` },
  accessibility:  { title: 'Accessibility Statement',       version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Accessibility Statement\n\nContent loading from database…` },
  eligibility:    { title: 'Eligibility Policy',            version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Eligibility Policy\n\nContent loading from database…` },
  data_retention: { title: 'Data Retention Policy',         version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Data Retention Policy\n\nContent loading from database…` },
  reporting:      { title: 'Reporting & Moderation Policy', version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Reporting & Moderation Policy\n\nContent loading from database…` },
  security:       { title: 'Security Policy',               version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Security Policy\n\nContent loading from database…` },
  data_rights:    { title: 'Data Subject Rights',           version: '1.0', effective_date: new Date().toISOString().split('T')[0], is_published: true,  last_updated: new Date().toISOString(), content: `# Data Subject Rights\n\nContent loading from database…` },
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function AdminLegal() {
  const [policies, setPolicies] = useState(defaultPolicies);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  // 'markdown' | 'html' per policy key
  const [editorMode, setEditorMode] = useState<Record<string, 'markdown' | 'html'>>({});

  useEffect(() => {
    fetch('/api/admin/legal', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setPolicies(prev => ({ ...prev, ...d.data }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updatePolicy = (key: string, field: keyof PolicyDoc, value: string | boolean) => {
    setPolicies(p => ({ ...p, [key]: { ...p[key], [field]: value } }));
  };

  const savePolicy = async (key: string, overrides?: Partial<PolicyDoc>) => {
    setSaveStatus(s => ({ ...s, [key]: 'saving' }));
    try {
      const payload = { ...policies[key], ...overrides, last_updated: new Date().toISOString() };
      const res = await fetch(`/api/admin/legal/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const status = data.success ? 'saved' : 'error';
      setSaveStatus(s => ({ ...s, [key]: status }));
      if (data.success) setTimeout(() => setSaveStatus(s => ({ ...s, [key]: 'idle' })), 3000);
    } catch {
      setSaveStatus(s => ({ ...s, [key]: 'error' }));
    }
  };

  const policyKeys = ['terms', 'privacy', 'cookies', 'acceptable_use', 'refunds', 'complaints', 'accessibility', 'eligibility', 'data_retention', 'reporting', 'security', 'data_rights'];
  const policyLabels: Record<string, string> = {
    terms:          'Terms',
    privacy:        'Privacy',
    cookies:        'Cookies',
    acceptable_use: 'Acceptable Use',
    refunds:        'Refunds',
    complaints:     'Complaints',
    accessibility:  'Accessibility',
    eligibility:    'Eligibility',
    data_retention: 'Data Retention',
    reporting:      'Reporting',
    security:       'Security',
    data_rights:    'Data Rights',
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      {[1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Legal Policies — Admin Portal</title>
        <meta name="description" content="Manage Terms of Service, Privacy Policy, Cookie Policy, and Acceptable Use Policy." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/legal" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Legal Policies</h1>
        <p className="text-muted-foreground mt-1">Manage all platform legal documents — Terms, Privacy, Cookies, Acceptable Use, Refunds, Complaints, Accessibility, Eligibility, Data Retention, Reporting, Security, and Data Rights policies.</p>
      </div>

      {/* Policy status overview */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {policyKeys.map(key => {
          const p = policies[key];
          return (
            <Card key={key} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <Badge className={p.is_published ? 'bg-green-500/10 text-green-400 border-0 text-xs' : 'bg-muted text-muted-foreground border-0 text-xs'}>
                    {p.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1">v{p.version} · Effective {p.effective_date}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Updated {fmtDate(p.last_updated)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Editor tabs */}
      <Tabs defaultValue="terms">
        <TabsList className="bg-muted border border-border mb-6">
          {policyKeys.map(key => (
            <TabsTrigger key={key} value={key} className="data-[state=active]:bg-background">
              {policyLabels[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {policyKeys.map(key => {
          const p = policies[key];
          const status = saveStatus[key] ?? 'idle';
          return (
            <TabsContent key={key} value={key}>
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{p.title}</CardTitle>
                      <CardDescription>Edit the content, version, and publication status</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewing(previewing === key ? null : key)}
                        className="gap-1.5 border-border"
                      >
                        {previewing === key ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {previewing === key ? 'Edit' : 'Preview'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => savePolicy(key)}
                        disabled={status === 'saving'}
                        className="bg-primary hover:bg-primary/90 gap-1.5"
                      >
                        {status === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                         status === 'saved' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                         <Save className="w-3.5 h-3.5" />}
                        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Error' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Meta fields */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Version</Label>
                      <Input
                        value={p.version}
                        onChange={e => updatePolicy(key, 'version', e.target.value)}
                        className="bg-background border-border"
                        placeholder="e.g. 1.0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Effective Date</Label>
                      <Input
                        type="date"
                        value={p.effective_date}
                        onChange={e => updatePolicy(key, 'effective_date', e.target.value)}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                      <div className="flex items-center gap-2 h-10">
                        <button
                          onClick={async () => {
                            const newVal = !p.is_published;
                            updatePolicy(key, 'is_published', newVal);
                            await savePolicy(key, { is_published: newVal });
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.is_published ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.is_published ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-sm font-medium ${p.is_published ? 'text-green-400' : 'text-muted-foreground'}`}>
                          {p.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Editor mode toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <button
                        onClick={() => setEditorMode(m => ({ ...m, [key]: 'markdown' }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          (editorMode[key] ?? 'markdown') === 'markdown'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" /> Markdown
                      </button>
                      <button
                        onClick={() => setEditorMode(m => ({ ...m, [key]: 'html' }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          editorMode[key] === 'html'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" /> HTML
                      </button>
                    </div>
                    {editorMode[key] === 'html' && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                        Raw HTML — will render as-is on the public policy page
                      </Badge>
                    )}
                  </div>

                  {/* Content editor / preview */}
                  {previewing === key ? (
                    editorMode[key] === 'html' ? (
                      <div className="bg-background border border-border rounded-xl p-6 min-h-96 overflow-auto">
                        <div
                          className="prose prose-sm prose-invert max-w-none text-foreground"
                          dangerouslySetInnerHTML={{ __html: p.content }}
                        />
                      </div>
                    ) : (
                      <div className="bg-background border border-border rounded-xl p-6 min-h-96 prose prose-sm prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{p.content}</pre>
                      </div>
                    )
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {editorMode[key] === 'html'
                          ? <>Policy Content <span className="text-blue-400">(HTML)</span></>
                          : <>Policy Content <span className="text-muted-foreground/60">(Markdown supported)</span></>
                        }
                      </Label>
                      <Textarea
                        value={p.content}
                        onChange={e => updatePolicy(key, 'content', e.target.value)}
                        className="bg-background border-border font-mono text-xs resize-none min-h-[500px]"
                        spellCheck={false}
                        placeholder={editorMode[key] === 'html'
                          ? '<h1>Policy Title</h1>\n<p>Your policy content here...</p>'
                          : '# Policy Title\n\nYour policy content here...'
                        }
                      />
                      {editorMode[key] === 'html' && (
                        <p className="text-xs text-muted-foreground">
                          Enter valid HTML. Use standard tags: &lt;h1&gt;–&lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, &lt;table&gt;.
                          Script tags and event handlers are stripped on render.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
