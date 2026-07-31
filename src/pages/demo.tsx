import { demo } from 'virtual:content';
/**
 * Public Demo Page — /demo
 *
 * A fully public, no-login-required showcase of the Profile Centre platform.
 * Visitors can explore what the platform looks like and what it does.
 * Links to /login (sign up / create account) as the conversion CTA.
 */
import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FlaskConical, User, Building2, QrCode, Mail, Link2, BarChart3,
  ArrowRight, CheckCircle2, Star, Globe, Smartphone, Shield,
  ChevronDown, ChevronUp, Zap, Eye, Share2, CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// ── Mock profile data ─────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  name: 'Alex Johnson',
  title: 'Product Designer & UX Consultant',
  company: 'Freelance',
  location: 'London, UK',
  bio: 'Helping startups and scale-ups design products people actually love. 8+ years in UX, previously at Google and Monzo.',
  avatar: 'AJ',
  links: [
    { label: 'Portfolio', url: 'alexjohnson.design', icon: Globe },
    { label: 'LinkedIn', url: 'linkedin.com/in/alexjohnson', icon: Share2 },
    { label: 'Book a call', url: 'cal.com/alexjohnson', icon: Smartphone },
  ],
  stats: { views: '1,247', shares: '89', qr_scans: '312' },
};

const MOCK_BUSINESS = {
  name: 'Bright & Co. Solicitors',
  tagline: 'Expert legal advice for individuals and businesses',
  location: 'Manchester, UK',
  services: ['Conveyancing', 'Employment Law', 'Commercial Contracts', 'Wills & Probate'],
  rating: 4.9,
  reviews: 127,
};

// ── Feature tabs ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: 'personal',
    icon: <User className="w-4 h-4" />,
    label: 'Personal Profile',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    headline: 'Your professional identity, always ready to share',
    description: 'A clean, mobile-first profile page with your photo, bio, contact details, and links — all in one place. Share it via QR code, link, or NFC.',
    preview: 'personal',
  },
  {
    id: 'business',
    icon: <Building2 className="w-4 h-4" />,
    label: 'Business Profile',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    headline: 'A full business page — no website needed',
    description: 'Services, gallery, team members, FAQs, opening hours, and reviews. Everything a customer needs to trust and contact you.',
    preview: 'business',
  },
  {
    id: 'qr',
    icon: <QrCode className="w-4 h-4" />,
    label: 'QR Code',
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    headline: 'Instant sharing with a scannable QR code',
    description: 'Every profile gets a unique QR code. Download it for business cards, email footers, shop windows, or anywhere you want people to find you.',
    preview: 'qr',
  },
  {
    id: 'email',
    icon: <Mail className="w-4 h-4" />,
    label: 'Email Signature',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    headline: 'Turn every email into a networking opportunity',
    description: 'Generate a professional email signature that links directly to your profile. Works with Gmail, Outlook, Apple Mail, and more.',
    preview: 'email',
  },
  {
    id: 'analytics',
    icon: <BarChart3 className="w-4 h-4" />,
    label: 'Analytics',
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    headline: 'See who\'s viewing and sharing your profile',
    description: 'Track profile views, link clicks, QR scans, and shares. Understand what\'s working and where your audience is coming from.',
    preview: 'analytics',
  },
];

// ── Preview components ────────────────────────────────────────────────────────

