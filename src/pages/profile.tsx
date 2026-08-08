import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  Facebook,
  Flag,
  Github,
  Globe,
  GraduationCap,
  Instagram,
  KeyRound,
  Languages,
  Linkedin,
  Lock,
  Mail,
  MapPin,
  MapPinned,
  Moon,
  Phone,
  QrCode,
  Send,
  Share2,
  Star,
  Sun,
  Twitter,
  Wrench,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranding } from '@/lib/branding';

const SITE = 'https://sousamurrayprofiles.jagroupservices.co.uk';

type IconProps = { className?: string; style?: React.CSSProperties };
interface ExpEntry { title: string; org: string; period: string; description: string; }
interface SimpleSocialLink { id: string; platform: string; url: string; label: string; }
interface GalleryItem { id: string; url: string; caption: string; alt: string; }
interface MenuItem { id: string; category: string; name: string; description: string; price: string; }
interface DocumentItem { id: string; label: string; url: string; description: string; }

interface PublicProfile {
  id: number;
  username: string;
  display_name: string;
  job_title: string;
  company: string;
  bio: string;
  bio_html?: string | null;
  phone: string;
  email: string;
  website: string;
  address: string;
  business_address?: string | null;
  profile_photo: string;
  theme_id: number;
  messaging_enabled: number;
  enquiry_enabled: number;
  public_pin_enabled: boolean;
  is_verified: boolean;
  verified_at: string | null;
  allow_indexing: number;
  seo_title: string | null;
  seo_description: string | null;
  profile_type?: string;
  personal_type?: string;
  layout_preset?: string;
  colour_palette?: string;
  custom_colour?: string;
  button_style?: string;
  photo_shape?: string;
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
  plan: {
    has_contact_form: number;
    has_vcard_download: number;
    remove_branding: number;
    has_messaging: number;
  };
  theme: {
    primary_color: string;
    accent_color: string;
    background_color: string;
    text_color: string;
  };
  links: {
    id: number;
    type: string;
    platform: string | null;
    label: string;
    url: string;
    icon: string | null;
  }[];
}

const PLATFORM_ICONS: Record<string, React.ComponentType<IconProps>> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  github: Github,
};

function PlatformIcon({ platform, className, style }: { platform: string | null; className?: string; style?: React.CSSProperties }) {
  const Icon = platform ? PLATFORM_ICONS[platform.toLowerCase()] : undefined;
  return Icon ? <Icon className={className} style={style} /> : <Globe className={className} style={style} />;
}

