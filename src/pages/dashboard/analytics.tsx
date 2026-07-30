import { useState, useEffect, useMemo } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Eye, MousePointerClick, TrendingUp, TrendingDown, BarChart3,
  ChevronDown, Users, Percent, ArrowUpRight, ArrowDownRight,
  Minus, ExternalLink, Calendar, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface DayPoint { date: string; count: number }
interface WeekdayPoint { dow: number; count: number }
interface TopLink { label: string; url: string; platform: string | null; clicks: number }

interface Analytics {
  totalViews: number; recentViews: number;
  totalClicks: number; recentClicks: number;
  prevViews: number; prevClicks: number;
  uniqueVisitors: number; prevUniqueVisitors: number;
  ctr: number; prevCtr: number;
  viewsByDay: DayPoint[];
  clicksByDay: DayPoint[];
  weekdayViews: WeekdayPoint[];
  topLinks: TopLink[];
}

interface ProfileOption {
  id: number; display_name: string;
  username?: string; biz_slug?: string; profile_type: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: '365 days', days: 365 },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function fmtDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (days <= 30) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (days <= 90) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// Fill in missing dates so the chart has a continuous x-axis
function fillDates(data: DayPoint[], days: number): DayPoint[] {
  const map = new Map(data.map(d => [d.date, d.count]));
  const result: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) ?? 0 });
  }
  return result;
}

// ── SVG dual-line chart ──────────────────────────────────────────────────────

interface ChartProps {
  views: DayPoint[];
  clicks: DayPoint[];
  days: number;
  showClicks: boolean;
}

function LineChart({ views, clicks, days, showClicks }: ChartProps) {
  const W = 800; const H = 200; const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = [...views.map(d => d.count), ...(showClicks ? clicks.map(d => d.count) : [])];
  const maxVal = Math.max(...allValues, 1);

  const xStep = innerW / Math.max(views.length - 1, 1);

  function toPath(data: DayPoint[]) {
    return data.map((d, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + innerH - (d.count / maxVal) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  function toArea(data: DayPoint[], color: string) {
    const pts = data.map((d, i) => ({
      x: PAD.left + i * xStep,
      y: PAD.top + innerH - (d.count / maxVal) * innerH,
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = line
      + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)}`
      + ` L ${pts[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;
    return { line, area };
  }

  const viewPaths = toArea(views, '#3b82f6');
  const clickPaths = showClicks ? toArea(clicks, '#10b981') : null;

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    val: Math.round(maxVal * t),
    y: PAD.top + innerH - t * innerH,
  }));

  // X-axis labels — show ~6 evenly spaced
  const xLabelCount = Math.min(6, views.length);
  const xLabelStep = Math.floor(views.length / xLabelCount);
  const xLabels = views
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % xLabelStep === 0 || i === views.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      <defs>
        <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t.val}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
            stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end"
            fontSize="10" fill="currentColor" opacity="0.45">{t.val}</text>
        </g>
      ))}

      {/* Area fills */}
      {clickPaths && (
        <path d={clickPaths.area} fill="url(#clickGrad)" />
      )}
      <path d={viewPaths.area} fill="url(#viewGrad)" />

      {/* Lines */}
      {clickPaths && (
        <path d={clickPaths.line} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
      )}
      <path d={viewPaths.line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

      {/* X-axis labels */}
      {xLabels.map(({ d, i }) => (
        <text key={i} x={PAD.left + i * xStep} y={H - 4}
          textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.45">
          {fmtDate(d.date, days)}
        </text>
      ))}
    </svg>
  );
}

// ── Bar chart for weekday distribution ──────────────────────────────────────

