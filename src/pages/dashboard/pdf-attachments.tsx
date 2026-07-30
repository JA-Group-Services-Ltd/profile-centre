import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { FileText, Save, Check, Plus, Trash2, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NoProfilePrompt from '@/components/dashboard/NoProfilePrompt';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface PdfItem {
  id: string;
  label: string;
  url: string;
  description: string;
}

interface ProfileRow {
  id: number;
  profile_type: string;
  display_name?: string | null;
  business_name?: string | null;
  biz_slug?: string | null;
  person_slug?: string | null;
  username?: string | null;
  pdf_attachments: string | null;
  pdf_enabled: number;
}

function profileLabel(p: ProfileRow): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

export default function PdfAttachmentsPage() {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<PdfItem[]>([]);

  const loadProfile = (p: ProfileRow) => {
    setProfile(p);
    setEnabled(!!p.pdf_enabled);
    try {
      const parsed = p.pdf_attachments ? JSON.parse(p.pdf_attachments) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch { setItems([]); }
    setSaved(false);
    setError('');
  };

  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.length > 0) {
          const profiles: ProfileRow[] = d.data;
          setAllProfiles(profiles);
          const defaultProfile = profiles.find(x => x.profile_type !== 'business') ?? profiles[0];
          loadProfile(defaultProfile);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const switchProfile = (id: number) => {
    const p = allProfiles.find(x => x.id === id);
    if (p) loadProfile(p);
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now().toString(), label: '', url: '', description: '' }]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof PdfItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async () => {
    if (!profile) return;
    setError('');
    setSaving(true);
    try {
      const validItems = items.filter(i => i.url.trim() && i.label.trim());
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pdf_attachments: JSON.stringify(validItems),
          pdf_enabled: enabled ? 1 : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>PDF Attachments — Dashboard</title>
        <meta name="description" content="Attach PDFs to your profile for visitors to download." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/pdf-attachments" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> PDF Attachments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Attach PDFs to your profile — brochures, CVs, menus, portfolios, or any document you want visitors to download.
          </p>
        </div>

        {/* Profile selector — always visible so users know which profile they're editing */}
        {allProfiles.length > 0 && (
          <div className="mb-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Managing PDF attachments for:</p>
            <div className="flex flex-wrap gap-2">
              {allProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchProfile(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    profile?.id === p.id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {profileLabel(p)}
                  <span className="ml-1.5 opacity-60">{p.profile_type === 'business' ? '· Business' : '· Personal'}</span>
                </button>
              ))}
            </div>
            {profile?.profile_type === 'business' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                You can also edit this from your{' '}
                <a href="/dashboard/business-profile" className="text-primary underline underline-offset-2 hover:no-underline">Business Profile page</a>
                {' '}— changes sync automatically, nothing is duplicated.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !profile ? (
          <NoProfilePrompt featureName="PDF Attachments" preferredType="any" />
        ) : (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show PDF attachments on profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Display download links for your PDFs on your public profile card.</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PDF documents</CardTitle>
                <CardDescription>
                  Add links to your PDF files. Host them on Google Drive, Dropbox, your website, or any public URL.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No PDFs yet. Add your first document below.</p>
                  </div>
                )}

                {items.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Document {idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Label <span className="text-destructive">*</span></Label>
                      <Input
                        value={item.label}
                        onChange={e => updateItem(item.id, 'label', e.target.value)}
                        placeholder="e.g. Company Brochure, My CV, Price List 2026"
                        maxLength={80}
                        className="bg-background border-border text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">PDF URL <span className="text-destructive">*</span></Label>
                      <div className="flex gap-2">
                        <Input
                          value={item.url}
                          onChange={e => updateItem(item.id, 'url', e.target.value)}
                          placeholder="https://drive.google.com/file/d/..."
                          className="bg-background border-border text-sm font-mono"
                        />
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="outline" size="sm" className="border-border flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use a direct link or a shareable link from Google Drive / Dropbox. Make sure the file is set to public access.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        value={item.description}
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Brief description of this document"
                        maxLength={120}
                        className="bg-background border-border text-sm"
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed border-border gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add PDF
                </Button>
              </CardContent>
            </Card>

            {/* Hosting tip */}
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-400 mb-1">Where to host your PDFs</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong className="text-foreground">Google Drive</strong> — Upload, right-click → Share → Anyone with the link → Copy link</li>
                  <li>• <strong className="text-foreground">Dropbox</strong> — Upload, click Share → Create link → Copy</li>
                  <li>• <strong className="text-foreground">Your website</strong> — Upload to your site and paste the direct URL</li>
                </ul>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSave} disabled={saving || items.every(i => !i.url || !i.label)} className="gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save attachments</>}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
