import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, User } from 'lucide-react';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

export default function ServicesPage() {
  const branding = useBranding();
  return (
    <>
      <Helmet>
        <title>{`Services — ${branding.platform_name}`}</title>
        <meta name="description" content="Services offered by Profile Centre, operated by JA Group Services Ltd. Digital profiles, QR codes, links and more." />
        <link rel="canonical" href={`${APP_URL}/services`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`Services — ${branding.platform_name}`} />
        <meta property="og:description" content="Digital profile services by JA Group Services Ltd." />
        <meta property="og:url" content={`${APP_URL}/services`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <p className="text-sm text-muted-foreground mb-2">Services</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Our Services</h1>
          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            JA Group Services Ltd operates Profile Centre — a digital profile service for professionals and businesses.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Link
            to="/services/ja-profile-studio"
            className="group flex items-start gap-5 p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold text-foreground group-hover:text-primary transition-colors">Profile Centre</h2>
                <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Live</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                A professional digital profile service. Share your contact details, links and QR code in one place. Available on free and paid plans.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Digital profiles', 'QR codes', 'Custom links', 'Analytics', 'Business Cards'].map(f => (
                  <span key={f} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border">{f}</span>
                ))}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
          </Link>
        </div>

        <div className="mt-12 p-5 rounded-2xl bg-muted/40 border border-border text-sm text-muted-foreground">
          <p>
            All services are operated by <strong className="text-foreground">JA Group Services Ltd</strong>, a company registered in England and Wales.
            For enquiries, contact{' '}
            <a href={`mailto:${branding.contact_email}`} className="text-primary hover:underline">{branding.contact_email}</a>.
          </p>
        </div>
      </div>
    </>
  );
}
