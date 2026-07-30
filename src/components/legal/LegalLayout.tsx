/**
 * Shared layout wrapper for all legal pages.
 * Uses the global site Header and Footer — identical to the homepage.
 * No custom header/footer here; RootLayout wraps these pages.
 */
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useBranding } from '@/lib/branding';

interface LegalLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

const ALL_LEGAL_DOCS = [
  { to: '/legal/terms',          label: 'Terms of Service' },
  { to: '/legal/privacy',        label: 'Privacy Policy' },
  { to: '/legal/cookies',        label: 'Cookie Policy' },
  { to: '/legal/acceptable-use', label: 'Acceptable Use' },
  { to: '/legal/refunds',        label: 'Refund Policy' },
  { to: '/legal/complaints',     label: 'Complaints Policy' },
  { to: '/legal/reporting',      label: 'Reporting Policy' },
  { to: '/legal/security',       label: 'Security Policy' },
  { to: '/legal/accessibility',  label: 'Accessibility' },
  { to: '/legal/eligibility',    label: 'Eligibility Policy' },
  { to: '/legal/data-retention', label: 'Data Retention' },
  { to: '/legal/data-rights',    label: 'Data Subject Rights' },
  { to: '/legal/service-status', label: 'Service Status' },
];

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const branding = useBranding();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Breadcrumb */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/legal" className="hover:text-foreground transition-colors">Legal</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{title}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-12 pb-8 border-b border-border">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{title}</h1>
            {lastUpdated && (
              <p className="text-muted-foreground text-sm">
                Last updated: {lastUpdated} · {branding.legal_company_name || branding.platform_name}
              </p>
            )}
          </div>

          {/* Legal content */}
          <div className="prose-legal">
            {children}
          </div>

          {/* All legal docs nav — full list, pill buttons, mobile-friendly grid */}
          <div className="mt-16 pt-8 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-4">All legal documents</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_LEGAL_DOCS.map(doc => {
                const isCurrent = pathname === doc.to || pathname.startsWith(doc.to + '/');
                return (
                  <Link
                    key={doc.to}
                    to={doc.to}
                    className={[
                      'flex items-center justify-center text-center px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-150 leading-snug min-h-[44px]',
                      isCurrent
                        ? 'bg-primary text-primary-foreground border-primary cursor-default pointer-events-none'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-muted/40',
                    ].join(' ')}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    {doc.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
