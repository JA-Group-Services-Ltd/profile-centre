import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Plus, Trash2, Edit2, ChevronUp, ChevronDown, Check, X, Globe,
  Linkedin, Twitter, Instagram, Facebook, Youtube, Github,
  Mail, Phone, Link2, Music, ShoppingBag, Palette, Calendar,
  MessageCircle, Video, Mic, BookOpen, MapPin, ExternalLink,
  Share2, CreditCard, Star,
} from 'lucide-react';import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface Link { id: number; type: string; platform: string | null; label: string; url: string; is_enabled: number; sort_order: number; }
interface Profile { id: number; username: string; profile_type?: string; display_name?: string; business_name?: string; biz_slug?: string; person_slug?: string; }
interface Plan { max_links: number; name: string; }

function profileLabel(p: Profile): string {
  if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || 'Business';
  return p.display_name || p.person_slug || p.username || 'Personal';
}

// ── Platform registry ─────────────────────────────────────────────────────────
interface PlatformDef {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  placeholder: string;
  hint?: string;
}

const PLATFORM_CATEGORIES = [
  { id: 'social', label: 'Social Media' },
  { id: 'professional', label: 'Professional' },
  { id: 'contact', label: 'Contact & Messaging' },
  { id: 'creative', label: 'Creative & Portfolio' },
  { id: 'music', label: 'Music & Podcasts' },
  { id: 'shopping', label: 'Shopping & Commerce' },
  { id: 'booking', label: 'Booking & Scheduling' },
  { id: 'video', label: 'Video & Streaming' },
  { id: 'other', label: 'Other' },
];

