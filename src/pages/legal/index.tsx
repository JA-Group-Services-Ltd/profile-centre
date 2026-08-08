import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Accessibility,
  Building2,
  CheckCircle2,
  Cookie,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://sousamurrayprofiles.jagroupservices.co.uk';

const legalDocs = [
  { to: '/legal/terms', icon: FileText, title: 'Terms of Service', desc: 'The contract rules for accounts, profiles, plans, subscriptions, sharing, embeds, custom domains and acceptable use.' },
  { to: '/legal/privacy', icon: Shield, title: 'Privacy Policy', desc: 'How JA Group Services Ltd uses personal data when operating Sousa Murray Profiles, including lawful bases, recipients and rights.' },
  { to: '/legal/cookies', icon: Cookie, title: 'Cookie & Storage Technologies Policy', desc: 'How cookies and similar technologies are used, including essential technology and choices for non-essential uses.' },
  { to: '/legal/acceptable-use', icon: CheckCircle2, title: 'Acceptable Use Policy', desc: 'Rules protecting customers and visitors from fraud, abuse, malicious content, impersonation and misuse of the platform.' },
  { to: '/legal/refunds', icon: RefreshCw, title: 'Refund & Cancellation Policy', desc: 'How subscription cancellation, billing mistakes, duplicate charges and refund requests are handled.' },
  { to: '/legal/complaints', icon: MessageSquare, title: 'Complaints Policy', desc: 'How to raise a complaint, what our investigation covers and how to request a review.' },
  { to: '/legal/accessibility', icon: Accessibility, title: 'Accessibility Statement', desc: 'Our approach to accessible design, WCAG 2.2 AA principles and reporting accessibility barriers.' },
  { to: '/legal/eligibility', icon: UserCheck, title: 'Eligibility Policy', desc: 'Age, authority and business/professional-use requirements for opening and operating an account.' },
  { to: '/legal/data-retention', icon: Database, title: 'Data Retention Policy', desc: 'How retention is decided for active accounts, closed accounts, payments, security records, complaints and backups.' },
  { to: '/legal/reporting', icon: Globe, title: 'Reporting & Moderation Policy', desc: 'How public profile reports are assessed and the types of moderation action we may take.' },
  { to: '/legal/security', icon: Lock, title: 'Security Policy', desc: 'The security principles used to protect accounts, integrations, administrative functions and operational systems.' },
  { to: '/legal/data-rights', icon: Users, title: 'Data Subject Rights', desc: 'How to exercise UK data-protection rights including access, correction, erasure, restriction, objection and portability.' },
];

export default function LegalIndexPage() {
  const branding = useBranding();
  const contact = branding.support_email || branding.contact_email || 'contact@jagroupservices.co.uk';

  return (
    <>
      <Helmet>
        <title>{`Legal & Policies — ${branding.platform_name || 'Sousa Murray Profiles'}`}</title>
        <meta name="description" content="Terms, privacy, cookies, refunds, complaints, security, accessibility, moderation and data-protection policies for Sousa Murray Profiles." />
        <link rel="canonical" href={`${APP_URL}/legal`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`Legal & Policies — ${branding.platform_name || 'Sousa Murray Profiles'}`} />
        <meta property="og:description" content="The legal and policy centre for Sousa Murray Profiles." />
        <meta property="og:url" content={`${APP_URL}/legal`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-7 sm:p-10 mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Legal & policies</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2">Clear rules for using Sousa Murray Profiles</h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl mt-4">
            These documents explain the contract, privacy, security, billing, content and operational rules that apply to Sousa Murray Profiles. The service is operated by JA Group Services Ltd.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Sousa Murray Profiles policies">
          {legalDocs.map(doc => {
            const Icon = doc.icon;
            return (
              <Link key={doc.to} to={doc.to} className="group flex items-start gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors"><Icon className="w-5 h-5 text-primary" /></div>
                <div><h2 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">{doc.title}</h2><p className="text-xs text-muted-foreground leading-relaxed">{doc.desc}</p></div>
              </Link>
            );
          })}
        </section>

        <section className="mt-6 p-5 rounded-2xl border border-border bg-card flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0"><Radio className="w-5 h-5 text-green-600" /></div>
          <div className="flex-1"><h2 className="font-semibold text-foreground text-sm mb-1">Service Status</h2><p className="text-xs text-muted-foreground leading-relaxed">Check the operational status of Sousa Murray Profiles services separately from the policy documents.</p></div>
          <Link to="/status" className="text-xs font-medium text-primary hover:underline flex-shrink-0 mt-0.5">View status →</Link>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-muted/20 p-6">
          <div className="flex items-center gap-2 mb-3"><Building2 className="w-5 h-5 text-primary" /><h2 className="font-bold text-foreground">JA Group Services Ltd</h2></div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sousa Murray Profiles is operated by JA Group Services Ltd, registered in England and Wales under company number 16314179, with registered office at 167–169 Great Portland Street, 5th Floor, London W1W 5PF. ICO registration ZB877370.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="https://www.jagroupservices.co.uk/legal/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Corporate privacy information <ExternalLink className="w-3 h-3" /></a>
            <a href="https://www.jagroupservices.co.uk/legal/terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Corporate terms <ExternalLink className="w-3 h-3" /></a>
          </div>
        </section>

        <section className="mt-6 p-5 rounded-2xl bg-muted/40 border border-border text-sm text-muted-foreground leading-relaxed">
          Questions about a policy can be sent to <a href={`mailto:${contact}`} className="text-primary hover:underline break-all">{contact}</a>. For an account-specific problem, use the <Link to="/support" className="text-primary hover:underline">customer support route</Link>; for a formal complaint, follow the <Link to="/legal/complaints" className="text-primary hover:underline">Complaints Policy</Link>.
        </section>
      </main>
    </>
  );
}
