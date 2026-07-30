import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { useState, useEffect, useLayoutEffect } from 'react';
import InstallAppBanner from '@/components/InstallAppBanner';

/**
 * When the app is running as an installed PWA (standalone display mode),
 * the marketing homepage makes no sense — redirect straight to the dashboard.
 * The manifest already sets start_url=/dashboard, but this catches any edge
 * case where the user navigates back to / while in standalone mode.
 */
function usePwaRedirect() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);
}
import {
  QrCode, Link2, Globe, Phone, Mail, BarChart3, Palette,
  Check, ArrowRight, Users, Briefcase,
  Scissors, Wrench, Star, Zap, Shield,
  Layout, UserCheck, Loader2, Building2,
  Share2, ChevronDown, ChevronUp, Megaphone,
  Lock, Smartphone, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─── Shared class helpers ──────────────────────────────────────────────── */
const glass = [
  'bg-card',
  'border border-border',
  'rounded-2xl',
  'shadow-[0_4px_24px_-4px_rgba(37,99,235,0.10)] dark:shadow-[0_4px_24px_-4px_rgba(37,99,235,0.18)]',
].join(' ');

const glassStrong = [
  'bg-card',
  'border border-border',
  'rounded-2xl',
  'shadow-[0_8px_40px_-8px_rgba(37,99,235,0.14),0_2px_8px_-2px_rgba(0,0,0,0.06)]',
  'dark:shadow-[0_8px_40px_-8px_rgba(37,99,235,0.28),0_2px_8px_-2px_rgba(0,0,0,0.30)]',
].join(' ');

const glassHover = 'hover:-translate-y-1 hover:shadow-[0_12px_40px_-8px_rgba(37,99,235,0.20)] dark:hover:shadow-[0_12px_40px_-8px_rgba(37,99,235,0.35)] transition-all duration-300';

/* ─── Demo profile card ──────────────────────────────────────────────────── */
function DemoProfileCard() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="absolute inset-0 rounded-3xl bg-blue-500/20 dark:bg-blue-500/30 blur-3xl scale-110 pointer-events-none" />
      <div className={`relative ${glassStrong} overflow-hidden`}>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-black/4 dark:bg-white/5 border-b border-black/6 dark:border-white/8">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 mx-2 bg-black/6 dark:bg-white/10 rounded-md px-2.5 py-1 text-[10px] text-muted-foreground font-mono truncate">
            japrofilestudio.jagroupservices.co.uk/profile/<span className="text-primary">alex-johnson</span>
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="flex flex-col items-center mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white text-lg font-bold mb-2.5 ring-4 ring-blue-500/20 shadow-lg shadow-blue-500/25">
              AJ
            </div>
            <h3 className="text-foreground font-bold text-sm">Alex Johnson</h3>
            <p className="text-primary text-xs mt-0.5 font-medium">Senior Product Designer</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">JA Group Services Ltd</p>
          </div>
          <div className="space-y-2 mb-4">
            {[
              { icon: <Phone className="w-3 h-3" />, label: '+44 7700 900000' },
              { icon: <Mail className="w-3 h-3" />, label: 'alex@jagroupservices.co.uk' },
              { icon: <Globe className="w-3 h-3" />, label: 'jagroupservices.co.uk' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border border-border">
                <span className="text-primary flex-shrink-0">{item.icon}</span>
                <span className="text-foreground text-[10px] truncate">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-blue-600 rounded-xl py-2 text-center text-white text-[10px] font-semibold shadow-sm shadow-blue-600/30">
              Save Contact
            </div>
            <div className="flex-1 bg-muted rounded-xl py-2 text-center text-muted-foreground text-[10px] font-semibold border border-border">
              Send Enquiry
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Demo business profile card ─────────────────────────────────────────── */
function DemoBusinessCard() {
  return (
    <div className={`relative ${glassStrong} overflow-hidden w-full max-w-[300px]`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-purple-600/6 pointer-events-none" />
      <div className="relative p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/80 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">JA</div>
          <div>
            <p className="text-foreground font-bold text-sm leading-tight">JA Group Services Ltd</p>
            <p className="text-primary text-[10px] mt-0.5">Digital Services & Solutions</p>
          </div>
        </div>
        <div className="space-y-1.5 mb-4">
          {[
            { icon: <Globe className="w-3 h-3" />, label: 'jagroupservices.co.uk' },
            { icon: <Mail className="w-3 h-3" />, label: 'hello@jagroupservices.co.uk' },
            { icon: <Phone className="w-3 h-3" />, label: '+44 7700 900000' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="text-primary">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-blue-600 rounded-lg py-1.5 text-center text-white text-[10px] font-semibold">
            View Profile
          </div>
          <div className="flex-1 bg-muted rounded-lg py-1.5 text-center text-muted-foreground text-[10px] font-semibold border border-border">
            Get Directions
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section badge ──────────────────────────────────────────────────────── */
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 mb-4">
      {children}
    </span>
  );
}

/* ─── Trust strip ────────────────────────────────────────────────────────── */
function TrustStrip() {
  const items = [
    { icon: <Lock className="w-4 h-4" />,       label: 'UK-based & GDPR compliant' },
    { icon: <Shield className="w-4 h-4" />,      label: 'Secure sign-in via JA Group Services ID' },
    { icon: <Smartphone className="w-4 h-4" />,  label: 'Works on any device' },
    { icon: <FileText className="w-4 h-4" />,    label: 'No credit card to get started' },
  ];
  return (
    <div className="border-y border-border bg-muted/20 py-5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-primary">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── FAQ item ───────────────────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${glass} overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-foreground font-semibold text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed border-t border-border/50 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

/* ─── Homepage content type ──────────────────────────────────────────────── */
interface HomepageContent {
  hero_badge: string;
  hero_title_line1: string;
  hero_title_highlight: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link: string;
  announcement_link_label: string;
}

const HOMEPAGE_DEFAULTS: HomepageContent = {
  hero_badge:              'Personal & Business Digital Profiles',
  hero_title_line1:        'Your professional profile,',
  hero_title_highlight:    'ready to share anywhere',
  hero_subtitle:           'JA Profile Studio gives you a personal or business digital profile page with your contact details, links, QR code and everything people need to find and connect with you — all in one place.',
  hero_cta_primary:        'Create Your Profile',
  hero_cta_secondary:      'See how it works',
  stats_users:             '',
  stats_profiles:          '',
  stats_countries:         '',
  stats_uptime:            '',
  announcement_enabled:    false,
  announcement_text:       '',
  announcement_link:       '',
  announcement_link_label: 'Learn more',
};

/* ─── Plan types ─────────────────────────────────────────────────────────── */
interface ApiPlan {
  id: number; name: string; slug: string;
  price_monthly: number; price_yearly: number;
  is_lifetime: boolean;
  max_profiles: number;
  max_org_profiles: number;
  max_seats: number;
  core_features: string[];
  included_features: string[];
  coming_soon_features: string[];
}

const PLAN_META: Record<string, { badge: string | null; highlight: boolean; cta: string; note: string; contactUs?: boolean }> = {
  free:             { badge: null,               highlight: false, cta: 'Create Free Account',  note: 'Free forever. No credit card required.' },
  starter:          { badge: '30-day free trial', highlight: false, cta: 'Start Free Trial',    note: 'Try free for 30 days — no card needed.' },
  professional:     { badge: 'Most popular',      highlight: true,  cta: 'Start Free Trial',    note: 'Try free for 30 days — no card needed.' },
  business:         { badge: '30-day free trial', highlight: false, cta: 'Start Free Trial',    note: 'Try free for 30 days — no card needed.' },
  ultimate_business:{ badge: 'Best value',        highlight: false, cta: 'Start Free Trial',    note: 'Try free for 30 days — no card needed.' },
  ultimate_plus:    { badge: 'Enterprise',        highlight: false, cta: 'Contact Us',          note: 'Tailored pricing — speak to our team.', contactUs: true },
  // lifetime is intentionally omitted — it is not publicly listed
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  usePwaRedirect();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [hpContent, setHpContent] = useState<HomepageContent>(HOMEPAGE_DEFAULTS);

  useEffect(() => {
    fetch('/api/homepage-content')
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setHpContent(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const raw: ApiPlan[] = d.plans ?? [];
          // Ensure ultimate_plus always renders last regardless of server sort
          raw.sort((a, b) => {
            if (a.slug === 'ultimate_plus') return 1;
            if (b.slug === 'ultimate_plus') return -1;
            return (a.price_monthly ?? 0) - (b.price_monthly ?? 0);
          });
          setPlans(raw);
        }
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  const handleTrialCta = (planSlug: string) => {
    // Pass trial intent as URL params — no sessionStorage needed
    navigate(`/login?trial=1&plan=${encodeURIComponent(planSlug)}`);
  };

  const site = 'https://japrofilestudio.jagroupservices.co.uk';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        name: 'JA Profile Studio',
        alternateName: 'JA Profile Studio by JA Group Services',
        url: `${site}/`,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${site}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'JA Profile Studio',
        legalName: 'JA Group Services Ltd',
        url: `${site}/`,
        logo: `${site}/airo-assets/images/logo/main`,
        sameAs: [],
      },
      {
        '@type': 'WebPage', '@id': `${site}/#webpage`, url: `${site}/`,
        name: 'JA Profile Studio | Your Digital Profile, Ready to Share',
        isPartOf: { '@id': `${site}/#website` },
        about: { '@id': `${site}/#organization` },
        datePublished: '2025-01-01', dateModified: '2026-07-12',
      },
    ],
  };

  return (
    <>
    <div className="relative">
      <Helmet>
        <title>JA Profile Studio | Your Digital Profile, Ready to Share</title>
        <meta name="description" content="Create a professional personal or business digital profile with contact details, links and a QR code. Share it anywhere — online, in person or via your unique profile link." />
        <meta property="og:title" content="JA Profile Studio | Your Digital Profile, Ready to Share" />
        <meta property="og:description" content="Create a professional personal or business digital profile with contact details, links and a QR code." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${site}/`} />
        <meta property="og:image" content={`${site}/og-image.png`} />
        <meta property="og:site_name" content="JA Profile Studio" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="JA Profile Studio | Your Digital Profile, Ready to Share" />
        <meta name="twitter:description" content="Create a professional personal or business digital profile with contact details, links and a QR code." />
        <meta name="twitter:image" content={`${site}/og-image.png`} />
        <link rel="canonical" href={`${site}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* ── Ambient background ── */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full bg-blue-300/15 dark:bg-blue-600/15 blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-indigo-300/10 dark:bg-purple-600/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-sky-300/10 dark:bg-blue-800/12 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(hsl(221 83% 53%) 1px, transparent 1px), linear-gradient(90deg, hsl(221 83% 53%) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════════════════════ */}
      <section className="relative pt-20 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">

          {/* Announcement banner */}
          {hpContent.announcement_enabled && hpContent.announcement_text && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary mb-8 max-w-3xl mx-auto">
              <Megaphone className="w-4 h-4 shrink-0" />
              <span className="flex-1">{hpContent.announcement_text}</span>
              {hpContent.announcement_link && hpContent.announcement_link_label && (
                <a href={hpContent.announcement_link} className="font-semibold underline hover:no-underline shrink-0">
                  {hpContent.announcement_link_label}
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' as const }}
              style={{ isolation: 'isolate' }}
            >
              <SectionBadge>{hpContent.hero_badge}</SectionBadge>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-foreground leading-[1.1] tracking-tight mb-6">
                {hpContent.hero_title_line1}{' '}
                <span className="bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">
                  {hpContent.hero_title_highlight}
                </span>
              </h1>
              <p className="text-lg text-foreground/80 leading-relaxed mb-8 max-w-lg font-normal">
                {hpContent.hero_subtitle}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login">
                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xl shadow-blue-600/25 px-7 rounded-xl transition-all duration-200 hover:-translate-y-px"
                  >
                    {hpContent.hero_cta_primary} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted px-7 rounded-xl font-medium">
                    {hpContent.hero_cta_secondary}
                  </Button>
                </a>
              </div>

            </motion.div>

            {/* Right — demo cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' as const }}
              className="relative flex items-center justify-center"
            >
              <div className="relative w-full max-w-sm mx-auto">
                <DemoProfileCard />
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' as const }}
                  className="absolute -bottom-10 -right-4 hidden sm:block z-10"
                >
                  <DemoBusinessCard />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <TrustStrip />

      {/* ══════════════════════════════════════════════════════════
          2. PERSONAL vs BUSINESS
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <SectionBadge>Two profile types</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-3">
              Personal profile or organisation profile — you choose
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto">
              Whether you are an individual sharing your contact details or an organisation presenting your brand, JA Profile Studio has a profile type for you.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className={`${glass} p-7`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-5">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-foreground font-bold text-xl mb-3">Personal Profile</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                Your own digital contact card. Add your name, job title, phone, email, website and social links. Share it with a link or QR code so anyone can save your details instantly.
              </p>
              <ul className="space-y-2.5">
                {[
                  'Your name, photo and job title',
                  'Phone, email and website links',
                  'Social media and booking links',
                  'QR code for in-person sharing',
                  'Save contact / vCard download',
                  'Profile Poster PDF',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Business */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className={`${glass} p-7`}
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 mb-5">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-foreground font-bold text-xl mb-3">Organisation Profile</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                A dedicated profile page for your organisation. Present your brand, services, contact details and team. Ideal for small businesses, agencies and growing teams.
              </p>
              <ul className="space-y-2.5">
                {[
                  'Organisation name, logo and description',
                  'Organisation contact details and address',
                  'Services, links and social media',
                  'Team directory (on Organisation plan)',
                  'Organisation seats for staff members',
                  'Organisation QR code and vCard',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          3. DASHBOARD
      ══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <SectionBadge>Your dashboard</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-3">
              Everything managed from one place
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto">
              Your JA Profile Studio dashboard gives you full control over your profile, links, analytics, messages and settings — all in one clean interface.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Layout className="w-5 h-5" />,    title: 'Profile Editor',          desc: 'Edit your personal or organisation profile details, photo and contact information.' },
              { icon: <Link2 className="w-5 h-5" />,     title: 'Link Manager',            desc: 'Add, reorder and manage all your links — social, booking, website and more.' },
              { icon: <QrCode className="w-5 h-5" />,    title: 'QR Code',                 desc: 'Download your profile QR code to use on displays, printed materials or anywhere you share your details.' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Analytics',               desc: 'See how many people have viewed your profile and which links they clicked.' },
              { icon: <Mail className="w-5 h-5" />,      title: 'Enquiries',               desc: 'Receive contact enquiries from your profile visitors and manage them from your dashboard.' },
              { icon: <Palette className="w-5 h-5" />,   title: 'Themes',                  desc: 'Choose a theme that matches your personal or organisation brand identity.' },
              { icon: <Users className="w-5 h-5" />,     title: 'Organisation Seats',      desc: 'Invite team members to your organisation profile with role-based access control.' },
              { icon: <Shield className="w-5 h-5" />,    title: 'Security',                desc: 'Manage your account security, sessions and privacy settings.' },
              { icon: <Share2 className="w-5 h-5" />,    title: 'Sharing Tools',           desc: 'Share your profile link, QR code or vCard from your dashboard at any time.' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`${glass} ${glassHover} p-5 group cursor-default`}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 group-hover:bg-primary/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-foreground font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          4. HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <SectionBadge>How it works</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Up and running in minutes
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Sign in and create your profile', desc: 'Sign in with your JA Group Services ID. Your account is created automatically. Add your name, contact details and links.' },
              { step: '02', title: 'Share your link or QR code', desc: 'Use your unique profile link or QR code to share your details online, in person, or anywhere you connect with people.' },
              { step: '03', title: 'Manage everything from your dashboard', desc: 'Update your profile, check analytics, manage enquiries and control your settings — all from your dashboard.' },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`${glass} p-7 relative overflow-hidden`}
              >
                <div className="absolute top-3 right-4 text-6xl font-black text-blue-600/6 dark:text-white/5 select-none leading-none">
                  {s.step}
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm mb-4 shadow-lg shadow-blue-600/30">
                  {parseInt(s.step)}
                </div>
                <h3 className="text-foreground font-bold text-base mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          5. WHO IT'S FOR
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <SectionBadge>Who it's for</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Built for professionals, organisations and businesses of all sizes
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <Briefcase className="w-5 h-5" />,  label: 'Organisations & Businesses' },
              { icon: <UserCheck className="w-5 h-5" />,  label: 'Freelancers' },
              { icon: <Scissors className="w-5 h-5" />,   label: 'Barbers & Beauty' },
              { icon: <Wrench className="w-5 h-5" />,     label: 'Tradespeople' },
              { icon: <Star className="w-5 h-5" />,       label: 'Consultants' },
              { icon: <Users className="w-5 h-5" />,      label: 'Sales Professionals' },
              { icon: <Zap className="w-5 h-5" />,        label: 'Creators' },
              { icon: <Globe className="w-5 h-5" />,      label: 'Event Staff' },
            ].map((w, i) => (
              <motion.div
                key={w.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`${glass} ${glassHover} p-5 flex flex-col items-center text-center gap-3 cursor-default`}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  {w.icon}
                </div>
                <span className="text-foreground text-sm font-semibold">{w.label}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-muted-foreground text-sm mt-6">
            And anyone who wants a simple, professional digital contact profile.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          6. PRICING
      ══════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <SectionBadge>Pricing</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground text-base">
              Start free. Upgrade when you need more.
            </p>
          </motion.div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Plan cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch mb-4">
                {plans.filter(p => !p.is_lifetime).map((plan, i) => {
                  const display = PLAN_META[plan.slug] ?? { badge: null, highlight: false, cta: 'Get Started', note: '' };
                  const isEnterprise = plan.slug === 'ultimate_plus';
                  const priceLabel = isEnterprise ? 'Contact us' : plan.price_monthly === 0 ? 'Free' : `£${plan.price_monthly}`;
                  const period = (isEnterprise || plan.price_monthly === 0) ? '' : '/mo';
                  const isPaid = plan.price_monthly > 0 && !isEnterprise;

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: i * 0.07 }}
                      className={`relative flex flex-col rounded-2xl overflow-hidden ${
                        isEnterprise
                          ? 'bg-gradient-to-br from-amber-500/8 to-orange-500/5 border-2 border-amber-500/40 shadow-md shadow-amber-500/10'
                          : display.highlight
                            ? 'bg-blue-600 shadow-2xl shadow-blue-600/30 ring-2 ring-blue-500'
                            : 'bg-card border border-border shadow-md'
                      }`}
                    >
                      {display.badge && (
                        <div className="px-5 pt-4 pb-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isEnterprise
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : display.highlight
                                ? 'bg-white/20 text-white'
                                : 'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {display.badge}
                          </span>
                        </div>
                      )}

                      <div className="p-5 flex flex-col flex-1 gap-4">
                        {/* Name + price */}
                        <div>
                          <h3 className={`font-bold text-base mb-0.5 ${display.highlight ? 'text-white' : 'text-foreground'}`}>
                            {plan.name}
                          </h3>
                          <div className="flex items-baseline gap-0.5">
                            <span className={`text-3xl font-extrabold ${isEnterprise ? 'text-amber-600' : display.highlight ? 'text-white' : 'text-foreground'}`}>
                              {priceLabel}
                            </span>
                            {period && (
                              <span className={`text-sm ml-0.5 ${display.highlight ? 'text-blue-100' : 'text-muted-foreground'}`}>
                                {period}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-1 leading-snug ${display.highlight ? 'text-blue-100' : 'text-muted-foreground'}`}>
                            {display.note}
                          </p>
                        </div>

                        {/* Profile allowance — the key differentiator */}
                        <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          isEnterprise
                            ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                            : display.highlight
                              ? 'bg-white/15 text-white'
                              : 'bg-primary/8 text-primary border border-primary/20'
                        }`}>
                          {(() => {
                            const orgSlots = plan.max_org_profiles ?? 0;
                            const seats = plan.max_seats ?? 1;
                            if (plan.max_profiles === 999) return 'Unlimited profiles';
                            if (orgSlots >= 10) return `1 personal + ${orgSlots} organisation profiles, ${seats} seats`;
                            if (orgSlots >= 4)  return `1 personal + ${orgSlots} organisation profiles`;
                            if (orgSlots === 1)  return '1 personal + 1 organisation profile';
                            return '1 personal profile only';
                          })()}
                        </div>

                        {/* Feature list */}
                        {plan.core_features && plan.core_features.length > 0 && (
                          <ul className="space-y-1.5">
                            {plan.core_features.map((f: string, fi: number) => (
                              <li key={fi} className={`flex items-start gap-1.5 text-xs ${display.highlight ? 'text-blue-100' : 'text-muted-foreground'}`}>
                                <svg className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isEnterprise ? 'text-amber-500' : display.highlight ? 'text-white' : 'text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* CTA */}
                        <div className="mt-auto pt-1">
                          {isEnterprise ? (
                            <a href="mailto:japrofilestudio@jagroupservices.co.uk?subject=Ultimate%20Organisation%2B%20Enquiry" className="block w-full">
                              <Button className="w-full text-sm font-semibold rounded-xl py-2 bg-amber-500 hover:bg-amber-400 text-white shadow-sm shadow-amber-500/20">
                                Get in touch
                              </Button>
                            </a>
                          ) : !isPaid ? (
                            <Link to="/login">
                              <Button className="w-full text-sm font-semibold rounded-xl py-2 bg-muted text-foreground hover:bg-muted/80 border border-border">
                                {display.cta}
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              onClick={() => handleTrialCta(plan.slug)}
                              className={`w-full text-sm font-semibold rounded-xl py-2 ${
                                display.highlight
                                  ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-md'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/20'
                              }`}
                            >
                              {display.cta}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-center text-xs text-muted-foreground mt-5">
                No credit card required to start. Sign in to see the full feature breakdown for each plan.
              </p>
            </>
          )}

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          7. FAQ
      ══════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="space-y-3">
            {[
              { q: 'What is JA Profile Studio?', a: 'JA Profile Studio is a digital profile service that gives you a personal or organisation profile page with your contact details, links, QR code and business information in one place. You can share it online, in person or via your unique profile link.' },
              { q: 'What is the difference between a personal profile and an organisation profile?', a: 'A personal profile is your individual digital contact card — your name, job title, phone, email and links. An organisation profile is a dedicated page for your business or organisation with your brand, services, team and contact details. Both are managed from the same dashboard.' },
              { q: 'What does the dashboard include?', a: 'Your dashboard lets you edit your profile, manage links, download your QR code, view analytics, receive contact enquiries, manage organisation seats (on Organisation plan), choose themes, generate a Profile Poster PDF and control your account settings.' },
              { q: 'Is there a free plan?', a: 'Yes. The Free plan is always free with no expiry. It includes a digital profile page, QR code sharing and basic links. Paid plans include a 30-day free trial — no credit card required to start.' },
              { q: 'Can I use my QR code on physical materials?', a: 'Yes. Download your QR code from the dashboard and use it on any physical material — posters, flyers, name badges, or anywhere you share your contact details.' },
              { q: 'Who can use JA Profile Studio?', a: 'JA Profile Studio is available to UK-based individuals and businesses aged 18 and over. Public profiles can be viewed worldwide.' },
              { q: 'How do I get started?', a: 'Sign in through JA Group Services ID to create your account. Your profile is created automatically on first sign-in — no separate registration needed.' },
              { q: 'Who operates JA Profile Studio?', a: 'JA Profile Studio is a service brand operated by JA Group Services Ltd, a company registered in England and Wales.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <FaqItem q={item.q} a={item.a} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          8. FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={`${glassStrong} p-10 sm:p-14 text-center relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/6 via-transparent to-indigo-600/4 pointer-events-none rounded-2xl" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600 mx-auto mb-6">
                <QrCode className="w-7 h-7" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                Ready to create your digital profile?
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed text-base max-w-xl mx-auto">
                Sign in through JA Group Services ID to get started. Your profile is created automatically on first sign-in. Free to start — no credit card required.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                <Link to="/login">
                  <Button
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xl shadow-blue-600/25 px-8 rounded-xl transition-all duration-200 hover:-translate-y-px"
                  >
                    Create Your Profile <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted px-8 rounded-xl font-medium">
                    Sign in to dashboard
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap justify-center gap-5 pt-6 border-t border-border">
                {['Free to get started', 'No credit card required', 'UK-based service'].map(t => (
                  <div key={t} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
    <InstallAppBanner />
    </>
  );
}