const PLATFORMS: PlatformDef[] = [
  // Social
  { value: 'instagram',  label: 'Instagram',      icon: Instagram,      category: 'social',       placeholder: 'https://instagram.com/yourhandle' },
  { value: 'facebook',   label: 'Facebook',        icon: Facebook,       category: 'social',       placeholder: 'https://facebook.com/yourpage' },
  { value: 'twitter',    label: 'Twitter / X',     icon: Twitter,        category: 'social',       placeholder: 'https://x.com/yourhandle' },
  { value: 'tiktok',     label: 'TikTok',          icon: Video,          category: 'social',       placeholder: 'https://tiktok.com/@yourhandle' },
  { value: 'threads',    label: 'Threads',         icon: MessageCircle,  category: 'social',       placeholder: 'https://threads.net/@yourhandle' },
  { value: 'snapchat',   label: 'Snapchat',        icon: Share2,         category: 'social',       placeholder: 'https://snapchat.com/add/yourhandle' },
  { value: 'pinterest',  label: 'Pinterest',       icon: Palette,        category: 'social',       placeholder: 'https://pinterest.com/yourhandle' },
  // Professional
  { value: 'linkedin',   label: 'LinkedIn',        icon: Linkedin,       category: 'professional', placeholder: 'https://linkedin.com/in/yourprofile' },
  { value: 'github',     label: 'GitHub',          icon: Github,         category: 'professional', placeholder: 'https://github.com/yourusername' },
  { value: 'behance',    label: 'Behance',         icon: Palette,        category: 'professional', placeholder: 'https://behance.net/yourprofile' },
  { value: 'dribbble',   label: 'Dribbble',        icon: Star,           category: 'professional', placeholder: 'https://dribbble.com/yourhandle' },
  { value: 'medium',     label: 'Medium',          icon: BookOpen,       category: 'professional', placeholder: 'https://medium.com/@yourhandle' },
  { value: 'substack',   label: 'Substack',        icon: Mail,           category: 'professional', placeholder: 'https://yourname.substack.com' },
  // Contact & Messaging
  { value: 'email',      label: 'Email',           icon: Mail,           category: 'contact',      placeholder: 'mailto:you@example.com', hint: 'Use mailto: prefix, e.g. mailto:you@example.com' },
  { value: 'phone',      label: 'Phone',           icon: Phone,          category: 'contact',      placeholder: 'tel:+441234567890', hint: 'Use tel: prefix, e.g. tel:+441234567890' },
  { value: 'whatsapp',   label: 'WhatsApp',        icon: MessageCircle,  category: 'contact',      placeholder: 'https://wa.me/441234567890', hint: 'Use wa.me link with country code, no + or spaces' },
  { value: 'telegram',   label: 'Telegram',        icon: MessageCircle,  category: 'contact',      placeholder: 'https://t.me/yourhandle' },
  { value: 'signal',     label: 'Signal',          icon: MessageCircle,  category: 'contact',      placeholder: 'https://signal.me/#p/yourhandle' },
  // Creative & Portfolio
  { value: 'website',    label: 'Website',         icon: Globe,          category: 'creative',     placeholder: 'https://yourwebsite.com' },
  { value: 'portfolio',  label: 'Portfolio',       icon: Palette,        category: 'creative',     placeholder: 'https://yourportfolio.com' },
  { value: 'linktree',   label: 'Linktree',        icon: Link2,          category: 'creative',     placeholder: 'https://linktr.ee/yourhandle' },
  { value: 'etsy',       label: 'Etsy',            icon: ShoppingBag,    category: 'creative',     placeholder: 'https://etsy.com/shop/yourshop' },
  // Music & Podcasts
  { value: 'spotify',    label: 'Spotify',         icon: Music,          category: 'music',        placeholder: 'https://open.spotify.com/artist/...' },
  { value: 'soundcloud', label: 'SoundCloud',      icon: Music,          category: 'music',        placeholder: 'https://soundcloud.com/yourhandle' },
  { value: 'apple_music',label: 'Apple Music',     icon: Music,          category: 'music',        placeholder: 'https://music.apple.com/...' },
  { value: 'podcast',    label: 'Podcast',         icon: Mic,            category: 'music',        placeholder: 'https://yourpodcast.com' },
  // Shopping & Commerce
  { value: 'shopify',    label: 'Shopify Store',   icon: ShoppingBag,    category: 'shopping',     placeholder: 'https://yourstore.myshopify.com' },
  { value: 'amazon',     label: 'Amazon Store',    icon: ShoppingBag,    category: 'shopping',     placeholder: 'https://amazon.co.uk/...' },
  { value: 'paypal',     label: 'PayPal.me',       icon: CreditCard,     category: 'shopping',     placeholder: 'https://paypal.me/yourhandle' },
  { value: 'stripe',     label: 'Stripe Payment',  icon: CreditCard,     category: 'shopping',     placeholder: 'https://buy.stripe.com/...' },
  // Booking & Scheduling
  { value: 'calendly',   label: 'Calendly',        icon: Calendar,       category: 'booking',      placeholder: 'https://calendly.com/yourhandle' },
  { value: 'booking',    label: 'Booking Page',    icon: Calendar,       category: 'booking',      placeholder: 'https://yourbooking.com' },
  { value: 'google_maps',label: 'Google Maps',     icon: MapPin,         category: 'booking',      placeholder: 'https://maps.google.com/...' },
  // Video & Streaming
  { value: 'youtube',    label: 'YouTube',         icon: Youtube,        category: 'video',        placeholder: 'https://youtube.com/@yourchannel' },
  { value: 'twitch',     label: 'Twitch',          icon: Video,          category: 'video',        placeholder: 'https://twitch.tv/yourhandle' },
  { value: 'vimeo',      label: 'Vimeo',           icon: Video,          category: 'video',        placeholder: 'https://vimeo.com/yourhandle' },
  // Other
  { value: 'other',      label: 'Other',           icon: ExternalLink,   category: 'other',        placeholder: 'https://...' },
];

function PlatformIcon({ platform }: { platform: string | null }) {
  const p = PLATFORMS.find(p => p.value === platform);
  if (p) return <p.icon className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    social: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    professional: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    contact: 'bg-green-500/10 text-green-600 dark:text-green-400',
    creative: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    music: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    shopping: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    booking: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    video: 'bg-red-500/10 text-red-600 dark:text-red-400',
    other: 'bg-muted text-muted-foreground',
  };
  return map[category] ?? map.other;
}

