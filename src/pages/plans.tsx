import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CircleHelp, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlanComparison from '@/components/public/PlanComparison';

const SITE = 'https://sousamurrayprofiles.jagroupservices.co.uk';

export default function PlansPage() {
  return (
    <>
      <Helmet>
        <title>Plans & Pricing — Sousa Murray Profiles</title>
        <meta name="description" content="Compare every current Sousa Murray Profiles plan, including profile limits, social sharing, website embedding, analytics, organisation tools and custom domains." />
        <link rel="canonical" href={`${SITE}/plans`} />
        <meta property="og:title" content="Plans & Pricing — Sousa Murray Profiles" />
        <meta property="og:description" content="A clear comparison of Sousa Murray Profiles plans and included features." />
        <meta property="og:url" content={`${SITE}/plans`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main>
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-5">Plans & pricing</span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto">
              Choose the profile plan that fits how you work
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Start with a professional public profile, then add more profiles, organisation tools, analytics and custom-domain features as your business grows.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <Link to="/login"><Button size="lg" className="gap-2">Create a profile <ArrowRight className="w-4 h-4" /></Button></Link>
              <Link to="/contact"><Button size="lg" variant="outline">Talk to us</Button></Link>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <PlanComparison />
        </section>

        <section className="border-y border-border bg-muted/25">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: BadgeCheck,
                title: 'Sharing starts on Free',
                text: 'Every public profile can be copied, shared through supported social channels and embedded on a website. Starter and higher plans keep the same sharing tools.',
              },
              {
                icon: ShieldCheck,
                title: 'Central, secure billing',
                text: 'Paid checkout and subscription management are handled through JA Group Services Ltd central payments rather than storing Stripe secret keys inside this website.',
              },
              {
                icon: CircleHelp,
                title: 'Need help choosing?',
                text: 'Tell us how many profiles, organisation users and domains you need. We can point you towards the most suitable current plan before you buy.',
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4"><Icon className="w-5 h-5" /></div>
                  <h2 className="font-bold text-foreground mb-2">{item.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Plan information is kept live</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            The comparison above loads the current public plan configuration from Sousa Murray Profiles. Your dashboard and checkout remain the final source for the entitlement and price attached to an order.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Subscription use is subject to our <Link className="text-primary underline" to="/legal/terms">Terms of Service</Link> and <Link className="text-primary underline" to="/legal/refunds">Refund and Cancellation Policy</Link>.
          </p>
        </section>
      </main>
    </>
  );
}
