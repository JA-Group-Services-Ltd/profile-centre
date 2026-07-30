import { useState, useEffect, useMemo } from 'react';
import { Check, Lock, Search, Sparkles, ChevronDown, Info } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface Theme {
  id: number; name: string; slug: string; description: string;
  primary_color: string; accent_color: string; background_color: string; text_color: string;
  is_free: number; category: string; font_heading: string; font_body: string;
  card_style: string; gradient: string | null; border_radius: string;
  button_style: string; layout: string; sort_order: number;
}

interface Profile { id: number; theme_id: number; display_name: string; profile_type: string; biz_slug: string | null; person_slug: string | null; }

interface AllowedThemesData {
  allowed_ids: number[];
  has_custom_themes: boolean;
  max_themes: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Themes',
  minimal: 'Minimal',
  dark: 'Dark',
  gradient: 'Gradient',
  professional: 'Professional',
  creative: 'Creative',
  nature: 'Nature',
  luxury: 'Luxury',
  tech: 'Tech / Startup',
  retro: 'Retro / Vintage',
  pastel: 'Pastel',
  bold: 'Bold',
  monochrome: 'Monochrome',
  seasonal: 'Seasonal',
  industry: 'Industry',
  cultural: 'Cultural',
  social: 'Social Media',
  glass: 'Glass / Frosted',
  neon: 'Neon',
  earth: 'Earth Tones',
  watercolour: 'Watercolour',
  typography: 'Typography',
};

