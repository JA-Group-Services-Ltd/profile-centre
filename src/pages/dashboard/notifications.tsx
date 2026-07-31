/**
 * /dashboard/notifications
 * Unified notification centre — service updates, account, billing, security,
 * support, and message alerts all in one place.
 * Live updates via SSE (/api/notifications/stream).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Bell, ShieldAlert, CreditCard, Info, Settings,
  HelpCircle, AlertTriangle, CheckCheck, Trash2, Loader2, Shield,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

// ── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}> = {
  security:        { label: 'Security',       icon: ShieldAlert,   color: 'text-red-400',    bg: 'bg-red-500/10' },
  security_alert:  { label: 'Security',       icon: ShieldAlert,   color: 'text-red-400',    bg: 'bg-red-500/10' },
  billing:         { label: 'Billing',        icon: CreditCard,    color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  payment:         { label: 'Payment',        icon: CreditCard,    color: 'text-blue-400',  bg: 'bg-blue-500/10' },
  account:         { label: 'Account',        icon: Settings,      color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  account_update:  { label: 'Account',        icon: Settings,      color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  support:         { label: 'Support',        icon: HelpCircle,    color: 'text-purple-400', bg: 'bg-purple-500/10' },
  support_reply:   { label: 'Support',        icon: HelpCircle,    color: 'text-purple-400', bg: 'bg-purple-500/10' },
  warning:         { label: 'Warning',        icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  service_update:  { label: 'Service Update', icon: Info,          color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  info:            { label: 'Info',           icon: Info,          color: 'text-primary',    bg: 'bg-primary/10' },
};

const FALLBACK_CFG = { label: 'Notice', icon: Info, color: 'text-primary', bg: 'bg-primary/10' };

// ── Filter tabs ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',      label: 'All' },
  { id: 'account',  label: 'Account & Billing' },
  { id: 'security', label: 'Security' },
  { id: 'support',  label: 'Support' },
  { id: 'updates',  label: 'Service Updates' },
];

function matchesTab(n: Notification, tab: string): boolean {
  if (tab === 'all') return true;
  if (tab === 'account')  return ['billing', 'payment', 'account', 'account_update'].includes(n.type);
  if (tab === 'security') return ['security', 'security_alert'].includes(n.type);
  if (tab === 'support')  return ['support', 'support_reply'].includes(n.type);
  if (tab === 'updates')  return ['service_update', 'info', 'warning'].includes(n.type);
  return false;
}

// ── Time formatter ───────────────────────────────────────────────────────────
function formatTime(dt: string): string {
  const d = new Date(dt);
  const now = new Date();
  const ukFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const todayStr = ukFmt.format(now);
  const dateStr  = ukFmt.format(d);
  const timeStr  = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);

  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (dateStr === todayStr) return `Today at ${timeStr}`;
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === ukFmt.format(yesterday)) return `Yesterday at ${timeStr}`;
  return d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }) + ` at ${timeStr}`;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const navigate = useNavigate();
  const sseRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setNotifications(data.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // SSE live connection
  useEffect(() => {
    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    sseRef.current = es;

    es.addEventListener('connected', () => setLiveConnected(true));
    es.addEventListener('notification', () => load()); // re-fetch on push
    es.onerror = () => setLiveConnected(false);

    return () => { es.close(); sseRef.current = null; };
  }, [load]);

  const unread = notifications.filter(n => !n.is_read).length;
  const filtered = notifications.filter(n => matchesTab(n, activeTab));
  const tabUnread = (tab: string) => notifications.filter(n => !n.is_read && matchesTab(n, tab)).length;

  const markAllRead = async () => {
    setMarkingAll(true);
    await fetch('/api/notifications/read', { method: 'POST', credentials: 'include' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setMarkingAll(false);
  };

  const markRead = async (id: number) => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const dismiss = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const toggleExpand = (n: Notification) => {
    const next = expanded === n.id ? null : n.id;
    setExpanded(next);
    if (!n.is_read && next === n.id) markRead(n.id);
  };

  const handleLink = (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (n.link) navigate(n.link);
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Notifications — Dashboard</title>
        <meta name="description" content="Your notifications, service updates, and account alerts." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/notifications" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Page header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
              {liveConnected && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 border-border flex-shrink-0"
          >
            {markingAll
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCheck className="w-3.5 h-3.5" />}
            Mark all read
          </Button>
        )}
      </div>

      {/* Trust notice */}
      <div className="mb-5 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-blue-300">Official communications only appear here.</span>{' '}
          Profile Centre will never ask for your password or payment details through this notification centre.
          If you receive a suspicious message or call, contact support to verify.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {TABS.map(tab => {
          const count = tabUnread(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
                  activeTab === tab.id ? 'bg-white/30 text-white' : 'bg-primary text-white'
                }`}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-muted-foreground opacity-40" />
          </div>
          <p className="text-base font-semibold text-foreground">No notifications</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {activeTab === 'all'
              ? 'Account updates, alerts, and messages will appear here.'
              : 'Nothing in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? FALLBACK_CFG;
            const IconComp = cfg.icon;
            const isExpanded = expanded === n.id;

            return (
              <div
                key={n.id}
                className={`rounded-2xl border transition-all ${
                  !n.is_read
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-card border-border'
                }`}
              >
                {/* Row */}
                <button
                  onClick={() => toggleExpand(n)}
                  className="w-full text-left flex items-start gap-3 p-4 group"
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <IconComp className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                          {n.title}
                        </p>
                        <Badge className={`text-[10px] border-0 px-1.5 py-0 h-4 flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    </div>
                    {!isExpanded && n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatTime(n.created_at)}</p>
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-4 pb-4 pl-16">
                    {n.body && (
                      <div className="p-3 rounded-xl bg-muted/50 border border-border mb-3">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{n.body}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.link && (
                        <Button size="sm" className="bg-primary gap-1.5" onClick={e => handleLink(n, e)}>
                          View details
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border gap-1.5 text-muted-foreground hover:text-red-400 hover:border-red-400/30"
                        onClick={e => dismiss(n.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
