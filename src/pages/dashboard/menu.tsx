import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { List, Save, Check, Plus, Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NoProfilePrompt from '@/components/dashboard/NoProfilePrompt';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface MenuItem {
  id: string;
  category: string;
  name: string;
  description: string;
  price: string;
}

interface ProfileRow {
  id: number;
  profile_type: string;
  display_name?: string | null;
  business_name?: string | null;
  biz_slug?: string | null;
  person_slug?: string | null;
  username?: string | null;
  menu_items: string | null;
  menu_enabled: number;
  menu_title: string | null;
}

function profileLabel(p: ProfileRow): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

export default function MenuPage() {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const loadProfile = (p: ProfileRow) => {
    setProfile(p);
    setEnabled(!!p.menu_enabled);
    setTitle(p.menu_title || '');
    try {
      const parsed = p.menu_items ? JSON.parse(p.menu_items) : [];
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
    const id = Date.now().toString();
    setItems(prev => [...prev, { id, category: '', name: '', description: '', price: '' }]);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof MenuItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const toggleCollapse = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  // Group items by category for preview
  const categories = [...new Set(items.map(i => i.category || 'Uncategorised'))];

  const handleSave = async () => {
    if (!profile) return;
    setError('');
    setSaving(true);
    try {
      const validItems = items.filter(i => i.name.trim());
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          menu_items: JSON.stringify(validItems),
          menu_enabled: enabled ? 1 : 0,
          menu_title: title.trim() || 'Menu',
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
        <title>Menu / Price List — Dashboard</title>
        <meta name="description" content="Display a menu, price list, or service catalogue on your public profile." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/menu" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <List className="w-6 h-6 text-primary" /> Menu / Price List
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Display a menu, price list, or service catalogue on your public profile.
          </p>
        </div>

        {/* Profile selector — always visible so users know which profile they're editing */}
        {allProfiles.length > 0 && (
          <div className="mb-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Managing menu / price list for:</p>
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
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !profile ? (
          <NoProfilePrompt featureName="Menu / Price List" preferredType="any" />
        ) : (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show menu on profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Display your menu or price list on your public profile card.</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="menu-title">Section title</Label>
                  <Input
                    id="menu-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Our Menu, Price List, Services"
                    maxLength={60}
                    className="bg-background border-border text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Items</CardTitle>
                <CardDescription>
                  Add items with optional categories, descriptions, and prices. Group items by category to create sections.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <List className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No items yet. Add your first item below.</p>
                  </div>
                )}

                {items.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-lg overflow-hidden bg-muted/10">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => toggleCollapse(item.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground flex-shrink-0">#{idx + 1}</span>
                        <span className="text-sm font-medium text-foreground truncate">
                          {item.name || <span className="text-muted-foreground italic">Untitled item</span>}
                        </span>
                        {item.price && <span className="text-xs text-primary flex-shrink-0">{item.price}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); removeItem(item.id); }} className="text-destructive hover:text-destructive h-7 w-7 p-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {collapsed[item.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {!collapsed[item.id] && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border">
                        <div className="grid grid-cols-2 gap-3 pt-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Item name <span className="text-destructive">*</span></Label>
                            <Input value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} placeholder="e.g. Flat White" maxLength={80} className="bg-background border-border text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Price <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input value={item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} placeholder="e.g. £3.50 or From £50" maxLength={30} className="bg-background border-border text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Category <span className="text-muted-foreground font-normal">(optional — groups items into sections)</span></Label>
                          <Input value={item.category} onChange={e => updateItem(item.id, 'category', e.target.value)} placeholder="e.g. Hot Drinks, Starters, Web Design" maxLength={60} className="bg-background border-border text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Textarea value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Brief description of this item" maxLength={200} rows={2} className="bg-background border-border text-sm resize-none" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed border-border gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add item
                </Button>
              </CardContent>
            </Card>

            {/* Preview by category */}
            {items.some(i => i.name) && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-base font-semibold text-foreground">{title || 'Menu'}</p>
                  {categories.map(cat => (
                    <div key={cat}>
                      {cat !== 'Uncategorised' && <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{cat}</p>}
                      <div className="space-y-2">
                        {items.filter(i => (i.category || 'Uncategorised') === cat && i.name).map(item => (
                          <div key={item.id} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.name}</p>
                              {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                            </div>
                            {item.price && <span className="text-sm font-semibold text-foreground flex-shrink-0">{item.price}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save menu</>}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
