import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PublicPlan {
  id: number | string;
  name: string;
  slug: string;
  price_monthly?: number | null;
  max_profiles?: number | null;
  max_org_profiles?: number | null;
  max_links?: number | null;
  max_seats?: number | null;
  has_qr_download?: number | boolean | null;
  has_contact_form?: number | boolean | null;
  has_advanced_analytics?: number | boolean | null;
  has_vcard_download?: number | boolean | null;
  has_custom_themes?: number | boolean | null;
  has_profile_link_customisation?: number | boolean | null;
  remove_branding?: number | boolean | null;
  has_messaging?: number | boolean | null;
  has_custom_domain?: number | boolean | null;
  core_features?: string[];
  included_features?: string[];
}

const FALLBACK_PLANS: PublicPlan[] = [
  { id: 'free', name: 'Free', slug: 'free', price_monthly: 0, max_profiles: 1, max_org_profiles: 0, max_links: 1, max_seats: 0, has_custom_domain: 0, core_features: ['Public profile', 'QR sharing', 'Social sharing', 'Website embed'] },
  { id: 'starter', name: 'Starter', slug: 'starter', price_monthly: 5, max_profiles: 1, max_org_profiles: 0, max_links: 20, max_seats: 0, has_contact_form: 1, has_custom_domain: 0, core_features: ['More links', 'Contact form', 'Social sharing', 'Website embed'] },
  { id: 'professional', name: 'Professional', slug: 'professional', price_monthly: 15, max_profiles: 10, max_org_profiles: 1, max_seats: 0, has_advanced_analytics: 1, has_custom_domain: 1, core_features: ['Advanced analytics', 'Organisation profiles', 'Custom domain'] },
  { id: 'business', name: 'Business', slug: 'business', price_monthly: 29, max_profiles: 25, max_org_profiles: 1, max_seats: 5, has_advanced_analytics: 1, has_custom_domain: 1, core_features: ['Team seats', 'Organisation profile', 'Custom domain'] },
  { id: 'ultimate_plus', name: 'Ultimate Organisation+', slug: 'ultimate_plus', price_monthly: null, max_profiles: 50, max_org_profiles: 1, max_seats: 25, has_advanced_analytics: 1, has_custom_domain: 1, core_features: ['Tailored organisation service', 'Expanded limits', 'Priority support'] },
];

function truthy(value: unknown) {
  return value === true || Number(value) === 1;
}

