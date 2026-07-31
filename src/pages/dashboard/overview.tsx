/**
 * Dashboard Overview — immersive glass redesign v2
 * /dashboard/overview
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, useInView } from 'motion/react';
import {
  Eye, MousePointerClick, Mail, Link2, ArrowRight, ExternalLink,
  User, Plus, Building2, CreditCard, AlertTriangle,
  Lock, Sparkles, QrCode, BarChart3, Settings,
  Palette, FileText, Shield, Zap, TrendingUp, Clock, Star,
  Activity, ChevronRight, Globe, CheckCircle2, Circle,
  Target, Share2, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import AssistedAccessBanner from '@/components/dashboard/AssistedAccessBanner';

interface Profile {
  id: number;
  username: string;
  display_name: string;
  is_published: number;
  profile_type?: string;
  biz_slug?: string;
  person_slug?: string;
}

interface Enquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  message: string;
  created_at: string;
  is_read: number;
  profile_name: string;
}

interface Analytics {
  totalViews: number;
  recentViews: number;
  totalClicks: number;
  recentClicks: number;
  prevViews: number;
  prevClicks: number;
  uniqueVisitors: number;
  prevUniqueVisitors: number;
  ctr: number;
  prevCtr: number;
}

function getProfilePath(p: Profile): string {
  if (p.profile_type === 'business' && p.biz_slug) return `/profile/${p.biz_slug}`;
  return `/profile/${p.username}`;
}

function getPlanLabel(user: ReturnType<typeof useAuth>['user']): { label: string; color: string; glow: string } {
  if (!user) return { label: 'Loading…', color: 'bg-muted text-muted-foreground', glow: '' };
  if (user.hasLifetimeAccess) return { label: 'Lifetime', color: 'bg-green-500/15 text-green-600 dark:text-green-400', glow: 'shadow-green-500/20' };
  if (user.trialActive) return { label: 'Trial Active', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20' };

  // Use plan_name from server when available — it reflects the actual DB display name
  const planName = (user as { plan_name?: string }).plan_name;
  const planSlug = (user as { plan_slug?: string }).plan_slug ?? '';

  if (planSlug === 'ultimate_plus') return { label: planName ?? 'Ultimate Organisation+', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', glow: 'shadow-amber-500/20' };
  if (planSlug === 'ultimate_business') return { label: planName ?? 'Ultimate Organisation', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', glow: 'shadow-purple-500/20' };
  if (planSlug === 'business') return { label: planName ?? 'Organisation', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', glow: 'shadow-purple-500/20' };
  if (planSlug === 'professional') return { label: planName ?? 'Professional', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20' };
  if (planSlug === 'starter') return { label: planName ?? 'Starter', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20' };

  if (user.hasBusinessAccess) return { label: planName ?? 'Business', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', glow: 'shadow-purple-500/20' };
  if (user.hasStarterAccess) return { label: planName ?? 'Starter', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', glow: 'shadow-blue-500/20' };
  if (user.isSeatUser) {
    const wsName = user.seatWorkspaces?.[0]?.ownerPlanName;
    return { label: wsName ? `${wsName} Seat` : 'Team Seat', color: 'bg-green-500/15 text-green-600 dark:text-green-400', glow: 'shadow-green-500/20' };
  }
  if ((user as { inPlanSelectionPeriod?: boolean }).inPlanSelectionPeriod) return { label: 'Trial Ended — Select Plan', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', glow: '' };
  if ((user as { isNoPlan?: boolean }).isNoPlan) return { label: 'No Plan', color: 'bg-muted text-muted-foreground', glow: '' };
  if (user.trialExpired) return { label: 'Trial Expired', color: 'bg-red-500/15 text-red-600 dark:text-red-400', glow: '' };
  if (user.isDowngraded) return { label: 'Downgraded', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', glow: '' };
  if (user.hasNoActivePlan) return { label: 'No active plan', color: 'bg-muted text-muted-foreground', glow: '' };
  return { label: 'Free', color: 'bg-muted text-muted-foreground', glow: '' };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Animated counter
function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = value / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, value, duration]);

  return <span ref={ref}>{display.toLocaleString()}</span>;
}

// Profile completion score
function getCompletionScore(profile: Profile | null, linkCount: number): { score: number; items: { label: string; done: boolean }[] } {
  const items = [
    { label: 'Profile created', done: !!profile },
    { label: 'Display name set', done: !!(profile?.display_name) },
    { label: 'Profile published', done: !!(profile?.is_published) },
    { label: 'Links added', done: linkCount > 0 },
    { label: '3+ links added', done: linkCount >= 3 },
  ];
  const done = items.filter(i => i.done).length;
  return { score: Math.round((done / items.length) * 100), items };
}

// Circular progress ring
function RingProgress({ value, size = 64, stroke = 5, color = '#3b82f6' }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

// Glass card base — semantic colours so it works in both light and dark mode
const glass = 'bg-card border border-border rounded-2xl shadow-sm';

export default function OverviewPage() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [personalProfile, setPersonalProfile] = useState<Profile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Profile | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [linkCount, setLinkCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedBiz, setCopiedBiz] = useState(false);
  const [emailSigEnabled, setEmailSigEnabled] = useState(false);

  // Auto-claim trial if user clicked a pricing CTA before logging in.
  // Intent is passed as URL params (?trial=1&plan=starter) — no sessionStorage.
  useEffect(() => {
    const intent = searchParams.get('trial');
    if (!intent || !user) return;
    const planSlug = searchParams.get('plan') || undefined;
    // Clear the params from the URL immediately
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('trial');
      next.delete('plan');
      return next;
    }, { replace: true });
    if (user.trialActive || user.trialExpired) return;
    fetch('/api/trial/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planSlug }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          refreshUser();
          // Send user to billing so they can see their active trial on the chosen plan
          window.location.href = '/dashboard/billing';
        }
      })
      .catch(() => {});
  }, [user]);

  // Load feature flags (email signature visibility)
  useEffect(() => {
    fetch('/api/feature-flags')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const globalOn = d.data?.feature_email_signature === '1';
          setEmailSigEnabled(globalOn);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const profilesRes = await fetch('/api/profiles/me', { credentials: 'include' });
        const profilesData = await profilesRes.json();
        let activeProfileForStats: Profile | null = null;
        if (profilesData.success && profilesData.data.length > 0) {
          const biz = profilesData.data.find((p: Profile) => p.profile_type === 'business') ?? null;
          const personal = profilesData.data.find((p: Profile) => p.profile_type !== 'business') ?? null;
          setPersonalProfile(personal);
          setBusinessProfile(biz);
          activeProfileForStats = biz ?? personal ?? profilesData.data[0];
        }
        if (!activeProfileForStats && user?.isSeatUser && user.seatWorkspaces?.[0]) {
          const ws = user.seatWorkspaces[0];
          const bizRes = await fetch(`/api/business/${ws.profileId}`, { credentials: 'include' });
          const bizData = await bizRes.json();
          if (bizData.success) {
            const seatBiz: Profile = {
              id: bizData.data.id,
              username: bizData.data.biz_slug || '',
              display_name: bizData.data.business_name || bizData.data.display_name || '',
              is_published: bizData.data.is_published,
              profile_type: 'business',
              biz_slug: bizData.data.biz_slug,
            };
            setBusinessProfile(seatBiz);
            activeProfileForStats = seatBiz;
          }
        }
        if (activeProfileForStats) {
          // Fetch analytics for ALL profiles and aggregate them
          const allProfiles: Profile[] = profilesData.success ? profilesData.data : [];
          const profilesForStats = allProfiles.length > 0 ? allProfiles : [activeProfileForStats];

          const [analyticsResults, linksRes, enquiriesRes] = await Promise.all([
            Promise.all(
              profilesForStats.map(p =>
                fetch(`/api/analytics/${p.id}`, { credentials: 'include' })
                  .then(r => r.json())
                  .catch(() => null)
              )
            ),
            fetch(`/api/links/${activeProfileForStats.id}`, { credentials: 'include' }),
            fetch('/api/enquiries', { credentials: 'include' }),
          ]);

          // Aggregate analytics across all profiles
          const validAnalytics = analyticsResults.filter(d => d?.success).map(d => d.data);
          if (validAnalytics.length > 0) {
            const agg: Analytics = {
              totalViews:        validAnalytics.reduce((s, d) => s + (d.totalViews ?? 0), 0),
              recentViews:       validAnalytics.reduce((s, d) => s + (d.recentViews ?? 0), 0),
              totalClicks:       validAnalytics.reduce((s, d) => s + (d.totalClicks ?? 0), 0),
              recentClicks:      validAnalytics.reduce((s, d) => s + (d.recentClicks ?? 0), 0),
              prevViews:         validAnalytics.reduce((s, d) => s + (d.prevViews ?? 0), 0),
              prevClicks:        validAnalytics.reduce((s, d) => s + (d.prevClicks ?? 0), 0),
              uniqueVisitors:    validAnalytics.reduce((s, d) => s + (d.uniqueVisitors ?? 0), 0),
              prevUniqueVisitors:validAnalytics.reduce((s, d) => s + (d.prevUniqueVisitors ?? 0), 0),
              ctr:               0,
              prevCtr:           0,
            };
            const totalV = agg.recentViews;
            const totalC = agg.recentClicks;
            agg.ctr = totalV > 0 ? Math.round((totalC / totalV) * 100 * 10) / 10 : 0;
            const prevV = agg.prevViews;
            const prevC = agg.prevClicks;
            agg.prevCtr = prevV > 0 ? Math.round((prevC / prevV) * 100 * 10) / 10 : 0;
            setAnalytics(agg);
          }

          const [linksData, enquiriesData] = await Promise.all([linksRes.json(), enquiriesRes.json()]);
          if (linksData.success) setLinkCount(linksData.data.filter((l: { is_enabled: number }) => l.is_enabled).length);
          if (enquiriesData.success) setEnquiries(enquiriesData.data.slice(0, 4));
        } else {
          const enquiriesRes = await fetch('/api/enquiries', { credentials: 'include' });
          const enquiriesData = await enquiriesRes.json();
          if (enquiriesData.success) setEnquiries(enquiriesData.data.slice(0, 4));
        }
      } catch { /* non-fatal */ }
      setLoading(false);
    }
    load();
  }, [user]);

  const unreadCount = enquiries.filter(e => !e.is_read).length;
  const planLabel = getPlanLabel(user);
  const seatWorkspace = user?.isSeatUser ? user.seatWorkspaces?.[0] : null;
  const seatPerms = seatWorkspace?.permissions;
  const hasOwnBusinessAccess = !!(user?.hasBusinessAccess && !user?.isSeatUser);
  const hasPersonalAccess = !!(user?.hasStarterAccess || user?.hasBusinessAccess || user?.hasLifetimeAccess || user?.trialActive);
  const isSeatOnly = !!(user?.isSeatUser && !user?.hasBusinessAccess && !user?.hasStarterAccess && !user?.hasLifetimeAccess);
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const ctr = analytics?.ctr ?? 0;
  const prevCtr = analytics?.prevCtr ?? 0;

  function pctChange(cur: number, prev: number): string | null {
    if (prev === 0) return null;
    const p = Math.round(((cur - prev) / prev) * 100);
    return p > 0 ? `+${p}%` : `${p}%`;
  }

  const activeProfile = personalProfile ?? businessProfile;
  const profileUrl = activeProfile ? `japrofilestudio.jagroupservices.co.uk${getProfilePath(activeProfile)}` : null;

  const completion = getCompletionScore(activeProfile, linkCount);

  const copyProfileUrl = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(`https://${profileUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const bizProfileUrl = businessProfile ? `japrofilestudio.jagroupservices.co.uk${getProfilePath(businessProfile)}` : null;
  const copyBizUrl = () => {
    if (!bizProfileUrl) return;
    navigator.clipboard.writeText(`https://${bizProfileUrl}`).then(() => {
      setCopiedBiz(true);
      setTimeout(() => setCopiedBiz(false), 2000);
    });
  };

  const stats = [
    {
      label: 'Profile views',
      value: analytics?.totalViews ?? 0,
      sub: pctChange(analytics?.recentViews ?? 0, analytics?.prevViews ?? 0)
        ? `${pctChange(analytics?.recentViews ?? 0, analytics?.prevViews ?? 0)} vs last 30d`
        : `+${analytics?.recentViews ?? 0} this month`,
      icon: Eye,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'from-blue-500/10 to-blue-600/5',
      border: 'border-blue-200/60 dark:border-blue-500/20',
      glow: 'shadow-blue-500/10',
      trend: (analytics?.recentViews ?? 0) >= (analytics?.prevViews ?? 0),
    },
    {
      label: 'Link clicks',
      value: analytics?.totalClicks ?? 0,
      sub: pctChange(analytics?.recentClicks ?? 0, analytics?.prevClicks ?? 0)
        ? `${pctChange(analytics?.recentClicks ?? 0, analytics?.prevClicks ?? 0)} vs last 30d`
        : `+${analytics?.recentClicks ?? 0} this month`,
      icon: MousePointerClick,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'from-emerald-500/10 to-emerald-600/5',
      border: 'border-emerald-200/60 dark:border-emerald-500/20',
      glow: 'shadow-emerald-500/10',
      trend: (analytics?.recentClicks ?? 0) >= (analytics?.prevClicks ?? 0),
    },
    {
      label: 'Unique visitors',
      value: analytics?.uniqueVisitors ?? 0,
      sub: pctChange(analytics?.uniqueVisitors ?? 0, analytics?.prevUniqueVisitors ?? 0)
        ? `${pctChange(analytics?.uniqueVisitors ?? 0, analytics?.prevUniqueVisitors ?? 0)} vs last 30d`
        : 'this month',
      icon: TrendingUp,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'from-violet-500/10 to-violet-600/5',
      border: 'border-violet-200/60 dark:border-violet-500/20',
      glow: 'shadow-violet-500/10',
      trend: (analytics?.uniqueVisitors ?? 0) >= (analytics?.prevUniqueVisitors ?? 0),
    },
    {
      label: 'Enquiries',
      value: enquiries.length,
      sub: `${unreadCount} unread`,
      icon: Mail,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'from-orange-500/10 to-orange-600/5',
      border: 'border-orange-200/60 dark:border-orange-500/20',
      glow: 'shadow-orange-500/10',
      trend: unreadCount > 0,
    },
  ];

  const quickActions = [
    (hasPersonalAccess || isSeatOnly) && { to: '/dashboard/profile', icon: User, label: 'Edit personal card', desc: 'Update your info & photo', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    (hasOwnBusinessAccess || (user?.isSeatUser && seatPerms?.canEditProfile)) && { to: '/dashboard/business-profile', icon: Building2, label: 'Edit business page', desc: 'Manage your business profile', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    (!user?.isSeatUser || seatPerms?.canEditLinks) && { to: '/dashboard/links', icon: Link2, label: 'Manage links', desc: `${linkCount} active link${linkCount !== 1 ? 's' : ''}`, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { to: '/dashboard/qr-code', icon: QrCode, label: 'QR code', desc: 'Download & share', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    hasPersonalAccess && { to: '/dashboard/poster', icon: FileText, label: 'Profile poster', desc: 'A4 PDF poster', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
    { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', desc: 'Views, clicks & trends', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { to: '/dashboard/themes', icon: Palette, label: 'Themes', desc: 'Customise your look', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10' },
    { to: '/dashboard/business-cards', icon: CreditCard, label: 'Business cards', desc: 'Order printed cards', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    // Email Signature — only shown when globally enabled AND user has beta access
    emailSigEnabled && { to: '/dashboard/email-signature', icon: FileText, label: 'Email signature', desc: 'Branded email footer', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { to: '/dashboard/support-tickets', icon: Sparkles, label: 'Support', desc: 'Get help & raise tickets', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { to: '/dashboard/billing', icon: CreditCard, label: 'Billing', desc: 'Plans & payments', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-500/10' },
    { to: '/dashboard/settings', icon: Settings, label: 'Settings', desc: 'Account preferences', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-500/10' },
    { to: '/dashboard/data-requests', icon: Shield, label: 'Privacy & data', desc: 'GDPR & data requests', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    { to: '/dashboard/help-centre', icon: Zap, label: 'Help centre', desc: 'Guides & FAQs', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ].filter(Boolean) as { to: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; color: string; bg: string }[];

  return (
    <div className="max-w-6xl mx-auto pb-24 lg:pb-8 space-y-5">
      <Helmet>
        <title>Dashboard — Profile Centre</title>
        <meta name="description" content="Your Profile Centre dashboard." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/overview" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Assisted Access Banner — shown when admin has requested or is in a session */}
      <AssistedAccessBanner />

      {/* ── Hero greeting banner ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-700 dark:from-primary dark:via-blue-700 dark:to-indigo-800 p-6 shadow-xl shadow-primary/20"
      >
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute top-4 right-24 w-20 h-20 rounded-full bg-white/5 blur-xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-white/70 text-sm font-medium">{getGreeting()},</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {firstName} 👋
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {seatWorkspace
                ? `${seatWorkspace.role} at ${seatWorkspace.businessName}`
                : 'Here\'s your profile performance at a glance.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Plan badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-sm border border-white/20`}>
              <Star className="w-3 h-3" />
              {planLabel.label}
            </span>
          </div>
        </div>

        {/* Profile URL share strip */}
        {profileUrl && (
          <div className="relative mt-5 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 min-w-0">
              <Globe className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
              <span className="text-white/80 text-xs font-mono truncate">{profileUrl}</span>
            </div>
            <button
              onClick={copyProfileUrl}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-medium transition-colors flex-shrink-0"
              aria-label="Copy profile URL"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {activeProfile && (
              <a
                href={`https://${profileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-primary text-xs font-semibold hover:bg-white/90 transition-colors flex-shrink-0"
                aria-label="View live profile"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View live
              </a>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Alert banners ── */}
      {user?.isDowngraded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-sm" role="alert">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-orange-800 dark:text-orange-300 flex-1">Some features are locked because your plan changed. Your data is safe.</span>
          <Link to="/dashboard/billing"><Button size="sm" variant="outline" className="border-orange-300 text-orange-600 text-xs h-7 px-3">View plans</Button></Link>
        </motion.div>
      )}
      {user?.hasNoActivePlan && !user?.isSeatUser && !(user as { inPlanSelectionPeriod?: boolean }).inPlanSelectionPeriod && !user?.trialActive && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border text-sm" role="alert">
          <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 text-foreground">No Plan — select a plan to access features.</span>
          <Link to="/dashboard/billing"><Button size="sm" className="bg-primary text-white text-xs h-7 px-3">See plans</Button></Link>
        </motion.div>
      )}
      {(user as { inPlanSelectionPeriod?: boolean }).inPlanSelectionPeriod && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20 text-sm" role="alert">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-orange-300 flex-1">Your trial has ended. Please select a plan within 7 days to continue using plan features.</span>
          <Link to="/dashboard/billing"><Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white text-xs h-7 px-3">Select plan</Button></Link>
        </motion.div>
      )}
      {user?.trialActive && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/8 border border-blue-500/20 text-sm" role="alert">
          <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-blue-400 flex-1">Trial Active — trial features are available until your trial ends.</span>
          <Link to="/dashboard/billing"><Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs h-7 px-3">View plans</Button></Link>
        </motion.div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="region" aria-label="Profile statistics">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className={`relative overflow-hidden rounded-2xl border ${stat.border} bg-gradient-to-br ${stat.bg} backdrop-blur-xl p-4 shadow-sm hover:shadow-md ${stat.glow} transition-all duration-300`}
          >
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-3 w-16" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground leading-tight">{stat.label}</p>
                  <div className={`w-7 h-7 rounded-lg bg-card/80 border border-border flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                  <AnimatedNumber value={stat.value} />
                  {'suffix' in stat && <span className="text-lg">{stat.suffix}</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  {stat.trend
                    ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                    : <Activity className="w-3 h-3" />}
                  {stat.sub}
                </p>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left column — profiles + enquiries */}
        <div className="lg:col-span-2 space-y-5">

          {/* Profile cards side-by-side on md+ */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Personal card */}
            {(hasPersonalAccess || isSeatOnly) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className={glass + ' p-5 flex flex-col gap-4'}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-semibold text-foreground text-sm">Personal card</span>
                  </div>
                  {isSeatOnly && (
                    <Badge className="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-0 text-xs gap-1">
                      <Sparkles className="w-3 h-3" /> Free
                    </Badge>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-2"><Skeleton className="h-12 w-full" /></div>
                ) : personalProfile ? (
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                      <span className="text-white font-bold">{(personalProfile.display_name || 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{personalProfile.display_name || 'No name set'}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        personalProfile.is_published ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${personalProfile.is_published ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                        {personalProfile.is_published ? 'Live' : 'Draft'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-dashed border-border">
                    <p className="text-muted-foreground text-xs">{isSeatOnly ? 'Set up your free personal card.' : 'Create your personal card.'}</p>
                    <Link to="/dashboard/profile"><Button size="sm" className="gap-1 text-xs h-7"><Plus className="w-3 h-3" /> Create</Button></Link>
                  </div>
                )}

                {personalProfile && (
                  <div className="space-y-2 mt-auto">
                    {/* Profile URL */}
                    <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5 min-w-0">
                      <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                        {`japrofilestudio.jagroupservices.co.uk${getProfilePath(personalProfile)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link to="/dashboard/profile" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-8">Edit</Button>
                      </Link>
                      <a href={`https://japrofilestudio.jagroupservices.co.uk${getProfilePath(personalProfile)}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1"><ExternalLink className="w-3 h-3" /> View</Button>
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(`https://japrofilestudio.jagroupservices.co.uk${getProfilePath(personalProfile)}`)}
                        className="px-2.5 h-8 rounded-lg border border-border bg-card hover:bg-muted transition-colors flex-shrink-0"
                        title="Copy link"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <Link to="/dashboard/qr-code" className="px-2.5 h-8 rounded-lg border border-border bg-card hover:bg-muted transition-colors flex-shrink-0 flex items-center" title="QR code">
                        <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Business page */}
            {(hasOwnBusinessAccess || user?.isSeatUser) ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className={glass + ' p-5 flex flex-col gap-4'}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="font-semibold text-foreground text-sm">{seatWorkspace ? seatWorkspace.businessName : 'Business page'}</span>
                  </div>
                  {seatWorkspace && <Badge className="bg-muted text-muted-foreground border-0 text-xs capitalize">{seatWorkspace.role}</Badge>}
                </div>

                {loading ? (
                  <div className="space-y-2"><Skeleton className="h-12 w-full" /></div>
                ) : businessProfile ? (
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/25">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{businessProfile.display_name || 'No name set'}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        businessProfile.is_published ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${businessProfile.is_published ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                        {businessProfile.is_published ? 'Live' : 'Draft'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-dashed border-border">
                    <p className="text-muted-foreground text-xs">{hasOwnBusinessAccess ? 'Set up your business page.' : 'Business profile not found.'}</p>
                    {hasOwnBusinessAccess && (
                      <Link to="/dashboard/business-profile"><Button size="sm" className="gap-1 text-xs h-7"><Plus className="w-3 h-3" /> Set up</Button></Link>
                    )}
                  </div>
                )}

                {businessProfile && (
                  <div className="space-y-2 mt-auto">
                    {/* Business profile URL */}
                    <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5 min-w-0">
                      <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                        {`japrofilestudio.jagroupservices.co.uk${getProfilePath(businessProfile)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {(!seatWorkspace || seatPerms?.canEditProfile) && (
                        <Link to="/dashboard/business-profile" className="flex-1">
                          <Button size="sm" variant="outline" className="w-full text-xs h-8">Edit</Button>
                        </Link>
                      )}
                      <a href={`https://japrofilestudio.jagroupservices.co.uk${getProfilePath(businessProfile)}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1"><ExternalLink className="w-3 h-3" /> View</Button>
                      </a>
                      <button
                        onClick={copyBizUrl}
                        className="px-2.5 h-8 rounded-lg border border-border bg-card hover:bg-muted transition-colors flex-shrink-0"
                        title="Copy link"
                      >
                        {copiedBiz ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      <Link to="/dashboard/qr-code" className="px-2.5 h-8 rounded-lg border border-border bg-card hover:bg-muted transition-colors flex-shrink-0 flex items-center" title="QR code">
                        <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : hasPersonalAccess ? (
              /* Locked business card */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className={glass + ' p-5 opacity-60 flex flex-col gap-3'}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="font-semibold text-muted-foreground text-sm flex items-center gap-1.5">Business page <Lock className="w-3.5 h-3.5" /></span>
                </div>
                <p className="text-xs text-muted-foreground">Available on Organisation plans.</p>
                <Link to="/dashboard/billing" className="mt-auto">
                  <Button size="sm" variant="outline" className="w-full text-xs gap-1.5"><ArrowRight className="w-3.5 h-3.5" /> Upgrade</Button>
                </Link>
              </motion.div>
            ) : null}
          </div>

          {/* Profile completion card */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className={glass + ' p-5'}
            >
              <div className="flex items-center gap-4">
                {/* Ring */}
                <div className="relative flex-shrink-0">
                  <RingProgress value={completion.score} size={72} stroke={6} color={completion.score === 100 ? '#22c55e' : '#3b82f6'} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground">{completion.score}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">Profile completion</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {completion.score === 100 ? 'Your profile is fully set up!' : 'Complete your profile to get more visibility.'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {completion.items.map(item => (
                      <span key={item.label} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        item.done
                          ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.done
                          ? <CheckCircle2 className="w-3 h-3" />
                          : <Circle className="w-3 h-3" />}
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent enquiries */}
          {(!user?.isSeatUser || seatPerms?.canViewEnquiries) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className={glass + ' p-5'}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="font-semibold text-foreground text-sm">Recent enquiries</h2>
                  {unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <Link to="/dashboard/enquiries" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
              ) : enquiries.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">No enquiries yet</p>
                  <p className="text-muted-foreground text-xs">They'll appear here when someone contacts you through your profile.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {enquiries.map((e, i) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                        e.is_read
                          ? 'border-border bg-muted/20 hover:bg-muted/40'
                          : 'border-primary/20 bg-primary/5 hover:bg-primary/8'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {(e.sender_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{e.sender_name}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!e.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                            <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{e.message}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right column — quick actions + share */}
        <div className="space-y-5">

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className={glass + ' p-5'}
          >
            <h2 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Quick actions
            </h2>
            <nav aria-label="Quick actions">
              <ul className="space-y-0.5">
                {quickActions.map((link, i) => (
                  <motion.li
                    key={link.to}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                  >
                    <Link
                      to={link.to}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-muted/60 transition-colors group"
                    >
                      <div className={`w-8 h-8 rounded-xl ${link.bg} flex items-center justify-center flex-shrink-0`}>
                        <link.icon className={`w-4 h-4 ${link.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{link.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{link.desc}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
          </motion.div>

          {/* Share card */}
          {activeProfile && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              className="rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-pink-500/10 border border-violet-200/60 dark:border-violet-500/20 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Share your profile</h3>
              </div>
              <p className="text-xs text-muted-foreground">Share your Profile Centre link with clients, colleagues and contacts.</p>
              <div className="flex gap-2">
                <Link to="/dashboard/qr-code" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5">
                    <QrCode className="w-3.5 h-3.5" /> QR code
                  </Button>
                </Link>
                <button
                  onClick={copyProfileUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors h-8"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Performance snapshot */}
          {analytics && !loading && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className={glass + ' p-5 space-y-3'}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Performance (30d)</h3>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: 'Views this month', value: analytics.recentViews, prev: analytics.prevViews, max: Math.max(analytics.recentViews, analytics.prevViews, 1), color: 'bg-blue-500' },
                  { label: 'Clicks this month', value: analytics.recentClicks, prev: analytics.prevClicks, max: Math.max(analytics.recentClicks, analytics.prevClicks, 1), color: 'bg-emerald-500' },
                  { label: 'Unique visitors', value: analytics.uniqueVisitors, prev: analytics.prevUniqueVisitors, max: Math.max(analytics.uniqueVisitors, analytics.prevUniqueVisitors, 1), color: 'bg-violet-500' },
                  { label: 'Click-through rate', value: ctr, prev: prevCtr, max: 100, color: 'bg-amber-500', suffix: '%' },
                ].map(item => {
                  const chg = pctChange(item.value, item.prev);
                  const isUp = chg && chg.startsWith('+');
                  const isDown = chg && !chg.startsWith('+');
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <div className="flex items-center gap-1.5">
                          {chg && (
                            <span className={`text-[10px] font-semibold ${isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-muted-foreground'}`}>
                              {chg}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-foreground">{item.value}{item.suffix ?? ''}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${item.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                          transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link to="/dashboard/analytics" className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                Full analytics <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
