import { useEffect, useLayoutEffect, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ContactRound,
  Globe2,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Palette,
  QrCode,
  Share2,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import InstallAppBanner from '@/components/InstallAppBanner';
import PlanComparison from '@/components/public/PlanComparison';

const SITE = 'https://sousamurrayprofiles.jagroupservices.co.uk';

interface HomepageContent {
  hero_badge?: string;
  hero_title_line1?: string;
  hero_title_highlight?: string;
  hero_subtitle?: string;
  hero_cta_primary?: string;
  hero_cta_secondary?: string;
  announcement_enabled?: boolean;
  announcement_text?: string;
  announcement_link?: string;
  announcement_link_label?: string;
}

const defaults: Required<HomepageContent> = {
  hero_badge: 'Professional digital profiles by Sousa Murray',
  hero_title_line1: 'One professional profile.',
  hero_title_highlight: 'Ready to share everywhere.',
  hero_subtitle: 'Create a public digital profile for yourself or your organisation, keep the important details in one place, and share the same live profile through a link, QR code, social app or website embed.',
  hero_cta_primary: 'Create your profile',
  hero_cta_secondary: 'Compare plans',
  announcement_enabled: false,
  announcement_text: '',
  announcement_link: '',
  announcement_link_label: 'Learn more',
};

function usePwaRedirect() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) navigate('/dashboard', { replace: true });
  }, [navigate]);
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{title}</h2>
      <p className="mt-4 text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/15 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-primary/10">
        <div className="border-b border-border bg-muted/40 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-green-400" /></div>
          <div className="ml-2 min-w-0 flex-1 rounded-lg bg-background px-3 py-1.5 text-[10px] text-muted-foreground truncate">sousamurrayprofiles.jagroupservices.co.uk/profile/alex</div>
        </div>
        <div className="p-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center text-2xl font-extrabold shadow-lg">AJ</div>
          <h3 className="mt-4 text-xl font-bold text-foreground">Alex Johnson</h3>
          <p className="text-sm text-primary font-medium">Independent Consultant</p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">Strategy, operations and practical support for growing businesses.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {['Call', 'Email', 'Website', 'Save contact'].map(label => <div key={label} className="rounded-xl border border-border bg-muted/30 py-2.5 text-xs font-semibold text-foreground">{label}</div>)}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3 text-primary"><QrCode className="w-5 h-5" /><Share2 className="w-5 h-5" /><Link2 className="w-5 h-5" /></div>
        </div>
      </div>
    </div>
  );
}

function Faq({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button type="button" className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="font-semibold text-foreground">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground leading-relaxed">{answer}</div>}
    </div>
  );
}