function count(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sortPlans(plans: PublicPlan[]) {
  const order = ['free', 'starter', 'professional', 'business', 'ultimate_business', 'ultimate_plus'];
  return [...plans].sort((a, b) => {
    const aIndex = order.indexOf(a.slug);
    const bIndex = order.indexOf(b.slug);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
    return Number(a.price_monthly ?? Number.MAX_SAFE_INTEGER) - Number(b.price_monthly ?? Number.MAX_SAFE_INTEGER);
  });
}

function planPrice(plan: PublicPlan) {
  if (plan.slug === 'ultimate_plus' && !Number(plan.price_monthly)) return 'Tailored';
  const price = Number(plan.price_monthly ?? 0);
  return price === 0 ? 'Free' : `£${price.toFixed(price % 1 === 0 ? 0 : 2)}`;
}

function planCta(plan: PublicPlan) {
  if (plan.slug === 'ultimate_plus' && !Number(plan.price_monthly)) return { to: '/contact', label: 'Contact us' };
  if (plan.slug === 'free') return { to: '/login', label: 'Create free account' };
  return { to: `/login?trial=1&plan=${encodeURIComponent(plan.slug)}`, label: 'Choose plan' };
}

function Tick({ yes }: { yes: boolean }) {
  return yes
    ? <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-medium"><Check className="w-4 h-4" /> Yes</span>
    : <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="w-4 h-4" /> No</span>;
}

export default function PlanComparison({ compact = false }: { compact?: boolean }) {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    fetch('/api/plans', { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !Array.isArray(payload.plans)) throw new Error('plans_unavailable');
        const publicPlans = payload.plans.filter((plan: PublicPlan) => !String(plan.slug).includes('lifetime'));
        if (!publicPlans.length) throw new Error('plans_empty');
        setPlans(sortPlans(publicPlans));
      })
      .catch(() => {
        setUsingFallback(true);
        setPlans(FALLBACK_PLANS);
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const displayedPlans = useMemo(() => sortPlans(plans), [plans]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground" role="status">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading current plans…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {usingFallback && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Live plan data is temporarily unavailable, so the standard plan guide is shown. Confirm the current price at checkout before purchasing.
        </div>
      )}

      <div className={`grid gap-4 ${displayedPlans.length >= 5 ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {displayedPlans.map(plan => {
          const cta = planCta(plan);
          const featured = plan.slug === 'professional';
          const features = [...new Set([...(plan.core_features || []), ...(plan.included_features || [])])].slice(0, compact ? 4 : 6);
          return (
            <article key={plan.id} className={`relative rounded-2xl border p-5 bg-card flex flex-col ${featured ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'}`}>
              {featured && <span className="absolute -top-3 left-4 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1">Popular</span>}
              <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
              <div className="mt-3 mb-4">
                <span className="text-3xl font-extrabold text-foreground">{planPrice(plan)}</span>
                {Number(plan.price_monthly) > 0 && <span className="text-sm text-muted-foreground"> / month</span>}
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-5">
                {features.length ? features.map(feature => (
                  <li key={feature} className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> <span>{feature}</span></li>
                )) : <li>Plan entitlements are shown in the comparison below.</li>}
              </ul>
              <Link to={cta.to} className="block">
                <Button className="w-full gap-2" variant={featured ? 'default' : 'outline'}>{cta.label}<ArrowRight className="w-4 h-4" /></Button>
              </Link>
            </article>
          );
        })}
      </div>

      {!compact && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-lg text-foreground">Detailed plan comparison</h2>
            <p className="text-sm text-muted-foreground mt-1">This table reads the current public plan configuration. Sharing and website embedding are available from Free upwards.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground sticky left-0 bg-muted/95 z-10 min-w-52">Feature</th>
                  {displayedPlans.map(plan => <th key={plan.id} className="px-4 py-3 text-center font-semibold text-foreground min-w-36">{plan.name}</th>)}
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Monthly price" plans={displayedPlans} render={plan => planPrice(plan)} />
                <ComparisonRow label="Personal profiles" plans={displayedPlans} render={plan => count(plan.max_profiles) ? String(count(plan.max_profiles)) : '—'} />
                <ComparisonRow label="Organisation profiles" plans={displayedPlans} render={plan => count(plan.max_org_profiles) ? String(count(plan.max_org_profiles)) : '—'} />
                <ComparisonRow label="Profile / social links" plans={displayedPlans} render={plan => count(plan.max_links) ? String(count(plan.max_links)) : 'Plan limit'} />
                <ComparisonRow label="Share to Facebook, Instagram, Snapchat, WhatsApp & Messenger" plans={displayedPlans} render={() => <Tick yes />} />
                <ComparisonRow label="Website embed code" plans={displayedPlans} render={() => <Tick yes />} />
                <ComparisonRow label="Public profile & QR sharing" plans={displayedPlans} render={() => <Tick yes />} />
                <ComparisonRow label="QR code download" plans={displayedPlans} render={plan => <Tick yes={truthy(plan.has_qr_download) || plan.slug !== 'free'} />} />
                <ComparisonRow label="Contact form" plans={displayedPlans} render={plan => <Tick yes={truthy(plan.has_contact_form)} />} />
                <ComparisonRow label="Advanced analytics" plans={displayedPlans} render={plan => <Tick yes={truthy(plan.has_advanced_analytics)} />} />
                <ComparisonRow label="Custom domain" plans={displayedPlans} render={plan => <Tick yes={truthy(plan.has_custom_domain)} />} />
                <ComparisonRow label="Team seats" plans={displayedPlans} render={plan => count(plan.max_seats) ? String(count(plan.max_seats)) : '—'} />
                <ComparisonRow label="Remove Sousa Murray Profiles branding" plans={displayedPlans} render={plan => <Tick yes={truthy(plan.remove_branding)} />} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({ label, plans, render }: { label: string; plans: PublicPlan[]; render: (plan: PublicPlan) => React.ReactNode }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      <th scope="row" className="text-left px-4 py-3 font-medium text-foreground sticky left-0 bg-card/95 z-10">{label}</th>
      {plans.map(plan => <td key={plan.id} className="px-4 py-3 text-center text-foreground">{render(plan)}</td>)}
    </tr>
  );
}
