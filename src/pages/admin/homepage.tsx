/**
 * Admin — Homepage Content Editor
 * /admin/homepage
 *
 * Edit the live homepage hero text, CTA buttons, stats,
 * and optional announcement banner. Changes are stored in
 * admin_settings and served via /api/homepage-content.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Home, Save, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff, RotateCcw, Megaphone, BarChart3,
  Type, MousePointer2, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HomepageContent {
  hero_badge: string;
  hero_title_line1: string;
  hero_title_highlight: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  stats_users: string;
  stats_profiles: string;
  stats_countries: string;
  stats_uptime: string;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link: string;
  announcement_link_label: string;
}

const DEFAULTS: HomepageContent = {
  hero_badge:              'Personal & Business Digital Profiles',
  hero_title_line1:        'Your professional profile,',
  hero_title_highlight:    'ready to share anywhere',
  hero_subtitle:           'Profile Centre gives you a personal or business digital profile page with your contact details, links, QR code and everything people need to find and connect with you — all in one place.',
  hero_cta_primary:        'Create Your Profile',
  hero_cta_secondary:      'See how it works',
  stats_users:             '10,000+',
  stats_profiles:          '15,000+',
  stats_countries:         '40+',
  stats_uptime:            '99.9%',
  announcement_enabled:    false,
  announcement_text:       '',
  announcement_link:       '',
  announcement_link_label: 'Learn more',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
      {children}
    </div>
  );
}

// ── Preview panel ─────────────────────────────────────────────────────────────

function HeroPreview({ c }: { c: HomepageContent }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">japrofilestudio.jagroupservices.co.uk</span>
      </div>
      <div className="p-6 space-y-4">
        {c.announcement_enabled && c.announcement_text && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{c.announcement_text}</span>
            {c.announcement_link_label && (
              <span className="underline font-medium">{c.announcement_link_label}</span>
            )}
          </div>
        )}
        <div>
          <span className="inline-block text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 mb-3">
            {c.hero_badge || 'Badge text'}
          </span>
          <h1 className="text-xl font-extrabold text-foreground leading-tight mb-2">
            {c.hero_title_line1 || 'Title line 1'}{' '}
            <span className="text-primary">{c.hero_title_highlight || 'highlighted text'}</span>
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-sm">
            {c.hero_subtitle || 'Subtitle text…'}
          </p>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
              {c.hero_cta_primary || 'Primary CTA'}
            </span>
            <span className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground">
              {c.hero_cta_secondary || 'Secondary CTA'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
          {[
            { label: 'Users', value: c.stats_users },
            { label: 'Profiles', value: c.stats_profiles },
            { label: 'Countries', value: c.stats_countries },
            { label: 'Uptime', value: c.stats_uptime },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminHomepage() {
  const [content, setContent] = useState<HomepageContent>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showPreview, setShowPreview] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch('/api/admin/homepage-content', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setContent(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof HomepageContent, value: string | boolean) => {
    setContent(c => ({ ...c, [field]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaveStatus('saving');
    try {
      const r = await fetch('/api/admin/homepage-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(content),
      });
      const d = await r.json();
      if (d.success) {
        setSaveStatus('saved');
        setDirty(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const reset = () => {
    setContent(DEFAULTS);
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-muted/30 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Homepage Content — Admin Portal</title>
        <meta name="description" content="Edit homepage hero text, CTAs, stats and announcement banner." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/homepage" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Home className="w-6 h-6 text-primary" /> Homepage Content
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Edit the live homepage hero text, call-to-action buttons, stats, and announcement banner.
            Changes take effect immediately on save.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dirty && (
            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(p => !p)}
            className="gap-1.5 border-border"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="gap-1.5 border-border text-muted-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saveStatus === 'saving' || !dirty}
            className="gap-1.5"
          >
            {saveStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             saveStatus === 'saved'  ? <CheckCircle2 className="w-3.5 h-3.5" /> :
             saveStatus === 'error'  ? <AlertCircle className="w-3.5 h-3.5" /> :
             <Save className="w-3.5 h-3.5" />}
            {saveStatus === 'saving' ? 'Saving…' :
             saveStatus === 'saved'  ? 'Saved!' :
             saveStatus === 'error'  ? 'Error — retry' :
             'Save changes'}
          </Button>
        </div>
      </div>

      <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

        {/* ── Editor ── */}
        <div className="space-y-6">
          <Tabs defaultValue="hero">
            <TabsList className="bg-muted border border-border mb-6">
              <TabsTrigger value="hero" className="gap-1.5 data-[state=active]:bg-background">
                <Type className="w-3.5 h-3.5" /> Hero
              </TabsTrigger>
              <TabsTrigger value="cta" className="gap-1.5 data-[state=active]:bg-background">
                <MousePointer2 className="w-3.5 h-3.5" /> CTAs
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5 data-[state=active]:bg-background">
                <BarChart3 className="w-3.5 h-3.5" /> Stats
              </TabsTrigger>
              <TabsTrigger value="announcement" className="gap-1.5 data-[state=active]:bg-background">
                <Megaphone className="w-3.5 h-3.5" /> Banner
              </TabsTrigger>
            </TabsList>

            {/* Hero tab */}
            <TabsContent value="hero">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Type className="w-4 h-4 text-primary" /> Hero Section
                  </CardTitle>
                  <CardDescription>The main headline, badge, and subtitle visible above the fold.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Field label="Badge / eyebrow text" hint="Small label above the headline (e.g. 'Personal & Business Digital Profiles')">
                    <Input
                      value={content.hero_badge}
                      onChange={e => update('hero_badge', e.target.value)}
                      maxLength={200}
                      className="bg-background border-border"
                      placeholder="Personal & Business Digital Profiles"
                    />
                  </Field>
                  <Separator className="bg-border" />
                  <Field label="Headline — first line" hint="The plain text part of the headline">
                    <Input
                      value={content.hero_title_line1}
                      onChange={e => update('hero_title_line1', e.target.value)}
                      maxLength={200}
                      className="bg-background border-border"
                      placeholder="Your professional profile,"
                    />
                  </Field>
                  <Field label="Headline — highlighted text" hint="The gradient-coloured part of the headline (shown in blue)">
                    <Input
                      value={content.hero_title_highlight}
                      onChange={e => update('hero_title_highlight', e.target.value)}
                      maxLength={200}
                      className="bg-background border-border"
                      placeholder="ready to share anywhere"
                    />
                  </Field>
                  <Separator className="bg-border" />
                  <Field label="Subtitle / description" hint="The paragraph below the headline (max 1000 characters)">
                    <Textarea
                      value={content.hero_subtitle}
                      onChange={e => update('hero_subtitle', e.target.value)}
                      maxLength={1000}
                      rows={4}
                      className="bg-background border-border resize-none text-sm"
                      placeholder="Profile Centre gives you a personal or business digital profile page…"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{content.hero_subtitle.length}/1000</p>
                  </Field>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CTAs tab */}
            <TabsContent value="cta">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MousePointer2 className="w-4 h-4 text-primary" /> Call-to-Action Buttons
                  </CardTitle>
                  <CardDescription>The two buttons in the hero section. Links are fixed (/login and #how-it-works).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Field label="Primary CTA button label" hint="The main blue button (links to /login)">
                    <Input
                      value={content.hero_cta_primary}
                      onChange={e => update('hero_cta_primary', e.target.value)}
                      maxLength={100}
                      className="bg-background border-border"
                      placeholder="Create Your Profile"
                    />
                  </Field>
                  <Field label="Secondary CTA button label" hint="The outline button (scrolls to #how-it-works)">
                    <Input
                      value={content.hero_cta_secondary}
                      onChange={e => update('hero_cta_secondary', e.target.value)}
                      maxLength={100}
                      className="bg-background border-border"
                      placeholder="See how it works"
                    />
                  </Field>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-600">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Button destinations are fixed in code. To change where they link, update the homepage source file.</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stats tab */}
            <TabsContent value="stats">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Social Proof Stats
                  </CardTitle>
                  <CardDescription>The four headline numbers shown below the hero (users, profiles, countries, uptime).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Users stat" hint="e.g. '10,000+' or '12k+'">
                      <Input
                        value={content.stats_users}
                        onChange={e => update('stats_users', e.target.value)}
                        maxLength={50}
                        className="bg-background border-border"
                        placeholder="10,000+"
                      />
                    </Field>
                    <Field label="Profiles stat" hint="e.g. '15,000+'">
                      <Input
                        value={content.stats_profiles}
                        onChange={e => update('stats_profiles', e.target.value)}
                        maxLength={50}
                        className="bg-background border-border"
                        placeholder="15,000+"
                      />
                    </Field>
                    <Field label="Countries stat" hint="e.g. '40+'">
                      <Input
                        value={content.stats_countries}
                        onChange={e => update('stats_countries', e.target.value)}
                        maxLength={50}
                        className="bg-background border-border"
                        placeholder="40+"
                      />
                    </Field>
                    <Field label="Uptime stat" hint="e.g. '99.9%'">
                      <Input
                        value={content.stats_uptime}
                        onChange={e => update('stats_uptime', e.target.value)}
                        maxLength={50}
                        className="bg-background border-border"
                        placeholder="99.9%"
                      />
                    </Field>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Announcement tab */}
            <TabsContent value="announcement">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" /> Announcement Banner
                  </CardTitle>
                  <CardDescription>Optional banner shown at the top of the homepage. Useful for launches, maintenance notices, or promotions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => update('announcement_enabled', !content.announcement_enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${content.announcement_enabled ? 'bg-primary' : 'bg-muted'}`}
                      role="switch"
                      aria-checked={content.announcement_enabled}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${content.announcement_enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-medium ${content.announcement_enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {content.announcement_enabled ? 'Banner enabled — visible on homepage' : 'Banner disabled — not shown'}
                    </span>
                  </div>

                  {content.announcement_enabled && (
                    <>
                      <Separator className="bg-border" />
                      <Field label="Announcement text" hint="The message shown in the banner (max 500 characters)">
                        <Textarea
                          value={content.announcement_text}
                          onChange={e => update('announcement_text', e.target.value)}
                          maxLength={500}
                          rows={3}
                          className="bg-background border-border resize-none text-sm"
                          placeholder="We're launching new features this week — check out what's new!"
                        />
                        <p className="text-[10px] text-muted-foreground text-right">{content.announcement_text.length}/500</p>
                      </Field>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Link URL (optional)" hint="Where the link label points to">
                          <Input
                            value={content.announcement_link}
                            onChange={e => update('announcement_link', e.target.value)}
                            maxLength={500}
                            className="bg-background border-border"
                            placeholder="https://… or /page"
                          />
                        </Field>
                        <Field label="Link label" hint="Text for the clickable link">
                          <Input
                            value={content.announcement_link_label}
                            onChange={e => update('announcement_link_label', e.target.value)}
                            maxLength={100}
                            className="bg-background border-border"
                            placeholder="Learn more"
                          />
                        </Field>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Live preview ── */}
        {showPreview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Live preview</span>
              <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">Updates as you type</Badge>
            </div>
            <HeroPreview c={content} />
            <p className="text-[11px] text-muted-foreground text-center">
              Preview shows the hero section only. Full homepage layout is unchanged.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
