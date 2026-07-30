import { useState } from 'react';
import { fmtDate, fmtMonthYear } from '@/lib/date';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  ArrowRight, ShieldCheck, Loader2, AlertTriangle,
  Star, Zap, Clock, CreditCard, Users, Crown, LogOut, LayoutDashboard, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth, type User } from '@/lib/auth';
import { useBranding } from '@/lib/branding';

function getPlanBadge(user: User | null) {
  if (!user) return null;
  if (user.hasLifetimeAccess) return { label: 'Lifetime', icon: Crown,         cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' };
  if (user.trialActive)       return { label: 'Free Trial', icon: Clock,       cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' };
  if (user.hasBusinessAccess) return { label: user.plan_name ?? 'Business', icon: Zap,  cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700' };
  if (user.hasStarterAccess)  return { label: user.plan_name ?? 'Starter', icon: Star,  cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' };
  if (user.isSeatUser)        return { label: user.seatWorkspaces?.[0]?.ownerPlanName ? `${user.seatWorkspaces[0].ownerPlanName} Seat` : 'Team Seat', icon: Users, cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700' };
  if (user.trialExpired)      return { label: 'Trial Expired', icon: AlertTriangle, cls: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700' };
  return { label: 'Free account', icon: CreditCard, cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' };
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const branding = useBranding();
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const error = searchParams.get('error');

  // Do NOT auto-redirect logged-in users — show the account choice screen instead.

  const handleSignIn = () => {
    setRedirecting(true);
    window.location.href = '/auth/login';
  };

  const handleSwitchAccount = () => {
    setRedirecting(true);
    // Pass switch intent as a URL param — no localStorage needed
    window.location.href = '/auth/logout?switch=1';
  };

  const handleSignOut = () => {
    setSigningOut(true);
    window.location.href = '/auth/logout';
  };

  const errorMessages: Record<string, string> = {
    oidc_init_failed:     'Could not start the sign-in process. Please try again.',
    oidc_callback_failed: 'Sign-in was not completed. Please try again.',
    oidc_state_missing:   'Your sign-in session expired. Please try again.',
    no_email:             'Your account does not have an email address associated. Please contact support.',
    wrong_account_type:   'That account does not have access here. Please sign in with your customer account.',
    already_signed_in:    'Another account is already signed in. Please sign out first before signing in with a different account.',
  };

  const planBadge = getPlanBadge(user);
  const memberSince = user?.created_at
    ? fmtMonthYear(user.created_at)
    : null;
  const trialEndsAt = user?.trialEndsAt
    ? fmtDate(user.trialEndsAt)
    : null;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{`Sign In — ${branding.platform_name}`}</title>
        <meta name="description" content={`Sign in to your ${branding.platform_name} account.`} />
        <link rel="canonical" href="/login" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        {/* Header — product name only, no duplicate bars */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 w-fit">
            {branding.platform_logo_url ? (
              <img
                src={branding.platform_logo_url}
                alt={branding.platform_name}
                className="h-9 w-auto object-contain shrink-0"
              />
            ) : (
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                JA <span className="text-blue-600 dark:text-blue-400">Profile Studio</span>
              </span>
            )}
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm space-y-5">

            {/* Brand mark */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 flex items-center justify-center mx-auto mb-5">
                <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>

              {user ? (
                /* Already signed in — account choice heading */
                <>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    You're signed in
                  </h1>
                  <p className="text-slate-600 dark:text-slate-300 text-sm">
                    Signed in to <strong className="text-slate-900 dark:text-white font-semibold">{branding.platform_name}</strong>
                  </p>
                </>
              ) : (
                /* Not signed in — sign-in heading */
                <>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Sign in to {branding.platform_name}
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Secured by JA Group Services ID
                  </p>
                </>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessages[error] ?? 'An unexpected error occurred. Please try again.'}</span>
              </div>
            )}

            {user ? (
              /* ── ACCOUNT CHOICE SCREEN (already signed in) ── */
              <>
                {/* Account card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
                  {/* Identity row */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">
                        {(user.name || user.email || 'U').split(' ').map((n: string) => n.charAt(0)).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                    {planBadge && (
                      <Badge className={`text-xs border flex-shrink-0 ${planBadge.cls}`}>
                        <planBadge.icon className="w-3 h-3 mr-1" />
                        {planBadge.label}
                      </Badge>
                    )}
                  </div>

                  {/* Plan / trial details */}
                  {(memberSince || (user.trialActive && trialEndsAt) || user.isSeatUser) && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                      {memberSince && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Member since</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{memberSince}</span>
                        </div>
                      )}
                      {user.trialActive && trialEndsAt && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Trial ends</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">{trialEndsAt}</span>
                        </div>
                      )}
                      {user.isSeatUser && user.seatWorkspaces?.[0] && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Workspace</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{user.seatWorkspaces[0].businessName}</span>
                        </div>
                      )}
                      {user.billing_interval && !user.lifetime_access && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Billing</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">{user.billing_interval}ly</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Three clear action buttons */}
                <div className="space-y-2.5">
                  <Link to="/dashboard/overview">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold">
                      <LayoutDashboard className="w-4 h-4" />
                      Continue to dashboard
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    className="w-full border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2"
                    onClick={handleSwitchAccount}
                    disabled={redirecting}
                  >
                    {redirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sign in with another account
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Log out
                  </Button>
                </div>
              </>
            ) : (
              /* ── SIGN-IN CARD (not signed in) ── */
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md">
                {redirecting ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Redirecting you securely…</p>
                  </div>
                ) : (
                  <>
                    <Button onClick={handleSignIn} size="lg" className="w-full text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                      <ShieldCheck className="mr-2 w-4 h-4" />
                      Continue with JA Group Services ID
                      <ArrowRight className="ml-auto w-4 h-4" />
                    </Button>

                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                        Access is provided through JA Group Services ID. This does not grant access to internal company systems, email, Teams or SharePoint.
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                        By continuing, you agree to the{' '}
                        <Link to="/legal/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms of Service</Link>
                        {' '}and{' '}
                        <Link to="/legal/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy Policy</Link>
                        {' '}of JA Profile Studio, operated by JA Group Services Ltd.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">← Back to home</Link>
              <Link to="/admin/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">Staff portal</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