export default function HomePage() {
  usePwaRedirect();
  const [content, setContent] = useState<Required<HomepageContent>>(defaults);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    fetch('/api/homepage-content', { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(response => response.json())
      .then(payload => {
        if (!payload?.success || !payload?.data) return;
        setContent(current => ({ ...current, ...Object.fromEntries(Object.entries(payload.data).filter(([, value]) => value !== null && value !== undefined)) }));
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Sousa Murray Profiles — Professional Digital Profiles</title>
        <meta name="description" content="Build a professional personal or organisation profile, share it by link, QR code and social apps, embed it on your website, and add business tools as you grow." />
        <link rel="canonical" href={`${SITE}/`} />
        <meta property="og:title" content="Sousa Murray Profiles — Professional Digital Profiles" />
        <meta property="og:description" content="One live professional profile, ready to share anywhere." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}/`} />
        <meta property="og:site_name" content="Sousa Murray Profiles" />
      </Helmet>

      <main className="overflow-hidden">
        {content.announcement_enabled && content.announcement_text && (
          <div className="border-b border-primary/20 bg-primary/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 text-center text-sm text-foreground">
              {content.announcement_text}{' '}
              {content.announcement_link && <a className="font-semibold text-primary underline" href={content.announcement_link}>{content.announcement_link_label}</a>}
            </div>
          </div>
        )}

        <section className="relative border-b border-border">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.16),transparent_38%),radial-gradient(circle_at_80%_35%,rgba(99,102,241,0.12),transparent_34%)]" aria-hidden="true" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 grid lg:grid-cols-[1.05fr_.95fr] gap-14 items-center">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{content.hero_badge}</span>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-foreground">
                {content.hero_title_line1}{' '}<span className="text-primary">{content.hero_title_highlight}</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">{content.hero_subtitle}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login"><Button size="lg" className="gap-2">{content.hero_cta_primary}<ArrowRight className="w-4 h-4" /></Button></Link>
                <Link to="/plans"><Button size="lg" variant="outline">{content.hero_cta_secondary}</Button></Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {['Free plan available', 'Social sharing from Free', 'Website embed from Free', 'Secure central sign-in'].map(item => <span key={item} className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-600" />{item}</span>)}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.1 }}><ProfilePreview /></motion.div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/25">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Smartphone, title: 'Works anywhere', text: 'Open on phones, tablets and desktop browsers.' },
              { icon: Share2, title: 'Built to share', text: 'Link, social app, messaging and website embed.' },
              { icon: LockKeyhole, title: 'Central sign-in', text: 'Customer access uses JA Group Services ID.' },
              { icon: ShieldCheck, title: 'UK operated', text: 'Operated by JA Group Services Ltd.' },
            ].map(item => { const Icon = item.icon; return <div key={item.title} className="flex gap-3 p-3"><Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><p className="font-semibold text-foreground text-sm">{item.title}</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.text}</p></div></div>; })}
          </div>
        </section>

        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeading eyebrow="What you can build" title="More useful than a static business card" text="Your public profile stays live when details change. Update it once, then keep using the same URL, QR code and embed wherever you have already shared it." />
          <div className="mt-10 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[
              { icon: ContactRound, title: 'Professional profile', text: 'Present your name, role, business, contact routes and the information visitors need to understand who you are.' },
              { icon: QrCode, title: 'QR sharing', text: 'Use a QR code for events, printed material, counters, networking or in-person introductions.' },
              { icon: Share2, title: 'Social and messaging share', text: 'Share through Facebook and WhatsApp directly, or use your device share sheet for Instagram, Snapchat, Messenger and other apps.' },
              { icon: Globe2, title: 'Website embedding', text: 'Copy an iframe snippet and place the live profile inside a website builder or site that accepts custom HTML.' },
              { icon: Palette, title: 'Profile presentation', text: 'Use the profile and theme options available on your plan to keep the page consistent with your professional identity.' },
              { icon: BarChart3, title: 'Business tools as you grow', text: 'Eligible plans add organisation profiles, team seats, analytics, custom domains and expanded profile limits.' },
            ].map(item => { const Icon = item.icon; return (
              <article key={item.title} className="rounded-2xl border border-border bg-card p-6 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                <h3 className="mt-4 text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
              </article>
            ); })}
          </div>
        </section>

        <section className="border-y border-border bg-muted/25">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <SectionHeading eyebrow="Who it is for" title="One platform for independent professionals and organisations" text="Profiles is designed around business and professional use, from a single self-employed person through to an organisation managing multiple profiles and team members." />
            <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: ContactRound, title: 'Sole traders & self-employed', text: 'Create one professional place for customers and contacts to find the right information.' },
                { icon: MessageSquareText, title: 'Freelancers & consultants', text: 'Share services, contact routes, professional links and a profile that is easier to remember than a list of URLs.' },
                { icon: Building2, title: 'Businesses & organisations', text: 'Use organisation features and eligible custom-domain tools to bring profiles closer to your own brand.' },
                { icon: Users, title: 'Teams & clubs', text: 'Eligible plans can manage organisation profiles and seats for multiple people under one account structure.' },
              ].map(item => { const Icon = item.icon; return <article key={item.title} className="rounded-2xl border border-border bg-card p-6"><Icon className="w-6 h-6 text-primary" /><h3 className="font-bold text-foreground mt-4">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p></article>; })}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeading eyebrow="Plans" title="Start simple. Add capability when you need it." text="Free and Starter customers can share and embed their public profiles. Higher plans add the business-management features that need more platform resources." />
          <div className="mt-10"><PlanComparison compact /></div>
          <div className="mt-8 text-center"><Link to="/plans"><Button variant="outline" size="lg" className="gap-2">Open full comparison table <ArrowRight className="w-4 h-4" /></Button></Link></div>
        </section>

        <section className="border-y border-border bg-gradient-to-br from-primary/8 via-muted/20 to-indigo-500/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <SectionHeading eyebrow="Sousa Murray + JA Group Services" title="A customer-facing profile product with central operations behind it" text="Sousa Murray Profiles is part of the Sousa Murray brand and is operated by JA Group Services Ltd. Customer identity, payments and operational controls are designed to connect into the same central business infrastructure rather than becoming isolated systems." />
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/about"><Button className="gap-2">About the platform <ArrowRight className="w-4 h-4" /></Button></Link><Link to="/legal"><Button variant="outline">Legal centre</Button></Link></div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <ul className="space-y-4">
                {[
                  'JA Group Services ID for customer authentication.',
                  'Head Office customer and security authority integration.',
                  'Central Payments for paid subscription checkout and billing.',
                  'Dedicated Profiles customer and admin interfaces.',
                  'Scoped integration credentials instead of exposing provider secrets to the website.',
                ].map(text => <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground"><ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" /><span>{text}</span></li>)}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeading eyebrow="Questions" title="Before you create your profile" text="A few of the things customers normally want to know before choosing a plan." />
          <div className="mt-8 space-y-3">
            <Faq question="Can I use Profiles if I am self-employed or a sole trader?" answer="Yes. Sousa Murray Profiles is a business/professional service and can be used by sole traders and self-employed professionals as well as companies and organisations." />
            <Faq question="Can Free and Starter profiles be shared on social apps?" answer="Yes. Public profiles can be shared from Free upwards. Facebook and WhatsApp have direct web-share routes, while supported devices can use the system share sheet for Instagram, Snapchat, Messenger and other installed apps." />
            <Faq question="Can I put my profile on my own website?" answer="Yes. The dashboard can generate website embed code for a published profile. Eligible higher plans can also include custom-domain functionality, which is a separate feature from embedding." />
            <Faq question="Does Sousa Murray Profiles store Stripe secret keys?" answer="The customer-facing Profiles website is designed to call JA Group Services Ltd Central Payments with a scoped platform credential. The principal payment provider secret remains in the central payment service rather than being copied into this website." />
            <Faq question="Where can I see the exact plan limits?" answer="Use the Plans page. It loads the current public plan catalogue and shows a detailed comparison table alongside the current plan cards." />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="rounded-3xl bg-primary text-primary-foreground px-6 py-10 sm:p-12 text-center shadow-xl shadow-primary/20">
            <h2 className="text-3xl font-extrabold">Build a profile you can keep using</h2>
            <p className="mt-3 max-w-2xl mx-auto text-primary-foreground/80 leading-relaxed">Create the profile once, then share the same live destination wherever customers, contacts or visitors need to find you.</p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center"><Link to="/login"><Button size="lg" variant="secondary" className="gap-2">Create your profile <ArrowRight className="w-4 h-4" /></Button></Link><Link to="/contact"><Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">Contact us</Button></Link></div>
          </div>
        </section>
      </main>

      <InstallAppBanner />
    </>
  );
}
