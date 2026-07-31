/**
 * /logged-out — shown after a successful logout.
 * This page must NOT use AuthProvider or useAuth — doing so would trigger
 * a /api/auth/me call and potentially redirect back to login.
 *
 * If the `switch=1` query param is present (set by the logout redirect from
 * /auth/logout when the user chose "switch account"), we immediately redirect
 * to /auth/login so the user can authenticate as a different account.
 * No localStorage is used.
 */
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { CheckCircle2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/branding';

export default function LoggedOutPage() {
  const branding = useBranding();
  const platformName = branding.platform_name ?? 'Profile Centre';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If the user triggered "switch account", bounce straight to login.
  // The switch=1 param is set by /auth/logout redirect — no localStorage needed.
  useEffect(() => {
    if (searchParams.get('switch') === '1') {
      const t = setTimeout(() => { window.location.href = '/auth/login'; }, 300);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  return (
    <>
      <Helmet>
        <title>{`Signed Out — ${platformName}`}</title>
        <meta name="description" content={`You have been securely signed out of ${platformName}.`} />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/logged-out" />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border px-6 py-4">
          <Link to="/" className="flex items-center w-fit">
            <span className="font-bold text-xl tracking-tight text-foreground">{platformName}</span>
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">You've been signed out</h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Your session has ended and you've been signed out of {platformName} securely.
            </p>

            <div className="flex flex-col gap-3">
              <Link to="/login">
                <Button className="w-full bg-primary hover:bg-primary/90 gap-2">
                  <LogIn className="w-4 h-4" />
                  Continue through JA Group Services ID
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full border-border">
                  Back to home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
