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
    heading: 'Profiles',
    links: [
      { label: 'About Profiles', href: '/about' },
      { label: 'Plans & Pricing', href: '/plans' },
      { label: 'Features', href: '/#features' },
      { label: 'Help Centre', href: '/help' },
      { label: 'Install App', href: '__install__' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Customer Support', href: '/support' },
      { label: 'Report an Issue', href: '/report-issue' },
      { label: 'Service Status', href: '/status' },
      { label: 'Legal Centre', href: '/legal' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Cookie & Storage Policy', href: '/legal/cookies' },
      { label: 'Acceptable Use', href: '/legal/acceptable-use' },
      { label: 'Refunds & Cancellations', href: '/legal/refunds' },
      { label: 'Complaints Policy', href: '/legal/complaints' },
      { label: 'Security Policy', href: '/legal/security' },
      { label: 'Data Subject Rights', href: '/legal/data-rights' },
    ],
  },
  {
    heading: 'More policies',
    links: [
      { label: 'Accessibility', href: '/legal/accessibility' },
      { label: 'Eligibility', href: '/legal/eligibility' },
      { label: 'Data Retention', href: '/legal/data-retention' },
      { label: 'Reporting & Moderation', href: '/legal/reporting' },
      { label: 'JA Group Services Ltd', href: 'https://www.jagroupservices.co.uk', external: true },
    ],
  },
];

function InstallAppLink({ label }: { label: string }) {
  return <button onClick={openInstallModal} className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">{label}</button>;
}

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.href === '__install__') return <InstallAppLink label={link.label} />;
  if (link.external || link.href.startsWith('http')) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
        {link.label} <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }
  return <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>;
}

export default function Footer() {
  const branding = useBranding();
  const year = new Date().getFullYear();

  let columns: FooterColumn[] = DEFAULT_FOOTER_COLUMNS;
  if (branding.footer_links) {
    try {
      const parsed = JSON.parse(branding.footer_links);
      if (Array.isArray(parsed) && parsed.length > 0) columns = parsed;
    } catch {
      // A malformed Admin override must never break the public footer.
    }
  }

  return (
    <footer className="border-t border-border bg-card" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Link to="/" className="inline-block mb-4">
              {branding.platform_logo_url ? (
                <img src={branding.platform_logo_url} alt={branding.platform_name || 'Sousa Murray Profiles'} className="h-14 w-auto max-w-[200px] object-contain" />
              ) : (
                <span className="font-extrabold text-lg text-primary">Sousa Murray Profiles</span>
              )}
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {branding.platform_description || 'Professional digital profiles for businesses, sole traders, self-employed professionals and organisations.'}
            </p>
            <a href={`mailto:${branding.support_email || 'contact@jagroupservices.co.uk'}`} className="mt-4 inline-block text-sm text-primary hover:underline break-all">
              {branding.support_email || 'contact@jagroupservices.co.uk'}
            </a>
          </div>

          {columns.map(column => (
            <div key={column.heading}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">{column.heading}</h2>
              <ul className="space-y-2.5">
                {column.links.map(link => <li key={`${link.href}-${link.label}`}><FooterLinkItem link={link} /></li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-12 pt-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">© {year} {branding.platform_name || 'Sousa Murray Profiles'}. All rights reserved.</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
              Sousa Murray Profiles is operated by <strong className="text-foreground font-medium">JA Group Services Ltd</strong>, registered in England and Wales under company number <strong className="text-foreground font-medium">16314179</strong>. Registered office: 167–169 Great Portland Street, 5th Floor, London W1W 5PF. ICO registration ZB877370.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
              The service is intended for business and professional use, including sole traders and self-employed customers. Public profiles may be viewed worldwide.
            </p>
          </div>
          <Link to="/legal" className="text-xs font-semibold text-primary hover:underline">Legal & policies →</Link>
        </div>
      </div>
    </footer>
  );
}
