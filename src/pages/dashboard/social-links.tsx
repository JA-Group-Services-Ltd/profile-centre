import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Share2, Save, Check, Plus, Trash2, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NoProfilePrompt from '@/components/dashboard/NoProfilePrompt';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  label: string;
}

const PLATFORMS = [
  { value: 'instagram',  label: 'Instagram',  placeholder: 'https://instagram.com/yourhandle' },
  { value: 'facebook',   label: 'Facebook',   placeholder: 'https://facebook.com/yourpage' },
  { value: 'twitter',    label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { value: 'linkedin',   label: 'LinkedIn',   placeholder: 'https://linkedin.com/in/yourname' },
  { value: 'tiktok',     label: 'TikTok',     placeholder: 'https://tiktok.com/@yourhandle' },
  { value: 'youtube',    label: 'YouTube',    placeholder: 'https://youtube.com/@yourchannel' },
  { value: 'pinterest',  label: 'Pinterest',  placeholder: 'https://pinterest.com/yourprofile' },
  { value: 'snapchat',   label: 'Snapchat',   placeholder: 'https://snapchat.com/add/yourhandle' },
  { value: 'threads',    label: 'Threads',    placeholder: 'https://threads.net/@yourhandle' },
  { value: 'github',     label: 'GitHub',     placeholder: 'https://github.com/yourhandle' },
  { value: 'behance',    label: 'Behance',    placeholder: 'https://behance.net/yourprofile' },
  { value: 'dribbble',   label: 'Dribbble',   placeholder: 'https://dribbble.com/yourhandle' },
  { value: 'other',      label: 'Other',      placeholder: 'https://...' },
];

interface ProfileRow {
  id: number;
  profile_type: string;
  display_name?: string | null;
  business_name?: string | null;
  biz_slug?: string | null;
  person_slug?: string | null;
  username?: string | null;
  social_links: string | null;
  social_links_enabled?: number;
}

function profileLabel(p: ProfileRow): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

export default function SocialLinksPage() {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [links, setLinks] = useState<SocialLink[]>([]);

  const loadProfile = (p: ProfileRow) => {
    setProfile(p);
    setEnabled(p.social_links_enabled !== 0);
    try {
      const parsed = p.social_links ? JSON.parse(p.social_links) : [];
      setLinks(Array.isArray(parsed) ? parsed : []);
    } catch { setLinks([]); }
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

  const addLink = () => {
    setLinks(prev => [...prev, { id: Date.now().toString(), platform: 'instagram', url: '', label: '' }]);
  };

  const removeLink = (id: string) => setLinks(prev => prev.filter(l => l.id !== id));

  const updateLink = (id: string, field: keyof SocialLink, value: string) => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSave = async () => {
    if (!profile) return;
    setError('');
    setSaving(true);
    try {
      const validLinks = links.filter(l => l.url.trim());
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          social_links: JSON.stringify(validLinks),
          social_links_enabled: enabled ? 1 : 0,
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
        <title>Social Links — Dashboard</title>
        <meta name="description" content="Add your social media profiles to your public profile card." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/social-links" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" /> Social Links
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add your social media profiles to your public card. These appear as branded icon links.
          </p>
        </div>

        {/* Profile selector — always visible so users know which profile they're editing */}
        {allProfiles.length > 0 && (
          <div className="mb-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Managing social links for:</p>
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
          <NoProfilePrompt featureName="Social Links" preferredType="any" />
        ) : (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show social links on profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Display social media icons on your public profile card.</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your social profiles</CardTitle>
                <CardDescription>Add each social platform you want to display. Order them by dragging.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {links.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <Share2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No social links yet. Add your first platform below.</p>
                  </div>
                )}

                {links.map((link, idx) => {
                  const platformInfo = PLATFORMS.find(p => p.value === link.platform) ?? PLATFORMS[PLATFORMS.length - 1];
                  return (
                    <div key={link.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Link {idx + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeLink(link.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Platform</Label>
                          <Select value={link.platform} onValueChange={v => updateLink(link.id, 'platform', v)}>
                            <SelectTrigger className="bg-background border-border text-sm h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATFORMS.map(p => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Custom label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input
                            value={link.label}
                            onChange={e => updateLink(link.id, 'label', e.target.value)}
                            placeholder={platformInfo.label}
                            maxLength={40}
                            className="bg-background border-border text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Profile URL <span className="text-destructive">*</span></Label>
                        <div className="flex gap-2">
                          <Input
                            value={link.url}
                            onChange={e => updateLink(link.id, 'url', e.target.value)}
                            placeholder={platformInfo.placeholder}
                            className="bg-background border-border text-sm font-mono"
                          />
                          {link.url && (
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              <Button type="button" variant="outline" size="sm" className="border-border flex-shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Button type="button" variant="outline" onClick={addLink} className="w-full border-dashed border-border gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add social platform
                </Button>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save social links</>}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