function PersonalPreview() {
  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-xl max-w-sm mx-auto">
      {/* Cover */}
      <div className="h-20 bg-gradient-to-r from-blue-600 to-indigo-600" />
      {/* Avatar */}
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between -mt-8 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold border-4 border-background shadow-lg">
            {MOCK_PROFILE.avatar}
          </div>
          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">Available</Badge>
        </div>
        <h3 className="font-bold text-foreground text-base">{MOCK_PROFILE.name}</h3>
        <p className="text-sm text-muted-foreground">{MOCK_PROFILE.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{MOCK_PROFILE.location}</p>
        <p className="text-xs text-foreground/70 mt-3 leading-relaxed">{MOCK_PROFILE.bio}</p>
        <div className="mt-4 space-y-2">
          {MOCK_PROFILE.links.map(l => (
            <div key={l.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
              <l.icon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground">{l.label}</span>
              <span className="text-xs text-muted-foreground ml-auto truncate">{l.url}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-border">
          {Object.entries(MOCK_PROFILE.stats).map(([k, v]) => (
            <div key={k} className="text-center">
              <p className="text-sm font-bold text-foreground">{v}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{k.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BusinessPreview() {
  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-xl max-w-sm mx-auto">
      <div className="h-20 bg-gradient-to-r from-purple-600 to-violet-600" />
      <div className="px-5 pb-5">
        <div className="-mt-8 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-xl font-bold border-4 border-background shadow-lg">
            B&amp;C
          </div>
        </div>
        <h3 className="font-bold text-foreground text-base">{MOCK_BUSINESS.name}</h3>
        <p className="text-sm text-muted-foreground">{MOCK_BUSINESS.tagline}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{MOCK_BUSINESS.location}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="text-xs font-semibold text-foreground">{MOCK_BUSINESS.rating}</span>
          <span className="text-xs text-muted-foreground">({MOCK_BUSINESS.reviews} reviews)</span>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold text-foreground mb-2">Services</p>
          <div className="flex flex-wrap gap-1.5">
            {MOCK_BUSINESS.services.map(s => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{s}</span>
            ))}
          </div>
        </div>
        <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white text-sm h-9 rounded-xl">
          Get in touch
        </Button>
      </div>
    </div>
  );
}

function QrPreview() {
  return (
    <div className="bg-background rounded-2xl border border-border p-6 shadow-xl max-w-sm mx-auto text-center">
      <div className="w-40 h-40 mx-auto bg-foreground rounded-xl flex items-center justify-center mb-4">
        {/* Stylised QR placeholder */}
        <div className="grid grid-cols-7 gap-0.5 p-2">
          {[...Array(49)].map((_, i) => {
            const corners = [0,1,2,3,4,5,6,7,13,14,20,21,27,28,34,35,41,42,43,44,45,46,47,48];
            const inner = [8,9,10,15,16,17,22,23,24];
            const filled = corners.includes(i) || inner.includes(i) || Math.random() > 0.5;
            return <div key={i} className={`w-2 h-2 rounded-[1px] ${filled ? 'bg-background' : 'bg-foreground'}`} />;
          })}
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground">Alex Johnson</p>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4">japrofilestudio.co.uk/profile/alexj</p>
      <div className="flex gap-2 justify-center">
        <div className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground">PNG</div>
        <div className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground">SVG</div>
        <div className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground">PDF</div>
      </div>
    </div>
  );
}

function EmailPreview() {
  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-xl max-w-sm mx-auto">
      <div className="bg-muted/50 border-b border-border px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-xs text-muted-foreground ml-1">Email preview</span>
      </div>
      <div className="p-5">
        <p className="text-xs text-muted-foreground mb-3">Hi Sarah,<br />Please find the proposal attached...</p>
        <div className="border-t border-border pt-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
            AJ
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{MOCK_PROFILE.name}</p>
            <p className="text-xs text-muted-foreground">{MOCK_PROFILE.title}</p>
            <p className="text-xs text-primary mt-0.5 underline">View my profile →</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPreview() {
  const bars = [40, 65, 45, 80, 55, 90, 70];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="bg-background rounded-2xl border border-border p-5 shadow-xl max-w-sm mx-auto">
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Profile views', value: '1,247', delta: '+12%' },
          { label: 'Link clicks', value: '389', delta: '+8%' },
          { label: 'QR scans', value: '312', delta: '+24%' },
        ].map(s => (
          <div key={s.label} className="bg-muted/50 rounded-xl p-2.5 border border-border">
            <p className="text-base font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
            <p className="text-[10px] text-green-400 mt-0.5">{s.delta}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {demo.bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t-sm bg-primary/70" style={{ height: `${h}%` }} />
            <span className="text-[9px] text-muted-foreground">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEWS: Record<string, React.ReactNode> = {
  personal: <PersonalPreview />,
  business: <BusinessPreview />,
  qr: <QrPreview />,
  email: <EmailPreview />,
  analytics: <AnalyticsPreview />,
};

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-medium text-foreground pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicDemoPage() {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0]);

  return (
    <>
      <Helmet>
        <title>See How It Works — Profile Centre Demo</title>
        <meta name="description" content="Explore Profile Centre — personal and business digital profiles, QR codes, email signatures, and analytics. No login required." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/demo" />
        <meta property="og:title" content="See How It Works — Profile Centre Demo" />
        <meta property="og:description" content="Explore Profile Centre — personal and business digital profiles, QR codes, email signatures, and analytics." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://japrofilestudio.jagroupservices.co.uk/demo" />
      </Helmet>

      <main className="min-h-screen bg-background">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
          <div className="max-w-5xl mx-auto px-5 py-16 md:py-24 text-center relative">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-5 gap-1.5 px-3 py-1">
                <FlaskConical className="w-3.5 h-3.5" />
                Interactive Demo — no login needed
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-5 leading-tight">
                See what Profile Centre<br className="hidden md:block" /> can do for you
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
                Explore every feature below — personal profiles, business pages, QR codes, email signatures, and analytics. Then create your own for free.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to="/login">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-7 rounded-xl gap-2">
                    Create your free profile <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted px-7 rounded-xl font-medium gap-2">
                    <Eye className="w-4 h-4" /> Explore features
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Feature explorer ── */}
        <section id="features" className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Everything in one profile</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Click any feature to see a live preview of what it looks like.</p>
          </div>

          {/* Tab row */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {FEATURES.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFeature(f)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  activeFeature.id === f.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                <span className={activeFeature.id === f.id ? 'text-primary-foreground' : ''}>{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>

          {/* Content area */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-10 items-center"
            >
              {/* Left: description */}
              <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium mb-5 ${activeFeature.color}`}>
                  {activeFeature.icon}
                  {activeFeature.label}
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4 leading-snug">{activeFeature.headline}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">{activeFeature.description}</p>
                <Link to="/login">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl">
                    Try it on your own profile <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              {/* Right: preview */}
              <div className="flex justify-center">
                {PREVIEWS[activeFeature.preview]}
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* ── Why Profile Centre ── */}
        <section className="border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto px-5 py-16">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Why people choose Profile Centre</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: <Zap className="w-5 h-5 text-amber-400" />, title: 'Set up in minutes', body: 'Create your profile, add your links, and start sharing — no technical knowledge needed.' },
                { icon: <Smartphone className="w-5 h-5 text-blue-400" />, title: 'Works on every device', body: 'Your profile looks great on phones, tablets, and desktops. Optimised for mobile sharing.' },
                { icon: <QrCode className="w-5 h-5 text-green-400" />, title: 'QR code included', body: 'Every profile comes with a downloadable QR code — perfect for business cards and signage.' },
                { icon: <Building2 className="w-5 h-5 text-purple-400" />, title: 'Personal & business', body: 'One platform for your personal brand and your business. Switch between profiles instantly.' },
                { icon: <Shield className="w-5 h-5 text-red-400" />, title: 'UK-based & GDPR compliant', body: 'Operated by JA Group Services Ltd. Your data stays in the UK and is handled with care.' },
                { icon: <CreditCard className="w-5 h-5 text-cyan-400" />, title: 'Free plan available', body: 'Start for free — no credit card required. Upgrade when you need more features.' },
              ].map(item => (
                <Card key={item.title} className="bg-card border-border">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm mb-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-3xl mx-auto px-5 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Common questions</h2>
          </div>
          <div className="space-y-3">
            {demo.FAQS.map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-border bg-muted/20">
          <div className="max-w-3xl mx-auto px-5 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Ready to create your profile?</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              Join thousands of professionals and businesses already using Profile Centre. Free to start — no credit card needed.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/login">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 rounded-xl gap-2">
                  Create your free profile <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-muted px-8 rounded-xl font-medium">
                  Back to homepage
                </Button>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
