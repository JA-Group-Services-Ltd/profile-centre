/**
 * Dashboard — Demo Mode
 * /dashboard/demo
 *
 * Dedicated page for exploring the platform in sandbox mode.
 * Demo mode lets users try features without affecting live data.
 * Placed in the Help Centre area of the dashboard.
 */
import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import {
  FlaskConical, Play, StopCircle, CheckCircle2,
  ArrowRight, Loader2, AlertTriangle, Info,
  User, Building2, QrCode, Mail, Link2, BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOnboarding } from '@/lib/useOnboarding';
import { useAuth } from '@/lib/auth';
import { motion } from 'motion/react';

// ── What you can try in demo mode ─────────────────────────────────────────────

const DEMO_FEATURES = [
  {
    icon: <User className="w-4 h-4" />,
    title: 'Personal Profile (My Card)',
    description: 'Edit your profile, add links, change your photo — nothing goes live.',
    path: '/dashboard/profile',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: <Building2 className="w-4 h-4" />,
    title: 'Business Profile',
    description: 'Try the business page editor — services, gallery, team, FAQs.',
    path: '/dashboard/business-profile',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    icon: <Link2 className="w-4 h-4" />,
    title: 'Links & Social',
    description: 'Add, reorder, and remove links from your profile.',
    path: '/dashboard/links',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    icon: <QrCode className="w-4 h-4" />,
    title: 'QR Code',
    description: 'Preview your QR code and download options.',
    path: '/dashboard/qr-code',
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
  },
  {
    icon: <Mail className="w-4 h-4" />,
    title: 'Email Signature',
    description: 'Build and preview your email signature.',
    path: '/dashboard/email-signature',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: 'Analytics',
    description: 'See how the analytics dashboard looks with sample data.',
    path: '/dashboard/analytics',
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const { user } = useAuth();
  const onboarding = useOnboarding(!!user);
  const [toggling, setToggling] = useState(false);

  const demoActive = onboarding.state.demoMode;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onboarding.toggleDemoMode();
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Helmet>
        <title>Demo Mode — Profile Centre</title>
        <meta name="description" content="Explore Profile Centre features in a safe sandbox without affecting your live data." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/demo" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
          demoActive ? 'bg-amber-500/15' : 'bg-muted'
        }`}>
          <FlaskConical className={`w-6 h-6 ${demoActive ? 'text-amber-500' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Demo Mode</h1>
            {demoActive && (
              <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-xs gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Explore the platform freely — nothing you do in demo mode goes live
          </p>
        </div>
      </div>

      {/* ── Status card ── */}
      <motion.div
        layout
        className={`rounded-2xl border p-5 mb-6 ${
          demoActive
            ? 'bg-amber-500/8 border-amber-500/25'
            : 'bg-card border-border'
        }`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              demoActive ? 'bg-amber-500/20' : 'bg-muted'
            }`}>
              {demoActive
                ? <FlaskConical className="w-5 h-5 text-amber-500" />
                : <Play className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className={`font-semibold text-sm ${demoActive ? 'text-amber-400' : 'text-foreground'}`}>
                {demoActive ? 'Demo mode is active' : 'Demo mode is off'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                {demoActive
                  ? 'Your real data is completely safe. Any changes you make right now are sandboxed and will not affect your live profile or account.'
                  : 'Turn on demo mode to explore features without any risk. Your live data stays untouched.'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleToggle}
            disabled={toggling || onboarding.demoLoading}
            variant={demoActive ? 'outline' : 'default'}
            className={`gap-2 flex-shrink-0 ${
              demoActive
                ? 'border-amber-500/40 text-amber-500 hover:bg-amber-500/10'
                : 'bg-primary'
            }`}
          >
            {toggling || onboarding.demoLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : demoActive
                ? <StopCircle className="w-4 h-4" />
                : <Play className="w-4 h-4" />}
            {demoActive ? 'Exit demo mode' : 'Start demo mode'}
          </Button>
        </div>
      </motion.div>

      {/* ── What is demo mode ── */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1.5">What demo mode does</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Lets you explore every feature safely</li>
                  <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Keeps your real profile data untouched</li>
                  <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> No emails or notifications sent to contacts</li>
                  <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> No billing or payment changes made</li>
                  <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span> Exit at any time — instantly returns to live mode</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1.5">Good to know</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">!</span> The amber banner at the top shows when demo is active</li>
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">!</span> Some actions (like Stripe payments) are always blocked</li>
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">!</span> Demo mode is per-session — it does not affect other devices</li>
                  <li className="flex items-start gap-1.5"><span className="text-amber-400 mt-0.5">!</span> Support tickets submitted in demo mode are still real</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Things to try ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Things to try in demo mode</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {DEMO_FEATURES.map(f => (
            <Link
              key={f.path}
              to={f.path}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${f.color}`}>
                {f.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.description}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── CTA if not active ── */}
      {!demoActive && (
        <div className="flex items-center justify-center p-6 rounded-2xl border border-dashed border-border bg-muted/20">
          <div className="text-center">
            <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Ready to explore?</p>
            <p className="text-xs text-muted-foreground mb-4">Start demo mode and try any feature above — completely risk-free.</p>
            <Button onClick={handleToggle} disabled={toggling || onboarding.demoLoading} className="gap-2 bg-primary">
              {toggling || onboarding.demoLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Play className="w-4 h-4" />}
              Start demo mode
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
