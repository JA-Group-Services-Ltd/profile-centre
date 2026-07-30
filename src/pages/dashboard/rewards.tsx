/**
 * /dashboard/rewards — Profile Rewards & Achievements
 * 150+ achievements across 8 categories with difficulty tiers.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  Star, Camera, Pen, Globe, Image, Link2, MessageCircle, Layers,
  Mail, Inbox, Building2, Briefcase, BadgeCheck, FileText, Clock,
  List, Users, User, Trophy, Zap, TrendingUp, CheckCircle2, Lock,
  Phone, MapPin, Palette, Bell, Tag, Eye, MousePointer, Calendar,
  Share2, Video, Music, ShoppingBag, Grid3X3, CreditCard, Award,
  UserPlus, QrCode, AtSign, Coins, ArrowRight,
} from 'lucide-react';

// ── Icon map ──────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  user:           <User className="w-5 h-5" />,
  camera:         <Camera className="w-5 h-5" />,
  pen:            <Pen className="w-5 h-5" />,
  star:           <Star className="w-5 h-5" />,
  globe:          <Globe className="w-5 h-5" />,
  image:          <Image className="w-5 h-5" />,
  link:           <Link2 className="w-5 h-5" />,
  message:        <MessageCircle className="w-5 h-5" />,
  layers:         <Layers className="w-5 h-5" />,
  photo:          <Image className="w-5 h-5" />,
  mail:           <Mail className="w-5 h-5" />,
  inbox:          <Inbox className="w-5 h-5" />,
  building:       <Building2 className="w-5 h-5" />,
  briefcase:      <Briefcase className="w-5 h-5" />,
  badge:          <BadgeCheck className="w-5 h-5" />,
  'file-text':    <FileText className="w-5 h-5" />,
  clock:          <Clock className="w-5 h-5" />,
  list:           <List className="w-5 h-5" />,
  users:          <Users className="w-5 h-5" />,
  trophy:         <Trophy className="w-5 h-5" />,
  zap:            <Zap className="w-5 h-5" />,
  'trending-up':  <TrendingUp className="w-5 h-5" />,
  'check-circle': <CheckCircle2 className="w-5 h-5" />,
  phone:          <Phone className="w-5 h-5" />,
  'map-pin':      <MapPin className="w-5 h-5" />,
  palette:        <Palette className="w-5 h-5" />,
  bell:           <Bell className="w-5 h-5" />,
  tag:            <Tag className="w-5 h-5" />,
  eye:            <Eye className="w-5 h-5" />,
  'mouse-pointer':<MousePointer className="w-5 h-5" />,
  calendar:       <Calendar className="w-5 h-5" />,
  share:          <Share2 className="w-5 h-5" />,
  video:          <Video className="w-5 h-5" />,
  music:          <Music className="w-5 h-5" />,
  'shopping-bag': <ShoppingBag className="w-5 h-5" />,
  grid:           <Grid3X3 className="w-5 h-5" />,
  'credit-card':  <CreditCard className="w-5 h-5" />,
  award:          <Award className="w-5 h-5" />,
  'user-plus':    <UserPlus className="w-5 h-5" />,
  'qr-code':      <QrCode className="w-5 h-5" />,
  'at-sign':      <AtSign className="w-5 h-5" />,
  lock:           <Lock className="w-5 h-5" />,
};

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  profile:      { label: 'Profile Setup',       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  content:      { label: 'Content & Links',      color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  connections:  { label: 'Connections',          color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  engagement:   { label: 'Engagement',           color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  organisation: { label: 'Organisation',         color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
  team:         { label: 'Team & Seats',         color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  tenure:       { label: 'Membership Tenure',    color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20'   },
  mastery:      { label: 'Mastery',              color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
};

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy:   { label: 'Easy',   color: 'text-green-400 bg-green-500/10 border-green-500/20'   },
  medium: { label: 'Medium', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'      },
  hard:   { label: 'Hard',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/20'},
  elite:  { label: 'Elite',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'},
};

interface CompletionItem { key: string; done: boolean; label: string; points: number }
interface Achievement { id: string; title: string; desc: string; icon: string; earned: boolean; category: string; difficulty: string }
interface RewardsData {
  completionScore: number;
  completionItems: CompletionItem[];
  earnedPoints: number;
  totalPoints: number;
  achievements: Achievement[];
  earnedCount: number;
  totalAchievements: number;
  enquiryCount: number;
  linkCount: number;
  orgProfileCount: number;
  pageViewCount: number;
  linkClickCount: number;
  seatCount: number;
  daysSinceCreated: number;
  isPaid: boolean;
  planSlug: string;
}

// ── Completion ring ───────────────────────────────────────────────────────
function CompletionRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="rotate-[-90deg]">
      <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────
function MiniBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RewardsPage() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<string>('all');
  const [showEarned, setShowEarned] = useState<'all' | 'earned' | 'locked'>('all');
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/rewards', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Also fetch points balance for the banner
    fetch('/api/points', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPointsBalance(d.data.balance); })
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    </div>
  );

  if (!data) return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 text-center py-16">
      <p className="text-muted-foreground">Could not load rewards. Please refresh.</p>
    </div>
  );

  const categories = Array.from(new Set(data.achievements.map(a => a.category)));

  // Filter achievements
  const filtered = data.achievements.filter(a => {
    if (activeCategory !== 'all' && a.category !== activeCategory) return false;
    if (activeDifficulty !== 'all' && a.difficulty !== activeDifficulty) return false;
    if (showEarned === 'earned' && !a.earned) return false;
    if (showEarned === 'locked' && a.earned) return false;
    return true;
  });

  // Category progress
  const catProgress = categories.map(cat => {
    const all = data.achievements.filter(a => a.category === cat);
    const done = all.filter(a => a.earned).length;
    return { cat, done, total: all.length };
  });

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Rewards & Achievements — Dashboard</title>
        <meta name="description" content="Track your profile completion and earn 150+ achievements." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/rewards" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" /> Rewards & Achievements
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Complete your profile, grow your presence and unlock {data.totalAchievements} achievements.
        </p>
      </div>

      {/* ── Points balance banner ───────────────────────────────────────── */}
      {pointsBalance !== null && (
        <div className="flex items-center justify-between gap-4 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {pointsBalance.toLocaleString()} points available
              </p>
              <p className="text-xs text-muted-foreground">Earned from your achievements — spend them in the Rewards Store</p>
            </div>
          </div>
          <Link to="/dashboard/points">
            <button className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0">
              Visit Rewards Store <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Completion',    value: `${data.completionScore}%`,    icon: <TrendingUp className="w-4 h-4 text-primary" />,        color: 'bg-primary/10'    },
          { label: 'Achievements',  value: `${data.earnedCount}/${data.totalAchievements}`, icon: <Trophy className="w-4 h-4 text-amber-500" />, color: 'bg-amber-500/10' },
          { label: 'Profile views', value: String(data.pageViewCount),    icon: <Eye className="w-4 h-4 text-blue-400" />,              color: 'bg-blue-500/10'   },
          { label: 'Link clicks',   value: String(data.linkClickCount),   icon: <MousePointer className="w-4 h-4 text-purple-400" />,   color: 'bg-purple-500/10' },
          { label: 'Enquiries',     value: String(data.enquiryCount),     icon: <Mail className="w-4 h-4 text-green-400" />,            color: 'bg-green-500/10'  },
          { label: 'Links',         value: String(data.linkCount),        icon: <Link2 className="w-4 h-4 text-cyan-400" />,            color: 'bg-cyan-500/10'   },
          { label: 'Team seats',    value: String(data.seatCount),        icon: <Users className="w-4 h-4 text-orange-400" />,          color: 'bg-orange-500/10' },
          { label: 'Days active',   value: String(data.daysSinceCreated), icon: <Calendar className="w-4 h-4 text-pink-400" />,         color: 'bg-pink-500/10'   },
        ].map(s => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-3">
              <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
                {s.icon}
              </div>
              <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Profile completion card ─────────────────────────────────────── */}
      <Card className="border-border bg-card mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <CompletionRing score={data.completionScore} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-foreground">{data.completionScore}%</span>
                <span className="text-xs text-muted-foreground">complete</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">Profile Completion</h2>
                <span className="text-xs text-muted-foreground">{data.earnedPoints}/{data.totalPoints} pts</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {data.completionItems.map(item => (
                  <div key={item.key} className="flex items-center gap-2 text-sm">
                    {item.done
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                    }
                    <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">+{item.points}pts</span>
                  </div>
                ))}
              </div>
              {data.completionScore < 100 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Link to="/dashboard/profile" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Complete your profile to earn more points
                  </Link>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Category progress overview ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {catProgress.map(({ cat, done, total }) => {
          const meta = CATEGORY_META[cat] ?? { label: cat, color: 'text-foreground', bg: 'bg-muted', border: 'border-border' };
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? 'all' : cat)}
              className={`text-left rounded-xl border p-3 transition-all ${
                activeCategory === cat ? `${meta.border} ${meta.bg}` : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <p className={`text-xs font-semibold ${meta.color} mb-1`}>{meta.label}</p>
              <p className="text-sm font-bold text-foreground">{done}/{total}</p>
              <MiniBar value={done} max={total} color={`bg-primary`} />
            </button>
          );
        })}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Status filter */}
        {(['all', 'earned', 'locked'] as const).map(v => (
          <button
            key={v}
            onClick={() => setShowEarned(v)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              showEarned === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {v === 'all' ? 'All' : v === 'earned' ? 'Earned' : 'Locked'}
          </button>
        ))}
        <span className="w-px h-5 bg-border self-center" />
        {/* Difficulty filter */}
        {(['all', 'easy', 'medium', 'hard', 'elite'] as const).map(v => (
          <button
            key={v}
            onClick={() => setActiveDifficulty(activeDifficulty === v ? 'all' : v)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              activeDifficulty === v
                ? v === 'all' ? 'bg-primary text-primary-foreground border-primary'
                  : `${DIFFICULTY_META[v]?.color ?? ''} border-current`
                : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {v === 'all' ? 'All difficulties' : DIFFICULTY_META[v]?.label ?? v}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {filtered.length} shown
        </span>
      </div>

      {/* ── Achievement grid ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No achievements match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {filtered.map(a => {
            const catMeta = CATEGORY_META[a.category] ?? { label: a.category, color: 'text-foreground', bg: 'bg-muted', border: 'border-border' };
            const diffMeta = DIFFICULTY_META[a.difficulty] ?? { label: a.difficulty, color: '' };
            return (
              <Card
                key={a.id}
                className={`border transition-all ${
                  a.earned
                    ? `${catMeta.border} ${catMeta.bg}`
                    : 'border-border bg-card opacity-55'
                }`}
              >
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    a.earned ? `${catMeta.bg} ${catMeta.color}` : 'bg-muted text-muted-foreground'
                  }`}>
                    {a.earned
                      ? (ICON_MAP[a.icon] ?? <Star className="w-5 h-5" />)
                      : <Lock className="w-5 h-5" />
                    }
                  </div>
                  <p className={`text-sm font-semibold leading-tight mb-1 ${a.earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug mb-2">{a.desc}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {a.earned && (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] px-1.5 py-0">
                        Earned
                      </Badge>
                    )}
                    <Badge className={`text-[10px] px-1.5 py-0 border ${diffMeta.color}`}>
                      {diffMeta.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── All earned celebration ──────────────────────────────────────── */}
      {data.earnedCount === data.totalAchievements && (
        <Card className="border-amber-500/30 bg-amber-500/5 mb-6">
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">All {data.totalAchievements} achievements unlocked!</h3>
            <p className="text-sm text-muted-foreground">
              You have completed every achievement. Your profile is fully optimised — outstanding work.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
