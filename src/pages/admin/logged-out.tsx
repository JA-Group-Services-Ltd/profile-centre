/**
 * /admin/logged-out — shown after a successful admin logout.
 * Must NOT use AuthProvider or AdminAuthProvider — doing so would trigger
 * a /api/auth/me call and potentially redirect back to login.
 */
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, ShieldCheck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/branding';

export default function AdminLoggedOutPage() {
  const branding = useBranding();
  const platformName = branding.platform_name ?? 'JA Profile Studio';

  return (
    <>
      <Helmet>
        <title>{`Signed Out — ${platformName} Admin Center`}</title>
        <meta name="description" content={`You have been securely signed out of the ${platformName} Admin Center.`} />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/logged-out" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-base text-foreground leading-none block">{platformName}</span>
              <span className="text-xs text-muted-foreground leading-none">Admin Center</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">Signed out of Admin Center</h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-2">
              Your administrator session has ended and you've been signed out of the {platformName} Admin Center securely.
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed mb-8">
              To sign back in, use your JA Group Services administrator account.
            </p>

            <div className="flex flex-col gap-3">
              <Link to="/admin/login">
                <Button className="w-full bg-primary hover:bg-primary/90 gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign in to Staff Portal
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full border-border">
                  Back to home
                </Button>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground mt-8">
              {platformName} · JA Group Services
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
