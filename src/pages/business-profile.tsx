/**
 * Public Business Profile Page
 * Route: /profile/:bizSlug/:personSlug  — person card
 * Route: /profile/:bizSlug              — business landing page (personSlug = "")
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Phone, Mail, Globe, MapPin, Search, Clock, Users, Briefcase,
  Linkedin, Twitter, Instagram, Facebook, Youtube, Github,
  ChevronDown, ChevronUp, Share2, X, Megaphone, Building2,
  MessageCircle, Send, CheckCircle2, BadgeCheck, QrCode,
  Star, Award, ShieldCheck, HelpCircle, CreditCard, CalendarCheck,
  ExternalLink, Image as ImageIcon, Quote, Zap, Flag, AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranding } from '@/lib/branding';

// ─── Types ────────────────────────────────────────────────────────────────

interface GalleryItem { url: string; caption?: string; type?: 'image' | 'video'; }
interface AwardItem { title: string; issuer?: string; year?: string; description?: string; }
interface CertItem { name: string; issuer?: string; year?: string; url?: string; }
interface FaqItem { question: string; answer: string; }
interface TestimonialItem { name: string; role?: string; body: string; rating?: number; }
interface CtaButton { label: string; url: string; style?: 'primary' | 'secondary' | 'outline'; }
interface PaymentMethod { name: string; }
interface FeaturedOffer { title?: string; body?: string; badge?: string; url?: string; }

interface Service {
  name: string;
  description?: string;
  price?: string;
  category?: string;
}

interface TeamMember {
  name: string;
  role?: string;
  bio?: string;
  photo?: string;
  email?: string;
  linkedin?: string;
}

interface Announcement {
  title: string;
  body?: string;
  date?: string;
  tag?: string;
}

interface ProfileLink {
  id: number; type: string; platform: string | null; label: string; url: string; icon: string | null;
}

interface BusinessProfile {
  id: number;
  profile_type: 'business';
  biz_slug: string;
  person_slug: string;
  business_name: string;
  business_tagline: string;
  display_name: string;
  business_description: string;
  business_description_html: string | null;
  business_category: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  profile_photo: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_verified?: boolean;
  opening_hours: string | null;
  services: Service[];
  team_members: TeamMember[];
  announcements: Announcement[];
  social_links: { platform: string; label: string; url: string }[];
  links: ProfileLink[];
  allow_indexing: number;
  seo_title: string | null;
  seo_description: string | null;
  theme_id: number | null;
  theme: { primary_color: string; accent_color: string; background_color: string; text_color: string } | null;
  enquiry_enabled: number;
  plan: { has_contact_form: number; remove_branding: number };
  // Design fields
  business_type?: string;
  layout_preset?: string;
  colour_palette?: string;
  custom_colour?: string;
  button_style?: string;
  // Extended sections
  gallery?: GalleryItem[];
  awards?: AwardItem[];
  certifications?: CertItem[];
  faqs?: FaqItem[];
  testimonials?: TestimonialItem[];
  cta_buttons?: CtaButton[];
  payment_methods?: PaymentMethod[];
  featured_offer?: FeaturedOffer | null;
  booking_link?: string | null;
  map_embed?: string | null;
  // WhatsApp / Menu / PDF feature sections
  whatsapp_url?: string | null;
  whatsapp_label?: string | null;
  whatsapp_enabled?: number;
  menu_items?: string | null;
  menu_enabled?: number;
  menu_title?: string | null;
  pdf_attachments?: string | null;
  pdf_enabled?: number;
}

// ─── Platform icons ───────────────────────────────────────────────────────

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

// ─── Search highlight helper ──────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  // Guard: skip highlight for empty or overly long queries (prevents ReDoS via dynamic RegExp)
  if (!trimmed || trimmed.length > 100) return <>{text}</>;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-orange-500/10 text-foreground rounded px-0.5">{p}</mark>
          : p
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function BusinessProfilePage({ _overrideBizSlug, _overridePersonSlug }: { _overrideBizSlug?: string; _overridePersonSlug?: string } = {}) {
  const params = useParams<{ bizSlug: string; personSlug: string }>();
  const bizSlug = _overrideBizSlug ?? params.bizSlug;
  const personSlug = _overridePersonSlug ?? params.personSlug;
  const branding = useBranding();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Sections expand/collapse
  const [expandedSection, setExpandedSection] = useState<string | null>('services');

  // Contact form
  const [contactForm, setContactForm] = useState({ sender_name: '', sender_email: '', message: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // QR code
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrProfileUrl, setQrProfileUrl] = useState('');

  useEffect(() => {
    if (!bizSlug) return;
    // If no personSlug → fetch business landing page; otherwise fetch person card
    const url = personSlug
      ? `/api/business/${encodeURIComponent(bizSlug)}/${encodeURIComponent(personSlug)}/public`
      : `/api/business/${encodeURIComponent(bizSlug)}/public`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(d => {
        if (d.success) {
          setProfile(d.data);
          // Record a view — uses biz_slug as the identifier; the server resolves it
          // against the profiles table (biz_slug column for business profiles).
          fetch(`/api/analytics/view/${encodeURIComponent(bizSlug)}`, { method: 'POST' }).catch(() => {});
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [bizSlug, personSlug]);

  // ── Search results ──────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!profile || !searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();

    const results: { section: string; label: string; text: string }[] = [];

    // Business info
    if (profile.business_description?.toLowerCase().includes(q)) {
      results.push({ section: 'About', label: 'Business Description', text: profile.business_description });
    }
    if (profile.business_category?.toLowerCase().includes(q)) {
      results.push({ section: 'About', label: 'Category', text: profile.business_category });
    }

    // Services
    profile.services.forEach(s => {
      if (s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)) {
        results.push({ section: 'Services', label: s.name, text: s.description || s.category || '' });
      }
    });

    // Team
    profile.team_members.forEach(m => {
      if (m.name.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q) || m.bio?.toLowerCase().includes(q)) {
        results.push({ section: 'Team', label: m.name, text: m.role || m.bio || '' });
      }
    });

    // Contact
    if (profile.phone?.toLowerCase().includes(q)) results.push({ section: 'Contact', label: 'Phone', text: profile.phone });
    if (profile.email?.toLowerCase().includes(q)) results.push({ section: 'Contact', label: 'Email', text: profile.email });
    if (profile.address?.toLowerCase().includes(q)) results.push({ section: 'Contact', label: 'Address', text: profile.address });

    // Announcements
    profile.announcements.forEach(a => {
      if (a.title.toLowerCase().includes(q) || a.body?.toLowerCase().includes(q)) {
        results.push({ section: 'Updates', label: a.title, text: a.body || '' });
      }
    });

    return results;
  }, [profile, searchQuery]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setFormSubmitting(true);
    setFormError('');
    try {
      const res = await fetch(`/api/enquiries/${profile.biz_slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactForm, _hp: '' }),
      });
      const data = await res.json();
      if (data.success) { setFormSuccess(true); setContactForm({ sender_name: '', sender_email: '', message: '' }); }
      else setFormError(data.error || 'Failed to send enquiry');
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const toggleSection = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  const loadQR = async () => {
    if (qrDataUrl) { setShowQR(true); return; }
    try {
      const slug = bizSlug ?? '';
      const res = await fetch(`/api/qr/public/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.success) {
        setQrDataUrl(data.data.qr_data_url);
        setQrProfileUrl(data.data.profile_url);
      } else {
        setQrDataUrl('');
        setQrProfileUrl(window.location.href);
      }
    } catch {
      setQrDataUrl('');
      setQrProfileUrl(window.location.href);
    }
    setShowQR(true);
  };

  // ── Loading / not found ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Business not found</h1>
        <p className="text-muted-foreground text-center">This business profile doesn't exist or has been removed.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  const socialLinks = [
    // From the business social links editor
    ...profile.social_links.filter(s => s.url).map(s => ({
      id: `sl-${s.platform}`,
      platform: s.platform,
      url: s.url,
      label: s.label || s.platform,
    })),
    // From the links manager (social type)
    ...profile.links.filter(l => l.type === 'social').map(l => ({
      id: `lm-${l.id}`,
      platform: l.platform,
      url: l.url,
      label: l.label,
    })),
  ];
  const otherLinks = profile.links.filter(l => l.type !== 'social');

  // Theme colours — fall back to CSS variable defaults if no theme set
  const themeColors = profile.theme ?? { primary_color: '#3B82F6', accent_color: '#3B82F6', background_color: '#ffffff', text_color: '#0F172A' };
  const tp = themeColors.primary_color;   // primary
  const ta = themeColors.accent_color;    // accent
  const tbg = themeColors.background_color;
  const ttx = themeColors.text_color;

  const canonicalUrl = `${branding.platform_url}/profile/${profile.biz_slug}`;
  const pageTitle = profile.seo_title || profile.business_name;
  const pageDesc = (profile.seo_description || profile.business_description || `${profile.business_name} — digital business profile`).slice(0, 160);
  const ogImage = profile.cover_url || profile.logo_url || `${branding.platform_url}/og-default.png`;

  // Build LocalBusiness / Organization JSON-LD
  const socialUrls = profile.social_links.filter(s => s.url).map(s => s.url);
  const bizJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": profile.business_category ? "LocalBusiness" : "Organization",
    "name": profile.business_name,
    "url": canonicalUrl,
    "description": profile.business_description || undefined,
    ...(profile.business_category && { "category": profile.business_category }),
    ...(profile.phone && { "telephone": profile.phone }),
    ...(profile.email && { "email": profile.email }),
    ...(profile.website && { "sameAs": [profile.website, ...socialUrls] }),
    ...(profile.address && { "address": { "@type": "PostalAddress", "streetAddress": profile.address } }),
    ...(profile.logo_url && { "logo": profile.logo_url }),
    ...(profile.cover_url && { "image": profile.cover_url }),
  };

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} — ${branding.platform_name}`}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonicalUrl} />
        {!!profile.allow_indexing === false && <meta name="robots" content="noindex, nofollow" />}

        {/* Open Graph */}
        <meta property="og:type" content="business.business" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${pageTitle} — ${branding.platform_name}`} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content={branding.platform_name} />

        {/* Twitter / X Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${pageTitle} — ${branding.platform_name}`} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={ogImage} />

        {/* JSON-LD: LocalBusiness / Organization */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bizJsonLd) }} />
      </Helmet>

      <div className="min-h-screen" style={{ backgroundColor: tbg, color: ttx }}>

        {/* ── Cover / Hero ─────────────────────────────────────────────── */}
        <div className="relative h-48 md:h-64 overflow-hidden" style={{ background: `linear-gradient(135deg, ${tp}33, ${ta}1a, transparent)` }}>
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${tbg}cc)` }} />

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="absolute top-4 right-4 flex items-center gap-2 backdrop-blur-sm border rounded-xl px-3 py-2 text-sm transition-colors"
            style={{ backgroundColor: `${tbg}cc`, borderColor: `${tp}30`, color: ttx }}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search this page…</span>
          </button>
        </div>

        {/* ── Profile header ───────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative -mt-16 mb-6 flex items-end gap-4">
            {/* Logo / avatar */}
            <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0">
              <div className="w-full h-full rounded-2xl border-4 flex items-center justify-center overflow-hidden shadow-xl" style={{ borderColor: tbg, backgroundColor: `${tp}15` }}>
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt={profile.business_name} className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-10 h-10" style={{ color: tp }} />
                )}
              </div>
              {profile.is_verified && (
                <div className="absolute -bottom-1 -left-1 flex items-center gap-1 bg-white dark:bg-gray-900 rounded-full pl-0.5 pr-2 py-0.5 shadow-md border border-blue-100 dark:border-blue-800">
                  <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 leading-none">Verified</span>
                </div>
              )}
            </div>
            <div className="pb-2 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight truncate" style={{ color: ttx }}>
                {profile.business_name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: `${ttx}99` }}>{profile.display_name}</p>
              {profile.business_category && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${tp}20`, color: tp }}>
                  {profile.business_category}
                </span>
              )}
              {profile.business_tagline && (
                <p className="text-xs mt-1 italic" style={{ color: `${ttx}80` }}>{profile.business_tagline}</p>
              )}
            </div>
          </div>

          {/* ── Standard profile content ──────────────────────────────── */}
          <>

          {/* Description */}
          {profile.business_description_html ? (
            <div
              className="text-sm leading-relaxed mb-6 prose prose-sm max-w-none"
              style={{ color: `${ttx}99` }}
              dangerouslySetInnerHTML={{ __html: profile.business_description_html }}
            />
          ) : profile.business_description ? (
            <p className="text-sm leading-relaxed mb-6" style={{ color: `${ttx}99` }}>
              {profile.business_description}
            </p>
          ) : null}

          {/* Quick contact row */}
          <div className="flex flex-wrap gap-2 mb-6">
            {profile.phone && (
              <a href={`tel:${profile.phone}`}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors border"
                style={{ backgroundColor: `${tp}10`, borderColor: `${tp}30`, color: ttx }}>
                <Phone className="w-3.5 h-3.5" style={{ color: tp }} /> {profile.phone}
              </a>
            )}
            {profile.email && (
              <a href={`mailto:${profile.email}`}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors border"
                style={{ backgroundColor: `${tp}10`, borderColor: `${tp}30`, color: ttx }}>
                <Mail className="w-3.5 h-3.5" style={{ color: tp }} /> {profile.email}
              </a>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors border"
                style={{ backgroundColor: `${tp}10`, borderColor: `${tp}30`, color: ttx }}>
                <Globe className="w-3.5 h-3.5" style={{ color: tp }} /> Website
              </a>
            )}
            {profile.address && (
              <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border"
                style={{ backgroundColor: `${tp}08`, borderColor: `${tp}20`, color: `${ttx}99` }}>
                <MapPin className="w-3.5 h-3.5" style={{ color: tp }} /> {profile.address}
              </div>
            )}
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div className="flex gap-2 mb-6">
              {socialLinks.map(link => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${tp}10`, borderColor: `${tp}30`, color: tp }}>
                  <PlatformIcon platform={link.platform} className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}

          {/* ── Announcements ─────────────────────────────────────────── */}
          {profile.announcements.length > 0 && (
            <Section
              icon={<Megaphone className="w-4 h-4" style={{ color: tp }} />}
              title="Updates & Announcements"
              sectionKey="announcements"
              expanded={expandedSection === 'announcements'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="space-y-3">
                {profile.announcements.map((a, i) => (
                  <div key={i} className="rounded-xl p-4 border" style={{ backgroundColor: `${tp}08`, borderColor: `${tp}20` }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: ttx }}>{a.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {a.tag && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${tp}20`, color: tp }}>{a.tag}</span>}
                        {a.date && <span className="text-xs" style={{ color: `${ttx}80` }}>{a.date}</span>}
                      </div>
                    </div>
                    {a.body && <p className="text-sm" style={{ color: `${ttx}99` }}>{a.body}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Services ──────────────────────────────────────────────── */}
          {profile.services.length > 0 && (
            <Section
              icon={<Briefcase className="w-4 h-4" style={{ color: tp }} />}
              title="Services & Products"
              sectionKey="services"
              expanded={expandedSection === 'services'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="grid sm:grid-cols-2 gap-3">
                {profile.services.map((s, i) => (
                  <div key={i} className="rounded-xl p-4 border" style={{ backgroundColor: `${tp}08`, borderColor: `${tp}20` }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: ttx }}>{s.name}</p>
                      {s.price && (
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: tp }}>{s.price}</span>
                      )}
                    </div>
                    {s.category && (
                      <span className="inline-block text-xs px-1.5 py-0.5 rounded mb-1" style={{ backgroundColor: `${tp}15`, color: tp }}>{s.category}</span>
                    )}
                    {s.description && (
                      <p className="text-xs leading-relaxed" style={{ color: `${ttx}99` }}>{s.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Team ──────────────────────────────────────────────────── */}
          {profile.team_members.length > 0 && (
            <Section
              icon={<Users className="w-4 h-4" style={{ color: tp }} />}
              title="Our Team"
              sectionKey="team"
              expanded={expandedSection === 'team'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="grid sm:grid-cols-2 gap-3">
                {profile.team_members.map((m, i) => (
                  <div key={i} className="rounded-xl p-4 flex items-start gap-3 border" style={{ backgroundColor: `${tp}08`, borderColor: `${tp}20` }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: `${tp}20` }}>
                      {m.photo
                        ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                        : <span className="font-bold text-sm" style={{ color: tp }}>{(m.name || '?').charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: ttx }}>{m.name}</p>
                      {m.role && <p className="text-xs" style={{ color: tp }}>{m.role}</p>}
                      {m.bio && <p className="text-xs mt-1 leading-relaxed" style={{ color: `${ttx}99` }}>{m.bio}</p>}
                      <div className="flex gap-2 mt-2">
                        {m.email && (
                          <a href={`mailto:${m.email}`} style={{ color: `${ttx}80` }}>
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {m.linkedin && (
                          <a href={m.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: `${ttx}80` }}>
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Opening hours ─────────────────────────────────────────── */}
          {profile.opening_hours && (
            <Section
              icon={<Clock className="w-4 h-4" style={{ color: tp }} />}
              title="Opening Hours"
              sectionKey="hours"
              expanded={expandedSection === 'hours'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: `${ttx}99` }}>
                {profile.opening_hours}
              </pre>
            </Section>
          )}

          {/* ── Other links ───────────────────────────────────────────── */}
          {otherLinks.length > 0 && (
            <Section
              icon={<Globe className="w-4 h-4" style={{ color: tp }} />}
              title="Links"
              sectionKey="links"
              expanded={expandedSection === 'links'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="space-y-2">
                {otherLinks.map(link => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors group border"
                    style={{ backgroundColor: `${tp}08`, borderColor: `${tp}20`, color: ttx }}>
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={link.platform} className="w-4 h-4" />
                      <span style={{ color: tp }}>{link.label}</span>
                    </div>
                    <Globe className="w-3.5 h-3.5" style={{ color: `${ttx}60` }} />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* ── Featured Offer Banner ─────────────────────────────────── */}
          {profile.featured_offer?.title && (
            <div className="rounded-2xl p-4 mb-6 border-2" style={{ backgroundColor: `${tp}10`, borderColor: `${tp}30` }}>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: tp }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold" style={{ color: ttx }}>{profile.featured_offer.title}</p>
                    {profile.featured_offer.badge && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: tp, color: '#fff' }}>
                        {profile.featured_offer.badge}
                      </span>
                    )}
                  </div>
                  {profile.featured_offer.body && (
                    <p className="text-sm" style={{ color: `${ttx}99` }}>{profile.featured_offer.body}</p>
                  )}
                  {profile.featured_offer.url && (
                    <a href={profile.featured_offer.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium" style={{ color: tp }}>
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Booking link ──────────────────────────────────────────── */}
          {profile.booking_link && (
            <div className="mb-6">
              <a href={profile.booking_link} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: tp }}>
                <CalendarCheck className="w-4 h-4" /> Book an Appointment
              </a>
            </div>
          )}

          {/* ── CTA Buttons ───────────────────────────────────────────── */}
          {(profile.cta_buttons?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2 mb-6">
              {profile.cta_buttons!.map((btn, i) => (
                <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                  style={
                    btn.style === 'outline'
                      ? { border: `2px solid ${tp}`, color: tp, backgroundColor: 'transparent' }
                      : btn.style === 'secondary'
                      ? { backgroundColor: `${tp}15`, color: tp }
                      : { backgroundColor: tp, color: '#fff' }
                  }>
                  {btn.label} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          )}

          {/* ── WhatsApp button ───────────────────────────────────────── */}
          {!!profile.whatsapp_enabled && profile.whatsapp_url && (
            <div className="mb-6">
              <a
                href={profile.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.847L0 24l6.335-1.508A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.371l-.36-.213-3.727.977.994-3.634-.234-.374A9.818 9.818 0 1112 21.818z"/>
                </svg>
                {profile.whatsapp_label || 'Message on WhatsApp'}
              </a>
            </div>
          )}

          {/* ── Menu / Price List ─────────────────────────────────────── */}
          {!!profile.menu_enabled && profile.menu_items && (() => {
            try {
              const items: { id: string; category: string; name: string; description: string; price: string }[] =
                typeof profile.menu_items === 'string' ? JSON.parse(profile.menu_items) : profile.menu_items as unknown as typeof items;
              const valid = items.filter(i => i.name);
              if (!valid.length) return null;
              const cats = [...new Set(valid.map(i => i.category || ''))];
              return (
                <Section
                  icon={<Briefcase className="w-4 h-4" style={{ color: tp }} />}
                  title={profile.menu_title || 'Menu / Price List'}
                  sectionKey="menu"
                  expanded={expandedSection === 'menu'}
                  onToggle={toggleSection}
                  tp={tp} ttx={ttx}
                >
                  {cats.map(cat => (
                    <div key={cat} className="mb-4 last:mb-0">
                      {cat && (
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: tp }}>{cat}</p>
                      )}
                      <div className="space-y-2">
                        {valid.filter(i => (i.category || '') === cat).map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 rounded-xl p-3 border" style={{ backgroundColor: `${tp}06`, borderColor: `${tp}15` }}>
                            <div className="min-w-0">
                              <p className="text-sm font-medium" style={{ color: ttx }}>{item.name}</p>
                              {item.description && (
                                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: `${ttx}80` }}>{item.description}</p>
                              )}
                            </div>
                            {item.price && (
                              <span className="text-sm font-bold flex-shrink-0" style={{ color: tp }}>{item.price}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </Section>
              );
            } catch { return null; }
          })()}

          {/* ── PDF Attachments ───────────────────────────────────────── */}
          {!!profile.pdf_enabled && profile.pdf_attachments && (() => {
            try {
              const items: { id: string; label: string; url: string; description: string }[] =
                typeof profile.pdf_attachments === 'string' ? JSON.parse(profile.pdf_attachments) : profile.pdf_attachments as unknown as typeof items;
              const valid = items.filter(i => i.url && i.label);
              if (!valid.length) return null;
              return (
                <Section
                  icon={<ExternalLink className="w-4 h-4" style={{ color: tp }} />}
                  title="Documents"
                  sectionKey="pdfs"
                  expanded={expandedSection === 'pdfs'}
                  onToggle={toggleSection}
                  tp={tp} ttx={ttx}
                >
                  <div className="space-y-2">
                    {valid.map((item, idx) => (
                      <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl p-3 border transition-opacity hover:opacity-80"
                        style={{ backgroundColor: `${tp}08`, borderColor: `${tp}20` }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tp}20` }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ color: tp }}>
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: ttx }}>{item.label}</p>
                          {item.description && (
                            <p className="text-xs truncate" style={{ color: `${ttx}70` }}>{item.description}</p>
                          )}
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0" style={{ color: tp }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </a>
                    ))}
                  </div>
                </Section>
              );
            } catch { return null; }
          })()}

          {/* ── Gallery ───────────────────────────────────────────────── */}
          {(profile.gallery?.length ?? 0) > 0 && (
            <Section
              icon={<ImageIcon className="w-4 h-4" style={{ color: tp }} />}
              title="Gallery"
              sectionKey="gallery"
              expanded={expandedSection === 'gallery'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="grid grid-cols-2 gap-2">
                {profile.gallery!.map((g, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: `${tp}20` }}>
                    {g.type === 'video' ? (
                      <video src={g.url} className="w-full h-32 object-cover" controls />
                    ) : (
                      <img src={g.url} alt={g.caption || `Gallery ${i + 1}`} className="w-full h-32 object-cover" />
                    )}
                    {g.caption && (
                      <p className="text-xs px-2 py-1" style={{ color: `${ttx}80` }}>{g.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Testimonials ──────────────────────────────────────────── */}
          {(profile.testimonials?.length ?? 0) > 0 && (
            <Section
              icon={<Quote className="w-4 h-4" style={{ color: tp }} />}
              title="What Our Customers Say"
              sectionKey="testimonials"
              expanded={expandedSection === 'testimonials'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="space-y-3">
                {profile.testimonials!.map((t, i) => (
                  <div key={i} className="rounded-xl p-4 border" style={{ backgroundColor: `${tp}06`, borderColor: `${tp}20` }}>
                    {t.rating && (
                      <div className="flex gap-0.5 mb-2">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className="w-3.5 h-3.5" style={{ color: s <= t.rating! ? '#f59e0b' : `${ttx}20`, fill: s <= t.rating! ? '#f59e0b' : 'none' }} />
                        ))}
                      </div>
                    )}
                    <p className="text-sm italic leading-relaxed mb-2" style={{ color: `${ttx}99` }}>"{t.body}"</p>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: ttx }}>{t.name}</p>
                      {t.role && <p className="text-xs" style={{ color: `${ttx}70` }}>{t.role}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Awards ────────────────────────────────────────────────── */}
          {(profile.awards?.length ?? 0) > 0 && (
            <Section
              icon={<Award className="w-4 h-4" style={{ color: tp }} />}
              title="Awards & Recognition"
              sectionKey="awards"
              expanded={expandedSection === 'awards'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="space-y-2">
                {profile.awards!.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl p-3 border" style={{ backgroundColor: `${tp}06`, borderColor: `${tp}20` }}>
                    <Star className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: ttx }}>{a.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {a.issuer && <span className="text-xs" style={{ color: tp }}>{a.issuer}</span>}
                        {a.year && <span className="text-xs" style={{ color: `${ttx}60` }}>{a.year}</span>}
                      </div>
                      {a.description && <p className="text-xs mt-1" style={{ color: `${ttx}80` }}>{a.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Certifications ────────────────────────────────────────── */}
          {(profile.certifications?.length ?? 0) > 0 && (
            <Section
              icon={<ShieldCheck className="w-4 h-4" style={{ color: tp }} />}
              title="Certifications & Accreditations"
              sectionKey="certifications"
              expanded={expandedSection === 'certifications'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="flex flex-wrap gap-2">
                {profile.certifications!.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2 border" style={{ backgroundColor: `${tp}08`, borderColor: `${tp}25` }}>
                    <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tp }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: ttx }}>{c.name}</p>
                      {c.issuer && <p className="text-[11px]" style={{ color: `${ttx}70` }}>{c.issuer}{c.year ? ` · ${c.year}` : ''}</p>}
                    </div>
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: `${ttx}50` }}>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Payment Methods ───────────────────────────────────────── */}
          {(profile.payment_methods?.length ?? 0) > 0 && (
            <Section
              icon={<CreditCard className="w-4 h-4" style={{ color: tp }} />}
              title="Payment Methods"
              sectionKey="payment"
              expanded={expandedSection === 'payment'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="flex flex-wrap gap-2">
                {profile.payment_methods!.map((pm, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
                    style={{ backgroundColor: `${tp}10`, borderColor: `${tp}25`, color: ttx }}>
                    <CreditCard className="w-3 h-3" style={{ color: tp }} />
                    {pm.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* ── FAQs ──────────────────────────────────────────────────── */}
          {(profile.faqs?.length ?? 0) > 0 && (
            <Section
              icon={<HelpCircle className="w-4 h-4" style={{ color: tp }} />}
              title="Frequently Asked Questions"
              sectionKey="faqs"
              expanded={expandedSection === 'faqs'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="space-y-2">
                {profile.faqs!.map((faq, i) => (
                  <details key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: `${tp}20` }}>
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium select-none"
                      style={{ backgroundColor: `${tp}08`, color: ttx }}>
                      {faq.question}
                    </summary>
                    <div className="px-4 py-3 text-sm" style={{ color: `${ttx}99`, backgroundColor: `${tp}04` }}>
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}

          {/* ── Map ───────────────────────────────────────────────────── */}
          {profile.map_embed && profile.map_embed.startsWith('https://www.google.com/maps/embed') && (
            <Section
              icon={<MapPin className="w-4 h-4" style={{ color: tp }} />}
              title="Find Us"
              sectionKey="map"
              expanded={expandedSection === 'map'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${tp}20` }}>
                <iframe
                  src={profile.map_embed}
                  width="100%"
                  height="280"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Business location"
                />
              </div>
            </Section>
          )}

          {/* ── Contact form — only shown when enquiry is enabled by the profile owner ── */}
          {!!profile.enquiry_enabled && profile.plan.has_contact_form ? (
            <Section
              icon={<MessageCircle className="w-4 h-4" style={{ color: tp }} />}
              title="Send an Enquiry"
              sectionKey="contact"
              expanded={expandedSection === 'contact'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              {formSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <p className="text-sm font-semibold" style={{ color: ttx }}>Enquiry sent!</p>
                  <p className="text-xs" style={{ color: `${ttx}80` }}>We'll get back to you as soon as possible.</p>
                  <button onClick={() => setFormSuccess(false)} className="text-xs hover:underline" style={{ color: tp }}>Send another</button>
                </div>
              ) : (
                <form onSubmit={submitContact} className="space-y-3">
                  <Input
                    placeholder="Your name"
                    value={contactForm.sender_name}
                    onChange={e => setContactForm(f => ({ ...f, sender_name: e.target.value }))}
                    required
                    className="bg-background border-border"
                  />
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={contactForm.sender_email}
                    onChange={e => setContactForm(f => ({ ...f, sender_email: e.target.value }))}
                    required
                    className="bg-background border-border"
                  />
                  <Textarea
                    placeholder="Your message…"
                    value={contactForm.message}
                    onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                    required
                    rows={4}
                    className="bg-background border-border resize-none"
                  />
                  {formError && <p className="text-xs text-destructive">{formError}</p>}
                  <button type="submit" disabled={formSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{ backgroundColor: tp, color: '#ffffff' }}>
                    <Send className="w-4 h-4" />
                    {formSubmitting ? 'Sending…' : 'Send Enquiry'}
                  </button>
                </form>
              )}
            </Section>
          ) : !profile.enquiry_enabled && profile.email ? (
            <Section
              icon={<Mail className="w-4 h-4" style={{ color: tp }} />}
              title="Get in Touch"
              sectionKey="contact"
              expanded={expandedSection === 'contact'}
              onToggle={toggleSection}
              tp={tp} ttx={ttx}
            >
              <p className="text-xs mb-3" style={{ color: `${ttx}80` }}>
                Send an email directly to {profile.business_name}.
              </p>
              <a
                href={`mailto:${profile.email}`}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: tp, color: '#ffffff' }}
              >
                <Mail className="w-4 h-4" />
                Email {profile.business_name}
              </a>
            </Section>
          ) : null}

          {/* Share + QR buttons */}
          <div className="flex items-center gap-4 py-6 mt-4 border-t" style={{ borderColor: `${tp}20` }}>
            <button
              onClick={() => navigator.share?.({ title: profile.business_name, url: window.location.href })
                .catch(() => navigator.clipboard.writeText(window.location.href))}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: `${ttx}80` }}
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <button
              onClick={loadQR}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: `${ttx}80` }}
            >
              <QrCode className="w-3.5 h-3.5" /> QR code
            </button>
          </div>

          {/* QR code modal */}
          {showQR && (
            <div
              className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
              onClick={() => setShowQR(false)}
            >
              <div
                className="rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl"
                style={{ backgroundColor: '#ffffff' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Scan QR Code</h3>
                  <button
                    onClick={() => setShowQR(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="rounded-2xl p-4 mb-4 inline-block bg-white" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-44 h-44 mx-auto block" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-gray-400 text-xs">
                      QR unavailable
                    </div>
                  )}
                </div>
                <div className="rounded-xl px-3 py-2 text-left bg-gray-50 border border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Profile URL</p>
                  <p className="text-xs text-gray-700 font-mono break-all">{qrProfileUrl || window.location.href}</p>
                </div>
              </div>
            </div>
          )}

          </>

          {/*
            ══════════════════════════════════════════════════════════════════
            PLATFORM-CONTROLLED SAFETY & LEGAL LAYER
            ──────────────────────────────────────────────────────────────────
            Rendered OUTSIDE the user-editable container. Cannot be removed,
            hidden, or overridden because:
              1. It is rendered after the profile content in DOM order
              2. The report button uses z-[9999] and pointer-events-auto
              3. Legal footer uses platform-controlled classes
            ══════════════════════════════════════════════════════════════════
          */}

          {/* Platform branding */}
          {!profile.plan.remove_branding && (
            <div className="text-center mt-4 mb-2">
              <Link to="/" className="inline-flex items-center gap-1.5 text-xs opacity-50 hover:opacity-70 transition-opacity" style={{ color: ttx }}>
                Powered by {branding.platform_name || 'JA Profile Studio'}
              </Link>
            </div>
          )}

          {/* Platform-controlled legal footer */}
          <div
            className="legal-footer platform-legal-footer mt-3 mb-4 px-2"
            data-platform-legal-footer="1"
            style={{ position: 'relative', zIndex: 9990 }}
          >
            <p className="text-center text-[10px] mb-2" style={{ color: ttx, opacity: 0.45 }}>
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
                  style={{ color: ttx, opacity: 0.4 }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

        </div>{/* end max-w-3xl */}
      </div>{/* end min-h-screen */}

      {/* ── Fixed Report button — always visible, always on top ─────────── */}
      <ReportButton bizSlug={profile.biz_slug} businessName={profile.business_name} />


      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder={`Search ${profile.business_name}…`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {!searchQuery.trim() ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Type to search services, team, contact details, and more…
                </div>
              ) : searchResults && searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results for "<strong>{searchQuery}</strong>"
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {searchResults?.map((r, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${tp}20`, color: tp }}>{r.section}</span>
                        <span className="text-sm font-medium" style={{ color: ttx }}>
                          <Highlight text={r.label} query={searchQuery} />
                        </span>
                      </div>
                      {r.text && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          <Highlight text={r.text} query={searchQuery} />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────

function Section({
  icon, title, sectionKey, expanded, onToggle, children, tp, ttx,
}: {
  icon: React.ReactNode;
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  tp?: string;
  ttx?: string;
}) {
  const primary = tp ?? '#3B82F6';
  const text = ttx ?? '#0F172A';
  return (
    <div className="mb-4 rounded-2xl overflow-hidden border" style={{ backgroundColor: `${primary}05`, borderColor: `${primary}25` }}>
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
        style={{ color: text }}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          {icon}
          {title}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4" style={{ color: `${text}60` }} />
          : <ChevronDown className="w-4 h-4" style={{ color: `${text}60` }} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t pt-3" style={{ borderColor: `${primary}20` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Platform-controlled Report button ───────────────────────────────────────
// Fixed bottom-right, always on top (z-[9999]), cannot be hidden by custom CSS.

function ReportButton({ bizSlug, businessName }: { bizSlug: string; businessName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    try {
      await fetch('/api/profiles/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_type: 'business',
          biz_slug: bizSlug,
          reason,
          details,
          reported_url: window.location.href,
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true); // fail silently — don't expose errors
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Fixed pill — always visible */}
      <button
        onClick={() => setOpen(true)}
        className="report-pill fixed bottom-4 right-4 z-[9999] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-background/90 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all shadow-lg pointer-events-auto"
        data-report-button="1"
        aria-label="Report this profile"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        Report
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
            {submitted ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="font-semibold text-foreground mb-1">Report submitted</h3>
                <p className="text-sm text-muted-foreground mb-4">Thank you. Our team will review this profile.</p>
                <button onClick={() => { setOpen(false); setSubmitted(false); setReason(''); setDetails(''); }} className="text-sm text-primary hover:underline">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-0.5">Report this profile</h3>
                  <p className="text-xs text-muted-foreground">{businessName}</p>
                </div>
                <div className="space-y-2">
                  {['Spam or misleading', 'Harmful or dangerous content', 'Impersonation', 'Illegal content', 'Other'].map(r => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-primary" />
                      <span className="text-sm text-foreground">{r}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  placeholder="Additional details (optional)"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button type="submit" disabled={!reason || submitting} className="flex-1 rounded-xl bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 transition-opacity">
                    {submitting ? 'Submitting…' : 'Submit report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
