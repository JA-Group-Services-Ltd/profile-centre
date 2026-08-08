import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ContactRound,
  Globe2,
  Layers3,
  QrCode,
  Share2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SITE = 'https://sousamurrayprofiles.jagroupservices.co.uk';

const products = [
  {
    icon: ContactRound,
    title: 'Personal professional profiles',
    text: 'A clean public profile for a sole trader, freelancer, consultant, creator or professional. Put contact details, business information and useful links behind one memorable URL.',
  },
  {
    icon: Building2,
    title: 'Organisation profiles',
    text: 'Present a business, club or organisation through a dedicated public profile, with organisation information and team functionality where the selected plan includes it.',
  },
  {
    icon: Users,
    title: 'Team and seat management',
    text: 'Eligible business plans can support multiple people under an organisation, helping teams manage a consistent public presence without every person starting from scratch.',
  },
  {
    icon: Globe2,
    title: 'Custom-domain profiles',
    text: 'Eligible paid plans can connect an approved custom domain so a profile can sit more naturally alongside the customer’s own brand and website.',
  },
];

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About Sousa Murray Profiles</title>
        <meta name="description" content="Learn what Sousa Murray Profiles is, who it is for, what the platform provides and how JA Group Services Ltd operates the service." />
        <link rel="canonical" href={`${SITE}/about`} />
        <meta property="og:title" content="About Sousa Murray Profiles" />
        <meta property="og:description" content="Professional digital profiles for businesses, organisations, sole traders and self-employed professionals." />
        <meta property="og:url" content={`${SITE}/about`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/12 via-background to-indigo-500/5" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 grid lg:grid-cols-[1.15fr_.85fr] gap-10 items-center">
            <div>
              <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-5">About the platform</span>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                A professional digital identity people can actually use
              </h1>
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-3xl">
                Sousa Murray Profiles helps businesses, sole traders, self-employed professionals and organisations turn their important public information into a profile that is easy to open, save, share and keep up to date.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/plans"><Button size="lg" className="gap-2">Compare plans <ArrowRight className="w-4 h-4" /></Button></Link>
                <Link to="/contact"><Button size="lg" variant="outline">Contact us</Button></Link>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-primary/5">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">The idea</p>
              <h2 className="text-2xl font-bold text-foreground mt-2">One profile. Many ways to use it.</h2>
              <div className="mt-6 space-y-4">
                {[
                  { icon: QrCode, text: 'Put a QR code on printed material or show it from your phone.' },
                  { icon: Share2, text: 'Share the same public profile through social apps and messaging.' },
                  { icon: Layers3, text: 'Embed the live profile into another website without maintaining a second copy.' },
                  { icon: ShieldCheck, text: 'Manage the account through central sign-in, security and operational controls.' },
                ].map(item => {
                  const Icon = item.icon;
                  return <div key={item.text} className="flex gap-3"><div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div><p className="text-sm text-muted-foreground leading-relaxed pt-1.5">{item.text}</p></div>;
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl mb-10">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">What Profiles provides</p>
            <h2 className="text-3xl font-bold text-foreground mt-2">Built for the different ways a business presents itself</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              A profile is more than a link-in-bio page. The platform combines contact information, profile presentation, QR sharing, social sharing, website embedding and — on eligible plans — organisation, analytics and domain tools.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {products.map(item => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                  <h3 className="text-lg font-bold text-foreground mt-4">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-border bg-muted/25">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid lg:grid-cols-2 gap-10">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">The brand</p>
              <h2 className="text-3xl font-bold text-foreground mt-2">Part of Sousa Murray</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Sousa Murray is the customer-facing master brand used by JA Group Services Ltd. Sousa Murray Profiles is the part of that brand focused on professional digital profiles and profile-management products.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                The service is operated by <strong className="text-foreground">JA Group Services Ltd</strong>, company number <strong className="text-foreground">16314179</strong>, which provides the underlying customer, administration, payment and security operations used by the platform.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-bold text-foreground">What that means for customers</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {[
                  'A consistent Sousa Murray customer-facing experience.',
                  'JA Group Services ID for central account sign-in and identity.',
                  'Central payment handling for paid subscriptions rather than separate payment accounts on each website.',
                  'Head Office operational and security controls behind customer-facing services.',
                  'Dedicated Profiles support, policies and profile-management tools.',
                ].map(text => <li key={text} className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>{text}</span></li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">See exactly what each plan includes</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Our plan comparison uses the live public plan catalogue, so you can compare profile limits and included functions before choosing.</p>
            <Link to="/plans" className="inline-block mt-6"><Button size="lg" className="gap-2">View plans <ArrowRight className="w-4 h-4" /></Button></Link>
          </div>
        </section>
      </main>
    </>
  );
}