function ThemePreview({ theme }: { theme: Theme }) {
  const bg = theme.gradient
    ? theme.gradient
    : theme.background_color;
  const isGradient = !!theme.gradient;

  // Derive avatar shape from card_style
  const avatarRadius = theme.card_style === 'flat' ? '4px' : theme.card_style === 'rounded' ? '50%' : '50%';
  // Derive button radius from border_radius
  const btnRadius = theme.border_radius === '0px' ? '0' : theme.border_radius === '20px' ? '9999px' : theme.border_radius || '6px';

  return (
    <div
      className="h-32 relative overflow-hidden"
      style={{ background: bg }}
    >
      {/* Simulated card layout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 border-2 flex-shrink-0"
          style={{
            backgroundColor: theme.primary_color,
            borderColor: theme.accent_color,
            borderRadius: avatarRadius,
          }}
        />
        {/* Name bar */}
        <div
          className="h-2 rounded-full"
          style={{
            width: '60%',
            backgroundColor: theme.text_color,
            opacity: 0.85,
          }}
        />
        {/* Title bar */}
        <div
          className="h-1.5 rounded-full"
          style={{
            width: '45%',
            backgroundColor: theme.text_color,
            opacity: 0.45,
          }}
        />
        {/* Button */}
        <div
          className="h-5 flex items-center justify-center mt-0.5"
          style={{
            width: '55%',
            borderRadius: btnRadius,
            backgroundColor: theme.button_style === 'outline' ? 'transparent' : theme.primary_color,
            border: theme.button_style === 'outline' ? `1.5px solid ${theme.primary_color}` : 'none',
          }}
        >
          <div
            className="h-1 rounded-full"
            style={{
              width: '40%',
              backgroundColor: theme.button_style === 'outline' ? theme.primary_color : theme.background_color,
              opacity: 0.9,
            }}
          />
        </div>
        {/* Link pills */}
        <div className="flex gap-1 mt-0.5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-1.5 rounded-full"
              style={{
                width: `${14 + i * 4}px`,
                backgroundColor: theme.accent_color,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
      {/* Gradient overlay for gradient themes */}
      {isGradient && (
        <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(to bottom, transparent, ${theme.background_color})` }} />
      )}
    </div>
  );
}

export default function ThemesPage() {
  const { user } = useAuth();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowedData, setAllowedData] = useState<AllowedThemesData | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showCount, setShowCount] = useState(30);

  useEffect(() => {
    async function load() {
      const [themesRes, profilesRes, allowedRes] = await Promise.all([
        fetch('/api/themes'),
        fetch('/api/profiles/me', { credentials: 'include' }),
        fetch('/api/themes/allowed', { credentials: 'include' }),
      ]);
      const [themesData, profilesData, allowedJson] = await Promise.all([
        themesRes.json(), profilesRes.json(), allowedRes.json(),
      ]);
      if (themesData.success) setThemes(themesData.data);
      if (profilesData.success && profilesData.data.length > 0) {
        const allProfiles: Profile[] = profilesData.data;
        setProfiles(allProfiles);
        const first = allProfiles[0];
        setProfile(first);
        setSelectedTheme(first.theme_id || 1);
      }
      if (allowedJson.success) setAllowedData(allowedJson.data);
      setLoading(false);
    }
    load();
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(themes.map(t => t.category || 'minimal'));
    return ['all', ...Array.from(cats).sort()];
  }, [themes]);

  const filtered = useMemo(() => {
    let list = themes;
    if (category !== 'all') list = list.filter(t => (t.category || 'minimal') === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [themes, category, search]);

  const visible = filtered.slice(0, showCount);

  const applyTheme = async (themeId: number) => {
    if (!profile) return;
    setSaving(true);
    const res = await fetch(`/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ theme_id: themeId }),
    });
    const data = await res.json();
    if (data.success) setSelectedTheme(themeId);
    setSaving(false);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Skeleton className="h-8 w-48 mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
      </div>
    </div>
  );

  const activeTheme = themes.find(t => t.id === selectedTheme);

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Themes — Dashboard</title>
        <meta name="description" content="Choose a theme for your digital business card profile." />
        <link rel="canonical" href="/dashboard/themes" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-foreground">Themes</h1>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            <Sparkles className="w-3 h-3 mr-1" />{themes.length} themes
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">Choose a theme for your digital card</p>
      </div>

      {/* Profile selector (if multiple profiles) */}
      {profiles.length > 1 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Applying theme to:</p>
          <div className="flex flex-wrap gap-2">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => { setProfile(p); setSelectedTheme(p.theme_id || 1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  profile?.id === p.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {p.display_name || (p.profile_type === 'business' ? p.biz_slug : p.person_slug) || `Profile ${p.id}`}
                <span className="ml-1.5 opacity-60 capitalize">{p.profile_type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active theme banner */}
      {activeTheme && (
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0"
            style={{ background: activeTheme.gradient || activeTheme.background_color, border: `2px solid ${activeTheme.primary_color}` }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Active: {activeTheme.name}</p>
            <p className="text-xs text-muted-foreground">{activeTheme.description}</p>
          </div>
          <Badge className="bg-primary text-white border-0 text-xs flex-shrink-0">
            <Check className="w-3 h-3 mr-1" />Applied
          </Badge>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowCount(30); }}
            placeholder="Search themes…"
            className="pl-9 bg-background border-border"
          />
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {categories.slice(0, 12).map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setShowCount(30); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  category === cat
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground mb-4">
        Showing {Math.min(visible.length, filtered.length)} of {filtered.length} themes
        {search && ` matching "${search}"`}
        {category !== 'all' && ` in ${CATEGORY_LABELS[category] || category}`}
      </p>

      {/* Theme grid */}
      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No themes found. Try a different search or category.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map(theme => {
              const isAllowed = allowedData
                ? allowedData.allowed_ids.includes(theme.id)
                : !!theme.is_free; // fallback: allow free themes if API unavailable
              const isLocked = !isAllowed;
              const isActive = selectedTheme === theme.id;
              return (
                <Card
                  key={theme.id}
                  className={`border-2 transition-all cursor-pointer overflow-hidden ${
                    isActive ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-primary/40'
                  } ${isLocked ? 'opacity-70' : ''} bg-card`}
                  onClick={() => !isLocked && !saving && !isActive && applyTheme(theme.id)}
                >
                  <ThemePreview theme={theme} />
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <p className="text-xs font-semibold text-foreground leading-tight truncate">{theme.name}</p>
                      <div className="flex-shrink-0">
                        {isActive && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {isLocked && !isActive && (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight line-clamp-2 mb-2">{theme.description}</p>
                    <div className="flex items-center gap-1 mb-2">
                      {[theme.background_color, theme.primary_color, theme.accent_color, theme.text_color].map((c, i) => (
                        <div key={i} className="w-3.5 h-3.5 rounded-full border border-border/50 flex-shrink-0" style={{ backgroundColor: c }} />
                      ))}
                      <span className="text-xs text-muted-foreground ml-auto capitalize">{theme.category || 'minimal'}</span>
                    </div>
                    {!theme.is_free && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs w-full justify-center mb-1.5">
                        Paid plan
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      className={`w-full text-xs h-7 ${isActive ? 'bg-primary' : ''}`}
                      variant={isActive ? 'default' : 'outline'}
                      disabled={isLocked || saving || isActive}
                      onClick={e => { e.stopPropagation(); !isLocked && applyTheme(theme.id); }}
                    >
                      {isActive ? '✓ Active' : isLocked ? 'Upgrade to unlock' : 'Apply'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Load more */}
          {showCount < filtered.length && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                className="border-border gap-2"
                onClick={() => setShowCount(c => c + 30)}
              >
                <ChevronDown className="w-4 h-4" />
                Load more ({filtered.length - showCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Upgrade prompt */}
      {allowedData && !allowedData.has_custom_themes && (
        <Card className="bg-primary/5 border-primary/20 mt-6">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Unlock all {themes.filter(t => !t.is_free).length} premium themes</p>
              {allowedData.max_themes === 1
                ? <p className="text-xs text-muted-foreground mt-0.5">Your free plan includes only the Default Blue theme. Upgrade to access all gradient, luxury, neon, and industry themes.</p>
                : <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Starter or above to access all premium themes.</p>
              }
            </div>
            <Button size="sm" className="bg-primary flex-shrink-0" onClick={() => window.location.href = '/dashboard/billing'}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Free plan notice */}
      {allowedData?.max_themes === 1 && (
        <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-400">
            <strong>Free plan:</strong> Only the Default Blue theme is available. Upgrade your plan to unlock all {themes.filter(t => !t.is_free).length} premium themes.
          </p>
        </div>
      )}
    </div>
  );
}