function WeekdayChart({ data }: { data: WeekdayPoint[] }) {
  const map = new Map(data.map(d => [d.dow, d.count]));
  const values = WEEKDAYS.map((_, i) => map.get(i) ?? 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5 h-20 w-full">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-primary/30 hover:bg-primary/60 transition-all"
            style={{ height: `${Math.max(4, (v / max) * 64)}px` }}
            title={`${WEEKDAYS[i]}: ${v} views`}
          />
          <span className="text-[9px] text-muted-foreground">{WEEKDAYS[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string; value: number | string;
  subLabel?: string; subValue?: string;
  change?: number | null;
  icon: React.ElementType; iconColor: string;
  loading: boolean;
  suffix?: string;
}

function StatCard({ label, value, subLabel, subValue, change, icon: Icon, iconColor, loading, suffix }: StatCardProps) {
  const isUp = change !== null && change !== undefined && change > 0;
  const isDown = change !== null && change !== undefined && change < 0;
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        {loading ? <Skeleton className="h-20 w-full" /> : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {value}{suffix && <span className="text-base font-normal text-muted-foreground ml-0.5">{suffix}</span>}
            </p>
            <div className="flex items-center justify-between mt-1.5 gap-2">
              {subLabel && <p className="text-xs text-muted-foreground">{subLabel}: <span className="text-foreground font-medium">{subValue}</span></p>}
              {change !== null && change !== undefined ? (
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : isDown ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {change > 0 ? '+' : ''}{change}%
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">vs prev period</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [chartMode, setChartMode] = useState<'views' | 'both'>('both');
  const [tableSort, setTableSort] = useState<'clicks' | 'label'>('clicks');

  const hasAdvancedAnalytics = !!(user?.hasBusinessAccess || user?.hasLifetimeAccess);

  // Load all profiles — personal first, then all business profiles
  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.length > 0) {
          // Sort: personal first, then business profiles alphabetically
          const sorted = [...d.data].sort((a: ProfileOption & { display_name?: string }, b: ProfileOption & { display_name?: string }) => {
            if (a.profile_type === 'personal' && b.profile_type !== 'personal') return -1;
            if (a.profile_type !== 'personal' && b.profile_type === 'personal') return 1;
            return ((a.display_name || a.username || '') as string).localeCompare((b.display_name || b.username || '') as string);
          });
          const all: ProfileOption[] = sorted.map((p: ProfileOption & { display_name?: string }) => ({
            id: p.id,
            display_name: p.display_name || p.username || p.biz_slug || `Profile ${p.id}`,
            username: p.username,
            biz_slug: p.biz_slug,
            profile_type: p.profile_type || 'personal',
          }));
          setProfiles(all);
          setSelectedProfileId(all[0].id);
        }
      })
      .finally(() => setProfilesLoading(false));
  }, []);

  // Fetch analytics
  useEffect(() => {
    if (!selectedProfileId) return;
    setLoading(true);
    setAnalytics(null);
    fetch(`/api/analytics/${selectedProfileId}?days=${days}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setAnalytics(d.data); })
      .finally(() => setLoading(false));
  }, [selectedProfileId, days]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  // Fill chart data
  const filledViews = useMemo(() => analytics ? fillDates(analytics.viewsByDay, days) : [], [analytics, days]);
  const filledClicks = useMemo(() => analytics ? fillDates(analytics.clicksByDay, days) : [], [analytics, days]);

  // Sorted top links
  const sortedLinks = useMemo(() => {
    if (!analytics) return [];
    return [...analytics.topLinks].sort((a, b) =>
      tableSort === 'clicks' ? b.clicks - a.clicks : a.label.localeCompare(b.label)
    );
  }, [analytics, tableSort]);

  // Best weekday
  const bestDay = useMemo(() => {
    if (!analytics?.weekdayViews.length) return null;
    const best = analytics.weekdayViews.reduce((a, b) => b.count > a.count ? b : a);
    return WEEKDAYS[best.dow];
  }, [analytics]);

  // Avg views/day
  const avgPerDay = analytics ? Math.round(analytics.recentViews / days) : 0;

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Analytics — Dashboard</title>
        <meta name="description" content="Track profile views, link clicks, and visitor trends." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/analytics" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Detailed performance insights for your profile</p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Profile switcher — always shown so user knows which profile they're viewing */}
          <div className="relative">
            <button
              onClick={() => profiles.length > 1 && setShowProfilePicker(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground transition-colors ${profiles.length > 1 ? 'hover:bg-muted cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                selectedProfile?.profile_type === 'business'
                  ? 'bg-indigo-500/10 text-indigo-500'
                  : 'bg-blue-500/10 text-blue-500'
              }`}>
                {selectedProfile?.profile_type === 'business' ? 'Biz' : 'Personal'}
              </span>
              <span className="max-w-[160px] truncate">
                {profilesLoading ? 'Loading…' : selectedProfile?.display_name ?? 'Select profile'}
              </span>
              {profiles.length > 1 && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            </button>
            {showProfilePicker && profiles.length > 1 && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg min-w-[220px] overflow-hidden">
                <p className="px-3 py-2 text-xs text-muted-foreground font-medium border-b border-border">Switch profile</p>
                {profiles.map(p => (
                  <button key={p.id}
                    onClick={() => { setSelectedProfileId(p.id); setShowProfilePicker(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2.5 ${p.id === selectedProfileId ? 'bg-primary/5' : ''}`}
                  >
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                      p.profile_type === 'business' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {p.profile_type === 'business' ? 'Biz' : 'Personal'}
                    </span>
                    <span className={`truncate flex-1 ${p.id === selectedProfileId ? 'text-primary font-medium' : 'text-foreground'}`}>{p.display_name}</span>
                    {p.id === selectedProfileId && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Period tabs ── */}
      <div className="flex gap-1 mb-6 bg-muted/50 rounded-xl p-1 w-fit">
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              days === p.days
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label={`Views (${days}d)`} value={analytics?.recentViews ?? 0}
          subLabel="All time" subValue={String(analytics?.totalViews ?? 0)}
          change={pctChange(analytics?.recentViews ?? 0, analytics?.prevViews ?? 0)}
          icon={Eye} iconColor="text-blue-400" loading={loading}
        />
        <StatCard
          label={`Clicks (${days}d)`} value={analytics?.recentClicks ?? 0}
          subLabel="All time" subValue={String(analytics?.totalClicks ?? 0)}
          change={pctChange(analytics?.recentClicks ?? 0, analytics?.prevClicks ?? 0)}
          icon={MousePointerClick} iconColor="text-emerald-400" loading={loading}
        />
        <StatCard
          label="Unique visitors" value={analytics?.uniqueVisitors ?? 0}
          subLabel="Avg/day" subValue={String(avgPerDay)}
          change={pctChange(analytics?.uniqueVisitors ?? 0, analytics?.prevUniqueVisitors ?? 0)}
          icon={Users} iconColor="text-purple-400" loading={loading}
        />
        <StatCard
          label="Click-through rate" value={analytics?.ctr ?? 0}
          subLabel="Prev period" subValue={`${analytics?.prevCtr ?? 0}%`}
          change={pctChange(analytics?.ctr ?? 0, analytics?.prevCtr ?? 0)}
          icon={Percent} iconColor="text-amber-400" loading={loading} suffix="%"
        />
      </div>

      {/* ── Main chart ── */}
      <Card className="bg-card border-border mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Views &amp; Clicks Over Time
            </CardTitle>
            <div className="flex gap-1">
              <button
                onClick={() => setChartMode('views')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${chartMode === 'views' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Views only
              </button>
              <button
                onClick={() => setChartMode('both')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${chartMode === 'both' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Compare clicks
              </button>
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Page views
            </span>
            {chartMode === 'both' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Link clicks
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : filledViews.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
          ) : (
            <LineChart views={filledViews} clicks={filledClicks} days={days} showClicks={chartMode === 'both'} />
          )}
        </CardContent>
      </Card>

      {/* ── Bottom grid: weekday + summary stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* Weekday distribution */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Views by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <>
                <WeekdayChart data={analytics?.weekdayViews ?? []} />
                {bestDay && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Best day: <span className="text-foreground font-medium">{bestDay}</span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary stats grid */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Period Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total views', value: analytics?.recentViews ?? 0, prev: analytics?.prevViews ?? 0 },
                  { label: 'Total clicks', value: analytics?.recentClicks ?? 0, prev: analytics?.prevClicks ?? 0 },
                  { label: 'Unique visitors', value: analytics?.uniqueVisitors ?? 0, prev: analytics?.prevUniqueVisitors ?? 0 },
                  { label: 'Avg views/day', value: avgPerDay, prev: analytics?.prevViews ? Math.round(analytics.prevViews / days) : 0 },
                  { label: 'CTR', value: `${analytics?.ctr ?? 0}%`, prev: null },
                  { label: 'All-time views', value: analytics?.totalViews ?? 0, prev: null },
                ].map((s, i) => {
                  const chg = s.prev !== null ? pctChange(typeof s.value === 'number' ? s.value : 0, s.prev) : null;
                  return (
                    <div key={i} className="bg-muted/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                      <p className="text-base font-bold text-foreground">{s.value}</p>
                      {chg !== null && (
                        <span className={`text-xs font-medium flex items-center gap-0.5 ${chg > 0 ? 'text-emerald-500' : chg < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {chg > 0 ? <TrendingUp className="w-3 h-3" /> : chg < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {chg > 0 ? '+' : ''}{chg}% vs prev
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Top links table ── */}
      <Card className="bg-card border-border mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-primary" /> Top Links by Clicks
            </CardTitle>
            <div className="flex gap-1">
              {(['clicks', 'label'] as const).map(s => (
                <button key={s} onClick={() => setTableSort(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${tableSort === s ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  Sort by {s === 'clicks' ? 'clicks' : 'name'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-40 w-full" /> : !sortedLinks.length ? (
            <p className="text-muted-foreground text-sm text-center py-6">No link clicks recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium w-6">#</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Link</th>
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium hidden sm:table-cell">Platform</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Clicks</th>
                    <th className="text-right py-2 pl-4 text-xs text-muted-foreground font-medium hidden md:table-cell">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLinks.map((link, i) => {
                    const maxClicks = sortedLinks[0]?.clicks || 1;
                    const share = Math.round((link.clicks / maxClicks) * 100);
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <p className="text-foreground font-medium truncate max-w-[200px]">{link.label || '—'}</p>
                              <a href={link.url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 truncate max-w-[200px]">
                                {link.url} <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 hidden sm:table-cell">
                          {link.platform ? (
                            <Badge variant="outline" className="text-xs capitalize">{link.platform}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="font-bold text-foreground">{link.clicks}</span>
                        </td>
                        <td className="py-2.5 pl-4 hidden md:table-cell">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Upgrade nudge ── */}
      {!hasAdvancedAnalytics && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Advanced analytics on Professional+</p>
              <p className="text-xs text-muted-foreground">Upgrade for detailed visitor insights, geographic data, and more.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
