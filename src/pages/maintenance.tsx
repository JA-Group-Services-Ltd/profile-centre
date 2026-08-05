import { maintenance } from 'virtual:content';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Wrench, Clock, CheckCircle2, Mail } from 'lucide-react';
import { useBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

export default function MaintenancePage() {
  const branding = useBranding();
  const name = branding.platform_name || 'Sousa Murray Profiles';

  return (
    <>
      <Helmet>
        <title>{`Maintenance in Progress — ${name}`}</title>
        <meta name="description" content={`${name} is currently undergoing scheduled maintenance. We will be back shortly.`} />
        <link rel="canonical" href={APP_URL + '/'} />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content={`Maintenance in Progress — ${name}`} />
        <meta property="og:description" content="We are currently carrying out scheduled maintenance. We will be back shortly." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-orange-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-500/3 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2">
            {branding.platform_logo_url ? (
              <img src={branding.platform_logo_url} alt={name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="font-bold text-foreground text-lg">{name}</span>
            )}
          </div>
          {branding.contact_email && (
            <a href={`mailto:${branding.contact_email}`}>
              <Button variant="outline" size="sm" className="border-border gap-2">
                <Mail className="w-3.5 h-3.5" /> Contact Us
              </Button>
            </a>
          )}
        </header>

        {/* Main content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-8">
              <Wrench className="w-10 h-10 text-orange-400" />
            </div>

            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              Scheduled Maintenance
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6 leading-tight">
              We'll Be Back Shortly
            </h1>

            {/* Body */}
            <p className="text-xl text-muted-foreground mb-4 leading-relaxed max-w-lg mx-auto">
              {name} is currently undergoing scheduled maintenance.
            </p>
            <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mb-10">
              We are working hard to improve the platform. This should not take long — please check back in a few minutes. We apologise for any inconvenience caused.
            </p>

            {/* Estimated time */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-10 bg-card border border-border rounded-xl px-6 py-4 max-w-sm mx-auto">
              <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span>Estimated downtime: <strong className="text-foreground">less than 30 minutes</strong></span>
            </div>

            {/* What we're doing */}
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left mb-12">
              {maintenance.updates.map((u, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{u}</span>
                </div>
              ))}
            </div>

            {/* Contact */}
            {branding.contact_email && (
              <p className="text-sm text-muted-foreground">
                For urgent enquiries, please contact us at{' '}
                <a href={`mailto:${branding.contact_email}`} className="text-primary hover:underline">
                  {branding.contact_email}
                </a>
              </p>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 px-6 py-6 border-t border-border">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} {branding.legal_company_name || name}. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/legal/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="/legal/cookies" className="hover:text-foreground transition-colors">Cookie Policy</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
