import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useBranding } from '@/lib/branding';
import { openInstallModal } from '@/components/InstallAppModal';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

export const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',    href: '/#features' },
      { label: 'Pricing',     href: '/#pricing' },
      { label: 'FAQ',         href: '/#faq' },
      { label: 'Help Centre', href: '/help' },
      { label: 'Install App', href: '__install__' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact Support',  href: '/support' },
      { label: 'Report an Issue',  href: '/report-issue' },
      { label: 'Service Status',   href: '/status' },
      { label: 'Help Centre',      href: '/dashboard/help-centre' },
      { label: 'JA Group Services Ltd', href: 'https://jagroupservices.co.uk', external: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service',    href: '/legal/terms' },
      { label: 'Privacy Policy',      href: '/legal/privacy' },
      { label: 'Cookie Policy',       href: '/legal/cookies' },
      { label: 'Acceptable Use',      href: '/legal/acceptable-use' },
      { label: 'Refund Policy',       href: '/legal/refunds' },
      { label: 'Complaints Policy',   href: '/legal/complaints' },
      { label: 'Reporting Policy',    href: '/legal/reporting' },
      { label: 'Security Policy',     href: '/legal/security' },
      { label: 'Accessibility',       href: '/legal/accessibility' },
      { label: 'Eligibility Policy',  href: '/legal/eligibility' },
      { label: 'Data Retention',      href: '/legal/data-retention' },
      { label: 'Data Subject Rights', href: '/legal/data-rights' },
    ],
  },
];

function InstallAppLink({ label }: { label: string }) {
  return (
    <button
      onClick={openInstallModal}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
    >
      {label}
    </button>
  );
}

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.href === '__install__') {
    return <InstallAppLink label={link.label} />;
  }
  if (link.external || link.href.startsWith('http')) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
      >
        {link.label} <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }
  return (
    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
      {link.label}
    </Link>
  );
}

export default function Footer() {
  const branding = useBranding();
  const year = new Date().getFullYear();

  // Parse footer_links from branding; fall back to defaults
  let columns: FooterColumn[] = DEFAULT_FOOTER_COLUMNS;
  if (branding.footer_links) {
    try {
      const parsed = JSON.parse(branding.footer_links);
      if (Array.isArray(parsed) && parsed.length > 0) columns = parsed;
    } catch { /* use defaults */ }
  }

  return (
    <footer className="border-t border-border bg-card" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-10"
          style={{ gridTemplateColumns: `1fr repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {/* Brand column */}
          <div className="sm:col-span-1">
            <Link to="/" className="inline-block mb-4">
              {branding.platform_logo_url ? (
                <img
                  src={branding.platform_logo_url}
                  alt={branding.platform_name || 'Sousa Murray Profiles'}
                  className="h-14 w-auto max-w-[200px] object-contain"
                />
              ) : (
                <span className="font-extrabold text-lg text-foreground">
                  <span className="text-primary">Sousa Murray Profiles</span>
                </span>
              )}
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {branding.platform_description || 'A professional digital profile service for UK-based individuals and businesses. Share your contact details, links and QR code in one place.'}
            </p>
            {branding.support_email && (
              <a
                href={`mailto:${branding.support_email}`}
                className="text-sm text-primary hover:underline transition-colors font-medium break-all leading-relaxed inline-block max-w-full"
                style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
              >
                {branding.support_email}
              </a>
            )}
          </div>

          {/* Dynamic columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-12 pt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            © {year} {branding.platform_name || 'Sousa Murray Profiles'}. All rights reserved.
            {branding.footer_tagline ? ` ${branding.footer_tagline}.` : ''}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Sousa Murray Profiles is a service brand operated by JA Group Services Ltd, a company registered in England and Wales. This service is available to UK-based users aged 18 and over only. Public profiles may be viewed worldwide.
          </p>
          <p className="text-xs text-muted-foreground">
            Separate terms may apply to third-party print providers or connected services where used.
          </p>
        </div>
      </div>
    </footer>
  );
}
