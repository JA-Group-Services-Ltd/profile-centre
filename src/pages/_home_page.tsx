import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import {
  CreditCard, QrCode, Link2, Mail, BarChart3, Palette,
  Check, Menu, X, ArrowRight, Globe, Phone,
  Linkedin, Twitter, Instagram, Star, Zap, Shield, Users, FileSignature, Loader2,
  LayoutDashboard, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useBranding } from '@/lib/branding';
import { useAuth } from '@/lib/auth';



const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function DemoProfileCard() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* Glow */}
      <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-2xl scale-110" />
      <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold mb-3 ring-4 ring-blue-500/30">
            AJ
          </div>
          <h3 className="text-white font-bold text-lg">Alex Johnson</h3>
          <p className="text-blue-400 text-sm">Senior Product Designer</p>
          <p className="text-white/50 text-xs">Available for freelance</p>
        </div>
        <div className="flex gap-2 mb-4">
          <button className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded-xl transition-colors">
            <Phone className="w-3 h-3" /> Call
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs py-2 rounded-xl transition-colors">
            <Mail className="w-3 h-3" /> Email
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs py-2 rounded-xl transition-colors">
            <Globe className="w-3 h-3" /> Web
          </button>
        </div>
        <div className="flex gap-2 mb-4 justify-center">
          {[Linkedin, Twitter, Instagram].map((Icon, i) => (
            <div key={i} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-blue-400 hover:bg-white/20 transition-colors cursor-pointer">
              <Icon className="w-4 h-4" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {['Portfolio & Case Studies', 'Book a Consultation'].map((label, i) => (
            <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors cursor-pointer">
              <span>{label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/40" />
            </div>
          ))}
        </div>
        <p className="text-center text-white/30 text-xs mt-4">Powered by Profile Centre</p>
      </div>
    </div>
  );
}

const features = [
  { icon: CreditCard, title: 'Digital Business Card', description: 'Create a stunning digital business card with your photo, contact details, and links. Share it instantly via QR code or link.', gradient: 'from-blue-500/10 to-blue-600/5' },
  { icon: QrCode, title: 'QR Code Generator', description: 'Generate a custom QR code for your profile. Download as PNG and print on physical cards, flyers, or merchandise.', gradient: 'from-purple-500/10 to-purple-600/5' },
  { icon: Link2, title: 'Custom Links & Buttons', description: 'Add unlimited links to your social profiles, website, portfolio, booking page, and more.', gradient: 'from-cyan-500/10 to-cyan-600/5' },
  { icon: Mail, title: 'Contact Form', description: 'Let visitors send you enquiries directly from your profile. All messages saved to your dashboard inbox.', gradient: 'from-green-500/10 to-green-600/5' },
  { icon: BarChart3, title: 'Analytics Dashboard', description: 'Track profile views, link clicks, and visitor trends. Understand how people engage with your card.', gradient: 'from-orange-500/10 to-orange-600/5' },
  { icon: Palette, title: 'Multiple Themes', description: 'Choose from beautiful themes to match your brand. Customise colours and style to stand out.', gradient: 'from-pink-500/10 to-pink-600/5' },
  { icon: FileSignature, title: 'Profile Poster PDF', description: 'Generate a professional A4 PDF poster of your profile to share digitally — as an email attachment, in a presentation, or on a website.', gradient: 'from-indigo-500/10 to-indigo-600/5' },
];

interface DbPlan {
  id: number; name: string; slug: string;
  price_monthly: number; price_yearly: number;
  max_profiles: number; max_links: number; max_seats: number;
  has_qr_download: number; has_contact_form: number;
  has_advanced_analytics: number; has_vcard_download: number;
  has_custom_themes: number; remove_branding: number;
  has_lifetime: number;
  max_themes: number; stripe_price_monthly: string | null; stripe_price_yearly: string | null;
}

function getPlanFeatures(plan: DbPlan): string[] {
  return [
    `${plan.max_profiles >= 999 ? 'Unlimited' : plan.max_profiles} digital profile${plan.max_profiles !== 1 ? 's' : ''}`,
    `${plan.max_links >= 999 ? 'Unlimited' : plan.max_links} links per profile`,
    plan.has_qr_download ? 'QR code download' : null,
    plan.has_contact_form ? 'Contact enquiry form' : null,
    plan.has_advanced_analytics ? 'Advanced analytics' : null,
    plan.has_vcard_download ? 'vCard / contact download' : null,
    plan.has_custom_themes ? (plan.max_themes === -1 ? 'All themes unlocked' : `${plan.max_themes} premium theme${plan.max_themes !== 1 ? 's' : ''}`) : null,
    plan.max_seats > 1 ? `Up to ${plan.max_seats >= 999 ? 'unlimited' : plan.max_seats} team seats` : null,
    plan.remove_branding ? 'Remove platform branding' : null,
    'Profile Poster PDF',
  ].filter(Boolean) as string[];
}

const POPULAR_SLUG = 'professional';

const FAQ_ITEMS = [
  { q: "How do I get started?", a: "Sign in through JA Group Services ID to create your account. Your account is created automatically on first sign-in — no separate registration needed." },
  { q: "What URL will my profile be on?", a: "Every profile gets a unique URL at japrofilestudio.jagroupservices.co.uk/profile/yourusername. Choose your username when you set up your profile." },
  { q: "How does the QR code work?", a: "Your QR code links directly to your public profile page. Starter plans can display it on screen; paid plans can download it as a PNG to print on physical cards or flyers." },
  { q: "Can people download my contact as a vCard?", a: "vCard download is available on the Professional and Business plans. Visitors can save your contact directly to their phone with one tap." },
  { q: "Can I remove the platform branding?", a: 'Yes — the Professional and Business plans allow you to remove the "Powered by" footer from your public profile.' },
  { q: "How many links can I add?", a: "This depends on your plan. Professional and Business plans include unlimited links." },
  { q: "Can I have multiple profiles?", a: "Yes — higher plans include multiple profiles. Professional supports up to 5 profiles. Business supports up to 20 profiles — perfect for teams." },
  { q: "Can visitors contact me from my profile?", a: "Yes — paid plans include a contact enquiry form. Visitors can send you a message from your profile card and you will receive it in your dashboard." },
  { q: "Is my data secure?", a: "Yes. We use industry-standard security practices including encrypted sessions and rate limiting. Your private data is never shown publicly unless you choose to display it." },
  { q: "Is this compliant with UK data protection law?", a: "Yes. The platform is built to comply with UK GDPR and the Data Protection Act 2018. You can manage your consent preferences and request data deletion from your dashboard at any time." },
];

export default function HomePage() {
  const { user } = useAuth();
  const branding = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbPlans, setDbPlans] = useState<DbPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Only show yearly toggle if at least one public plan has a yearly price configured
  const hasYearlyPlans = dbPlans.some(p => p.price_yearly > 0 && p.stripe_price_yearly);

  const loadPlans = useCallback(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => { if (d.success) setDbPlans(d.data.filter((p: DbPlan) => !p.has_lifetime)); })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  return (
    <>
      <Helmet>
        <title>{`${branding.platform_name} — ${branding.platform_tagline}`}</title>
        <meta name="description" content={branding.platform_description} />
        <link rel="canonical" href={branding.platform_url} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={branding.platform_url} />
        <meta property="og:title" content={`${branding.platform_name} — ${branding.platform_tagline}`} />
        <meta property="og:description" content={branding.platform_description} />
        <meta property="og:site_name" content={branding.platform_name} />
        <meta property="og:image" content={`${branding.platform_url}/api/og?title=${encodeURIComponent(branding.platform_name)}&description=${encodeURIComponent(branding.platform_tagline)}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${branding.platform_name} — ${branding.platform_tagline}`} />
        <meta name="twitter:description" content={branding.platform_description} />
        <meta name="twitter:image" content={`${branding.platform_url}/api/og?title=${encodeURIComponent(branding.platform_name)}&description=${encodeURIComponent(branding.platform_tagline)}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": branding.platform_name,
          "description": branding.platform_description,
          "url": branding.platform_url,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP" },
        })}</script>
      </Helmet>

      {/* Full-page glass background */}
      <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
        {/* Global ambient orbs — purely decorative, behind everything */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px]" />
          <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px]" />
          <div className="absolute bottom-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-cyan-600/6 blur-[100px]" />
        </div>

        <h1 className="sr-only">{branding.platform_name} — {branding.platform_tagline}</h1>

        {/* ── Navigation ── */}
        <header className="sticky top-0 z-50 border-b border-white/8 bg-background/60 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center">
                <span className="font-bold text-xl tracking-tight text-foreground">{branding.platform_name}</span>
              </Link>
              <nav className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
                <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              </nav>
              <div className="hidden md:flex items-center gap-3">
                {user ? (
                  <Link to="/dashboard/overview">
                    <Button size="sm" className="bg-primary hover:bg-primary/90">
                      <LayoutDashboard className="w-4 h-4 mr-1.5" /> Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login"><Button variant="ghost" size="sm">Log In</Button></Link>
                    <Link to="/login"><Button size="sm" className="bg-primary hover:bg-primary/90">Get Started</Button></Link>
                  </>
                )}
              </div>
              <button
                className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-white/8 bg-background/80 backdrop-blur-xl px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#pricing" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <div className="flex gap-2 pt-2">
                {user ? (
                  <Link to="/dashboard/overview" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full bg-primary"><LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full border-white/10">Log In</Button>
                    </Link>
                    <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                      <Button size="sm" className="w-full bg-primary">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        {/* ── Hero ── */}
        <section className="relative z-10 pt-24 pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center lg:text-left">
                <motion.div variants={fadeUp}>
                  <Badge className="mb-6 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">
                    <Zap className="w-3 h-3 mr-1" /> Digital business cards for JA Group Services
                  </Badge>
                </motion.div>
                <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-foreground mb-6">
                  Create your digital business card{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">in minutes</span>
                </motion.h1>
                <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                  A professional digital business card, QR code profile, and contact link page — for yourself or your whole team.
                </motion.p>
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  {user ? (
                    <Link to="/dashboard/overview">
                      <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 w-full sm:w-auto">
                        <LayoutDashboard className="mr-2 w-4 h-4" /> Go to Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/login">
                      <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 w-full sm:w-auto">
                        Get Started <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  <a href="#features">
                    <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 w-full sm:w-auto">
                      See Features
                    </Button>
                  </a>
                </motion.div>
                <motion.div variants={fadeUp} className="flex items-center gap-6 mt-8 justify-center lg:justify-start flex-wrap">
                  {['Professional profiles', 'QR codes included', 'Live in minutes'].map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-green-400" /> {t}
                    </div>
                  ))}
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' as const }}
                className="flex justify-center"
              >
                <DemoProfileCard />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="relative z-10 py-24">
          {/* Subtle glass divider */}
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-0 border-y border-white/5" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
              <motion.p variants={fadeUp} className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Features</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Everything you need to stand out</motion.h2>
              <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
                One link to share everything. Your digital identity, beautifully presented.
              </motion.p>
            </motion.div>
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className={`relative rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm p-6 hover:border-primary/30 hover:bg-white/[0.07] transition-all duration-300 group ${
                    i === 0 || i === 5 ? 'lg:col-span-2' : ''
                  }`}
                >
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── How it Works ── */}
        <section id="how-it-works" className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
              <motion.p variants={fadeUp} className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">How it Works</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Up and running in 3 steps</motion.h2>
            </motion.div>
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid md:grid-cols-3 gap-8 relative"
            >
              <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />
              {[
                { step: '01', icon: Users, title: 'Sign Up', desc: 'Create your account in seconds. Choose your unique username and pick a plan.' },
                { step: '02', icon: Palette, title: 'Customise Your Card', desc: 'Add your photo, contact details, social links, and choose a theme that matches your brand.' },
                { step: '03', icon: QrCode, title: 'Share Everywhere', desc: 'Share your link, display your QR code, or let people save your contact with one tap.' },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="text-center relative">
                  <div className="w-24 h-24 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 relative">
                    <item.icon className="w-10 h-10 text-primary" />
                    <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Profile Preview ── */}
        <section className="relative z-10 py-24">
          <div className="absolute inset-0 bg-white/[0.02] border-y border-white/5" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
                <motion.p variants={fadeUp} className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Live Preview</motion.p>
                <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                  Beautiful profiles that convert
                </motion.h2>
                <motion.p variants={fadeUp} className="text-muted-foreground text-lg mb-6">
                  Your digital business card looks stunning on every device. Mobile-first design ensures your profile makes the right impression.
                </motion.p>
                <motion.ul variants={stagger} className="space-y-3">
                  {['Works perfectly on mobile and desktop', 'Multiple themes to match your brand', 'One-tap to call, email, or visit your website', 'Share via QR code or direct link'].map((item, i) => (
                    <motion.li key={i} variants={fadeUp} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-green-400" />
                      </div>
                      {item}
                    </motion.li>
                  ))}
                </motion.ul>
                <motion.div variants={fadeUp} className="mt-8">
                  <Link to="/login">
                    <Button variant="outline" className="border-white/10 hover:bg-white/5">
                      Create Your Profile <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: 'easeOut' as const }}
                className="flex justify-center"
              >
                <DemoProfileCard />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
              <motion.p variants={fadeUp} className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Pricing</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</motion.h2>
              <motion.p variants={fadeUp} className="text-muted-foreground text-lg mb-6">
                Choose the plan that fits you. No hidden fees. Cancel any time.
              </motion.p>
              {/* Billing toggle — only shown when yearly pricing is configured */}
              {hasYearlyPlans && (
                <motion.div variants={fadeUp} className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Yearly
                    <Badge className="bg-green-500/20 text-green-400 border-0 text-xs px-1.5 py-0">Save ~17%</Badge>
                  </button>
                </motion.div>
              )}
            </motion.div>

            {plansLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full rounded-2xl border border-white/8 bg-white/[0.04] p-6 flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  </div>
                ))}
              </div>
            ) : dbPlans.length === 0 ? (
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="max-w-lg mx-auto text-center rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm p-10"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                  <CreditCard className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Plans coming soon</h3>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Sign in to view available plans and choose the right one for you.
                </p>
                <Link to="/login">
                  <Button className="bg-primary hover:bg-primary/90 gap-2">Get Started <ArrowRight className="w-4 h-4" /></Button>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center"
              >
                {dbPlans.map((plan) => {
                  const isPopular = plan.slug === POPULAR_SLUG;
                  const planFeatures = getPlanFeatures(plan);
                  const price = billingCycle === 'yearly' && plan.price_yearly > 0 && hasYearlyPlans
                    ? (plan.price_yearly / 12)
                    : plan.price_monthly;
                  const showYearlySaving = hasYearlyPlans && billingCycle === 'yearly' && plan.price_yearly > 0 && plan.price_monthly > 0;
                  return (
                    <motion.div
                      key={plan.id}
                      variants={fadeUp}
                      className={`relative rounded-2xl border p-6 flex flex-col backdrop-blur-sm w-full ${
                        isPopular
                          ? 'border-primary/50 bg-primary/8 shadow-lg shadow-primary/10'
                          : 'border-white/8 bg-white/[0.04]'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-white border-0 shadow-lg">
                            <Star className="w-3 h-3 mr-1" /> Most Popular
                          </Badge>
                        </div>
                      )}
                      <div className="mb-6">
                        <h3 className="font-bold text-foreground text-lg mb-1">{plan.name}</h3>
                        <p className="text-muted-foreground text-xs mb-4">
                          {plan.slug === 'starter' ? 'For individuals and freelancers' :
                           plan.slug === 'professional' ? 'For professionals and creators' :
                           plan.slug === 'business' ? 'For teams and businesses' :
                           `${plan.name} plan`}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">£{price.toFixed(price % 1 === 0 ? 0 : 2)}</span>
                          <span className="text-sm text-muted-foreground">/mo</span>
                        </div>
                        {showYearlySaving && (
                          <p className="text-green-400 text-xs mt-1">£{plan.price_yearly}/yr — billed annually</p>
                        )}
                        {!showYearlySaving && plan.price_monthly > 0 && (
                          <p className="text-muted-foreground text-xs mt-1">Billed monthly</p>
                        )}
                      </div>
                      <ul className="space-y-2.5 mb-6 flex-1">
                        {planFeatures.map((f, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link to="/login">
                        <Button className={`w-full ${isPopular ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-white/8 hover:bg-white/12 text-foreground border border-white/10'}`}>
                          Get Started
                        </Button>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="relative z-10 py-20">
          <div className="absolute inset-0 bg-white/[0.02] border-y border-white/5" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
              <motion.div variants={fadeUp} className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-amber-400 text-blue-400" />)}
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Trusted by professionals</motion.h2>
              <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
                Built for UK businesses, freelancers, and teams who want to make a great first impression.
              </motion.p>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
              {[
                { quote: 'I replaced my paper business cards entirely. Now I just show my QR code and people have all my details instantly.', name: 'Sarah M.', role: 'Freelance Consultant' },
                { quote: 'The business profile page for our team is brilliant. Everyone has their own card linked to our company page.', name: 'James T.', role: 'Operations Manager' },
                { quote: 'The profile poster is brilliant for sharing at events. One PDF with everything — QR code, contact details, links. Looks completely professional.', name: 'Priya K.', role: 'Marketing Director' },
              ].map((t, i) => (
                <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm p-6 flex flex-col gap-4">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-blue-400" />)}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">"{t.quote}"</p>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="relative z-10 py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
              <motion.p variants={fadeUp} className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">FAQ</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Frequently asked questions</motion.h2>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <Accordion type="single" collapsible className="space-y-3">
                {FAQ_ITEMS.map((faq, i) => (
                  <motion.div key={i} variants={fadeUp}>
                    <AccordionItem value={`faq-${i}`} className="border border-white/8 rounded-xl px-4 bg-white/[0.03] backdrop-blur-sm">
                      <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-sm pb-4 leading-relaxed">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="relative z-10 py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm p-12"
            >
              <motion.div variants={fadeUp} className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-primary" />
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Ready to create your digital card?
              </motion.h2>
              <motion.p variants={fadeUp} className="text-muted-foreground text-lg mb-8">
                Join professionals sharing their digital business card. Plans start from just £5/mo.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/login">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8">
                    Create Your Card <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="relative z-10 border-t border-white/8 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              <div className="col-span-2">
                <Link to="/" className="flex items-center mb-4">
                  <span className="font-bold text-xl tracking-tight text-foreground">{branding.platform_name}</span>
                </Link>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{branding.platform_tagline}</p>
                {branding.footer_tagline && <p className="text-xs text-muted-foreground mt-2">{branding.footer_tagline}</p>}
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Support:{' '}
                    <a href={`mailto:${branding.support_email || 'japrofilestudio@jagroupservices.co.uk'}`} className="hover:text-foreground transition-colors">
                      {branding.support_email || 'japrofilestudio@jagroupservices.co.uk'}
                    </a>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <a href="https://japrofilestudio.jagroupservices.co.uk" className="hover:text-foreground transition-colors">
                      japrofilestudio.jagroupservices.co.uk
                    </a>
                  </p>
                </div>
              </div>
              {[
                { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'How it Works', href: '#how-it-works' }] },
                { title: 'Support', links: [{ label: 'Report an Issue', href: '/report-issue' }, { label: 'Contact Us', href: `mailto:${branding.support_email || 'japrofilestudio@jagroupservices.co.uk'}` }] },
                { title: 'Legal', links: [{ label: 'Privacy Policy', href: '/legal/privacy' }, { label: 'Terms of Service', href: '/legal/terms' }, { label: 'Cookie Policy', href: '/legal/cookies' }] },
              ].map((col, i) => (
                <div key={i}>
                  <h4 className="font-semibold text-foreground text-sm mb-4">{col.title}</h4>
                  <ul className="space-y-2.5">
                    {col.links.map((link, j) => (
                      <li key={j}>
                        {link.href.startsWith('/') && !link.href.includes('#') ? (
                          <Link to={link.href} className="text-muted-foreground text-sm hover:text-foreground transition-colors">{link.label}</Link>
                        ) : (
                          <a href={link.href} className="text-muted-foreground text-sm hover:text-foreground transition-colors">{link.label}</a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} {branding.platform_name}. All rights reserved.</p>
              {branding.footer_show_legal_name === '1' && branding.legal_company_name && (
                <p className="text-muted-foreground text-sm">
                  {branding.platform_name} is a service provided by {branding.legal_company_name}
                  {branding.legal_company_number ? ` · Co. No. ${branding.legal_company_number}` : ''}
                </p>
              )}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
