/**
 * /dashboard/points — Points & Rewards Store
 *
 * Store catalogue is loaded live from the database (admin-managed).
 * Points are earned by completing achievements — no purchase of points.
 * Perks are platform features only — no cash value.
 *
 * UK Regulatory compliance:
 * - Points have NO monetary value and cannot be exchanged for cash.
 * - No gambling mechanics, no random rewards, no loot boxes.
 * - No financial promotion or inducement to spend money.
 * - Points are non-transferable and expire if the account is closed.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  Coins, Trophy, Zap, Star, TrendingUp, Gift,
  Sparkles, Lock, CheckCircle2, ArrowRight, Info, Clock,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface StoreItem {
  id: number;
  key: string;
  title: string;
  description: string;
  cost: number;
  category: string;
  icon: string;
  color: string;
  is_active: number;
  repeatable: number;
}

interface PointsData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  earnedCount: number;
  totalAchievements: number;
  completionScore: number;
  planSlug: string;
  isPaid: boolean;
  redeemedPerks: string[];
  redeemedMap: Record<string, string>; // perk_key → redeemed_at ISO
  storeItems: StoreItem[];
}

// ── Category styling ───────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  theme:   { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', color: 'text-indigo-400',  label: 'Theme'   },
  badge:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  color: 'text-amber-400',   label: 'Badge'   },
  boost:   { bg: 'bg-pink-500/10',   border: 'border-pink-500/20',   color: 'text-pink-400',    label: 'Boost'   },
  feature: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', color: 'text-purple-400',  label: 'Feature' },
  other:   { bg: 'bg-muted',         border: 'border-border',        color: 'text-muted-foreground', label: 'Other' },
};

function catStyle(cat: string) {
  return CAT_STYLE[cat] ?? CAT_STYLE.other;
}

// ── Earn guide ─────────────────────────────────────────────────────────────

const EARN_GUIDE = [
  { label: 'Complete your personal profile',  pts: 50  },
  { label: 'Add a profile photo',             pts: 10  },
  { label: 'Add 5 or more links',             pts: 15  },
  { label: 'Publish your profile',            pts: 20  },
  { label: 'Receive your first enquiry',      pts: 15  },
  { label: 'Reach 100 profile views',         pts: 35  },
  { label: 'Earn 10 achievements',            pts: 100 },
  { label: 'Earn 25 achievements',            pts: 200 },
  { label: 'Create an organisation profile',  pts: 25  },
  { label: 'Add team members',                pts: 15  },
  { label: 'Reach 1 year membership',         pts: 150 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PointsPage() {
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemMsg, setRedeemMsg] = useState<{ key: string; msg: string; ok: boolean } | null>(null);
  const [showEarnGuide, setShowEarnGuide] = useState(false);

  useEffect(() => {
    fetch('/api/points', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRedeem = async (item: StoreItem) => {
    if (!data) return;
    if (data.balance < item.cost) return;
    setRedeeming(item.key);
    setRedeemMsg(null);
    try {
      const res = await fetch('/api/points/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ perkKey: item.key }),
      });
      const result = await res.json();
      if (result.success) {
        const now = new Date().toISOString();
        setData(d => d ? {
          ...d,
          balance: result.newBalance ?? d.balance - item.cost,
          totalSpent: d.totalSpent + item.cost,
          redeemedPerks: [...d.redeemedPerks, item.key],
          redeemedMap: { ...d.redeemedMap, [item.key]: now },
        } : d);
        setRedeemMsg({ key: item.key, msg: 'Redeemed! Check your profile settings to activate.', ok: true });
      } else {
        setRedeemMsg({ key: item.key, msg: result.error || 'Could not redeem. Please try again.', ok: false });
      }
    } catch {
      setRedeemMsg({ key: item.key, msg: 'Network error. Please try again.', ok: false });
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
      </div>
    </div>
  );

  if (!data) return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 text-center py-16">
      <p className="text-muted-foreground">Could not load points. Please refresh.</p>
    </div>
  );

  // Build category filter list from live store items
  const categories = ['all', ...Array.from(new Set(data.storeItems.map(i => i.category)))];
  const filtered = data.storeItems.filter(i => activeFilter === 'all' || i.category === activeFilter);

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Points & Rewards Store — Dashboard</title>
        <meta name="description" content="Spend your earned points on profile themes, badges, and boosts." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/points" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Coins className="w-6 h-6 text-amber-500" /> Points & Rewards Store
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Earn points by completing achievements, then spend them on profile perks.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 bg-muted/40 border border-border rounded-xl px-4 py-3 mb-6 text-xs text-muted-foreground">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Points have no monetary value and cannot be exchanged for cash or cash equivalents.
          Perks are platform features only. Points are non-transferable and are forfeited if your account is closed.
          You cannot purchase points.
        </span>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="sm:col-span-1 border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <Coins className="w-8 h-8 text-amber-500 mb-1" />
            <p className="text-3xl font-extrabold text-foreground">{data.balance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground font-medium">Available points</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <TrendingUp className="w-6 h-6 text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{data.totalEarned.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total earned</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <Gift className="w-6 h-6 text-purple-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{data.redeemedPerks.length}</p>
            <p className="text-xs text-muted-foreground">Perks redeemed</p>
          </CardContent>
        </Card>
      </div>

      {/* Earn more CTA */}
      <Card className="border-border bg-card mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {data.earnedCount} of {data.totalAchievements} achievements earned
                </p>
                <p className="text-xs text-muted-foreground">
                  Profile {data.completionScore}% complete — keep going to earn more points
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowEarnGuide(v => !v)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                {showEarnGuide ? 'Hide earn guide' : 'How to earn points'}
              </button>
              <Link to="/dashboard/rewards">
                <Button size="sm" variant="outline" className="border-border text-xs h-8 gap-1">
                  Achievements <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>

          {showEarnGuide && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {EARN_GUIDE.map(g => (
                <div key={g.label} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{g.label}</span>
                  <span className="text-amber-500 font-semibold flex-shrink-0">+{g.pts} pts</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                activeFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {cat === 'all' ? 'All perks' : cat.charAt(0).toUpperCase() + cat.slice(1) + 's'}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground self-center">
            {filtered.length} perk{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Perks grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">No perks available right now. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {filtered.map(item => {
            const alreadyOwned = !item.repeatable && data.redeemedPerks.includes(item.key);
            const canAfford = data.balance >= item.cost;
            const isRedeeming = redeeming === item.key;
            const msg = redeemMsg?.key === item.key ? redeemMsg : null;
            const cs = catStyle(item.category);
            const redeemedAt = data.redeemedMap[item.key];

            return (
              <Card
                key={item.key}
                className={`border transition-all ${
                  alreadyOwned
                    ? 'border-green-500/30 bg-green-500/5'
                    : `${cs.border} bg-card`
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cs.bg} ${cs.color}`}>
                      <Gift className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${cs.bg} ${cs.color} ${cs.border}`}>
                          {cs.label}
                        </Badge>
                        {alreadyOwned && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                            Owned
                          </Badge>
                        )}
                        {!!item.repeatable && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-400 border-blue-500/20">
                            Repeatable
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
                    </div>
                  </div>

                  {/* Cost row */}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className={`text-sm font-bold ${canAfford || alreadyOwned ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {item.cost.toLocaleString()} pts
                      </span>
                      {!canAfford && !alreadyOwned && (
                        <span className="text-xs text-muted-foreground">
                          (need {(item.cost - data.balance).toLocaleString()} more)
                        </span>
                      )}
                    </div>

                    {alreadyOwned ? (
                      <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Redeemed
                      </div>
                    ) : canAfford ? (
                      <Button
                        size="sm"
                        onClick={() => handleRedeem(item)}
                        disabled={isRedeeming}
                        className="bg-primary text-primary-foreground h-8 text-xs gap-1.5"
                      >
                        {isRedeeming ? (
                          <><Sparkles className="w-3.5 h-3.5 animate-spin" /> Redeeming…</>
                        ) : (
                          <><Gift className="w-3.5 h-3.5" /> Redeem</>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Lock className="w-3.5 h-3.5" /> Not enough points
                      </div>
                    )}
                  </div>

                  {/* Redeemed timestamp */}
                  {alreadyOwned && redeemedAt && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Redeemed {fmtDateTime(redeemedAt)}
                    </div>
                  )}

                  {/* Feedback message */}
                  {msg && (
                    <p className={`text-xs mt-2 px-2.5 py-1.5 rounded-lg border ${
                      msg.ok
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                    }`}>
                      {msg.msg}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Redeemed history */}
      {data.redeemedPerks.length > 0 && (
        <Card className="border-border bg-card mb-6">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Your redeemed perks
            </p>
            <div className="space-y-2">
              {data.redeemedPerks.map(pk => {
                const item = data.storeItems.find(i => i.key === pk);
                const ts = data.redeemedMap[pk];
                const cs = catStyle(item?.category ?? 'other');
                return (
                  <div key={pk} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-foreground font-medium">{item?.title ?? pk}</span>
                      {item && (
                        <Badge className={`text-[10px] px-1.5 py-0 border ${cs.bg} ${cs.color} ${cs.border}`}>
                          {cs.label}
                        </Badge>
                      )}
                    </div>
                    {ts && (
                      <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" /> {fmtDateTime(ts)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer note */}
      <div className="text-center text-xs text-muted-foreground pb-4">
        Points and perks are subject to the{' '}
        <a href="/legal/terms" className="underline hover:text-foreground">Terms of Service</a>.
        Points have no monetary value and are not redeemable for cash. You cannot purchase points.
      </div>
    </div>
  );
}