function safeColour(value: string | null | undefined, fallback: string) {
  const raw = String(value || '').trim();
  return /^(#[0-9a-f]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\))$/i.test(raw) ? raw : fallback;
}

function safeExternalUrl(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function safeImageUrl(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (raw.startsWith('data:image/')) return raw;
  return safeExternalUrl(raw);
}

function parseArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeVCard(value: string | null | undefined) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

function generateVCard(profile: PublicProfile): string {
  const website = safeExternalUrl(profile.website);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(profile.display_name)}`,
    profile.job_title ? `TITLE:${escapeVCard(profile.job_title)}` : '',
    profile.company ? `ORG:${escapeVCard(profile.company)}` : '',
    profile.phone ? `TEL:${escapeVCard(profile.phone)}` : '',
    profile.email ? `EMAIL:${escapeVCard(profile.email)}` : '',
    website ? `URL:${escapeVCard(website)}` : '',
    profile.address ? `ADR:;;${escapeVCard(profile.address)};;;;` : '',
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export default function PublicProfilePage({ _overrideUsername }: { _overridePrefix?: string; _overrideUsername?: string } = {}) {
  const params = useParams<{ seg1: string; seg2: string }>();
  const username = _overrideUsername ?? params.seg2 ?? params.seg1;
  const branding = useBranding();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [themeDark, setThemeDark] = useState(false);

  const [pinRequired, setPinRequired] = useState(false);
  const [pinPreview, setPinPreview] = useState<{ display_name: string; profile_photo: string | null } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const [enquiryForm, setEnquiryForm] = useState({ sender_name: '', sender_email: '', message: '' });
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [enquiryError, setEnquiryError] = useState('');

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ reporter_name: '', reporter_email: '', reason: '', details: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState('');

  const loadProfile = async () => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/public`, { headers: { accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (response.status === 403 && data?.pin_required) {
        setPinRequired(true);
        setPinPreview({ display_name: String(data.display_name || ''), profile_photo: data.profile_photo || null });
        return;
      }
      if (!response.ok || !data?.success || !data?.data) {
        setNotFound(true);
        return;
      }
      setPinRequired(false);
      setProfile(data.data);
      void fetch(`/api/analytics/view/${encodeURIComponent(username)}`, { method: 'POST' }).catch(() => undefined);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const submitPin = async () => {
    if (!username || !pinInput.trim()) return;
    setPinSubmitting(true);
    setPinError('');
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/public-pin/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.verified) {
        setPinRequired(false);
        setPinInput('');
        await loadProfile();
      } else {
        setPinError(data?.error?.message || data?.error || 'Incorrect PIN. Please try again.');
      }
    } catch {
      setPinError('Something went wrong. Please try again.');
    } finally {
      setPinSubmitting(false);
    }
  };

  const recordClick = (linkId: number) => {
    void fetch(`/api/links/${linkId}/click`, { method: 'POST' }).catch(() => undefined);
  };

  const downloadVCard = () => {
    if (!profile) return;
    const blob = new Blob([generateVCard(profile)], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${profile.display_name || profile.username}.vcf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const shareProfile = async () => {
    if (!profile) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.display_name || profile.username, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(url); } catch { /* visitor can copy browser URL */ }
      }
    }
  };

  const loadQR = async () => {
    if (!username) return;
    if (qrDataUrl) {
      setShowQR(true);
      return;
    }
    try {
      const response = await fetch(`/api/qr/public/${encodeURIComponent(username)}`, { headers: { accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && data?.data?.qr_data_url) setQrDataUrl(String(data.data.qr_data_url));
    } catch {
      // Keep QR unavailable rather than loading visitor data through a third-party QR service.
    }
    setShowQR(true);
  };

  const submitEnquiry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username) return;
    setEnquiryError('');
    setEnquirySubmitting(true);
    try {
      const response = await fetch(`/api/enquiries/${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...enquiryForm, _hp: '' }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error?.message || data?.error || 'Failed to send enquiry.');
      setEnquirySuccess(true);
      setEnquiryForm({ sender_name: '', sender_email: '', message: '' });
    } catch (error) {
      setEnquiryError(error instanceof Error ? error.message : 'Failed to send enquiry.');
    } finally {
      setEnquirySubmitting(false);
    }
  };

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username) return;
    setReportError('');
    setReportSubmitting(true);
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(reportForm),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error?.message || data?.error || 'Failed to submit report.');
      setReportSuccess(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Failed to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const openReport = () => {
    setReportSuccess(false);
    setReportError('');
    setReportForm({ reporter_name: '', reporter_email: '', reason: '', details: '' });
    setShowReportModal(true);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (pinRequired) {
    const pinPhoto = safeImageUrl(pinPreview?.profile_photo);
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Helmet><title>{`Protected Profile — ${branding.platform_name || 'Sousa Murray Profiles'}`}</title><meta name="robots" content="noindex, nofollow" /></Helmet>
        <div className="w-full max-w-sm text-center">
          {pinPhoto ? (
            <img src={pinPhoto} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border-2 border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-primary" /></div>
          )}
          <h1 className="text-xl font-bold text-foreground mb-1">{pinPreview?.display_name || 'Protected Profile'}</h1>
          <p className="text-sm text-muted-foreground mb-6">This profile is protected. Enter the PIN to view it.</p>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4"><KeyRound className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium text-foreground">Enter PIN</span></div>
            <Input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={pinInput} onChange={event => { setPinInput(event.target.value.replace(/\D/g, '')); setPinError(''); }} onKeyDown={event => { if (event.key === 'Enter') void submitPin(); }} placeholder="••••••" className="text-center text-xl tracking-widest mb-3 bg-background border-border" autoFocus />
            {pinError && <p className="text-sm text-destructive mb-3">{pinError}</p>}
            <Button onClick={() => void submitPin()} disabled={pinSubmitting || !pinInput} className="w-full">{pinSubmitting ? 'Verifying…' : 'Unlock Profile'}</Button>
          </div>
          <Link to="/" className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground">Back to {branding.platform_name || 'Sousa Murray Profiles'}</Link>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <Helmet><title>{`Profile Not Found — ${branding.platform_name || 'Sousa Murray Profiles'}`}</title><meta name="robots" content="noindex, nofollow" /></Helmet>
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6"><Globe className="w-8 h-8 text-muted-foreground" /></div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Profile not found</h1>
        <p className="text-muted-foreground mb-6">This profile does not exist, is not public, or has been removed.</p>
        <Link to="/"><Button>Go to {branding.platform_name || 'Sousa Murray Profiles'}</Button></Link>
      </div>
    );
  }

  const primary = safeColour(profile.theme?.primary_color, '#3B82F6');
  const accent = safeColour(profile.theme?.accent_color, primary);
  const baseBackground = safeColour(profile.theme?.background_color, '#FFFFFF');
  const baseText = safeColour(profile.theme?.text_color, '#0F172A');
  const effectiveBg = themeDark && /^#fff(fff)?$/i.test(baseBackground) ? '#0F172A' : baseBackground;
  const effectiveText = themeDark && /^#(0f172a|111827)$/i.test(baseText) ? '#F1F5F9' : baseText;
  const canonicalUrl = `${SITE}/profile/${encodeURIComponent(profile.username)}`;
  const publicPhoto = safeImageUrl(profile.profile_photo);
  const website = safeExternalUrl(profile.website);
  const portfolio = safeExternalUrl(profile.portfolio_url);
  const whatsApp = safeExternalUrl(profile.whatsapp_url);
  const socialLinks = (profile.links || []).filter(link => link.type === 'social' && safeExternalUrl(link.url));
  const customLinks = (profile.links || []).filter(link => link.type !== 'social' && safeExternalUrl(link.url));
  const extendedSocial = parseArray<SimpleSocialLink>(profile.social_links).filter(link => safeExternalUrl(link.url));
  const gallery = parseArray<GalleryItem>(profile.gallery).filter(item => safeImageUrl(item.url));
  const menuItems = parseArray<MenuItem>(profile.menu_items).filter(item => String(item.name || '').trim());
  const documents = parseArray<DocumentItem>(profile.pdf_attachments).filter(item => safeExternalUrl(item.url) && String(item.label || '').trim());
  const pageTitle = profile.seo_title || `${profile.display_name || profile.username}${profile.job_title ? ` — ${profile.job_title}` : ''}`;
  const pageDesc = profile.seo_description || profile.bio || `${profile.display_name || profile.username}'s professional digital profile.`;
  const platformUrl = safeExternalUrl(branding.platform_url) || SITE;
  const ogImage = publicPhoto || `${platformUrl.replace(/\/$/, '')}/og-default.png`;

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name || profile.username,
    url: canonicalUrl,
    ...(profile.job_title && { jobTitle: profile.job_title }),
    ...(profile.company && { worksFor: { '@type': 'Organization', name: profile.company } }),
    ...(profile.email && { email: profile.email }),
    ...(profile.phone && { telephone: profile.phone }),
    ...(website && { sameAs: [website] }),
    ...(publicPhoto && { image: publicPhoto }),
  };

  const buttonRadius = profile.button_style === 'sharp' ? 'rounded-none' : profile.button_style === 'soft' ? 'rounded-lg' : 'rounded-xl';
  const subtle = `${primary}18`;

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} — ${branding.platform_name || 'Sousa Murray Profiles'}`}</title>
        <meta name="description" content={pageDesc.slice(0, 160)} />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content={profile.allow_indexing ? 'index, follow' : 'noindex, nofollow'} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${pageTitle} — ${branding.platform_name || 'Sousa Murray Profiles'}`} />
        <meta property="og:description" content={pageDesc.slice(0, 160)} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content={branding.platform_name || 'Sousa Murray Profiles'} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${pageTitle} — ${branding.platform_name || 'Sousa Murray Profiles'}`} />
        <meta name="twitter:description" content={pageDesc.slice(0, 160)} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(personJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col items-center py-8 px-4" style={{ backgroundColor: effectiveBg }} data-platform-profile-wrapper="1">
        <div className="w-full max-w-sm">
          <div className="flex justify-end mb-3">
            <button type="button" onClick={() => setThemeDark(value => !value)} className="p-2 rounded-xl transition-opacity hover:opacity-80" style={{ backgroundColor: subtle, color: primary }} title={themeDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {themeDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <article className="rounded-3xl overflow-hidden shadow-2xl mb-4" style={{ backgroundColor: effectiveBg, border: `1px solid ${primary}20` }}>
            <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${primary}40 0%, ${accent}15 100%)` }} />
            <div className="px-5 pb-5">
              <div className="flex items-end justify-between -mt-10 mb-4">
                <div className="relative">
                  {publicPhoto ? (
                    <img src={publicPhoto} alt={profile.display_name || profile.username} className={`w-20 h-20 object-cover border-4 shadow-lg ${profile.photo_shape === 'square' ? 'rounded-none' : profile.photo_shape === 'rounded' ? 'rounded-2xl' : 'rounded-full'}`} style={{ borderColor: effectiveBg }} />
                  ) : (
                    <div className={`w-20 h-20 flex items-center justify-center text-3xl font-bold text-white border-4 shadow-lg ${profile.photo_shape === 'square' ? 'rounded-none' : profile.photo_shape === 'rounded' ? 'rounded-2xl' : 'rounded-full'}`} style={{ backgroundColor: primary, borderColor: effectiveBg }}>
                      {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {profile.is_verified && <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-white rounded-full pl-0.5 pr-1.5 py-0.5 shadow-md border border-blue-100"><BadgeCheck className="w-3.5 h-3.5 text-blue-500" /><span className="text-[9px] font-bold text-blue-600">Verified</span></div>}
                </div>
                <div className="flex gap-1.5 mb-1">
                  <button type="button" onClick={() => void loadQR()} className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ borderColor: `${primary}40`, color: primary, backgroundColor: `${primary}10` }} title="Show QR code"><QrCode className="w-4 h-4" /></button>
                  <button type="button" onClick={() => void shareProfile()} className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ borderColor: `${primary}40`, color: primary, backgroundColor: `${primary}10` }} title="Share profile"><Share2 className="w-4 h-4" /></button>
                </div>
              </div>

              <section className="mb-4">
                <h1 className="text-xl font-bold leading-tight" style={{ color: effectiveText }}>{profile.display_name}</h1>
                {profile.headline && <p className="text-sm font-medium mt-0.5" style={{ color: primary }}>{profile.headline}</p>}
                {(profile.job_title || profile.company) && <p className="text-sm mt-1" style={{ color: effectiveText, opacity: 0.7 }}>{[profile.job_title, profile.company].filter(Boolean).join(' · ')}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.pronouns && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${primary}15`, color: primary }}>{profile.pronouns}</span>}
                  {profile.location_city && <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: `${primary}10`, color: effectiveText }}><MapPinned className="w-2.5 h-2.5" />{profile.location_city}</span>}
                  {profile.availability && <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium" style={{ backgroundColor: '#22c55e15', color: '#16a34a' }}><Calendar className="w-2.5 h-2.5" />{profile.availability}</span>}
                </div>
              </section>

              {profile.bio && (
                <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}15` }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: effectiveText, opacity: 0.85 }}>{profile.bio}</p>
                </section>
              )}

              {(profile.phone || profile.email || website) && (
                <section className="flex gap-2 mb-4">
                  {profile.phone && <a href={`tel:${encodeURIComponent(profile.phone)}`} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white ${buttonRadius}`} style={{ backgroundColor: primary }}><Phone className="w-3.5 h-3.5" /> Call</a>}
                  {profile.email && <a href={`mailto:${profile.email}`} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${buttonRadius}`} style={{ backgroundColor: subtle, color: primary }}><Mail className="w-3.5 h-3.5" /> Email</a>}
                  {website && <a href={website} target="_blank" rel="noopener noreferrer" className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${buttonRadius}`} style={{ backgroundColor: subtle, color: primary }}><Globe className="w-3.5 h-3.5" /> Web</a>}
                </section>
              )}

              {profile.address && <div className="flex items-start gap-2 mb-2 text-sm" style={{ color: effectiveText, opacity: 0.7 }}><MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} /><span>{profile.address}</span></div>}
              {profile.business_address && <div className="flex items-start gap-2 mb-4 text-sm" style={{ color: effectiveText, opacity: 0.7 }}><MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} /><span>{profile.business_address}</span><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${primary}15`, color: primary }}>Business</span></div>}
              {portfolio && <a href={portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-4 text-sm font-medium" style={{ color: primary }}><ExternalLink className="w-4 h-4" /> View portfolio</a>}

              {socialLinks.length > 0 && <div className="flex gap-2 flex-wrap mb-4">{socialLinks.map(link => <a key={link.id} href={safeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" onClick={() => recordClick(link.id)} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primary}15`, color: primary }} title={link.label}><PlatformIcon platform={link.platform} className="w-4 h-4" /></a>)}</div>}
              {customLinks.length > 0 && <div className="space-y-2 mb-4">{customLinks.map(link => <a key={link.id} href={safeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" onClick={() => recordClick(link.id)} className={`flex items-center justify-between px-4 py-3 text-sm font-medium ${buttonRadius}`} style={{ backgroundColor: `${primary}12`, color: effectiveText }}><span>{link.label}</span><ArrowRight className="w-4 h-4" style={{ color: primary }} /></a>)}</div>}

              <button type="button" onClick={downloadVCard} className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border mb-4 ${buttonRadius}`} style={{ borderColor: `${primary}40`, color: primary }}><Download className="w-4 h-4" /> Save contact</button>

              {(profile.skills?.length ?? 0) > 0 && <ProfileTagSection icon={<Wrench className="w-3.5 h-3.5" />} title="Skills" items={profile.skills || []} primary={primary} text={effectiveText} />}
              {(profile.languages?.length ?? 0) > 0 && <ProfileTagSection icon={<Languages className="w-3.5 h-3.5" />} title="Languages" items={profile.languages || []} primary={primary} text={effectiveText} />}
              {(profile.awards?.length ?? 0) > 0 && <ProfileTagSection icon={<Award className="w-3.5 h-3.5" />} title="Awards & recognition" items={profile.awards || []} primary={primary} text={effectiveText} itemIcon={<Star className="w-3 h-3" />} />}
              {(profile.certifications?.length ?? 0) > 0 && <ProfileTagSection icon={<BadgeCheck className="w-3.5 h-3.5" />} title="Certifications" items={profile.certifications || []} primary={primary} text={effectiveText} />}
              {(profile.experience?.length ?? 0) > 0 && <TimelineSection icon={<Briefcase className="w-3.5 h-3.5" />} title="Experience" entries={profile.experience || []} primary={primary} text={effectiveText} />}
              {(profile.education?.length ?? 0) > 0 && <TimelineSection icon={<GraduationCap className="w-3.5 h-3.5" />} title="Education" entries={profile.education || []} primary={primary} text={effectiveText} />}

              {!!profile.whatsapp_enabled && whatsApp && <a href={whatsApp} target="_blank" rel="noopener noreferrer" className={`w-full flex items-center justify-center gap-2 py-2.5 mb-4 text-sm font-semibold text-white ${buttonRadius}`} style={{ backgroundColor: '#25D366' }}>Message on WhatsApp{profile.whatsapp_label ? ` — ${profile.whatsapp_label}` : ''}</a>}

              {!!profile.social_links_enabled && extendedSocial.length > 0 && (
                <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}12` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: primary }}>Social</p>
                  <div className="flex flex-wrap gap-2">{extendedSocial.map(link => <a key={link.id || `${link.platform}-${link.url}`} href={safeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full" style={{ backgroundColor: `${primary}15`, color: effectiveText }}><PlatformIcon platform={link.platform} className="w-3 h-3" style={{ color: primary }} />{link.label || link.platform}</a>)}</div>
                </section>
              )}

              {!!profile.gallery_enabled && gallery.length > 0 && (
                <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}12` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: primary }}>Gallery</p>
                  <div className="grid grid-cols-2 gap-2">{gallery.map(item => <div key={item.id || item.url} className="rounded-lg overflow-hidden aspect-square bg-muted"><img src={safeImageUrl(item.url)} alt={item.alt || item.caption || 'Gallery image'} className="w-full h-full object-cover" loading="lazy" /></div>)}</div>
                </section>
              )}

              {!!profile.menu_enabled && menuItems.length > 0 && <MenuSection title={profile.menu_title || 'Menu'} items={menuItems} primary={primary} text={effectiveText} />}

              {!!profile.pdf_enabled && documents.length > 0 && (
                <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}12` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: primary }}>Documents</p>
                  <div className="space-y-2">{documents.map(item => <a key={item.id || item.url} href={safeExternalUrl(item.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: `${primary}10`, border: `1px solid ${primary}20` }}><Download className="w-4 h-4 shrink-0" style={{ color: primary }} /><div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: effectiveText }}>{item.label}</p>{item.description && <p className="text-xs truncate" style={{ color: effectiveText, opacity: 0.65 }}>{item.description}</p>}</div></a>)}</div>
                </section>
              )}

              {!!profile.enquiry_enabled ? (
                <section className="border-t pt-4 mb-4" style={{ borderColor: `${primary}20` }}>
                  {enquirySuccess ? (
                    <div className="text-center py-4"><CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" /><p className="text-sm font-medium" style={{ color: effectiveText }}>Enquiry sent.</p><button type="button" onClick={() => setEnquirySuccess(false)} className="text-xs mt-2 underline" style={{ color: primary }}>Send another</button></div>
                  ) : (
                    <form onSubmit={submitEnquiry} className="space-y-3">
                      <h2 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: effectiveText }}><Mail className="w-4 h-4" style={{ color: primary }} /> Send an enquiry</h2>
                      {enquiryError && <p className="text-xs text-red-500">{enquiryError}</p>}
                      <Input value={enquiryForm.sender_name} onChange={event => setEnquiryForm(form => ({ ...form, sender_name: event.target.value }))} placeholder="Your name" required maxLength={120} />
                      <Input type="email" value={enquiryForm.sender_email} onChange={event => setEnquiryForm(form => ({ ...form, sender_email: event.target.value }))} placeholder="Your email" required maxLength={254} />
                      <Textarea value={enquiryForm.message} onChange={event => setEnquiryForm(form => ({ ...form, message: event.target.value }))} placeholder="Your message" required rows={3} maxLength={5000} />
                      <button type="submit" disabled={enquirySubmitting} className={`w-full py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 ${buttonRadius}`} style={{ backgroundColor: primary }}><Send className="w-4 h-4" />{enquirySubmitting ? 'Sending…' : 'Send enquiry'}</button>
                    </form>
                  )}
                </section>
              ) : profile.email ? <a href={`mailto:${profile.email}`} className={`w-full flex items-center justify-center gap-2 py-2.5 mb-4 text-sm font-semibold text-white ${buttonRadius}`} style={{ backgroundColor: primary }}><Mail className="w-4 h-4" /> Email {profile.display_name}</a> : null}
            </div>
          </article>

          {!profile.plan?.remove_branding && <div className="text-center mb-2"><Link to="/" className="inline-flex items-center gap-1.5 text-xs opacity-60" style={{ color: effectiveText }}><div className="w-4 h-4 rounded bg-primary flex items-center justify-center"><Zap className="w-2 h-2 text-white" /></div>Powered by {branding.platform_name || 'Sousa Murray Profiles'}</Link></div>}

          <div className="platform-legal-footer mt-3 mb-4 px-2" data-platform-legal-footer="1" style={{ position: 'relative', zIndex: 10 }}>
            <p className="text-center text-[10px] mb-2" style={{ color: effectiveText, opacity: 0.55 }}>By using this page, you agree to our <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</a> and policies.</p>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">{[
              ['/legal/terms', 'Terms'], ['/legal/privacy', 'Privacy'], ['/legal/cookies', 'Cookies'], ['/legal/acceptable-use', 'Acceptable Use'], ['/legal/reporting', 'Reporting'],
            ].map(([href, label]) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="text-[10px] underline" style={{ color: effectiveText, opacity: 0.55 }}>{label}</a>)}</div>
          </div>

          <div className="text-center mb-6"><button type="button" onClick={openReport} className="inline-flex items-center gap-1 text-[10px] opacity-60" style={{ color: effectiveText }}><Flag className="w-3 h-3" /> Report this {profile.profile_type === 'business' ? 'business' : 'profile'}</button></div>
        </div>

        <button type="button" onClick={openReport} className="fixed bottom-5 right-5 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium shadow-lg" style={{ backgroundColor: 'rgba(0,0,0,0.62)', color: '#fff', zIndex: 9999, backdropFilter: 'blur(8px)' }} aria-label="Report this profile" data-platform-report-fixed="1"><Flag className="w-3 h-3" /> Report</button>

        {showQR && (
          <div className="fixed inset-0 bg-black/70 z-[10000] flex items-center justify-center p-4" onClick={() => setShowQR(false)} role="dialog" aria-modal="true" aria-label="Profile QR code">
            <div className="rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl bg-white" onClick={event => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-gray-900">Scan QR code</h2><button type="button" onClick={() => setShowQR(false)} className="text-gray-500 p-1" aria-label="Close QR code"><X className="w-5 h-5" /></button></div>
              {qrDataUrl ? <img src={safeImageUrl(qrDataUrl) || qrDataUrl} alt="QR code for this profile" className="w-44 h-44 mx-auto bg-white" /> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The QR code could not be loaded. You can still share this profile using the Share button.</div>}
              <p className="mt-4 text-xs text-gray-600 break-all">{canonicalUrl}</p>
            </div>
          </div>
        )}

        {showReportModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ zIndex: 10001 }} role="dialog" aria-modal="true" aria-labelledby="report-modal-title" data-platform-modal="1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
              <button type="button" onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 text-slate-500" aria-label="Close report form"><X className="w-5 h-5" /></button>
              {reportSuccess ? (
                <div className="text-center py-4 space-y-3"><CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Report submitted</h2><p className="text-sm text-slate-600 dark:text-slate-400">Thank you. Our team will review the report under the Reporting and Moderation Policy.</p><button type="button" onClick={() => setShowReportModal(false)} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">Close</button></div>
              ) : (
                <form onSubmit={submitReport} className="space-y-4">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><Flag className="w-5 h-5 text-red-600" /></div><div><h2 id="report-modal-title" className="font-bold text-slate-900 dark:text-white">Report this {profile.profile_type === 'business' ? 'business' : 'profile'}</h2><p className="text-xs text-slate-500">Reports are reviewed by our moderation team.</p></div></div>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-700 dark:text-blue-300"><strong>Privacy:</strong> Your details are used to process the report and contact you if needed. They are not intentionally shared with the profile owner.</div>
                  {reportError && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"><AlertTriangle className="w-4 h-4" />{reportError}</div>}
                  <div className="grid grid-cols-2 gap-3"><Input value={reportForm.reporter_name} onChange={event => setReportForm(form => ({ ...form, reporter_name: event.target.value }))} placeholder="Your name" required maxLength={120} /><Input type="email" value={reportForm.reporter_email} onChange={event => setReportForm(form => ({ ...form, reporter_email: event.target.value }))} placeholder="Your email" required maxLength={254} /></div>
                  <Select value={reportForm.reason} onValueChange={reason => setReportForm(form => ({ ...form, reason }))}><SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger><SelectContent><SelectItem value="spam_scam">Spam or scam</SelectItem><SelectItem value="impersonation">Impersonation</SelectItem><SelectItem value="harassment_abuse">Harassment or abuse</SelectItem><SelectItem value="illegal_content">Illegal content</SelectItem><SelectItem value="adult_unsafe_content">Adult or unsafe content</SelectItem><SelectItem value="misleading_information">Misleading information</SelectItem><SelectItem value="privacy_issue">Privacy issue</SelectItem><SelectItem value="intellectual_property">Intellectual property</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                  <Textarea value={reportForm.details} onChange={event => setReportForm(form => ({ ...form, details: event.target.value }))} placeholder="Describe the issue" required minLength={10} maxLength={5000} rows={4} />
                  <button type="submit" disabled={reportSubmitting || !reportForm.reason} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"><Flag className="w-4 h-4" />{reportSubmitting ? 'Submitting…' : 'Submit report'}</button>
                  <p className="text-xs text-slate-500 text-center">Reports are handled under our <a href="/legal/reporting" className="underline" target="_blank" rel="noopener noreferrer">Reporting and Moderation Policy</a>.</p>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ProfileTagSection({ icon, title, items, primary, text, itemIcon }: { icon: React.ReactNode; title: string; items: string[]; primary: string; text: string; itemIcon?: React.ReactNode }) {
  return (
    <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}12` }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: primary }}>{icon}<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: text, opacity: 0.55 }}>{title}</p></div>
      <div className="flex flex-wrap gap-1.5">{items.map((item, index) => <span key={`${item}-${index}`} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: `${primary}12`, color: text }}>{itemIcon}{item}</span>)}</div>
    </section>
  );
}

function TimelineSection({ icon, title, entries, primary, text }: { icon: React.ReactNode; title: string; entries: ExpEntry[]; primary: string; text: string }) {
  return (
    <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}12` }}>
      <div className="flex items-center gap-1.5 mb-3" style={{ color: primary }}>{icon}<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: text, opacity: 0.55 }}>{title}</p></div>
      <div className="space-y-3">{entries.map((entry, index) => <div key={`${entry.title}-${entry.org}-${index}`} className="flex gap-3"><div className="w-1.5 pt-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} /></div><div className="min-w-0"><p className="text-sm font-semibold" style={{ color: text }}>{entry.title}</p>{entry.org && <p className="text-xs mt-0.5" style={{ color: primary }}>{entry.org}</p>}{entry.period && <p className="text-xs mt-0.5" style={{ color: text, opacity: 0.55 }}>{entry.period}</p>}{entry.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: text, opacity: 0.72 }}>{entry.description}</p>}</div></div>)}</div>
    </section>
  );
}

function MenuSection({ title, items, primary, text }: { title: string; items: MenuItem[]; primary: string; text: string }) {
  const categories = useMemo(() => [...new Set(items.map(item => item.category || ''))], [items]);
  return (
    <section className="mb-4 pb-4" style={{ borderBottom: `1px solid ${primary}12` }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: text }}>{title}</h2>
      {categories.map(category => <div key={category || 'uncategorised'} className="mb-3">{category && <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: primary }}>{category}</p>}<div className="space-y-2">{items.filter(item => (item.category || '') === category).map((item, index) => <div key={item.id || `${item.name}-${index}`} className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium" style={{ color: text }}>{item.name}</p>{item.description && <p className="text-xs mt-0.5" style={{ color: text, opacity: 0.65 }}>{item.description}</p>}</div>{item.price && <span className="text-sm font-semibold shrink-0" style={{ color: primary }}>{item.price}</span>}</div>)}</div></div>)}
    </section>
  );
}
