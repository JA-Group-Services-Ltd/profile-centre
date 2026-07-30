import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Zap, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/branding';

export default function NotFoundPage() {
  const branding = useBranding();

  return (
    <>
      <Helmet>
        <title>{`Page Not Found — ${branding.platform_name}`}</title>
        <meta name="description" content="The page you're looking for doesn't exist or may have been moved." />
        <link rel="canonical" href={`${branding.platform_url ?? 'https://japrofilestudio.jagroupservices.co.uk'}/404`} />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border/50 px-6 py-4">
          <Link to="/" className="flex items-center w-fit">
            <span className="font-bold text-xl tracking-tight text-foreground">{branding.platform_name}</span>
          </Link>
        </header>

        {/* Main */}
        <div className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full text-center">
            {/* Glowing number */}
            <div className="relative mb-8">
              <p className="text-[9rem] font-black leading-none text-primary/10 select-none">404</p>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Zap className="w-10 h-10 text-primary" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-3">Page not found</h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              The page you're looking for doesn't exist or may have been moved.
              Head back home and we'll get you sorted.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/">
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2 w-full sm:w-auto">
                  <Home className="w-4 h-4" /> Go to Homepage
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-border gap-2 w-full sm:w-auto"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-4 h-4" /> Go Back
              </Button>
            </div>

            <p className="mt-10 text-xs text-muted-foreground">
              Need help?{' '}
              <a
                href={`mailto:${branding.support_email}`}
                className="text-primary hover:underline"
              >
                {branding.support_email}
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border py-5 px-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {branding.platform_name}. Part of JA Group Services.
          </p>
        </footer>
      </div>
    </>
  );
}
