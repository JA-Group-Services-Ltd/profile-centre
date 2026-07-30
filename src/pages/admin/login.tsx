/**
 * Admin Login Page — OIDC only via JA Group Services workforce tenant.
 * No local password login. Admin access is restricted to authorised
 * internal staff authenticated through Microsoft Entra.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { ArrowRight, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/lib/admin-auth';
import { useBranding } from '@/lib/branding';

export default function AdminLoginPage() {
  const { adminUser, loading, loginAdmin } = useAdminAuth();
  const branding = useBranding();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const error = searchParams.get('error');

  useEffect(() => {
    if (!loading && adminUser) {
      window.location.href = '/admin';
    }
  }, [adminUser, loading]);

  const handleSignIn = () => {
    setRedirecting(true);
    loginAdmin();
  };

  const oidcErrorMessages: Record<string, string> = {
    oidc_init_failed:    'Could not start the access process. Please contact support.',
    oidc_callback_failed:'Access was not completed. Please try again.',
    oidc_state_missing:  'Login session expired. Please try again.',
    no_email:            'Your account does not have an email address. Please contact support.',
    access_denied:       'Your account does not have the Administrator role required to access this portal.',
    already_signed_in:   'Another admin account is already signed in. Please sign out first.',
    unknown_error:       'An unexpected error occurred. Please try again.',
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{`Staff Portal — ${branding.platform_name} Admin`}</title>
        <meta name="description" content="Staff portal access for authorised administrators only." />
        <link rel="canonical" href="/admin/login" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border px-6 py-4">
          <Link to="/" className="flex items-center w-fit">
            <span className="font-bold text-xl tracking-tight text-foreground">{branding.platform_name}</span>
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Staff Portal</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Restricted to authorised {branding.legal_company_name || branding.platform_name} internal staff only.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">

              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{oidcErrorMessages[error] ?? 'An unexpected error occurred. Please try again.'}</span>
                </div>
              )}

              {redirecting ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Redirecting you securely…</p>
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleSignIn}
                    className="w-full bg-primary hover:bg-primary/90 h-11 text-base font-medium text-primary-foreground"
                  >
                    Sign in to Staff Portal
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>

                  <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                      Access is restricted to authorised internal staff. This does not grant access to internal company systems, email, Teams, SharePoint or private resources. All access is logged and monitored.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Not staff?{' '}
              <Link to="/login" className="text-primary hover:underline">Customer access</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
