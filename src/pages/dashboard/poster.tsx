/**
 * Dashboard — Profile Poster PDF
 *
 * Generates an A4 profile poster (portrait or landscape) as a PDF
 * that opens inline in the browser. Save from the browser's PDF viewer.
 * Wordmark removed automatically on Professional, Business, and Lifetime plans.
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  FileText, ExternalLink, Lock,
  Info, CheckCircle, Sparkles, Download,
  LayoutTemplate, AlignJustify, Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: number;
  display_name: string;
  username: string;
  biz_slug: string;
  business_name: string;
  is_published: number;
  profile_type: 'personal' | 'business';
}

// ── Template definitions ───────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: '1',
    name: 'Classic Professional',
    description: 'White background, navy header, gold accent. Clean corporate look.',
    tag: 'Corporate',
    portraitPreview: { bg: '#f8fafc', header: '#1e3a5f', accent: '#c9a84c', text: '#1e3a5f' },
    landscapePreview: { bg: '#f8fafc', panel: '#1e3a5f', accent: '#c9a84c', text: '#1e3a5f' },
  },
  {
    id: '2',
    name: 'Bold Dark',
    description: 'Dark background, blue accents, white text. Modern and striking.',
    tag: 'Modern',
    portraitPreview: { bg: '#0f172a', header: '#0f172a', accent: '#3b82f6', text: '#ffffff' },
    landscapePreview: { bg: '#0f172a', panel: '#0f172a', accent: '#3b82f6', text: '#ffffff' },
  },
  {
    id: '3',
    name: 'Minimal Clean',
    description: 'White background, thin rules, monochrome typography. Understated elegance.',
    tag: 'Minimal',
    portraitPreview: { bg: '#ffffff', header: '#ffffff', accent: '#000000', text: '#000000' },
    landscapePreview: { bg: '#ffffff', panel: '#f9fafb', accent: '#000000', text: '#000000' },
  },
  {
    id: '4',
    name: 'JA Branded',
    description: 'JA Profile Studio brand colours — blue header, white body.',
    tag: 'Branded',
    portraitPreview: { bg: '#ffffff', header: '#2563eb', accent: '#60a5fa', text: '#1e293b' },
    landscapePreview: { bg: '#ffffff', panel: '#2563eb', accent: '#60a5fa', text: '#1e293b' },
  },
];

// ── Mini poster previews ───────────────────────────────────────────────────────

function PortraitMini({ tmpl, selected }: { tmpl: typeof TEMPLATES[0]; selected: boolean }) {
  const p = tmpl.portraitPreview;
  return (
    <div
      className={`relative rounded-lg overflow-hidden shadow-sm transition-all flex-shrink-0 ${selected ? 'ring-2 ring-primary' : 'ring-1 ring-border'}`}
      style={{ width: 64, height: 90, background: p.bg }}
    >
      <div style={{ background: p.header, height: 24, width: '100%' }} />
      <div style={{ background: p.accent, height: 2, width: '100%' }} />
      <div className="px-1.5 pt-1.5 space-y-1">
        <div style={{ background: p.text, height: 4, width: '80%', borderRadius: 2, opacity: 0.7 }} />
        <div style={{ background: p.accent, height: 3, width: '55%', borderRadius: 2, opacity: 0.6 }} />
        <div style={{ background: p.text, height: 2, width: '40%', borderRadius: 2, opacity: 0.3 }} />
      </div>
      <div className="px-1.5 pt-1.5 space-y-1">
        {[80, 70, 60, 50].map((w, i) => (
          <div key={i} style={{ background: p.text, height: 1.5, width: `${w}%`, borderRadius: 1, opacity: 0.15 }} />
        ))}
      </div>
      <div className="absolute bottom-1.5 right-1.5" style={{ width: 14, height: 14, background: p.accent, opacity: 0.3, borderRadius: 2 }} />
    </div>
  );
}

function LandscapeMini({ tmpl, selected }: { tmpl: typeof TEMPLATES[0]; selected: boolean }) {
  const p = tmpl.landscapePreview;
  return (
    <div
      className={`relative rounded-lg overflow-hidden shadow-sm transition-all flex-shrink-0 ${selected ? 'ring-2 ring-primary' : 'ring-1 ring-border'}`}
      style={{ width: 90, height: 64, background: p.bg }}
    >
      <div style={{ background: p.panel, width: 24, height: '100%', position: 'absolute', left: 0, top: 0 }} />
      <div style={{ background: p.accent, width: 2, height: '100%', position: 'absolute', left: 24, top: 0 }} />
      <div className="absolute" style={{ left: 3, top: 7 }}>
        <div style={{ background: '#ffffff', height: 3, width: 16, borderRadius: 1, opacity: 0.7 }} />
        <div style={{ background: p.accent, height: 2, width: 12, borderRadius: 1, opacity: 0.6, marginTop: 2 }} />
      </div>
      <div className="absolute" style={{ left: 3, bottom: 5, width: 12, height: 12, background: '#ffffff', opacity: 0.25, borderRadius: 2 }} />
      <div className="absolute" style={{ left: 30, top: 8, right: 4 }}>
        {[90, 75, 60, 50].map((w, i) => (
          <div key={i} style={{ background: p.text, height: 1.5, width: `${w}%`, borderRadius: 1, opacity: 0.2, marginBottom: 2.5 }} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PosterPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('1');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [loading, setLoading] = useState(true);

  const hasAccess = !!(
    user?.hasBusinessAccess ||
    user?.hasStarterAccess ||
    user?.hasLifetimeAccess ||
    user?.trialActive ||
    (user as { hasProfessionalAccess?: boolean })?.hasProfessionalAccess
  );

  const removeBranding = !!(
    user?.hasBusinessAccess ||
    user?.hasLifetimeAccess ||
    (user as { hasProfessionalAccess?: boolean })?.hasProfessionalAccess
  );

  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(profilesData => {
        const pubs = (profilesData?.data || profilesData?.profiles || []).filter((p: Profile) => p.is_published);
        setProfiles(pubs);
        if (pubs.length > 0) setSelectedProfile(pubs[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const posterUrl = selectedProfile
    ? `/api/profiles/${selectedProfile.id}/poster-pdf?template=${selectedTemplate}&orient=${orient}`
    : null;

  function profileLabel(p: Profile): string {
    if (p.profile_type === 'business') return p.business_name || p.display_name || p.biz_slug || `Business #${p.id}`;
    return p.display_name || p.username || `Profile #${p.id}`;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Helmet>
          <title>Profile Poster — JA Profile Studio</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Profile Poster
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Generate an A4 PDF poster of your profile to share digitally.</p>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="py-16 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Profile Poster requires a paid plan</h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Upgrade to Starter or higher to generate A4 PDF posters of your profile in 4 design templates, portrait and landscape.
              </p>
            </div>
            <Link to="/dashboard/billing">
              <Button className="bg-primary hover:bg-primary/90 mt-2">View Plans &amp; Upgrade</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-20 lg:pb-6">
      <Helmet>
        <title>Profile Poster — JA Profile Studio</title>
        <meta name="description" content="Generate an A4 profile poster PDF to share or display." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/poster" />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Profile Poster
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate an A4 PDF poster of your profile. Opens in your browser — save from there.
          </p>
        </div>
        {posterUrl && profiles.length > 0 && (
          <a href={posterUrl} target="_blank" rel="noopener noreferrer">
            <Button className="bg-primary gap-2">
              <Download className="w-4 h-4" /> Generate &amp; Open PDF
            </Button>
          </a>
        )}
      </div>

      {/* Alerts */}
      {profiles.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-sm text-amber-700 dark:text-amber-400">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">No published profile found</p>
            <p className="text-xs mt-1">You need at least one published profile to generate a poster. Go to your profile and set it to published.</p>
          </div>
        </div>
      )}

      {!removeBranding && (
        <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-3 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            <span className="font-medium text-foreground">Wordmark included</span> — your poster will include a small "Created with JA Profile Studio" footer.
            Upgrade to Professional, Business, or Lifetime to remove it.
          </span>
        </div>
      )}
      {removeBranding && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-xs text-green-700 dark:text-green-400">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span><span className="font-medium">Wordmark removed</span> — your poster will not include any JA Profile Studio branding.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — controls */}
        <div className="lg:col-span-2 space-y-5">

          {/* Profile selector */}
          {profiles.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlignJustify className="w-4 h-4 text-muted-foreground" /> Profile
                </CardTitle>
                <CardDescription className="text-xs">Choose which profile to generate a poster for.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {profiles.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProfile(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5 ${
                        selectedProfile?.id === p.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {profileLabel(p)}
                      <Badge className={`text-[10px] px-1.5 py-0 ${p.profile_type === 'business' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-green-500/15 text-green-400 border-green-500/20'}`}>
                        {p.profile_type === 'business' ? 'Business' : 'Personal'}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orientation */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-muted-foreground" /> Orientation
              </CardTitle>
              <CardDescription className="text-xs">Portrait is taller (like a flyer). Landscape is wider (like a banner or display board).</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                {(['portrait', 'landscape'] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => setOrient(o)}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all ${
                      orient === o ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div
                      className={`rounded border-2 opacity-60 ${orient === o ? 'border-primary' : 'border-muted-foreground'}`}
                      style={o === 'portrait' ? { width: 32, height: 44 } : { width: 44, height: 32 }}
                    />
                    <div className="text-center">
                      <p className="text-sm font-semibold capitalize">{o}</p>
                      <p className="text-xs text-muted-foreground">{o === 'portrait' ? 'A4 tall · 210 × 297mm' : 'A4 wide · 297 × 210mm'}</p>
                    </div>
                    {orient === o && <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">Selected</Badge>}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Template picker */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-muted-foreground" /> Design Template
              </CardTitle>
              <CardDescription className="text-xs">All templates include your name, title, bio, skills, contact details, and a QR code.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATES.map(tmpl => (
                  <motion.button
                    key={tmpl.id}
                    whileHover={{ y: -1 }}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all flex gap-3 items-start ${
                      selectedTemplate === tmpl.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {orient === 'portrait'
                      ? <PortraitMini tmpl={tmpl} selected={selectedTemplate === tmpl.id} />
                      : <LandscapeMini tmpl={tmpl} selected={selectedTemplate === tmpl.id} />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-sm">{tmpl.name}</span>
                        <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border">{tmpl.tag}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.description}</p>
                      {selectedTemplate === tmpl.id && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-primary font-medium">
                          <CheckCircle className="w-3 h-3" /> Selected
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — generate panel */}
        <div className="space-y-4">
          <Card className="bg-card border-border lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Generate Poster
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">

              {/* Summary */}
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Profile', value: selectedProfile ? profileLabel(selectedProfile) : '—' },
                  { label: 'Template', value: TEMPLATES.find(t => t.id === selectedTemplate)?.name ?? '—' },
                  { label: 'Orientation', value: orient.charAt(0).toUpperCase() + orient.slice(1) },
                  { label: 'Size', value: orient === 'portrait' ? 'A4 · 210 × 297mm' : 'A4 · 297 × 210mm' },
                  { label: 'Wordmark', value: removeBranding ? 'Removed' : 'Included', highlight: removeBranding ? 'green' : 'amber' },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium truncate max-w-[140px] ${
                      highlight === 'green' ? 'text-green-600 dark:text-green-400' :
                      highlight === 'amber' ? 'text-amber-600 dark:text-amber-400' :
                      'text-foreground'
                    }`}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              {posterUrl && profiles.length > 0 ? (
                <a href={posterUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
                    <ExternalLink className="w-4 h-4" /> Open Poster PDF
                  </Button>
                </a>
              ) : (
                <Button className="w-full gap-2" disabled>
                  <FileText className="w-4 h-4" />
                  {profiles.length === 0 ? 'No published profile' : 'Select a profile'}
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Opens in a new tab. Use <strong>Ctrl+S</strong> / <strong>Cmd+S</strong> or your browser's Save button to download.
              </p>

              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">What's included</p>
                <ul className="space-y-1">
                  {[
                    'Name, title & company',
                    'Bio / about text',
                    'Skills (up to 12)',
                    'Email, phone & website',
                    'QR code linking to your profile',
                    'A4 size — portrait or landscape',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-blue-700 dark:text-blue-400">
                <p className="font-medium mb-1">Digital sharing only</p>
                <p>This poster is designed for digital sharing — email attachments, websites, presentations. It is not optimised for physical printing.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


