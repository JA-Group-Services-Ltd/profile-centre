/**
 * Dashboard — Service Communications
 * Shows official messages from Sousa Murray Profiles / JA Group Services to the user.
 * Platform-to-user only. No visitor or user-to-user messaging.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Bell, Shield, CreditCard, Settings, HelpCircle, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface ServiceNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  security:        { label: 'Security',       icon: Shield,       color: 'text-red-400',    bg: 'bg-red-500/10' },
  security_alert:  { label: 'Security',       icon: Shield,       color: 'text-red-400',    bg: 'bg-red-500/10' },
  billing:         { label: 'Billing',        icon: CreditCard,   color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  payment:         { label: 'Payment',        icon: CreditCard,   color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  account:         { label: 'Account',        icon: Settings,     color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  account_update:  { label: 'Account',        icon: Settings,     color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  support:         { label: 'Support',        icon: HelpCircle,   color: 'text-purple-400', bg: 'bg-purple-500/10' },
  support_reply:   { label: 'Support',        icon: HelpCircle,   color: 'text-purple-400', bg: 'bg-purple-500/10' },
  warning:         { label: 'Warning',        icon: AlertTriangle,color: 'text-orange-400', bg: 'bg-orange-500/10' },
  service_update:  { label: 'Service Update', icon: Info,         color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
};

const FILTER_TABS = [
  { id: 'all',     label: 'All' },
  { id: 'account', label: 'Account & Billing' },
  { id: 'security',label: 'Security' },
  { id: 'support', label: 'Support' },
  { id: 'service_update', label: 'Service Updates' },
];

function formatTime(dt: string): string {
  const d = new Date(dt);
  const now = new Date();
  const ukFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const todayStr     = ukFmt.format(now);
  const dateStr      = ukFmt.format(d);
  const yesterday    = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = ukFmt.format(yesterday);
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  if (dateStr === todayStr)     return `Today at ${timeStr}`;
  if (dateStr === yesterdayStr) return `Yesterday at ${timeStr}`;
  return d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }) + ` at ${timeStr}`;
}

export default function ServiceCommunicationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ServiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setNotifications(d.data);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const markRead = async (id: number) => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read', { method: 'POST', credentials: 'include' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const toggleExpand = (id: number) => {
    setExpanded(e => e === id ? null : id);
    const n = notifications.find(x => x.id === id);
    if (n && !n.is_read) markRead(id);
  };

  const filtered = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'account') return ['billing', 'payment', 'account', 'account_update'].includes(n.type);
    if (activeFilter === 'security') return ['security', 'security_alert'].includes(n.type);
    if (activeFilter === 'support') return ['support', 'support_reply'].includes(n.type);
    return n.type === activeFilter;
  });

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Service Communications — Dashboard</title>
        <meta name="description" content="Official messages and updates from Sousa Murray Profiles." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/service-communications" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Service Communications</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Official messages from Sousa Murray Profiles and JA Group Services
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Badge className="bg-primary text-white border-0">{unread} unread</Badge>
          )}
          {unread > 0 && (
            <Button variant="outline" size="sm" className="border-border text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Trust notice */}
      <div className="mb-5 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-300">How to verify official contact</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Sousa Murray Profiles will never ask for your password, payment card details, or sensitive login information through this notification centre.
            Official communications appear here in your dashboard. If you receive a suspicious message or call, do not share personal details — contact support to verify.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === tab.id
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-medium text-foreground mb-2">No service communications yet</h3>
          <p className="text-muted-foreground text-sm">
            Account updates, billing notices, security alerts, and support replies will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? { label: 'Notice', icon: Info, color: 'text-primary', bg: 'bg-primary/10' };
            const IconComp = cfg.icon;
            return (
              <Card
                key={n.id}
                className={`border transition-all cursor-pointer ${!n.is_read ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3" onClick={() => toggleExpand(n.id)}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <IconComp className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className={`text-sm font-medium truncate ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {n.title}
                          </p>
                          <Badge className={`text-xs border-0 flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(n.created_at)}</span>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          {expanded === n.id
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>
                      </div>
                      {expanded !== n.id && n.body && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{n.body}</p>
                      )}
                    </div>
                  </div>

                  {expanded === n.id && (
                    <div className="mt-4 pl-12">
                      {n.body && (
                        <div className="p-3 rounded-xl bg-muted/50 border border-border mb-3">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{n.body}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {n.link && (
                          <a href={n.link}>
                            <Button size="sm" className="bg-primary gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5" /> View details
                            </Button>
                          </a>
                        )}
                        {!n.is_read && (
                          <Button size="sm" variant="outline" className="border-border gap-2" onClick={() => markRead(n.id)}>
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
