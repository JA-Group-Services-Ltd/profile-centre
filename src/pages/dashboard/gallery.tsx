import { useState, useEffect, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Image, Save, Check, Plus, Trash2, GripVertical, Upload, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NoProfilePrompt from '@/components/dashboard/NoProfilePrompt';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface GalleryItem {
  id: string;
  url: string;
  caption: string;
  alt: string;
}

interface ProfileRow {
  id: number;
  profile_type: string;
  display_name?: string | null;
  business_name?: string | null;
  biz_slug?: string | null;
  person_slug?: string | null;
  username?: string | null;
  gallery: string | null;
}

function profileLabel(p: ProfileRow): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

export default function GalleryPage() {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadProfile = (p: ProfileRow & { gallery_enabled?: number }) => {
    setProfile(p);
    setEnabled(!!p.gallery_enabled);
    try {
      const parsed = p.gallery ? JSON.parse(p.gallery) : [];
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
          const profiles = d.data as (ProfileRow & { gallery_enabled?: number })[];
          setAllProfiles(profiles);
          const defaultProfile = profiles.find(x => x.profile_type !== 'business') ?? profiles[0];
          loadProfile(defaultProfile);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const switchProfile = (id: number) => {
    const p = allProfiles.find(x => x.id === id) as (ProfileRow & { gallery_enabled?: number }) | undefined;
    if (p) loadProfile(p);
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now().toString(), url: '', caption: '', alt: '' }]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof GalleryItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleImageUpload = async (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
    setUploading(id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/profile-image', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (data.url) updateItem(id, 'url', data.url);
      else setError('Upload failed — please try a URL instead');
    } catch { setError('Upload failed'); }
    finally { setUploading(null); }
  };

  const handleSave = async () => {
    if (!profile) return;
    setError('');
    setSaving(true);
    try {
      const validItems = items.filter(i => i.url.trim());
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gallery: JSON.stringify(validItems),
          gallery_enabled: enabled ? 1 : 0,
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
        <title>Gallery — Dashboard</title>
        <meta name="description" content="Showcase your work and portfolio images on your public profile." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/gallery" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Image className="w-6 h-6 text-primary" /> Gallery
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Showcase your work, products, or portfolio images on your public profile.
          </p>
        </div>

        {/* Profile selector — always visible so users know which profile they're editing */}
        {allProfiles.length > 0 && (
          <div className="mb-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Managing gallery for:</p>
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
          <NoProfilePrompt featureName="Gallery" preferredType="any" />
        ) : (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show gallery on profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Display your gallery section on your public profile card.</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Gallery images</CardTitle>
                <CardDescription>Add images by URL or upload. Add a caption to describe each image.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No images yet. Add your first image below.</p>
                  </div>
                )}

                {items.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Image {idx + 1}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Preview */}
                    {item.url && (
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                        <img src={item.url} alt={item.alt || item.caption || 'Gallery image'} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Image URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={item.url}
                          onChange={e => updateItem(item.id, 'url', e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="bg-background border-border text-sm font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border flex-shrink-0 gap-1 text-xs"
                          onClick={() => fileRefs.current[item.id]?.click()}
                          disabled={uploading === item.id}
                        >
                          {uploading === item.id ? <div className="w-3 h-3 border border-foreground/30 border-t-foreground rounded-full animate-spin" /> : <Upload className="w-3 h-3" />}
                          Upload
                        </Button>
                        <input
                          ref={el => { fileRefs.current[item.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(item.id, f); }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Caption <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input value={item.caption} onChange={e => updateItem(item.id, 'caption', e.target.value)} placeholder="Describe this image" maxLength={120} className="bg-background border-border text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Alt text <span className="text-muted-foreground font-normal">(accessibility)</span></Label>
                        <Input value={item.alt} onChange={e => updateItem(item.id, 'alt', e.target.value)} placeholder="Brief description for screen readers" maxLength={120} className="bg-background border-border text-sm" />
                      </div>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed border-border gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add image
                </Button>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save gallery</>}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
