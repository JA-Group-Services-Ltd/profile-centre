import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Phone, Mail, Globe, MapPin, Share2, Download, QrCode, Send,
  Linkedin, Twitter, Instagram, Facebook, Youtube, Github, ArrowRight, X, Zap,
  CheckCircle2, Sun, Moon, KeyRound, Flag, AlertTriangle, BadgeCheck,
  Briefcase, GraduationCap, Award, Star, Languages, Wrench, ExternalLink, Calendar, MapPinned
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranding } from '@/lib/branding';

interface ExpEntry { title: string; org: string; period: string; description: string; }

interface PublicProfile {
  id: number; username: string; display_name: string; job_title: string; company: string;
  bio: string; bio_html: string | null; phone: string; email: string; website: string; address: string;
  profile_photo: string; theme_id: number;
  messaging_enabled: number;
  enquiry_enabled: number;
  public_pin_enabled: boolean;
  is_verified: boolean;
  verified_at: string | null;
  allow_indexing: number;
  seo_title: string | null;
  seo_description: string | null;
  profile_type?: string;
  // Design fields
  personal_type?: string;
  layout_preset?: string;
  colour_palette?: string;
  custom_colour?: string;
  button_style?: string;
  photo_shape?: string;
  // Extended personal fields
  headline?: string | null;
  pronouns?: string | null;
  location_city?: string | null;
  availability?: string | null;
  portfolio_url?: string | null;
  skills?: string[];
  languages?: string[];
  awards?: string[];
  certifications?: string[];
  experience?: ExpEntry[];
  education?: ExpEntry[];
  // New feature sections
  whatsapp_url?: string | null;
  whatsapp_label?: string | null;
  whatsapp_enabled?: number;
  gallery?: string | null;
  gallery_enabled?: number;
  menu_items?: string | null;
  menu_enabled?: number;
  menu_title?: string | null;
  pdf_attachments?: string | null;
  pdf_enabled?: number;
  social_links?: string | null;
  social_links_enabled?: number;
  plan: { has_contact_form: number; has_vcard_download: number; remove_branding: number; has_messaging: number };
  theme: { primary_color: string; accent_color: string; background_color: string; text_color: string };
  links: { id: number; type: string; platform: string | null; label: string; url: string; icon: string | null }[];
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin, twitter: Twitter, instagram: Instagram,
  facebook: Facebook, youtube: Youtube, github: Github,
};

function PlatformIcon({ platform, className }: { platform: string | null; className?: string }) {
  if (platform && PLATFORM_ICONS[platform]) {
    const Icon = PLATFORM_ICONS[platform];
    return <Icon className={className} />;
  }
  return <Globe className={className} />;
}

