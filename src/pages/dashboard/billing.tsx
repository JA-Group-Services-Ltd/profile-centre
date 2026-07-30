import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { Check, AlertTriangle, X, Calendar, CreditCard, Loader2, ExternalLink, TrendingDown, Star, Zap, Building2 } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';

const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/eVq6oH3k35B89IS9UJfEk00';

function TrialClaimButton({ onClaimed }: { onClaimed: () => void }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [claimed, setClaimed] = useState(false);

  const claim = async () => {
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/trial/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setClaimed(true);
        onClaimed();
      } else if (data.error === 'already_claimed') {
        setError('Your trial has already been claimed.');
      } else {
        setError(data.message || 'Could not start trial. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (claimed) return (
    <div className="flex items-center gap-1.5 text-sm text-green-400">
      <Check className="w-4 h-4" /> Trial started!
    </div>
  );

  return (
    <div className="space-y-1.5">
      <Button onClick={claim} disabled={claiming} className="bg-primary gap-2 flex-shrink-0">
        {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        Start free trial
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface Plan {
  id: number; name: string; slug: string; price_monthly: number; price_yearly: number;
  max_profiles: number; max_org_profiles: number; max_links: number; has_qr_download: number; has_contact_form: number;
  has_advanced_analytics: number; has_vcard_download: number; has_custom_themes: number;
  remove_branding: number; has_lifetime: number;
  max_seats: number; max_themes: number;
  stripe_price_monthly: string | null; stripe_price_yearly: string | null;
  stripe_price_lifetime: string | null;
  _core_features?: string[];
  _included_features?: string[];
  _quote_features?: string[];
}

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const branding = useBranding();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const billingInterval = 'monthly' as const;
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelDone, setCancelDone] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    // Proactively link the user's sign-in email to a Stripe customer record
    // so that webhook events can be matched even before first checkout.
    fetch('/api/billing/init-customer', { method: 'POST', credentials: 'include' }).catch(() => {});

    fetch('/api/plans?include_lifetime=1')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // API returns { plans: [...], addons: [...] }
          const rawPlans: typeof d.plans = (d.plans ?? []).sort((a: { slug: string; price_monthly: number }, b: { slug: string; price_monthly: number }) => {
            if (a.slug === 'ultimate_plus') return 1;
            if (b.slug === 'ultimate_plus') return -1;
            return (a.price_monthly ?? 0) - (b.price_monthly ?? 0);
          });
          // Map API plan shape to the local Plan interface
          setPlans(rawPlans.map((p: {
            id: number; name: string; slug: string;
            price_monthly: number; price_yearly: number;
            max_profiles?: number; max_links?: number; has_qr_download?: number;
            has_contact_form?: number; has_advanced_analytics?: number;
            has_vcard_download?: number; has_custom_themes?: number;
            remove_branding?: number; has_lifetime?: number;
            max_seats?: number; max_themes?: number;
            stripe_price_monthly?: string | null; stripe_price_yearly?: string | null;
            stripe_price_lifetime?: string | null;
            core_features?: string[]; included_features?: string[];
            quote_features?: string[];
          }) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price_monthly: p.price_monthly,
            price_yearly: p.price_yearly,
            max_profiles: p.max_profiles ?? 1,
            max_links: p.max_links ?? 1,
            has_qr_download: p.has_qr_download ?? 0,
            has_contact_form: p.has_contact_form ?? 0,
            has_advanced_analytics: p.has_advanced_analytics ?? 0,
            has_vcard_download: p.has_vcard_download ?? 0,
            has_custom_themes: p.has_custom_themes ?? 0,
            remove_branding: p.remove_branding ?? 0,
            has_lifetime: p.has_lifetime ?? 0,
            max_seats: p.max_seats ?? 0,
            max_themes: p.max_themes ?? 0,
            stripe_price_monthly: p.stripe_price_monthly ?? null,
            stripe_price_yearly: p.stripe_price_yearly ?? null,
            stripe_price_lifetime: p.stripe_price_lifetime ?? null,
            _core_features: p.core_features ?? [],
            _included_features: p.included_features ?? [],
            _quote_features: p.quote_features ?? [],
          })));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const [selectingFree, setSelectingFree] = useState(false);
  const handleSelectFree = async () => {
    setSelectingFree(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/billing/select-free', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCheckoutError(data.error || 'Failed to select free plan. Please try again.');
        return;
      }
      await refreshUser();
    } catch {
      setCheckoutError('Something went wrong. Please try again.');
    } finally {
      setSelectingFree(false);
    }
  };

  const handleUpgrade = async (planId: number) => {
    setCheckoutError('');
    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_id: planId, interval: 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCheckoutError(data.error || 'Failed to start checkout. Please try again.');
        return;
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setCheckoutError('Something went wrong. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getPlanFeatures = (plan: Plan) => {
    // Core capabilities + included add-on features from the API
    const core = plan._core_features ?? [];
    const included = plan._included_features ?? [];
    return [...core, ...included];
  };

  // Determine the effective price to display (monthly only — yearly not offered)
  const getDisplayPrice = (plan: Plan) => {
    if (plan.price_monthly === 0) return { price: 0, label: 'Free' };
    return { price: plan.price_monthly, label: `£${plan.price_monthly}/mo`, sub: 'Billed monthly' };
  };

  // ── Derived state — all declarations in dependency order ─────────────────
  const hasActiveSub = user?.subscription_status && user.subscription_status !== 'cancelled' && !user.lifetime_access;
  const isOnFreePlan = !user?.lifetime_access && (!user?.subscription_status || user.subscription_status === 'cancelled');
  const isOnTrial = !!user?.trialActive;
  const inPlanSelection = !!user?.inPlanSelectionPeriod;
  const isNoPlan = !!user?.isNoPlan;
  const isLifetime = !!user?.lifetime_access;
  // canUpgrade: user can go to Stripe checkout (trial users cannot — they pick a plan to start AFTER trial)
  const canUpgrade = (isOnFreePlan || inPlanSelection || isNoPlan) && !isOnTrial;

  // Only show a plan if the user actually has one assigned — never fall back to plans[0]
  // During trial, suppress currentPlan so we don't show "Current" badge on a plan card
  const currentPlan = (!isOnTrial && user?.plan_id) ? plans.find(p => p.id === user.plan_id) ?? null : null;

  // Plan order for downgrade detection (lower index = lower tier)
  const PLAN_ORDER = ['free', 'starter', 'professional', 'business', 'lifetime'];
  const currentPlanIndex = currentPlan ? PLAN_ORDER.indexOf(currentPlan.slug) : -1;
  const isLowerTier = (plan: Plan) => {
    const idx = PLAN_ORDER.indexOf(plan.slug);
    return idx !== -1 && currentPlanIndex !== -1 && idx < currentPlanIndex;
  };
  const isHigherTier = (plan: Plan) => {
    const idx = PLAN_ORDER.indexOf(plan.slug);
    return idx !== -1 && currentPlanIndex !== -1 && idx > currentPlanIndex;
  };

  // Can checkout: not current plan, has a Stripe monthly price
  // Trial users CANNOT checkout — they must wait until the trial ends, then select a plan
  const canCheckoutPlan = (plan: Plan) => {
    if (plan.price_monthly === 0) return false;
    if (isOnTrial) return false;
    if (!canUpgrade) return false;
    return !!plan.stripe_price_monthly;
  };

  const periodEnd = user?.current_period_end
    ? fmtDate(user.current_period_end, 'long')
    : null;
  const trialEndsFormatted = user?.trialEndsAt
    ? fmtDate(user.trialEndsAt, 'long')
    : null;
  const planDeadlineFormatted = user?.planSelectionDeadline
    ? fmtDate(user.planSelectionDeadline, 'long')
    : null;

  const confirmCancel = async () => {
    setCancelError('');
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed');
      setCancelDone(true);
      await refreshUser();
      setTimeout(() => { setShowCancelDialog(false); setCancelDone(false); }, 3000);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Skeleton className="h-8 w-48 mb-8" />
      <Skeleton className="h-32 w-full rounded-2xl mb-6" />
      <div className="grid sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Plans & Billing — Dashboard</title>
        <meta name="description" content="Manage your subscription plan and billing details." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/billing" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Plans & Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and plan</p>
      </div>

      {/* Current plan summary */}
      {isLifetime ? (
        /* ── LIFETIME: no billing, no plan cards needed ── */
        <Card className="bg-green-500/5 border-green-500/20 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Account Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">Lifetime Access</h2>
                  <Badge className="bg-green-500/15 text-green-400 border-green-500/20">Active</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Lifetime access is active on your account. No recurring subscription is required while this status is active.
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-green-500/8 border border-green-500/15 flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-green-300">
                Lifetime access is a discretionary access status granted by JA Group Services Ltd in selected cases. It may be reviewed, changed, or withdrawn where appropriate under the JA Profile Studio terms. If you have any questions about your access status, please contact support.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isOnTrial ? (
        /* ── TRIAL ACTIVE: calm info + invite to pick a plan ── */
        <Card className="bg-blue-500/5 border-blue-500/20 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Account Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">Free Trial</h2>
                  <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20">Active</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  You have full access to all features during your trial. No payment is taken now.
                </p>
                {trialEndsFormatted && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-400">
                    <Calendar className="w-3.5 h-3.5" />
                    Trial ends {trialEndsFormatted}
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-start gap-2">
              <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                You have full access to all features during your trial. When your trial ends you will be asked to choose a plan. No payment is taken until then.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : inPlanSelection ? (
        /* ── POST-TRIAL: 7-day plan selection period ── */
        <Card className="bg-orange-500/5 border-orange-500/30 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Account Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">Trial Ended — Plan Selection Required</h2>
                  <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/20">Action needed</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">Your trial has ended. Please select a plan to continue using plan features.</p>
                {planDeadlineFormatted && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-400">
                    <Calendar className="w-3.5 h-3.5" />
                    Selection deadline: {planDeadlineFormatted}
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-orange-500/8 border border-orange-500/15 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300">
                Your trial has ended. Please select a plan within 7 days to continue using plan features. If no plan is selected by {planDeadlineFormatted ?? 'the deadline'}, your account will be restricted and most features will be unavailable. Your data will not be deleted — you can subscribe at any time to restore access.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isNoPlan ? (
        /* ── NO PLAN: account exists, no plan selected ── */
        <Card className="bg-muted/30 border-border mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Account Status</p>
                <p className="text-lg font-bold text-foreground">No Plan</p>
                <p className="text-sm text-muted-foreground mt-0.5">Your account is active but you are not on a plan. Select a paid plan below to restore full access, or choose the Free plan to continue with limited features. Your data is safe.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : currentPlan ? (
        <Card className="bg-primary/5 border-primary/20 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">
                    {currentPlan.name}
                  </h2>
                  {user?.subscription_status && (
                    <Badge className={
                      user.subscription_status === 'active'    ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      user.subscription_status === 'past_due'  ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      user.subscription_status === 'cancelled' ? 'bg-muted text-muted-foreground border-0' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }>
                      {user.subscription_status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {currentPlan.price_monthly === 0
                    ? 'Free plan'
                    : `£${currentPlan.price_monthly}/month`}
                </p>
                {user?.billing_interval && user.billing_interval !== 'monthly' && (
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    Billed {user.billing_interval}ly
                  </p>
                )}
                {periodEnd && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {user?.subscription_status === 'cancelled'
                      ? `Access until ${periodEnd}`
                      : `Renews ${periodEnd}`}
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
            </div>

            {/* Cancel button — only shown for active/trialing subscriptions */}
            {hasActiveSub && (
              <div className="mt-5 pt-5 border-t border-border/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Cancel subscription</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You'll keep access until {periodEnd ?? 'the end of your billing period'}, then your access will be locked.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 flex-shrink-0 gap-1.5"
                    onClick={() => { setCancelError(''); setShowCancelDialog(true); }}
                  >
                    <X className="w-3.5 h-3.5" /> Cancel Plan
                  </Button>
                </div>
              </div>
            )}

            {user?.subscription_status === 'cancelled' && periodEnd && (
              <div className="mt-4 p-3 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  Your subscription has been cancelled. You'll retain access to your current plan until <strong>{periodEnd}</strong>, after which your account will move to the Free plan.
                </p>
              </div>
            )}

            {/* Stripe customer portal — shown whenever user has/had a paid subscription */}
            {(hasActiveSub || user?.subscription_status === 'cancelled') && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <a href={STRIPE_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="border-border gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Manage Subscription
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Update payment method, download invoices, or manage your billing details.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30 border-border mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Current Plan</p>
                <p className="text-lg font-bold text-foreground">Free account</p>
                <p className="text-sm text-muted-foreground mt-0.5">Limited to 1 profile and 1 link. Upgrade or start your free trial to unlock everything.</p>
              </div>
            </div>
            {/* Trial CTA — only shown if trial not yet claimed and not expired */}
            {!user?.trialActive && !user?.trialExpired && (
              <div className="mt-5 pt-5 border-t border-border/50">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-blue-400" /> Start your free 30-day trial
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Full access to all features. No credit card required. No automatic charges.</p>
                  </div>
                  <TrialClaimButton onClaimed={refreshUser} />
                </div>
              </div>
            )}
            {user?.trialExpired && !inPlanSelection && !isNoPlan && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/8 border border-red-500/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">Your free trial has expired. Select a plan below to restore access to your profile and features.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available plans — shown to all users including lifetime */}
      <>
      <div id="available-plans" className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isLifetime ? 'All Plans' : isOnTrial ? 'Plan overview' : hasActiveSub ? 'Your Plan Options' : 'Available Plans'}
          </h2>
          {isLifetime && (
            <p className="text-xs text-muted-foreground mt-0.5">
              To change your plan, please contact us — we'll handle it for you.
            </p>
          )}
          {isOnTrial && (
            <p className="text-xs text-muted-foreground mt-0.5">
              You are on a free trial. Plans become available to subscribe once your trial ends.
            </p>
          )}
          {hasActiveSub && !isOnTrial && (
            <p className="text-xs text-muted-foreground mt-0.5">
              To move to a lower plan, cancel your current subscription via the Stripe portal — your account will downgrade automatically at the end of your billing period.
            </p>
          )}
        </div>
      </div>
      {checkoutError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {checkoutError}
        </div>
      )}

      {/* Plan cards */}
      {(() => {
        const planMeta: Record<string, { desc: string; icon: React.ReactNode; badge?: string; badgeClass?: string }> = {
          free:              { desc: 'Get started with a single digital card', icon: <Zap className="w-5 h-5 text-muted-foreground" /> },
          starter:           { desc: 'Perfect for individuals & freelancers', icon: <Star className="w-5 h-5 text-blue-400" />, badge: 'Popular', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
          professional:      { desc: 'For professionals managing multiple profiles', icon: <CreditCard className="w-5 h-5 text-purple-400" />, badge: 'Best Value', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
          business:          { desc: 'Teams, agencies & growing organisations', icon: <Building2 className="w-5 h-5 text-blue-400" /> },
          ultimate_business: { desc: 'Multiple brands with full seat management', icon: <Building2 className="w-5 h-5 text-amber-400" />, badge: 'Most Powerful', badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
          ultimate_plus:     { desc: 'Large organisations — bespoke, white-glove service', icon: <Star className="w-5 h-5 text-amber-500" />, badge: 'Enterprise', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
          lifetime:          { desc: 'Discretionary lifetime access — contact us for details', icon: <Star className="w-5 h-5 text-green-400" /> },
        };
        return (
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {plans.filter(plan => !plan.has_lifetime).map(plan => {
              const isEnterprise = plan.slug === 'ultimate_plus';
              const isCurrent = !isOnTrial && plan.id === user?.plan_id;
              const features = getPlanFeatures(plan);
              const canCheckout = canCheckoutPlan(plan);
              const isPaidPlan = plan.price_monthly > 0;
              const isLoadingThis = checkoutLoading === plan.id;
              const meta = planMeta[plan.slug] ?? { desc: '', icon: <Zap className="w-5 h-5" /> };
              const displayPrice = getDisplayPrice(plan);
              const isDowngrade = hasActiveSub && !isCurrent && isLowerTier(plan);
              const isUpgradeBlocked = hasActiveSub && !isCurrent && isHigherTier(plan);

              return (
                <Card key={plan.id} className={`border-2 transition-all flex flex-col ${
                  isCurrent
                    ? isEnterprise ? 'border-amber-500' : 'border-primary'
                    : isEnterprise ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5' : 'border-border'
                } bg-card`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isCurrent ? (isEnterprise ? 'bg-amber-500/20' : 'bg-primary/20') : 'bg-muted'}`}>
                          {meta.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base leading-tight">{plan.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {isCurrent && <Badge className={`${isEnterprise ? 'bg-amber-500' : 'bg-primary'} text-white border-0 text-xs`}>Current</Badge>}
                        {!isCurrent && meta.badge && <Badge className={`text-xs ${meta.badgeClass}`}>{meta.badge}</Badge>}
                      </div>
                    </div>
                    <div className="mt-3">
                      {isEnterprise ? (
                        <span className="text-2xl font-bold text-amber-600">Contact us</span>
                      ) : displayPrice.price === 0 ? (
                        <span className="text-2xl font-bold text-foreground">Free</span>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-foreground">£{displayPrice.price}</span>
                            <span className="text-sm font-normal text-muted-foreground">/month</span>
                          </div>
                          {displayPrice.sub && (
                            <p className="text-xs text-muted-foreground mt-0.5">{displayPrice.sub}</p>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    <ul className="space-y-2 mb-4 flex-1">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isEnterprise ? 'text-amber-500' : 'text-green-400'}`} /> {f}
                        </li>
                      ))}
                    </ul>

                    {/* ── CTA button logic ── */}
                    {isEnterprise ? (
                      isCurrent ? (
                        <Button variant="outline" className="w-full border-amber-500/30 text-amber-600" disabled>
                          Your current plan
                        </Button>
                      ) : (
                        <a href={`mailto:${branding.contact_email || 'japrofilestudio@jagroupservices.co.uk'}?subject=Ultimate%20Organisation%2B%20Enquiry`} className="block w-full">
                          <Button className="w-full bg-amber-500 hover:bg-amber-400 text-white font-semibold gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Contact us for pricing
                          </Button>
                        </a>
                      )
                    ) : isLifetime && isPaidPlan ? (
                      /* Lifetime user — must contact us to change plan */
                      <a href={`mailto:${branding.contact_email || 'japrofilestudio@jagroupservices.co.uk'}?subject=Plan%20Change%20Request`} className="block w-full">
                        <Button variant="outline" className="w-full border-border gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" /> Contact us to switch
                        </Button>
                      </a>
                    ) : isLifetime && !isPaidPlan ? (
                      /* Lifetime user — free plan not applicable */
                      <Button variant="outline" className="w-full border-border text-muted-foreground" disabled>
                        Not applicable
                      </Button>
                    ) : isCurrent ? (
                      /* Current plan — no action */
                      <Button variant="outline" className="w-full border-border" disabled>
                        Your current plan
                      </Button>
                    ) : isOnTrial && isPaidPlan ? (
                      /* Trial active — cannot subscribe yet, must wait until trial ends */
                      <div className="space-y-1.5">
                        <Button variant="outline" className="w-full border-border text-muted-foreground" disabled>
                          Available after trial
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          You can subscribe once your trial ends
                        </p>
                      </div>
                    ) : isOnTrial && !isPaidPlan ? (
                      /* Free plan during trial — trial covers everything, free not relevant */
                      <Button variant="outline" className="w-full border-border text-muted-foreground" disabled>
                        Not applicable during trial
                      </Button>
                    ) : !isPaidPlan && hasActiveSub ? (
                      /* Free plan card — user is on a paid plan; tell them to cancel to drop to free */
                      <div className="space-y-1.5">
                        <Button
                          variant="outline"
                          className="w-full border-border text-muted-foreground"
                          onClick={() => { setCancelError(''); setShowCancelDialog(true); }}
                        >
                          Cancel subscription to use Free
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          Your account moves to Free at the end of your billing period
                        </p>
                      </div>
                    ) : isDowngrade ? (
                      /* Lower paid tier — downgrade via Stripe portal */
                      <div className="space-y-1.5">
                        <a href={STRIPE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="block">
                          <Button variant="outline" className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10 gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5" /> Downgrade via Stripe Portal
                          </Button>
                        </a>
                        <p className="text-xs text-muted-foreground text-center">
                          Cancel your current plan in the portal — your account moves to this plan automatically.
                        </p>
                      </div>
                    ) : isUpgradeBlocked ? (
                      /* Higher tier — on active paid plan, upgrade via Stripe portal */
                      <div className="space-y-1.5">
                        <a href={STRIPE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="block">
                          <Button className="w-full bg-primary hover:bg-primary/90 gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Upgrade via Stripe Portal
                          </Button>
                        </a>
                        <p className="text-xs text-muted-foreground text-center">
                          Switch to this plan from your Stripe billing portal.
                        </p>
                      </div>
                    ) : canCheckout ? (
                      /* Free/post-trial/no-plan — can subscribe */
                      <Button
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={isLoadingThis}
                      >
                        {isLoadingThis
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                          : `Subscribe to ${plan.name}`
                        }
                      </Button>
                    ) : !isPaidPlan && (inPlanSelection || isNoPlan) ? (
                      /* Post-trial / no-plan — can explicitly choose free */
                      <div className="space-y-1.5">
                        <Button
                          variant="outline"
                          className="w-full border-border hover:border-primary/40"
                          onClick={handleSelectFree}
                          disabled={selectingFree}
                        >
                          {selectingFree
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Selecting…</>
                            : 'Continue with Free plan'
                          }
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          Limited features — upgrade any time
                        </p>
                      </div>
                    ) : !isPaidPlan ? (
                      /* Free plan — user is already on free (no plan_id match but effectively free) */
                      <Button variant="outline" className="w-full border-border" disabled>
                        Your current plan
                      </Button>
                    ) : isPaidPlan && !plan.stripe_price_monthly && !plan.stripe_price_yearly ? (
                      <Button variant="outline" className="w-full border-border" disabled>
                        Contact us to subscribe
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full border-border" disabled>
                        Not available
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* Upgrade interest — only shown when no paid plans have Stripe configured */}
      {plans.every(p => p.price_monthly === 0 || (!p.stripe_price_monthly && !p.stripe_price_yearly)) && (
        <Card className="bg-muted/30 border-border mb-6">
          <CardContent className="p-6 text-center">
            <p className="text-foreground font-medium mb-2">Need help with your plan?</p>
            <p className="text-muted-foreground text-sm mb-4">
              Contact JA Group Services to upgrade or change your plan manually.
            </p>
            <a href={`mailto:${branding.contact_email || 'japrofilestudio@jagroupservices.co.uk'}`}>
              <Button className="bg-primary">Contact JA Group Services</Button>
            </a>
          </CardContent>
        </Card>
      )}
        </>

      {/* ── Add-ons section removed — features are now included in plans ── */}

      {/* Payment security notice */}
      <Card className="bg-blue-500/5 border-blue-500/20 mb-6">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Payment security</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All subscription payments are processed securely by <strong className="text-foreground">Stripe</strong>. JA Profile Studio never stores your card details. Plan subscription payments are handled through Stripe Checkout only — you will always be redirected to a secure Stripe-hosted page.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                <strong className="text-foreground">Business Cards are separate.</strong> Business Card payments are handled through official Stripe invoices or Stripe payment links issued by admin — not through this subscription checkout. Never pay for Business Cards through any link that has not been officially issued by JA Profile Studio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-400" /> Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>

          {cancelDone ? (
            <div className="py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-foreground font-medium">Subscription cancelled</p>
              <p className="text-muted-foreground text-sm mt-1">
                You'll retain access until {periodEnd ?? 'the end of your billing period'}.
              </p>
            </div>
          ) : (
            <>
              <div className="py-2 space-y-3">
                {cancelError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{cancelError}</div>
                )}
                <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                  {[
                    periodEnd ? `You'll keep full access until ${periodEnd}` : 'You keep access until the end of your billing period',
                    'After that, your account moves to the Free plan',
                    'Your profiles and links will be preserved',
                    'This action cannot be undone',
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${i === 3 ? 'bg-red-400' : 'bg-muted-foreground'}`} />
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="border-border">
                  Keep my plan
                </Button>
                <Button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel subscription'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
