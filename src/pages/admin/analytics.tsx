import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { BarChart3, Users, Globe, Eye, MousePointer, TrendingUp, Calendar, RefreshCw, Lock } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface AnalyticsData {
  totalUsers: number;
  totalProfiles: number;
  totalEnquiries: number;
  totalViews: number;
  totalClicks: number;
  recentUsers: { id: number; email: string; name: string; role: string; created_at: string }[];
  topProfiles: { username: string; display_name: string; views: number }[];
  viewsByDay: { date: string; count: number }[];
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'pin_required' | 'fetch_error' | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/analytics', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.pinRequired) { setError('pin_required'); return; }
        if (d.success) setData(d.data);
        else setError('fetch_error');
      })
      .catch(() => setError('fetch_error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const maxViews = data?.viewsByDay.length ? Math.max(...data.viewsByDay.map(d => d.count), 1) : 1;

  if (!loading && error === 'pin_required') {
    return (
      <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-1">Platform-wide performance and usage statistics</p>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="py-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">PIN verification required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Your admin PIN session has expired. Re-enter your PIN to access analytics.</p>
            </div>
            <Button onClick={load} variant="outline" className="gap-2 border-border mt-1">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!loading && error === 'fetch_error') {
    return (
      <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-1">Platform-wide performance and usage statistics</p>
          </div>
          <Button variant="outline" onClick={load} className="gap-2 border-border">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Failed to load analytics data. Check your connection and try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: data?.totalUsers ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Profiles', value: data?.totalProfiles ?? 0, icon: Globe, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Total Page Views', value: data?.totalViews ?? 0, icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Link Clicks', value: data?.totalClicks ?? 0, icon: MousePointer, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Total Enquiries', value: data?.totalEnquiries ?? 0, icon: BarChart3, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    {
      label: 'Click-Through Rate',
      value: data ? (data.totalViews > 0 ? `${((data.totalClicks / data.totalViews) * 100).toFixed(1)}%` : '0%') : '—',
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Analytics — Admin Portal</title>
        <meta name="description" content="Platform-wide analytics and usage statistics for JA Profile Studio." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/analytics" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Platform-wide performance and usage statistics</p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2 border-border">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-5">
              {loading ? <Skeleton className="h-16 w-full" /> : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Views chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Page Views — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : (
              data?.viewsByDay.length ? (
                <div className="flex items-end gap-1 h-40">
                  {data.viewsByDay.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-primary/60 hover:bg-primary rounded-sm transition-all cursor-default"
                        style={{ height: `${(d.count / maxViews) * 100}%`, minHeight: d.count > 0 ? '4px' : '2px' }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-xs text-foreground whitespace-nowrap z-10 shadow-lg">
                        {fmtDate(d.date, 'short').replace(/\s\d{4}$/, '')}: {d.count} views
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                  No view data for the last 30 days
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Top profiles */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Top Profiles by Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : (
              <div className="space-y-3">
                {data?.topProfiles.slice(0, 8).map((p, i) => {
                  const pct = data.totalViews > 0 ? Math.round((p.views / data.totalViews) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 flex-shrink-0 font-mono">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-foreground truncate">{p.display_name || p.username}</p>
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{p.views.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!data?.topProfiles.length && (
                  <p className="text-sm text-muted-foreground text-center py-6">No profile data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent registrations */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Recent Registrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium px-2 py-2">User</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-2 py-2">Role</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-2 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentUsers.slice(0, 10).map(u => (
                    <tr key={u.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary text-xs font-bold">{(u.name || u.email || '?').charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge className={`text-xs border-0 ${u.role === 'admin' ? 'bg-red-500/10 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground">
                        {fmtDate(u.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
