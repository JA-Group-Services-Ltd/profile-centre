import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import {
  Building2,
  CircleHelp,
  FileWarning,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SITE = 'https://sousamurrayprofiles.jagroupservices.co.uk';
const EMAIL = 'contact@jagroupservices.co.uk';
const PHONE_DISPLAY = '020 3834 2790';
const PHONE_LINK = 'tel:+442038342790';

export default function ContactPage() {
  return (
    <>
      <Helmet>
        <title>Contact Us — Sousa Murray Profiles</title>
        <meta name="description" content="Contact Sousa Murray Profiles for sales, account support, billing, complaints, privacy and security enquiries." />
        <link rel="canonical" href={`${SITE}/contact`} />
        <meta property="og:title" content="Contact Us — Sousa Murray Profiles" />
        <meta property="og:description" content="Contact the Sousa Murray Profiles team, operated by JA Group Services Ltd." />
        <meta property="og:url" content={`${SITE}/contact`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <section className="border-b border-border bg-gradient-to-b from-primary/10 to-background">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-5">Contact Sousa Murray Profiles</span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">Tell us what you need help with</h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Questions about plans, your account, billing, a public profile, privacy or security can all be directed through the contacts below.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid lg:grid-cols-[.85fr_1.15fr] gap-8">
          <div className="space-y-4">
            <a href={`mailto:${EMAIL}`} className="block rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
              <div className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Mail className="w-5 h-5" /></div>
                <div><p className="font-bold text-foreground">Email</p><p className="text-sm text-primary mt-1 break-all">{EMAIL}</p><p className="text-xs text-muted-foreground mt-1">General, sales, billing and support enquiries.</p></div>
              </div>
            </a>
            <a href={PHONE_LINK} className="block rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
              <div className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Phone className="w-5 h-5" /></div>
                <div><p className="font-bold text-foreground">Telephone</p><p className="text-sm text-primary mt-1">{PHONE_DISPLAY}</p><p className="text-xs text-muted-foreground mt-1">For customers who prefer to speak to us.</p></div>
              </div>
            </a>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><MapPin className="w-5 h-5" /></div>
                <div><p className="font-bold text-foreground">Registered office</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">167–169 Great Portland Street<br />5th Floor<br />London W1W 5PF<br />United Kingdom</p><p className="text-xs text-muted-foreground mt-2">Registered-office correspondence address; not advertised as a customer walk-in support centre.</p></div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-foreground">Choose the right route</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Using the most relevant route helps us keep the correct operational record attached to your account or enquiry.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {[
                { icon: CircleHelp, title: 'Account & profile support', text: 'Use your customer support area for an account-specific issue.', to: '/support', label: 'Open support' },
                { icon: ReceiptText, title: 'Plans & billing', text: 'Compare plans first, or contact us about a payment or subscription.', to: '/plans', label: 'View plans' },
                { icon: FileWarning, title: 'Report a public profile', text: 'Report suspected harmful, fraudulent or policy-breaking profile content.', to: '/report-issue', label: 'Report an issue' },
                { icon: ShieldCheck, title: 'Privacy or security', text: 'Use our policies to understand the process, then contact us if action is needed.', to: '/legal', label: 'View legal centre' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-2xl border border-border bg-muted/20 p-5">
                    <Icon className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground mt-3">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.text}</p>
                    <Link to={item.to} className="inline-block mt-4"><Button size="sm" variant="outline">{item.label}</Button></Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/25">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-foreground">Operated by JA Group Services Ltd</h2>
                <p className="text-sm text-muted-foreground mt-1">Company number 16314179 · ICO registration ZB877370.</p>
              </div>
            </div>
            <a href="https://www.jagroupservices.co.uk" target="_blank" rel="noopener noreferrer"><Button variant="outline">JA Group Services website</Button></a>
          </div>
        </section>
      </main>
    </>
  );
}