export default function LinksPage() {
  const { user } = useAuth();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  const [newLink, setNewLink] = useState({ type: 'social', platform: '', label: '', url: '' });
  const [editLink, setEditLink] = useState({ label: '', url: '' });

  const selectedPlatformDef = PLATFORMS.find(p => p.value === newLink.platform);

  // Load profiles + plan once
  useEffect(() => {
    async function load() {
      const [profilesRes, plansRes] = await Promise.all([
        fetch('/api/profiles/me', { credentials: 'include' }),
        fetch('/api/plans'),
      ]);
      const profilesData = await profilesRes.json();
      const plansData = await plansRes.json();

      if (profilesData.success && profilesData.data.length > 0) {
        const profiles: Profile[] = profilesData.data;
        setAllProfiles(profiles);
        // Default to personal profile if one exists; otherwise use whichever profile is present
        // (e.g. business-only users must not be left with profile=null)
        const defaultProfile = profiles.find(p => p.profile_type !== 'business') ?? profiles[0];
        setProfile(defaultProfile);
        const linksRes = await fetch(`/api/links/${defaultProfile.id}`, { credentials: 'include' });
        const linksData = await linksRes.json();
        if (linksData.success) setLinks(linksData.data);
      }
      if (plansData.success) {
        const userPlan = plansData.plans?.find((p: { id: number }) => p.id === user?.plan_id);
        setPlan(userPlan || plansData.plans?.[0] || null);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  // Switch profile — reload links for the selected profile
  const switchProfile = async (id: number) => {
    const p = allProfiles.find(x => x.id === id);
    if (!p || p.id === profile?.id) return;
    setProfile(p);
    setLinks([]);
    setShowAddForm(false);
    setEditingId(null);
    setFilterCat('all');
    setLinksLoading(true);
    try {
      const res = await fetch(`/api/links/${p.id}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setLinks(data.data);
    } catch { /* non-fatal */ }
    setLinksLoading(false);
  };

  const addLink = async () => {
    if (!profile) return setError('No profile found');
    if (newLink.type === 'social' && !newLink.platform) return setError('Please select a platform');
    if (!newLink.label) return setError('Label is required');
    if (!newLink.url) return setError('URL is required');
    setError('');
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile_id: profile.id, ...newLink, platform: newLink.type === 'social' ? newLink.platform : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinks(l => [...l, data.data]);
      setNewLink({ type: 'social', platform: '', label: '', url: '' });
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add link');
    }
  };

  const toggleLink = async (link: Link) => {
    const res = await fetch(`/api/links/${link.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_enabled: link.is_enabled ? 0 : 1 }),
    });
    const data = await res.json();
    if (data.success) setLinks(l => l.map(x => x.id === link.id ? data.data : x));
  };

  const deleteLink = async (id: number) => {
    if (!confirm('Delete this link?')) return;
    await fetch(`/api/links/${id}`, { method: 'DELETE', credentials: 'include' });
    setLinks(l => l.filter(x => x.id !== id));
  };

  const saveEdit = async (id: number) => {
    const res = await fetch(`/api/links/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editLink),
    });
    const data = await res.json();
    if (data.success) {
      setLinks(l => l.map(x => x.id === id ? data.data : x));
      setEditingId(null);
    }
  };

  const moveLink = async (index: number, direction: 'up' | 'down') => {
    const newLinks = [...links];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newLinks.length) return;
    [newLinks[index], newLinks[swapIndex]] = [newLinks[swapIndex], newLinks[index]];
    const updated = newLinks.map((l, i) => ({ ...l, sort_order: i }));
    setLinks(updated);
    await fetch('/api/links/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ links: updated.map(l => ({ id: l.id, sort_order: l.sort_order })) }),
    });
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Links Manager — Dashboard</title>
        <meta name="description" content="Manage your profile links and social media buttons." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/links" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Links</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Add social media, contact, booking, and custom links to your profile
          </p>
        </div>
        <Button onClick={() => { setShowAddForm(true); setFilterCat('all'); }} className="bg-primary gap-2">
          <Plus className="w-4 h-4" /> Add Link
        </Button>
      </div>

      {/* Profile selector — always visible so users know which profile they're managing links for */}
      {allProfiles.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Managing links for:</p>
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
        </div>
      )}

      {/* Plan limit */}
      {plan && (
        <div className="mb-5 p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{links.length}</span> of{' '}
            <span className="text-foreground font-medium">{plan.max_links >= 999 ? 'unlimited' : plan.max_links}</span> links used
          </span>
          <Badge variant="outline" className="text-xs">{plan.name} plan</Badge>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {/* Add form */}
      {showAddForm && (
        <Card className="bg-card border-primary/30 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Add New Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewLink(l => ({ ...l, type: 'social', platform: '' }))}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${newLink.type === 'social' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
              >
                <Share2 className="w-4 h-4 mx-auto mb-1" />
                Platform / Social
              </button>
              <button
                type="button"
                onClick={() => setNewLink(l => ({ ...l, type: 'custom', platform: '' }))}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${newLink.type === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
              >
                <Link2 className="w-4 h-4 mx-auto mb-1" />
                Custom URL
              </button>
            </div>

            {/* Platform picker — categorised */}
            {newLink.type === 'social' && (
              <div className="space-y-3">
                {/* Category filter tabs */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterCat('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    All
                  </button>
                  {PLATFORM_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFilterCat(cat.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Platform grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                  {PLATFORMS
                    .filter(p => filterCat === 'all' || p.category === filterCat)
                    .map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewLink(l => ({ ...l, platform: p.value, label: l.label || p.label, url: '' }))}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          newLink.platform === p.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        }`}
                      >
                        <p.icon className="w-4 h-4" />
                        <span className="leading-tight text-center">{p.label}</span>
                      </button>
                    ))
                  }
                </div>

                {/* Hint for selected platform */}
                {selectedPlatformDef?.hint && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    {selectedPlatformDef.hint}
                  </p>
                )}
              </div>
            )}

            {/* Label */}
            <div>
              <Label>Label</Label>
              <Input
                value={newLink.label}
                onChange={e => setNewLink(l => ({ ...l, label: e.target.value }))}
                className="mt-1.5 bg-background border-border"
                placeholder={selectedPlatformDef?.label ?? 'My Portfolio'}
              />
            </div>

            {/* URL */}
            <div>
              <Label>URL</Label>
              <Input
                value={newLink.url}
                onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))}
                className="mt-1.5 bg-background border-border"
                placeholder={selectedPlatformDef?.placeholder ?? 'https://...'}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={addLink} className="bg-primary">Add Link</Button>
              <Button variant="outline" onClick={() => { setShowAddForm(false); setNewLink({ type: 'social', platform: '', label: '', url: '' }); }} className="border-border">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links list */}
      {(loading || linksLoading) ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-2">No links yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Add social media, contact, booking, and more</p>
          <Button onClick={() => setShowAddForm(true)} className="bg-primary gap-2">
            <Plus className="w-4 h-4" /> Add Your First Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link, index) => {
            const platformDef = PLATFORMS.find(p => p.value === link.platform);
            const catColor = platformDef ? getCategoryColor(platformDef.category) : getCategoryColor('other');
            return (
              <div key={link.id} className={`rounded-xl border p-4 transition-all ${link.is_enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'}`}>
                {editingId === link.id ? (
                  <div className="space-y-3">
                    <Input value={editLink.label} onChange={e => setEditLink(l => ({ ...l, label: e.target.value }))}
                      className="bg-background border-border" placeholder="Label" />
                    <Input value={editLink.url} onChange={e => setEditLink(l => ({ ...l, url: e.target.value }))}
                      className="bg-background border-border" placeholder="URL" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(link.id)} className="bg-primary gap-1"><Check className="w-3 h-3" /> Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-border gap-1"><X className="w-3 h-3" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveLink(index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveLink(index, 'down')} disabled={index === links.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${catColor}`}>
                      <PlatformIcon platform={link.platform} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
                        {platformDef && (
                          <Badge variant="outline" className={`text-xs border-0 px-1.5 py-0 ${catColor}`}>
                            {platformDef.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{link.url}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch checked={!!link.is_enabled} onCheckedChange={() => toggleLink(link)} />
                      <button
                        onClick={() => { setEditingId(link.id); setEditLink({ label: link.label, url: link.url }); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteLink(link.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tips */}
      {!showAddForm && links.length > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-muted/40 border border-border">
          <p className="text-xs font-semibold text-foreground mb-2">Tips</p>
          <ul className="space-y-1">
            <li className="text-xs text-muted-foreground">• Use the arrows to reorder links — they appear on your profile in this order</li>
            <li className="text-xs text-muted-foreground">• Toggle the switch to temporarily hide a link without deleting it</li>
            <li className="text-xs text-muted-foreground">• For WhatsApp, use the format: https://wa.me/447700000000 (no + or spaces)</li>
            <li className="text-xs text-muted-foreground">• For Email, use: mailto:you@example.com — for Phone, use: tel:+441234567890</li>
          </ul>
        </div>
      )}
    </div>
  );
}