function generateVCard(profile: PublicProfile): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${profile.display_name || ''}`,
    profile.job_title ? `TITLE:${profile.job_title}` : '',
    profile.company ? `ORG:${profile.company}` : '',
    profile.phone ? `TEL:${profile.phone}` : '',
    profile.email ? `EMAIL:${profile.email}` : '',
    profile.website ? `URL:${profile.website}` : '',
    profile.address ? `ADR:;;${profile.address};;;;` : '',
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\n');
}

export default function PublicProfilePage({ _overrideUsername }: { _overridePrefix?: string; _overrideUsername?: string } = {}) {
  const params = useParams<{ seg1: string; seg2: string }>();
  // New scheme: /profile/:username → seg1 is username
  // Legacy scheme: /:prefix/:username → seg2 is username
  const username = _overrideUsername ?? params.seg2 ?? params.seg1;
  const branding = useBranding();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [themeDark, setThemeDark] = useState(false);


  // Public PIN gate state
  const [pinRequired, setPinRequired] = useState(false);
  const [pinPreview, setPinPreview] = useState<{ display_name: string; profile_photo: string | null } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Enquiry form state
  const [enquiryForm, setEnquiryForm] = useState({ sender_name: '', sender_email: '', message: '' });
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [enquiryError, setEnquiryError] = useState('');

  // Report profile state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ reporter_name: '', reporter_email: '', reason: '', details: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState('');

  const loadProfile = () => {
    if (!username) return;
    setLoading(true);
    fetch(`/api/profiles/${encodeURIComponent(username)}/public`)
      .then(async r => {
        const data = await r.json();
        if (r.status === 403 && data.pin_required) {
          setPinRequired(true);
          setPinPreview({ display_name: data.display_name, profile_photo: data.profile_photo });
          setLoading(false);
          return;
        }
        if (data.success) {
          setProfile(data.data);
          fetch(`/api/analytics/view/${username}`, { method: 'POST' }).catch(() => {});
        } else {
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  };

  useEffect(() => { loadProfile(); }, [username]);

  const submitPin = async () => {
    if (!pinInput.trim()) return;
    setPinSubmitting(true);
    setPinError('');
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(username ?? '')}/public-pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setPinRequired(false);
        setPinInput('');
        loadProfile();
      } else {
        setPinError(data.error || 'Incorrect PIN. Please try again.');
      }
    } catch {
      setPinError('Something went wrong. Please try again.');
    } finally {
      setPinSubmitting(false);
    }
  };

  const recordClick = (linkId: number) => {
    fetch(`/api/links/${linkId}/click`, { method: 'POST' }).catch(() => {});
  };

  const downloadVCard = () => {
    if (!profile) return;
    const vcf = generateVCard(profile);
    const blob = new Blob([vcf], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.display_name || profile.username}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareProfile = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: profile?.display_name || '', url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const loadQR = async () => {
    if (qrDataUrl) { setShowQR(true); return; }
    try {
      const res = await fetch(`/api/qr/public/${encodeURIComponent(username ?? '')}`);
      const data = await res.json();
      if (data.success) {
        setQrDataUrl(data.data.qr_data_url);
      } else {
        // Fallback: generate QR from current URL via qrserver (may be blocked by CSP)
        setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`);
      }
    } catch {
      setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`);
    }
    setShowQR(true);
  };

  const submitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnquiryError('');
    setEnquirySubmitting(true);
    try {
      const res = await fetch(`/api/enquiries/${username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...enquiryForm, _hp: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setEnquirySuccess(true);
      setEnquiryForm({ sender_name: '', sender_email: '', message: '' });
    } catch (err) {
      setEnquiryError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setEnquirySubmitting(false);
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError('');
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(username!)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');
      setReportSuccess(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Public PIN gate ──────────────────────────────────────────────────────────
  if (pinRequired) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Helmet><title>{`Protected Profile — ${branding.platform_name}`}</title></Helmet>
        <div className="w-full max-w-sm text-center">
          {pinPreview?.profile_photo ? (
            <img src={pinPreview.profile_photo} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border-2 border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className="text-xl font-bold text-foreground mb-1">
            {pinPreview?.display_name || 'Protected Profile'}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            This profile is protected. Enter the PIN to view it.
          </p>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Enter PIN</span>
            </div>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && submitPin()}
              placeholder="••••••"
              className="text-center text-xl tracking-widest mb-3 bg-background border-border"
              autoFocus
            />
            {pinError && (
              <p className="text-sm text-destructive mb-3">{pinError}</p>
            )}
            <Button
              onClick={submitPin}
              disabled={pinSubmitting || !pinInput}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {pinSubmitting ? 'Verifying…' : 'Unlock Profile'}
            </Button>
          </div>
          <Link to="/" className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground">
            Back to {branding.platform_name}
          </Link>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <Helmet><title>{`Profile Not Found — ${branding.platform_name}`}</title></Helmet>
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <Globe className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Profile not found</h1>
        <p className="text-muted-foreground mb-6">This profile doesn't exist or has been removed.</p>
        <Link to="/">
          <Button className="bg-primary">Go to {branding.platform_name}</Button>
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const theme = profile.theme || { primary_color: '#3B82F6', accent_color: '#3B82F6', background_color: '#FFFFFF', text_color: '#0F172A' };

  // Visitor theme toggle: flip bg/text for dark mode
  const effectiveBg = themeDark
    ? (theme.background_color === '#FFFFFF' || theme.background_color === '#ffffff' ? '#0F172A' : theme.background_color)
    : theme.background_color;
  const effectiveText = themeDark
    ? (theme.text_color === '#0F172A' || theme.text_color === '#111827' ? '#F1F5F9' : theme.text_color)
    : theme.text_color;
  const socialLinks = profile.links.filter(l => l.type === 'social');
  const customLinks = profile.links.filter(l => l.type !== 'social');

  const themeStyle = {
    '--profile-bg': effectiveBg,
    '--profile-text': effectiveText,
    '--profile-primary': theme.primary_color,
    '--profile-accent': theme.accent_color,
  } as React.CSSProperties;

  const canonicalUrl = `https://japrofilestudio.jagroupservices.co.uk/profile/${profile.username}`;
  const pageTitle = profile.seo_title || `${profile.display_name || profile.username}${profile.job_title ? ` — ${profile.job_title}` : ''}`;
  const pageDesc = profile.seo_description || profile.bio || `${profile.display_name}'s digital business card${profile.company ? ` at ${profile.company}` : ''}. Connect via QR code or direct link.`;
  const ogImage = profile.profile_photo || `${branding.platform_url}/og-default.png`;

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": profile.display_name || profile.username,
    "url": canonicalUrl,
    ...(profile.job_title && { "jobTitle": profile.job_title }),
    ...(profile.company && { "worksFor": { "@type": "Organization", "name": profile.company } }),
    ...(profile.email && { "email": profile.email }),
    ...(profile.phone && { "telephone": profile.phone }),
    ...(profile.website && { "sameAs": [profile.website] }),
    ...(profile.profile_photo && { "image": profile.profile_photo }),
  };

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} — ${branding.platform_name}`}</title>
        <meta name="description" content={pageDesc.slice(0, 160)} />
        <link rel="canonical" href={canonicalUrl} />
        {!profile.allow_indexing
          ? <meta name="robots" content="noindex, nofollow" />
          : <meta name="robots" content="index, follow" />
        }

        {/* Open Graph */}
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${pageTitle} — ${branding.platform_name}`} />
        <meta property="og:description" content={pageDesc.slice(0, 160)} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content={branding.platform_name} />
        {!!profile.display_name && <meta property="profile:username" content={profile.username} />}

        {/* Twitter / X Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${pageTitle} — ${branding.platform_name}`} />
        <meta name="twitter:description" content={pageDesc.slice(0, 160)} />
        <meta name="twitter:image" content={ogImage} />

        {/* JSON-LD: Person */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      </Helmet>

      {/*
        ══════════════════════════════════════════════════════════════════════
        PLATFORM-CONTROLLED WRAPPER
        Everything inside this div is rendered by the platform, not the user.
        The report button, legal footer, and cookie controls sit OUTSIDE the
        user-editable profile card area and cannot be removed, hidden, or
        overridden by custom HTML/CSS.
        ══════════════════════════════════════════════════════════════════════
      */}
      <div
        className="min-h-screen flex flex-col items-center py-8 px-4"
        style={{ backgroundColor: effectiveBg, ...themeStyle }}
        data-platform-profile-wrapper="1"
      >
        <div className="w-full max-w-sm">
          {/* Theme toggle */}
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setThemeDark(v => !v)}
              className="p-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ backgroundColor: theme.primary_color + '15', color: theme.primary_color }}
              title={themeDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {themeDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* ── Modern profile card ──────────────────────────────────── */}
          <div className="rounded-3xl overflow-hidden shadow-2xl mb-4" style={{ backgroundColor: effectiveBg, border: `1px solid ${theme.primary_color}20` }}>

            {/* Cover / header band */}
            <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${theme.primary_color}40 0%, ${theme.primary_color}15 100%)` }}>
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 20% 50%, ${theme.primary_color}60 0%, transparent 60%), radial-gradient(circle at 80% 20%, ${theme.accent_color || theme.primary_color}40 0%, transparent 50%)` }} />
            </div>

            <div className="px-5 pb-5">
              {/* Avatar row */}
              <div className="flex items-end justify-between -mt-10 mb-4">
                <div className="relative">
                  {profile.profile_photo ? (
                    <img
                      src={profile.profile_photo}
                      alt={profile.display_name}
                      className={`w-20 h-20 object-cover border-4 shadow-lg ${
                        profile.photo_shape === 'square' ? 'rounded-none' :
                        profile.photo_shape === 'rounded' ? 'rounded-2xl' : 'rounded-full'
                      }`}
                      style={{ borderColor: effectiveBg }}
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 flex items-center justify-center text-3xl font-bold text-white border-4 shadow-lg ${
                        profile.photo_shape === 'square' ? 'rounded-none' :
                        profile.photo_shape === 'rounded' ? 'rounded-2xl' : 'rounded-full'
                      }`}
                      style={{ backgroundColor: theme.primary_color, borderColor: effectiveBg }}
                    >
                      {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {profile.is_verified && (
                    <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-white rounded-full pl-0.5 pr-1.5 py-0.5 shadow-md border border-blue-100">
                      <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-[9px] font-bold text-blue-600 leading-none">Verified</span>
                    </div>
                  )}
                </div>
                {/* Quick action buttons top-right */}
                <div className="flex gap-1.5 mb-1">
                  <button onClick={loadQR}
                    className="w-9 h-9 rounded-xl flex items-center justify-center border transition-opacity hover:opacity-80"
                    style={{ borderColor: theme.primary_color + '40', color: theme.primary_color, backgroundColor: theme.primary_color + '10' }}
                    title="Show QR code">
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button onClick={shareProfile}
                    className="w-9 h-9 rounded-xl flex items-center justify-center border transition-opacity hover:opacity-80"
                    style={{ borderColor: theme.primary_color + '40', color: theme.primary_color, backgroundColor: theme.primary_color + '10' }}
                    title="Share profile">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Name + headline */}
              <div className="mb-4">
                <h1 className="text-xl font-bold leading-tight" style={{ color: effectiveText }}>{profile.display_name}</h1>
                {profile.headline && (
                  <p className="text-sm font-medium mt-0.5" style={{ color: theme.primary_color }}>{profile.headline}</p>
                )}
                {(profile.job_title || profile.company) && (
                  <p className="text-sm mt-1" style={{ color: effectiveText, opacity: 0.7 }}>
                    {[profile.job_title, profile.company].filter(Boolean).join(' · ')}
                  </p>
                )}
                {/* Meta chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.pronouns && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: theme.primary_color + '15', color: theme.primary_color }}>
                      {profile.pronouns}
                    </span>
                  )}
                  {profile.location_city && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: theme.primary_color + '10', color: effectiveText, opacity: 0.8 }}>
                      <MapPinned style={{ width: '10px', height: '10px' }} />{profile.location_city}
                    </span>
                  )}
                  {profile.availability && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium" style={{ backgroundColor: '#22c55e15', color: '#16a34a' }}>
                      <Calendar style={{ width: '10px', height: '10px' }} />{profile.availability}
                    </span>
                  )}
                </div>
              </div>

              {/* Bio */}
              {(profile.bio || profile.bio_html) && (
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}15` }}>
                  {profile.bio_html ? (
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none" style={{ color: effectiveText, opacity: 0.85 }}
                      dangerouslySetInnerHTML={{ __html: profile.bio_html }} />
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: effectiveText, opacity: 0.85 }}>{profile.bio}</p>
                  )}
                </div>
              )}

              {/* Contact buttons */}
              {(profile.phone || profile.email || profile.website) && (
                <div className="flex gap-2 mb-4">
                  {profile.phone && (
                    <a href={`tel:${profile.phone}`}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
                        profile.button_style === 'sharp' ? 'rounded-none' :
                        profile.button_style === 'soft' ? 'rounded-lg' :
                        profile.button_style === 'outline' ? 'rounded-lg border-2 !text-current !bg-transparent' :
                        'rounded-full'
                      }`}
                      style={{ backgroundColor: profile.button_style === 'outline' ? 'transparent' : theme.primary_color, borderColor: theme.primary_color, color: profile.button_style === 'outline' ? theme.primary_color : 'white' }}>
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                  )}
                  {profile.email && (
                    <a href={`mailto:${profile.email}`}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 ${
                        profile.button_style === 'sharp' ? 'rounded-none' :
                        profile.button_style === 'soft' ? 'rounded-lg' : 'rounded-full'
                      }`}
                      style={{ backgroundColor: theme.primary_color + '18', color: theme.primary_color }}>
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  )}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer"
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 ${
                        profile.button_style === 'sharp' ? 'rounded-none' :
                        profile.button_style === 'soft' ? 'rounded-lg' : 'rounded-full'
                      }`}
                      style={{ backgroundColor: theme.primary_color + '18', color: theme.primary_color }}>
                      <Globe className="w-3.5 h-3.5" /> Web
                    </a>
                  )}
                </div>
              )}

              {/* Address */}
              {profile.address && (
                <div className="flex items-center gap-2 mb-2 text-sm" style={{ color: effectiveText, opacity: 0.65 }}>
                  <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: theme.primary_color }} />
                  {profile.address}
                </div>
              )}

              {/* Business address */}
              {profile.business_address && (
                <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: effectiveText, opacity: 0.65 }}>
                  <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: theme.primary_color }} />
                  <span>{profile.business_address}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.primary_color + '15', color: theme.primary_color }}>Business</span>
                </div>
              )}

              {/* Portfolio link */}
              {profile.portfolio_url && (
                <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 mb-4 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: theme.primary_color }}>
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  View Portfolio
                </a>
              )}

              {/* Social links */}
              {socialLinks.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {socialLinks.map(link => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      onClick={() => recordClick(link.id)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                      style={{ backgroundColor: theme.primary_color + '15', color: theme.primary_color }}
                      title={link.label}>
                      <PlatformIcon platform={link.platform} className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              )}

              {/* Custom links */}
              {customLinks.length > 0 && (
                <div className="space-y-2 mb-4">
                  {customLinks.map(link => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      onClick={() => recordClick(link.id)}
                      className={`flex items-center justify-between px-4 py-3 text-sm font-medium transition-all hover:opacity-90 ${
                        profile.button_style === 'sharp' ? 'rounded-none' :
                        profile.button_style === 'soft' ? 'rounded-xl' : 'rounded-2xl'
                      }`}
                      style={{ backgroundColor: theme.primary_color + '12', color: effectiveText }}>
                      <span>{link.label}</span>
                      <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.primary_color }} />
                    </a>
                  ))}
                </div>
              )}

              {/* Save contact + Download */}
              <div className="flex gap-2 mb-4">
                <button onClick={downloadVCard}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border transition-opacity hover:opacity-80 ${
                    profile.button_style === 'sharp' ? 'rounded-none' :
                    profile.button_style === 'soft' ? 'rounded-lg' : 'rounded-xl'
                  }`}
                  style={{ borderColor: theme.primary_color + '40', color: theme.primary_color }}>
                  <Download className="w-4 h-4" /> Save Contact
                </button>
              </div>

              {/* ── Skills ─────────────────────────────────────────────── */}
              {(profile.skills?.length ?? 0) > 0 && (
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wrench style={{ width: '13px', height: '13px', color: theme.primary_color }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: effectiveText, opacity: 0.5 }}>Skills</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills!.map((skill, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: theme.primary_color + '15', color: theme.primary_color }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Languages ──────────────────────────────────────────── */}
              {(profile.languages?.length ?? 0) > 0 && (
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Languages style={{ width: '13px', height: '13px', color: theme.primary_color }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: effectiveText, opacity: 0.5 }}>Languages</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.languages!.map((lang, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: theme.primary_color + '10', color: effectiveText, opacity: 0.85 }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Experience ─────────────────────────────────────────── */}
              {(profile.experience?.length ?? 0) > 0 && (
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Briefcase style={{ width: '13px', height: '13px', color: theme.primary_color }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: effectiveText, opacity: 0.5 }}>Experience</p>
                  </div>
                  <div className="space-y-3">
                    {profile.experience!.map((exp, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1.5 flex-shrink-0 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary_color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight" style={{ color: effectiveText }}>{exp.title}</p>
                          {exp.org && <p className="text-xs mt-0.5" style={{ color: theme.primary_color }}>{exp.org}</p>}
                          {exp.period && <p className="text-xs mt-0.5" style={{ color: effectiveText, opacity: 0.5 }}>{exp.period}</p>}
                          {exp.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: effectiveText, opacity: 0.7 }}>{exp.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Education ──────────────────────────────────────────── */}
              {(profile.education?.length ?? 0) > 0 && (
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <GraduationCap style={{ width: '13px', height: '13px', color: theme.primary_color }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: effectiveText, opacity: 0.5 }}>Education</p>
                  </div>
                  <div className="space-y-3">
                    {profile.education!.map((edu, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1.5 flex-shrink-0 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary_color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight" style={{ color: effectiveText }}>{edu.title}</p>
                          {edu.org && <p className="text-xs mt-0.5" style={{ color: theme.primary_color }}>{edu.org}</p>}
                          {edu.period && <p className="text-xs mt-0.5" style={{ color: effectiveText, opacity: 0.5 }}>{edu.period}</p>}
                          {edu.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: effectiveText, opacity: 0.7 }}>{edu.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Awards ─────────────────────────────────────────────── */}
              {(profile.awards?.length ?? 0) > 0 && (
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Award style={{ width: '13px', height: '13px', color: theme.primary_color }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: effectiveText, opacity: 0.5 }}>Awards & Recognition</p>
                  </div>
                  <div className="space-y-1">
                    {profile.awards!.map((award, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Star style={{ width: '11px', height: '11px', flexShrink: 0, color: theme.primary_color }} />
                        <span className="text-sm" style={{ color: effectiveText, opacity: 0.85 }}>{award}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Certifications ─────────────────────────────────────── */}
              {(profile.certifications?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BadgeCheck style={{ width: '13px', height: '13px', color: theme.primary_color }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: effectiveText, opacity: 0.5 }}>Certifications</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.certifications!.map((cert, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                        style={{ backgroundColor: theme.primary_color + '12', color: effectiveText, opacity: 0.9 }}>
                        <BadgeCheck style={{ width: '10px', height: '10px', color: theme.primary_color }} />
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── WhatsApp button ─────────────────────────────────────── */}
              {!!profile.whatsapp_enabled && profile.whatsapp_url && (
                <div className="mb-4">
                  <a
                    href={profile.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
                      profile.button_style === 'sharp' ? 'rounded-none' : 'rounded-xl'
                    }`}
                    style={{ backgroundColor: '#25D366' }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.847L0 24l6.335-1.508A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.371l-.36-.213-3.727.977.994-3.634-.234-.374A9.818 9.818 0 1112 21.818z"/></svg>
                    {profile.whatsapp_label || 'Message on WhatsApp'}
                  </a>
                </div>
              )}

              {/* ── Social links ────────────────────────────────────────── */}
              {!!profile.social_links_enabled && profile.social_links && (() => {
                try {
                  const links: { id: string; platform: string; url: string; label: string }[] = JSON.parse(profile.social_links);
                  if (!links.length) return null;
                  return (
                    <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.primary_color }}>Social</p>
                      <div className="flex flex-wrap gap-2">
                        {links.filter(l => l.url).map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${
                              profile.button_style === 'sharp' ? 'rounded-none' : 'rounded-full'
                            }`}
                            style={{ backgroundColor: theme.primary_color + '15', color: effectiveText }}>
                            <PlatformIcon platform={l.platform} className="w-3 h-3" style={{ color: theme.primary_color } as React.CSSProperties} />
                            {l.label || l.platform}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* ── Gallery ─────────────────────────────────────────────── */}
              {!!profile.gallery_enabled && profile.gallery && (() => {
                try {
                  const items: { id: string; url: string; caption: string; alt: string }[] = JSON.parse(profile.gallery);
                  const valid = items.filter(i => i.url);
                  if (!valid.length) return null;
                  return (
                    <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.primary_color }}>Gallery</p>
                      <div className="grid grid-cols-2 gap-2">
                        {valid.map((item, i) => (
                          <div key={i} className="rounded-lg overflow-hidden aspect-square bg-muted">
                            <img src={item.url} alt={item.alt || item.caption || 'Gallery image'} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* ── Menu / Price List ───────────────────────────────────── */}
              {!!profile.menu_enabled && profile.menu_items && (() => {
                try {
                  const items: { id: string; category: string; name: string; description: string; price: string }[] = JSON.parse(profile.menu_items);
                  const valid = items.filter(i => i.name);
                  if (!valid.length) return null;
                  const cats = [...new Set(valid.map(i => i.category || ''))];
                  return (
                    <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                      <p className="text-sm font-semibold mb-3" style={{ color: effectiveText }}>{profile.menu_title || 'Menu'}</p>
                      {cats.map(cat => (
                        <div key={cat} className="mb-3">
                          {cat && <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.primary_color }}>{cat}</p>}
                          <div className="space-y-2">
                            {valid.filter(i => (i.category || '') === cat).map((item, i) => (
                              <div key={i} className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium" style={{ color: effectiveText }}>{item.name}</p>
                                  {item.description && <p className="text-xs mt-0.5" style={{ color: effectiveText, opacity: 0.6 }}>{item.description}</p>}
                                </div>
                                {item.price && <span className="text-sm font-semibold flex-shrink-0" style={{ color: theme.primary_color }}>{item.price}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* ── PDF Attachments ─────────────────────────────────────── */}
              {!!profile.pdf_enabled && profile.pdf_attachments && (() => {
                try {
                  const items: { id: string; label: string; url: string; description: string }[] = JSON.parse(profile.pdf_attachments);
                  const valid = items.filter(i => i.url && i.label);
                  if (!valid.length) return null;
                  return (
                    <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.primary_color}12` }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: theme.primary_color }}>Documents</p>
                      <div className="space-y-2">
                        {valid.map((item, i) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-3 p-3 transition-opacity hover:opacity-80 ${
                              profile.button_style === 'sharp' ? 'rounded-none' : 'rounded-xl'
                            }`}
                            style={{ backgroundColor: theme.primary_color + '10', border: `1px solid ${theme.primary_color}20` }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.primary_color + '20' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ color: theme.primary_color }}>
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: effectiveText }}>{item.label}</p>
                              {item.description && <p className="text-xs truncate" style={{ color: effectiveText, opacity: 0.6 }}>{item.description}</p>}
                            </div>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0 ml-auto" style={{ color: theme.primary_color }}>
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* ── Enquiry form / email fallback ─────────────────────────── */}
              {!!profile.enquiry_enabled ? (
                <div className="border-t pt-4 mb-4" style={{ borderColor: theme.primary_color + '20' }}>
                  {enquirySuccess ? (
                    <div className="text-center py-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-sm font-medium" style={{ color: effectiveText }}>Enquiry sent!</p>
                      <p className="text-xs mt-1" style={{ color: effectiveText, opacity: 0.6 }}>
                        {profile.display_name} will be in touch.
                      </p>
                      <button onClick={() => setEnquirySuccess(false)} className="text-xs mt-2 hover:underline" style={{ color: theme.primary_color }}>
                        Send another
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={submitEnquiry} className="space-y-3">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5" style={{ color: effectiveText }}>
                        <Mail className="w-4 h-4" style={{ color: theme.primary_color }} />
                        Send an Enquiry
                      </h3>
                      {enquiryError && <p className="text-xs text-red-500">{enquiryError}</p>}
                      <Input value={enquiryForm.sender_name} onChange={e => setEnquiryForm(f => ({ ...f, sender_name: e.target.value }))}
                        placeholder="Your name *" required className="text-sm" style={{ borderColor: theme.primary_color + '30' }} />
                      <Input type="email" value={enquiryForm.sender_email} onChange={e => setEnquiryForm(f => ({ ...f, sender_email: e.target.value }))}
                        placeholder="Your email *" required className="text-sm" style={{ borderColor: theme.primary_color + '30' }} />
                      <Textarea value={enquiryForm.message} onChange={e => setEnquiryForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Your message… *" required rows={3} className="text-sm resize-none" style={{ borderColor: theme.primary_color + '30' }} />
                      <button type="submit" disabled={enquirySubmitting}
                        className={`w-full py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 ${
                          profile.button_style === 'sharp' ? 'rounded-none' : 'rounded-xl'
                        }`}
                        style={{ backgroundColor: theme.primary_color }}>
                        <Send className="w-4 h-4" />
                        {enquirySubmitting ? 'Sending…' : 'Send Enquiry'}
                      </button>
                    </form>
                  )}
                </div>
              ) : profile.email ? (
                <div className="border-t pt-4 mb-4" style={{ borderColor: theme.primary_color + '20' }}>
                  <p className="text-xs mb-2 text-center" style={{ color: effectiveText, opacity: 0.6 }}>
                    Get in touch via email
                  </p>
                  <a
                    href={`mailto:${profile.email}`}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
                      profile.button_style === 'sharp' ? 'rounded-none' : 'rounded-xl'
                    }`}
                    style={{ backgroundColor: theme.primary_color }}
                  >
                    <Mail className="w-4 h-4" />
                    Email {profile.display_name}
                  </a>
                </div>
              ) : null}

                {/* QR Code modal */}
                {showQR && (
                  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
                    <div className="rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl" style={{ backgroundColor: '#ffffff' }} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Scan QR Code</h3>
                        <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="rounded-2xl p-4 mb-4 inline-block bg-white" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}>
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="QR Code" className="w-44 h-44 mx-auto block" />
                        ) : (
                          <div className="w-44 h-44 flex items-center justify-center text-gray-400 text-xs">Loading…</div>
                        )}
                      </div>
                      <div className="rounded-xl px-3 py-2 text-left bg-gray-50 border border-gray-100">
                        <p className="text-[10px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Profile URL</p>
                        <p className="text-xs font-semibold text-gray-800 break-all leading-relaxed">
                          {window.location.hostname}
                        </p>
                        <p className="text-xs text-gray-500 break-all leading-relaxed">
                          {window.location.pathname}
                        </p>
                      </div>
                    </div>
                  </div>
                )}


            </div>
          </div>

          {/*
            ══════════════════════════════════════════════════════════════════
            PLATFORM-CONTROLLED SAFETY & LEGAL LAYER
            ──────────────────────────────────────────────────────────────────
            This section is rendered by the platform and sits OUTSIDE the
            user-editable profile card. It cannot be removed, hidden, or covered
            because:
              1. It is rendered after the profile card in DOM order
              2. The report button uses a high z-index (z-[9999]) and
                 pointer-events-auto so it is always clickable
              3. The legal footer uses platform-controlled classes
            ══════════════════════════════════════════════════════════════════
          */}

          {/* Platform branding */}
          {!profile.plan.remove_branding && (
            <div className="text-center mb-2">
              <Link to="/" className="inline-flex items-center gap-1.5 text-xs opacity-50 hover:opacity-70 transition-opacity" style={{ color: theme.text_color }}>
                <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
                  <Zap style={{ width: '8px', height: '8px', color: 'white' }} />
                </div>
                Powered by {branding.platform_name}
              </Link>
            </div>
          )}

          {/*
            ── PLATFORM-CONTROLLED LEGAL FOOTER ──────────────────────────────
            Required on all public profile pages. Cannot be removed by users.
            Uses data-platform-legal-footer attribute so the CSS sanitiser
            can identify and protect it.
          */}
          <div
            className="legal-footer platform-legal-footer mt-3 mb-4 px-2"
            data-platform-legal-footer="1"
            style={{ position: 'relative', zIndex: 9990 }}
          >
            <p className="text-center text-[10px] mb-2" style={{ color: theme.text_color, opacity: 0.45 }}>
              By using this page, you agree to our{' '}
              <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">Terms</a>
              {' '}and policies.
            </p>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              {[
                { href: '/legal/terms',          label: 'Terms of Service' },
                { href: '/legal/privacy',         label: 'Privacy Policy' },
                { href: '/legal/cookies',         label: 'Cookie Policy' },
                { href: '/legal/acceptable-use',  label: 'Acceptable Use' },
                { href: '/legal/reporting',       label: 'Reporting Policy' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] underline hover:opacity-80 transition-opacity"
                  style={{ color: theme.text_color, opacity: 0.4 }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/*
            ── PLATFORM-CONTROLLED REPORT BUTTON ─────────────────────────────
            Inline version below the profile card — always visible.
            Also rendered as a fixed bottom-right button for maximum visibility.
            Both are outside the user-editable area and cannot be overridden.
          */}
          <div className="text-center mb-6" data-platform-report="1">
            <button
              onClick={() => { setShowReportModal(true); setReportSuccess(false); setReportError(''); setReportForm({ reporter_name: '', reporter_email: '', reason: '', details: '' }); }}
              className="inline-flex items-center gap-1 text-[10px] opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: theme.text_color }}
              aria-label="Report this profile"
            >
              <Flag style={{ width: '10px', height: '10px' }} />
              Report this {profile.profile_type === 'business' ? 'business' : 'profile'}
            </button>
          </div>
        </div>

        {/*
          ── FIXED REPORT BUTTON (bottom-right) ──────────────────────────────
          Always visible regardless of scroll position or custom CSS.
          z-[9999] ensures it sits above any user content.
          pointer-events-auto ensures it is always clickable.
          data-platform-report-fixed prevents the CSS sanitiser from
          allowing user CSS to target it.
        */}
        <button
          onClick={() => { setShowReportModal(true); setReportSuccess(false); setReportError(''); setReportForm({ reporter_name: '', reporter_email: '', reason: '', details: '' }); }}
          className="fixed bottom-5 right-5 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium shadow-lg transition-all hover:opacity-90 active:scale-95"
          style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
            color: '#fff',
            zIndex: 9999,
            pointerEvents: 'auto',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          aria-label="Report this profile"
          data-platform-report-fixed="1"
        >
          <Flag className="w-3 h-3" />
          Report
        </button>

        {/* ── REPORT MODAL ──────────────────────────────────────────────────── */}
        {showReportModal && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 10000 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            data-platform-modal="1"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
              <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Close report form">
                <X className="w-5 h-5" />
              </button>

              {reportSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Report submitted</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Thank you for your report. Our moderation team will review it and take appropriate action in line with our{' '}
                    <a href="/legal/reporting-moderation" target="_blank" rel="noopener noreferrer" className="underline">Reporting and Moderation Policy</a>.
                    We will not share your details with the profile owner.
                  </p>
                  <button onClick={() => setShowReportModal(false)} className="mt-2 px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={submitReport} className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Flag className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h2 id="report-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                        Report this {profile.profile_type === 'business' ? 'business' : 'profile'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Reports are reviewed by our moderation team. Profile type:{' '}
                        <span className="font-medium capitalize">{profile.profile_type ?? 'personal'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                    <strong>UK GDPR notice:</strong> Your name and email will be used only to process this report and contact you if needed. We will not share your details with the profile owner.
                  </div>

                  {reportError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {reportError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Your name *</label>
                      <Input value={reportForm.reporter_name} onChange={e => setReportForm(f => ({ ...f, reporter_name: e.target.value }))} placeholder="Jane Smith" required className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Your email *</label>
                      <Input type="email" value={reportForm.reporter_email} onChange={e => setReportForm(f => ({ ...f, reporter_email: e.target.value }))} placeholder="jane@example.com" required className="text-sm" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Reason for report *</label>
                    <Select value={reportForm.reason} onValueChange={v => setReportForm(f => ({ ...f, reason: v }))}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spam_scam">Spam or scam</SelectItem>
                        <SelectItem value="impersonation">Impersonation</SelectItem>
                        <SelectItem value="harassment_abuse">Harassment or abuse</SelectItem>
                        <SelectItem value="illegal_content">Illegal content</SelectItem>
                        <SelectItem value="adult_unsafe_content">Adult or unsafe content</SelectItem>
                        <SelectItem value="misleading_information">Misleading information</SelectItem>
                        <SelectItem value="privacy_issue">Privacy issue</SelectItem>
                        <SelectItem value="intellectual_property">Intellectual property issue</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Details *</label>
                    <Textarea value={reportForm.details} onChange={e => setReportForm(f => ({ ...f, details: e.target.value }))} placeholder="Please describe the issue in detail…" required rows={3} className="text-sm resize-none" minLength={10} />
                  </div>

                  {/* Hidden fields for context */}
                  <input type="hidden" value={profile.profile_type ?? 'personal'} readOnly />
                  <input type="hidden" value={window.location.href} readOnly />

                  <button
                    type="submit"
                    disabled={reportSubmitting || !reportForm.reason}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {reportSubmitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Flag className="w-4 h-4" />
                    )}
                    {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                  </button>

                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                    False reports may result in action against your account. Reports are reviewed in line with our{' '}
                    <a href="/legal/reporting-moderation" className="underline hover:text-slate-600" target="_blank" rel="noopener noreferrer">Reporting and Moderation Policy</a>.
                  </p>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
