/**
 * ProfileFeatureTabs
 * Embedded feature panels shown inside the Profile page for the currently
 * active profile (personal or business).  Replaces the old standalone
 * /dashboard/whatsapp, /gallery, /menu, /pdf-attachments, /social-links pages.
 */
import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, Image, List, FileText, Share2,
  Save, Check, Plus, Trash2, Upload, ExternalLink,
  Info, ChevronDown, ChevronUp, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: number;
  profile_type: string;
  // WhatsApp
  whatsapp_url?: string | null;
  whatsapp_label?: string | null;
  whatsapp_enabled?: number;
  // Gallery
  gallery?: string | null;
  gallery_enabled?: number;
  // Menu
  menu_items?: string | null;
  menu_enabled?: number;
  menu_title?: string | null;
  // PDF
  pdf_attachments?: string | null;
  pdf_enabled?: number;
  // Social links
  social_links?: string | null;
  social_links_enabled?: number;
}

interface GalleryItem  { id: string; url: string; caption: string; alt: string; }
interface MenuItem     { id: string; category: string; name: string; description: string; price: string; }
interface PdfItem      { id: string; label: string; url: string; description: string; }
interface SocialLink   { id: string; platform: string; url: string; label: string; }

const PLATFORMS = [
  { value: 'instagram',  label: 'Instagram',   placeholder: 'https://instagram.com/yourhandle' },
  { value: 'facebook',   label: 'Facebook',    placeholder: 'https://facebook.com/yourpage' },
  { value: 'twitter',    label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { value: 'linkedin',   label: 'LinkedIn',    placeholder: 'https://linkedin.com/in/yourname' },
  { value: 'tiktok',     label: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle' },
  { value: 'youtube',    label: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel' },
  { value: 'pinterest',  label: 'Pinterest',   placeholder: 'https://pinterest.com/yourprofile' },
  { value: 'snapchat',   label: 'Snapchat',    placeholder: 'https://snapchat.com/add/yourhandle' },
  { value: 'threads',    label: 'Threads',     placeholder: 'https://threads.net/@yourhandle' },
  { value: 'github',     label: 'GitHub',      placeholder: 'https://github.com/yourhandle' },
  { value: 'behance',    label: 'Behance',     placeholder: 'https://behance.net/yourprofile' },
  { value: 'dribbble',   label: 'Dribbble',    placeholder: 'https://dribbble.com/yourhandle' },
  { value: 'other',      label: 'Other',       placeholder: 'https://...' },
];

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'whatsapp' | 'social' | 'gallery' | 'menu' | 'pdf';

interface TabDef {
  id: TabId;
  icon: React.ElementType;
  label: string;
  // Context-aware description per profile type
  descPersonal: string;
  descBusiness: string;
}

const TABS: TabDef[] = [
  {
    id: 'whatsapp',
    icon: MessageCircle,
    label: 'WhatsApp',
    descPersonal: 'Add a click-to-chat WhatsApp button so visitors can message you directly.',
    descBusiness: 'Add a WhatsApp button for customers to reach your business instantly.',
  },
  {
    id: 'social',
    icon: Share2,
    label: 'Social Links',
    descPersonal: 'Link your personal social media profiles — Instagram, LinkedIn, GitHub and more.',
    descBusiness: 'Link your business social media pages — Facebook, Instagram, LinkedIn and more.',
  },
  {
    id: 'gallery',
    icon: Image,
    label: 'Gallery',
    descPersonal: 'Showcase your portfolio, artwork, or personal projects.',
    descBusiness: 'Showcase your products, premises, team, or completed work.',
  },
  {
    id: 'menu',
    icon: List,
    label: 'Menu / Price List',
    descPersonal: 'Display a rate card, service list, or price guide on your profile.',
    descBusiness: 'Display your menu, price list, or service catalogue on your business profile.',
  },
  {
    id: 'pdf',
    icon: FileText,
    label: 'PDF Attachments',
    descPersonal: 'Attach your CV, portfolio, or any document for visitors to download.',
    descBusiness: 'Attach brochures, menus, price lists, or any document for customers to download.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v as T : fallback; }
  catch { return fallback; }
}

function SaveBtn({ saving, saved, onClick, disabled }: { saving: boolean; saved: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Button onClick={onClick} disabled={saving || !!disabled} className="gap-2">
      {saving
        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
        : saved
          ? <><Check className="w-4 h-4" /> Saved!</>
          : <><Save className="w-4 h-4" /> Save changes</>}
    </Button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** The currently active profile from the parent profile page */
  profile: ProfileRow;
  /** Called after a successful save so the parent can refresh its profile state */
  onSaved?: (updated: ProfileRow) => void;
}

export default function ProfileFeatureTabs({ profile, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('whatsapp');
  const isBusiness = profile.profile_type === 'business';

  // Re-seed local state whenever the profile switches
  useEffect(() => {
    setWaEnabled(!!profile.whatsapp_enabled);
    setWaUrl(profile.whatsapp_url || '');
    setWaLabel(profile.whatsapp_label || '');

    setSocialEnabled(profile.social_links_enabled !== 0);
    setSocialLinks(parseJson<SocialLink[]>(profile.social_links, []));

    setGalleryEnabled(!!profile.gallery_enabled);
    setGalleryItems(parseJson<GalleryItem[]>(profile.gallery, []));

    setMenuEnabled(!!profile.menu_enabled);
    setMenuTitle(profile.menu_title || '');
    setMenuItems(parseJson<MenuItem[]>(profile.menu_items, []));

    setPdfEnabled(!!profile.pdf_enabled);
    setPdfItems(parseJson<PdfItem[]>(profile.pdf_attachments, []));

    setSaving(false); setSaved(false); setError('');
  }, [profile.id]);

  // ── Shared save state ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const doSave = async (payload: Record<string, unknown>) => {
    setError(''); setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.(data.data as ProfileRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── WhatsApp state ─────────────────────────────────────────────────────────
  const [waEnabled, setWaEnabled] = useState(!!profile.whatsapp_enabled);
  const [waUrl,     setWaUrl]     = useState(profile.whatsapp_url || '');
  const [waLabel,   setWaLabel]   = useState(profile.whatsapp_label || '');
  const isValidWa = waUrl.startsWith('https://wa.me/') || waUrl.startsWith('https://api.whatsapp.com/');
  const formatWaUrl = (input: string) => {
    const stripped = input.replace(/\D/g, '');
    return stripped.length >= 7 ? `https://wa.me/${stripped}` : input;
  };

  // ── Social links state ─────────────────────────────────────────────────────
  const [socialEnabled, setSocialEnabled] = useState(profile.social_links_enabled !== 0);
  const [socialLinks,   setSocialLinks]   = useState<SocialLink[]>(parseJson<SocialLink[]>(profile.social_links, []));

  // ── Gallery state ──────────────────────────────────────────────────────────
  const [galleryEnabled, setGalleryEnabled] = useState(!!profile.gallery_enabled);
  const [galleryItems,   setGalleryItems]   = useState<GalleryItem[]>(parseJson<GalleryItem[]>(profile.gallery, []));
  const [uploading,      setUploading]      = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImageUpload = async (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB'); return; }
    setUploading(id);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload/profile-image', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (data.url) setGalleryItems(prev => prev.map(i => i.id === id ? { ...i, url: data.url } : i));
      else setError('Upload failed — please try a URL instead');
    } catch { setError('Upload failed'); }
    finally { setUploading(null); }
  };

  // ── Menu state ─────────────────────────────────────────────────────────────
  const [menuEnabled,   setMenuEnabled]   = useState(!!profile.menu_enabled);
  const [menuTitle,     setMenuTitle]     = useState(profile.menu_title || '');
  const [menuItems,     setMenuItems]     = useState<MenuItem[]>(parseJson<MenuItem[]>(profile.menu_items, []));
  const [menuCollapsed, setMenuCollapsed] = useState<Record<string, boolean>>({});
  const menuCategories = [...new Set(menuItems.map(i => i.category || 'Uncategorised'))];

  // ── PDF state ──────────────────────────────────────────────────────────────
  const [pdfEnabled, setPdfEnabled] = useState(!!profile.pdf_enabled);
  const [pdfItems,   setPdfItems]   = useState<PdfItem[]>(parseJson<PdfItem[]>(profile.pdf_attachments, []));

  // ─── Render ────────────────────────────────────────────────────────────────

  const activeDef = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Profile features</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isBusiness
            ? 'Enhance your business profile with contact buttons, social links, a gallery, price list, and downloadable documents.'
            : 'Enhance your personal profile with contact buttons, social links, a gallery, services list, and downloadable documents.'}
        </p>
      </div>

      {/* Tab pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(''); setSaved(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab description */}
      <p className="text-sm text-muted-foreground mb-5">
        {isBusiness ? activeDef.descBusiness : activeDef.descPersonal}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {/* ── WhatsApp ──────────────────────────────────────────────────────── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isBusiness ? 'Show WhatsApp button on business profile' : 'Show WhatsApp button on profile'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBusiness
                      ? 'A green WhatsApp button lets customers message your business directly.'
                      : 'A green WhatsApp button appears on your public profile card.'}
                  </p>
                </div>
                <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Button settings</CardTitle>
              <CardDescription>Configure your WhatsApp link and button label.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="wa-url">WhatsApp link <span className="text-destructive">*</span></Label>
                <Input id="wa-url" value={waUrl} onChange={e => setWaUrl(e.target.value)}
                  placeholder="https://wa.me/447700000000"
                  className="bg-background border-border font-mono text-sm" />
                <p className="text-xs text-muted-foreground">
                  Format: <code className="bg-muted px-1 rounded">https://wa.me/[country code][number]</code>
                </p>
                {waUrl && !isValidWa && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <Info className="w-3 h-3" /> URL should start with https://wa.me/
                  </p>
                )}
                {waUrl && isValidWa && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-400 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Test this link
                  </a>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-label">Button label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="wa-label" value={waLabel} onChange={e => setWaLabel(e.target.value)}
                  placeholder={isBusiness ? 'Chat with us on WhatsApp' : 'Message me on WhatsApp'}
                  maxLength={60} className="bg-background border-border text-sm" />
                <p className="text-xs text-muted-foreground">Leave blank to use the default label.</p>
              </div>

              <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-foreground">Quick link builder</p>
                <Input placeholder="Enter phone number e.g. 447700123456"
                  className="bg-background border-border text-sm"
                  onChange={e => { const f = formatWaUrl(e.target.value); if (f.startsWith('https://')) setWaUrl(f); }} />
                <p className="text-xs text-muted-foreground">Type your number (with country code, no +) to auto-build the link above.</p>
              </div>
            </CardContent>
          </Card>

          <SaveBtn saving={saving} saved={saved} disabled={!waUrl}
            onClick={() => doSave({ whatsapp_url: waUrl.trim(), whatsapp_label: waLabel.trim(), whatsapp_enabled: waEnabled ? 1 : 0 })} />
        </div>
      )}

      {/* ── Social Links ──────────────────────────────────────────────────── */}
      {activeTab === 'social' && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isBusiness ? 'Show social links on business profile' : 'Show social links on profile'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Display social media icons on your public profile card.</p>
                </div>
                <Switch checked={socialEnabled} onCheckedChange={setSocialEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBusiness ? 'Business social profiles' : 'Your social profiles'}
              </CardTitle>
              <CardDescription>
                {isBusiness
                  ? 'Add each social platform your business is active on.'
                  : 'Add each social platform you want to display.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {socialLinks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Share2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No social links yet. Add your first platform below.</p>
                </div>
              )}

              {socialLinks.map((link, idx) => {
                const pInfo = PLATFORMS.find(p => p.value === link.platform) ?? PLATFORMS[PLATFORMS.length - 1];
                return (
                  <div key={link.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Link {idx + 1}</span>
                      <Button variant="ghost" size="sm"
                        onClick={() => setSocialLinks(prev => prev.filter(l => l.id !== link.id))}
                        className="text-destructive hover:text-destructive h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Platform</Label>
                        <Select value={link.platform}
                          onValueChange={v => setSocialLinks(prev => prev.map(l => l.id === link.id ? { ...l, platform: v } : l))}>
                          <SelectTrigger className="bg-background border-border text-sm h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Custom label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input value={link.label}
                          onChange={e => setSocialLinks(prev => prev.map(l => l.id === link.id ? { ...l, label: e.target.value } : l))}
                          placeholder={pInfo.label} maxLength={40} className="bg-background border-border text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Profile URL <span className="text-destructive">*</span></Label>
                      <div className="flex gap-2">
                        <Input value={link.url}
                          onChange={e => setSocialLinks(prev => prev.map(l => l.id === link.id ? { ...l, url: e.target.value } : l))}
                          placeholder={pInfo.placeholder} className="bg-background border-border text-sm font-mono" />
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

              <Button type="button" variant="outline"
                onClick={() => setSocialLinks(prev => [...prev, { id: Date.now().toString(), platform: 'instagram', url: '', label: '' }])}
                className="w-full border-dashed border-border gap-2 text-sm">
                <Plus className="w-4 h-4" /> Add social platform
              </Button>
            </CardContent>
          </Card>

          <SaveBtn saving={saving} saved={saved}
            onClick={() => doSave({ social_links: JSON.stringify(socialLinks.filter(l => l.url.trim())), social_links_enabled: socialEnabled ? 1 : 0 })} />
        </div>
      )}

      {/* ── Gallery ───────────────────────────────────────────────────────── */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isBusiness ? 'Show gallery on business profile' : 'Show gallery on profile'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBusiness
                      ? 'Display a photo gallery of your products, premises, or work on your business profile.'
                      : 'Display your gallery section on your public profile card.'}
                  </p>
                </div>
                <Switch checked={galleryEnabled} onCheckedChange={setGalleryEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Gallery images</CardTitle>
              <CardDescription>Add images by URL or upload. Add a caption to describe each image.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {galleryItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No images yet. Add your first image below.</p>
                </div>
              )}

              {galleryItems.map((item, idx) => (
                <div key={item.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Image {idx + 1}</span>
                    </div>
                    <Button variant="ghost" size="sm"
                      onClick={() => setGalleryItems(prev => prev.filter(i => i.id !== item.id))}
                      className="text-destructive hover:text-destructive h-7 w-7 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {item.url && (
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                      <img src={item.url} alt={item.alt || item.caption || 'Gallery image'}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Image URL</Label>
                    <div className="flex gap-2">
                      <Input value={item.url}
                        onChange={e => setGalleryItems(prev => prev.map(i => i.id === item.id ? { ...i, url: e.target.value } : i))}
                        placeholder="https://example.com/image.jpg"
                        className="bg-background border-border text-sm font-mono" />
                      <Button type="button" variant="outline" size="sm"
                        className="border-border flex-shrink-0 gap-1 text-xs"
                        onClick={() => fileRefs.current[item.id]?.click()}
                        disabled={uploading === item.id}>
                        {uploading === item.id
                          ? <div className="w-3 h-3 border border-foreground/30 border-t-foreground rounded-full animate-spin" />
                          : <Upload className="w-3 h-3" />}
                        Upload
                      </Button>
                      <input ref={el => { fileRefs.current[item.id] = el; }}
                        type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(item.id, f); }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Caption <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input value={item.caption}
                        onChange={e => setGalleryItems(prev => prev.map(i => i.id === item.id ? { ...i, caption: e.target.value } : i))}
                        placeholder="Describe this image" maxLength={120} className="bg-background border-border text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Alt text <span className="text-muted-foreground font-normal">(accessibility)</span></Label>
                      <Input value={item.alt}
                        onChange={e => setGalleryItems(prev => prev.map(i => i.id === item.id ? { ...i, alt: e.target.value } : i))}
                        placeholder="Brief description for screen readers" maxLength={120} className="bg-background border-border text-sm" />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline"
                onClick={() => setGalleryItems(prev => [...prev, { id: Date.now().toString(), url: '', caption: '', alt: '' }])}
                className="w-full border-dashed border-border gap-2 text-sm">
                <Plus className="w-4 h-4" /> Add image
              </Button>
            </CardContent>
          </Card>

          <SaveBtn saving={saving} saved={saved}
            onClick={() => doSave({ gallery: JSON.stringify(galleryItems.filter(i => i.url.trim())), gallery_enabled: galleryEnabled ? 1 : 0 })} />
        </div>
      )}

      {/* ── Menu / Price List ─────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isBusiness ? 'Show menu / price list on business profile' : 'Show price list on profile'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBusiness
                      ? 'Display your menu, price list, or service catalogue on your business profile.'
                      : 'Display your rate card or service list on your public profile card.'}
                  </p>
                </div>
                <Switch checked={menuEnabled} onCheckedChange={setMenuEnabled} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="menu-title">Section title</Label>
                <Input id="menu-title" value={menuTitle} onChange={e => setMenuTitle(e.target.value)}
                  placeholder={isBusiness ? 'e.g. Our Menu, Price List, Services' : 'e.g. My Services, Rate Card'}
                  maxLength={60} className="bg-background border-border text-sm" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>
                {isBusiness
                  ? 'Add menu items, services, or products with optional categories, descriptions, and prices.'
                  : 'Add services or packages with optional categories, descriptions, and rates.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {menuItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <List className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No items yet. Add your first item below.</p>
                </div>
              )}

              {menuItems.map((item, idx) => (
                <div key={item.id} className="border border-border rounded-lg overflow-hidden bg-muted/10">
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setMenuCollapsed(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground flex-shrink-0">#{idx + 1}</span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.name || <span className="text-muted-foreground italic">Untitled item</span>}
                      </span>
                      {item.price && <span className="text-xs text-primary flex-shrink-0">{item.price}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm"
                        onClick={e => { e.stopPropagation(); setMenuItems(prev => prev.filter(i => i.id !== item.id)); }}
                        className="text-destructive hover:text-destructive h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {menuCollapsed[item.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {!menuCollapsed[item.id] && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border">
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Item name <span className="text-destructive">*</span></Label>
                          <Input value={item.name}
                            onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                            placeholder={isBusiness ? 'e.g. Flat White' : 'e.g. Logo Design'}
                            maxLength={80} className="bg-background border-border text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Price <span className="text-muted-foreground font-normal">(optional)</span></Label>
                          <Input value={item.price}
                            onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, price: e.target.value } : i))}
                            placeholder="e.g. £3.50 or From £50"
                            maxLength={30} className="bg-background border-border text-sm" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input value={item.category}
                          onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, category: e.target.value } : i))}
                          placeholder={isBusiness ? 'e.g. Hot Drinks, Starters' : 'e.g. Design, Development'}
                          maxLength={60} className="bg-background border-border text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Textarea value={item.description}
                          onChange={e => setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                          placeholder="Brief description of this item"
                          maxLength={200} rows={2} className="bg-background border-border text-sm resize-none" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline"
                onClick={() => setMenuItems(prev => [...prev, { id: Date.now().toString(), category: '', name: '', description: '', price: '' }])}
                className="w-full border-dashed border-border gap-2 text-sm">
                <Plus className="w-4 h-4" /> Add item
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          {menuItems.some(i => i.name) && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-base font-semibold text-foreground">{menuTitle || (isBusiness ? 'Menu' : 'Services')}</p>
                {menuCategories.map(cat => (
                  <div key={cat}>
                    {cat !== 'Uncategorised' && <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{cat}</p>}
                    <div className="space-y-2">
                      {menuItems.filter(i => (i.category || 'Uncategorised') === cat && i.name).map(item => (
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

          <SaveBtn saving={saving} saved={saved}
            onClick={() => doSave({ menu_items: JSON.stringify(menuItems.filter(i => i.name.trim())), menu_enabled: menuEnabled ? 1 : 0, menu_title: menuTitle.trim() || (isBusiness ? 'Menu' : 'Services') })} />
        </div>
      )}

      {/* ── PDF Attachments ───────────────────────────────────────────────── */}
      {activeTab === 'pdf' && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isBusiness ? 'Show PDF attachments on business profile' : 'Show PDF attachments on profile'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBusiness
                      ? 'Display download links for brochures, menus, or price lists on your business profile.'
                      : 'Display download links for your PDFs on your public profile card.'}
                  </p>
                </div>
                <Switch checked={pdfEnabled} onCheckedChange={setPdfEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">PDF documents</CardTitle>
              <CardDescription>
                {isBusiness
                  ? 'Add links to your business PDFs — brochures, menus, price lists, or any document.'
                  : 'Add links to your PDF files — CV, portfolio, or any document you want visitors to download.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pdfItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No PDFs yet. Add your first document below.</p>
                </div>
              )}

              {pdfItems.map((item, idx) => (
                <div key={item.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Document {idx + 1}</span>
                    <Button variant="ghost" size="sm"
                      onClick={() => setPdfItems(prev => prev.filter(i => i.id !== item.id))}
                      className="text-destructive hover:text-destructive h-7 w-7 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Label <span className="text-destructive">*</span></Label>
                    <Input value={item.label}
                      onChange={e => setPdfItems(prev => prev.map(i => i.id === item.id ? { ...i, label: e.target.value } : i))}
                      placeholder={isBusiness ? 'e.g. Company Brochure, Price List 2026' : 'e.g. My CV, Portfolio'}
                      maxLength={80} className="bg-background border-border text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">PDF URL <span className="text-destructive">*</span></Label>
                    <div className="flex gap-2">
                      <Input value={item.url}
                        onChange={e => setPdfItems(prev => prev.map(i => i.id === item.id ? { ...i, url: e.target.value } : i))}
                        placeholder="https://drive.google.com/file/d/..."
                        className="bg-background border-border text-sm font-mono" />
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="outline" size="sm" className="border-border flex-shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use a shareable link from Google Drive or Dropbox. Make sure the file is set to public access.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input value={item.description}
                      onChange={e => setPdfItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                      placeholder="Brief description of this document"
                      maxLength={120} className="bg-background border-border text-sm" />
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline"
                onClick={() => setPdfItems(prev => [...prev, { id: Date.now().toString(), label: '', url: '', description: '' }])}
                className="w-full border-dashed border-border gap-2 text-sm">
                <Plus className="w-4 h-4" /> Add PDF
              </Button>
            </CardContent>
          </Card>

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

          <SaveBtn saving={saving} saved={saved}
            disabled={pdfItems.every(i => !i.url || !i.label)}
            onClick={() => doSave({ pdf_attachments: JSON.stringify(pdfItems.filter(i => i.url.trim() && i.label.trim())), pdf_enabled: pdfEnabled ? 1 : 0 })} />
        </div>
      )}
    </div>
  );
}
