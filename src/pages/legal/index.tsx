import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { FileText, Shield, Cookie, RefreshCw, MessageSquare, Accessibility, CheckCircle2, Radio, UserCheck, Globe, Lock, Database, Users, ExternalLink, Building2 } from 'lucide-react';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

const legalDocs = [
  { to: '/legal/terms',          icon: FileText,       title: 'Terms of Service',              desc: 'The terms and conditions governing your use of Profile Centre.' },
  { to: '/legal/privacy',        icon: Shield,         title: 'Privacy Policy',                desc: 'How JA Group Services Ltd collects, uses and protects your personal data under UK GDPR.' },
  { to: '/legal/cookies',        icon: Cookie,         title: 'Cookie Policy',                 desc: 'How we use cookies and similar technologies on this platform.' },
  { to: '/legal/acceptable-use', icon: CheckCircle2,   title: 'Acceptable Use Policy',         desc: 'Rules for acceptable use of the platform and its services. Applies to all users aged 18+.' },
  { to: '/legal/refunds',        icon: RefreshCw,      title: 'Refund Policy',                 desc: 'Our policy on refunds, cancellations and billing disputes.' },
  { to: '/legal/complaints',     icon: MessageSquare,  title: 'Complaints Policy',             desc: 'How to raise a complaint and what to expect from us.' },
  { to: '/legal/accessibility',  icon: Accessibility,  title: 'Accessibility Statement',       desc: 'Our commitment to making this platform accessible to all users.' },
  { to: '/legal/eligibility',    icon: UserCheck,      title: 'Eligibility Policy',            desc: 'This service is available to UK-based users aged 18 and over only.' },
  { to: '/legal/data-retention', icon: Database,       title: 'Data Retention Policy',         desc: 'How long we keep your data and when it is deleted.' },
  { to: '/legal/reporting',      icon: Globe,          title: 'Reporting & Moderation Policy', desc: 'How we handle reports of harmful or illegal content on public profiles.' },
  { to: '/legal/security',       icon: Lock,           title: 'Security Policy',               desc: 'Our approach to keeping your account and data secure.' },
  { to: '/legal/data-rights',    icon: Users,          title: 'Data Subject Rights',           desc: 'Your rights under UK GDPR including access, erasure, and portability.' },
];

export default function LegalIndexPage() {
  const branding = useBranding();
  return (
    <>
      <Helmet>
        <title>{`Legal — ${branding.platform_name}`}</title>
        <meta name="description" content="Legal documents for Profile Centre, operated by JA Group Services Ltd. Terms, Privacy Policy, Cookie Policy, Refund Policy and more." />
        <link rel="canonical" href={`${APP_URL}/legal`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`Legal — ${branding.platform_name}`} />
        <meta property="og:description" content="Legal documents for Profile Centre." />
        <meta property="og:url" content={`${APP_URL}/legal`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <p className="text-sm text-muted-foreground mb-2">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Legal Documents</h1>
          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            The following documents govern your use of Profile Centre, operated by JA Group Services Ltd. This service is available to UK-based users aged 18 and over only.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {legalDocs.map(doc => {
            const Icon = doc.icon;
            return (
              <Link
                key={doc.to}
                to={doc.to}
                className="group flex items-start gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">{doc.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{doc.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Service Status — separate from legal docs */}
        <div className="mt-6 p-5 rounded-2xl border border-border bg-card flex items-start gap-4 hover:border-primary/40 hover:bg-muted/30 transition-all duration-200">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <Radio className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm mb-1">Service Status</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Live operational status of all Profile Centre services.</p>
          </div>
          <Link to="/status" className="text-xs font-medium text-primary hover:underline flex-shrink-0 mt-0.5">
            View status →
          </Link>
        </div>

        {/* JA Group Services corporate policies */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">JA Group Services Ltd — Corporate Policies</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Profile Centre is operated by JA Group Services Ltd. The following corporate policies also apply to your use of this service and JA Group Services ID.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                href: 'https://www.jagroupservices.co.uk/legal/privacy',
                label: 'JA Group Services Privacy Policy',
                desc: 'How JA Group Services Ltd handles personal data across all its services, including JA Group Services ID.',
              },
              {
                href: 'https://www.jagroupservices.co.uk/legal/terms',
                label: 'JA Group Services Terms of Service',
                desc: 'The overarching terms governing your relationship with JA Group Services Ltd.',
              },
              {
                href: 'https://www.jagroupservices.co.uk/legal/id-terms',
                label: 'JA Group Services ID Terms',
                desc: 'Terms governing the use of JA Group Services ID, the single sign-on identity service used to access Profile Centre.',
              },
              {
                href: 'https://www.jagroupservices.co.uk/legal/cookies',
                label: 'JA Group Services Cookie Policy',
                desc: 'How JA Group Services Ltd uses cookies across its websites and services.',
              },
            ].map(doc => (
              <a
                key={doc.href}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-xs mb-1 group-hover:text-primary transition-colors">{doc.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{doc.desc}</p>
                </div>
              </a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            These documents are hosted on <a href="https://www.jagroupservices.co.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">jagroupservices.co.uk</a> and open in a new tab.
          </p>
        </div>

        <div className="mt-8 p-5 rounded-2xl bg-muted/40 border border-border text-sm text-muted-foreground">
          <p>
            Profile Centre is a service operated by <strong className="text-foreground">JA Group Services Ltd</strong>, a company registered in England and Wales.
            This service is available to UK-based users aged 18 and over only. Public profiles may be viewed worldwide.
            If you have questions about any of these documents, please contact us at{' '}
            <a href={`mailto:${branding.support_email || branding.contact_email}`} className="text-primary hover:underline break-all">
              {branding.support_email || branding.contact_email}
            </a>.
          </p>
        </div>
      </div>
    </>
  );
}
