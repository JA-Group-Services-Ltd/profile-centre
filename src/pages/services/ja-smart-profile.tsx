import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, QrCode, Link2, User, BarChart3, Palette, Shield, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

const features = [
  { icon: User,      title: 'Digital Profile',    desc: 'A professional public profile page with your contact details, job title and business information.' },
  { icon: Link2,     title: 'Custom Links',        desc: 'Add links to your website, social media, portfolio or any other URL.' },
  { icon: QrCode,    title: 'QR Code',             desc: 'A unique QR code that links directly to your profile. Download and use on printed materials.' },
  { icon: BarChart3, title: 'Analytics',           desc: 'See how many people have viewed your profile and clicked your links.' },
  { icon: Palette,   title: 'Profile Themes',      desc: 'Customise the look of your profile with different themes and colour options.' },
  { icon: Shield,    title: 'Privacy Controls',    desc: 'Control who can see your profile and whether it appears in search engines.' },
  { icon: CreditCard, title: 'Business Cards',     desc: 'Request professionally printed business cards with your QR code and contact details. Managed through your dashboard.' },
];

const plans = [
  { name: 'Free',     price: '£0',    period: '/month', features: ['1 profile', '1 link', 'QR code', 'Public profile URL'], cta: 'Get started free', highlight: false },
  { name: 'Starter',  price: 'From £X', period: '/month', features: ['More profiles', 'More links', 'Analytics', 'Custom themes', '30-day free trial'], cta: 'Start free trial', highlight: true },
  { name: 'Pro',      price: 'From £X', period: '/month', features: ['Everything in Starter', 'Business profile', 'Email signature', 'Priority support', '30-day free trial'], cta: 'Start free trial', highlight: false },
];

export default function JASmartProfileServicePage() {
  const branding = useBranding();
  return (
    <>
      <Helmet>
        <title>{`JA Profile Studio — ${branding.platform_name}`}</title>
        <meta name="description" content="JA Profile Studio is a digital profile service by JA Group Services Ltd. Share your contact details, links and QR code in one professional profile." />
        <link rel="canonical" href={`${APP_URL}/services/ja-profile-studio`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`JA Profile Studio — ${branding.platform_name}`} />
        <meta property="og:description" content="A professional digital profile service. Share your contact details, links and QR code in one place." />
        <meta property="og:url" content={`${APP_URL}/services/ja-profile-studio`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Breadcrumb */}
        <p className="text-sm text-muted-foreground mb-8">
          <Link to="/services" className="hover:text-foreground transition-colors">Services</Link>
          {' / '}
          <span className="text-foreground">JA Profile Studio</span>
        </p>

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live service
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">JA Profile Studio</h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-6">
            A professional digital profile service that helps you keep your contact details, business information, links and QR code in one simple place.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/login">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                Get started free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/help">
              <Button variant="outline" className="gap-2">Learn more</Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-foreground mb-6">What's included</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-5 rounded-2xl border border-border bg-card">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plans summary */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-foreground mb-2">Plans</h2>
          <p className="text-sm text-muted-foreground mb-6">The free plan requires no credit card. Paid plans include a 30-day free trial. See the <Link to="/#pricing" className="text-primary hover:underline">homepage pricing section</Link> for full plan details and current prices.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div key={plan.name} className={`p-5 rounded-2xl border ${plan.highlight ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                <p className="font-bold text-foreground mb-1">{plan.name}</p>
                <p className="text-lg font-bold text-primary mb-3">{plan.price}<span className="text-xs font-normal text-muted-foreground">{plan.period}</span></p>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-green-500 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/login">
                  <Button size="sm" variant={plan.highlight ? 'default' : 'outline'} className="w-full text-xs">
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Business Cards note */}
        <div className="p-5 rounded-2xl bg-muted/40 border border-border">
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-sm mb-1">Printed Business Cards</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Professionally printed business cards with your QR code and contact details are available to order through your dashboard. Pricing is confirmed before any work begins.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
