/**
 * Dashboard — Messages
 * Real-time 2-way messaging using Server-Sent Events (SSE).
 * Mobile-first: full-screen thread view on small screens.
 * No manual refresh needed — new messages push instantly.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, Lock, Unlock, Trash2, ArrowLeft,
  Mail, AlertCircle, UserCheck, Clock, ExternalLink, Copy,
  CheckCheck, ToggleLeft, ToggleRight, Settings2, ChevronDown,
  Wifi, WifiOff, Flag, Ban, CalendarClock,
} from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Thread {
  id: number;
  profile_id: number;
  sender_name: string;
  sender_email: string;
  subject: string | null;
  status: 'open' | 'closed';
  visitor_accepted: number;
  visitor_token: string;
  last_message_at: string;
  created_at: string;
  unread_count: number;
  last_message: string | null;
  profile_username: string;
  profile_name: string | null;
}

interface Message {
  id: number;
  thread_id: number;
  sender: 'visitor' | 'owner';
  body: string;
  is_read: number;
  created_at: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<Thread | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportDialog, setReportDialog] = useState<Thread | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [messagingEnabled, setMessagingEnabled] = useState<boolean>(true);
  const [togglingMessaging, setTogglingMessaging] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [showHoursPanel, setShowHoursPanel] = useState(false);
  const [contactHours, setContactHours] = useState({
    enabled: false,
    start_time: '09:00',
    end_time: '17:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    outside_hours_message: 'This profile may respond during their listed contact hours.',
  });
  const [savingHours, setSavingHours] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<Thread | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  activeThreadRef.current = activeThread;

  // ── Load profile ID + messaging toggle status ──────────────────────────────
  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        if (d.success && d.data.length > 0) {
          const pid = d.data[0].id;
          setProfileId(pid);
          const [ps, ch] = await Promise.all([
            fetch(`/api/profiles/${pid}/pin/status`, { credentials: 'include' }).then(r => r.json()),
            fetch(`/api/profiles/${pid}/contact-hours`, { credentials: 'include' }).then(r => r.json()),
          ]);
          if (ps.success) setMessagingEnabled(!!ps.data.messaging_enabled);
          if (ch.success && ch.data) setContactHours(ch.data);
        }
      });
  }, [user]);

  // ── Initial thread load ────────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/threads', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setThreads(data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadThreads().finally(() => setLoading(false));
  }, [user, loadThreads]);

  // ── SSE real-time connection ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    function connect() {
      const es = new EventSource('/api/messages/sse', { withCredentials: true });
      sseRef.current = es;

      es.onopen = () => {
        setSseConnected(true);
        retryCount = 0;
      };

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; data: Record<string, unknown> };

          if (msg.type === 'connected') return;

          if (msg.type === 'new_thread') {
            // Reload thread list to get the full thread object
            loadThreads();
          }

          if (msg.type === 'new_message') {
            const threadId = msg.data.thread_id as number;
            // If this thread is currently open, reload its messages
            const current = activeThreadRef.current;
            if (current && current.id === threadId) {
              fetch(`/api/messages/threads/${threadId}`, { credentials: 'include' })
                .then(r => r.json())
                .then(d => {
                  if (d.success) {
                    setMessages(d.data.messages);
                    setActiveThread(prev => prev ? { ...prev, ...d.data.thread, unread_count: 0 } : prev);
                  }
                });
            }
            // Always refresh thread list for unread count
            loadThreads();
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        sseRef.current = null;
        // Exponential back-off: 2s, 4s, 8s … max 30s
        const delay = Math.min(2000 * Math.pow(2, retryCount), 30000);
        retryCount++;
        retryTimeout = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      sseRef.current?.close();
      sseRef.current = null;
      setSseConnected(false);
    };
  }, [user, loadThreads]);

  // ── Auto-scroll to latest message ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Thread actions ─────────────────────────────────────────────────────────
  const openThread = async (thread: Thread) => {
    setActiveThread(thread);
    setThreadLoading(true);
    setReply('');
    setReplyError('');
    const res = await fetch(`/api/messages/threads/${thread.id}`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      setMessages(data.data.messages);
      setActiveThread(prev => prev ? { ...prev, ...data.data.thread, unread_count: 0 } : thread);
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread_count: 0 } : t));
    }
    setThreadLoading(false);
  };

  const acceptVisitor = async () => {
    if (!activeThread || accepting) return;
    setAccepting(true);
    try {
      await fetch(`/api/messages/threads/${activeThread.id}/accept`, {
        method: 'PATCH', credentials: 'include',
      });
      const updated = { ...activeThread, visitor_accepted: 1 };
      setActiveThread(updated);
      setThreads(prev => prev.map(t => t.id === activeThread.id ? updated : t));
    } finally {
      setAccepting(false);
    }
  };

  const sendReply = async () => {
    if (!activeThread || !reply.trim() || replying) return;
    const body = reply.trim();
    setReplyError('');
    setReplying(true);
    setReply('');
    try {
      const res = await fetch(`/api/messages/threads/${activeThread.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.some(m => m.id === data.data.id) ? prev : [...prev, data.data]);
        setThreads(prev => prev.map(t => t.id === activeThread.id
          ? { ...t, last_message: body, last_message_at: new Date().toISOString() }
          : t
        ));
      } else {
        setReplyError(data.error || 'Failed to send reply');
        setReply(body);
      }
    } catch {
      setReplyError('Network error — please try again');
      setReply(body);
    } finally {
      setReplying(false);
    }
  };

  const toggleStatus = async (thread: Thread) => {
    const newStatus = thread.status === 'open' ? 'closed' : 'open';
    await fetch(`/api/messages/threads/${thread.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus }),
    });
    const updated = { ...thread, status: newStatus as 'open' | 'closed' };
    setThreads(prev => prev.map(t => t.id === thread.id ? updated : t));
    if (activeThread?.id === thread.id) setActiveThread(updated);
  };

  const deleteThread = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    await fetch(`/api/messages/threads/${deleteDialog.id}`, { method: 'DELETE', credentials: 'include' });
    setThreads(prev => prev.filter(t => t.id !== deleteDialog.id));
    if (activeThread?.id === deleteDialog.id) setActiveThread(null);
    setDeleteDialog(null);
    setDeleting(false);
  };

  const reportThread = async () => {
    if (!reportDialog || reporting) return;
    setReporting(true);
    try {
      await fetch(`/api/messages/threads/${reportDialog.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reportReason || 'Reported by profile owner' }),
      });
      setThreads(prev => prev.map(t => t.id === reportDialog.id ? { ...t, status: 'closed' as const } : t));
      if (activeThread?.id === reportDialog.id) setActiveThread(prev => prev ? { ...prev, status: 'closed' } : prev);
    } finally {
      setReporting(false);
      setReportDialog(null);
      setReportReason('');
    }
  };

  const blockSender = async (thread: Thread) => {
    if (blocking) return;
    setBlocking(true);
    try {
      await fetch(`/api/messages/threads/${thread.id}/block`, {
        method: 'POST', credentials: 'include',
      });
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, status: 'closed' as const } : t));
      if (activeThread?.id === thread.id) setActiveThread(prev => prev ? { ...prev, status: 'closed' } : prev);
    } finally {
      setBlocking(false);
    }
  };

  const copyConversationLink = (thread: Thread) => {
    const url = `${window.location.origin}/conversation/${thread.id}?token=${encodeURIComponent(thread.visitor_token)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleToggleMessaging = async (enabled: boolean) => {
    if (!profileId || togglingMessaging) return;
    setTogglingMessaging(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}/messaging`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) setMessagingEnabled(!!data.messaging_enabled);
    } finally {
      setTogglingMessaging(false);
    }
  };

  const saveContactHours = async () => {
    if (!profileId || savingHours) return;
    setSavingHours(true);
    try {
      await fetch(`/api/profiles/${profileId}/contact-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contactHours),
      });
    } finally {
      setSavingHours(false);
    }
  };

  const toggleContactDay = (day: string) => {
    setContactHours(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day],
    }));
  };

  const totalUnread = threads.reduce((s, t) => s + (t.unread_count || 0), 0);

  const formatTime = (dt: string) => {
    const d = new Date(dt);
    const now = new Date();

    const ukFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todayStr     = ukFmt.format(now);
    const dateStr      = ukFmt.format(d);
    const yesterday    = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = ukFmt.format(yesterday);

    const diffMs   = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60 && dateStr === todayStr) return `${diffMins}m ago`;

    const timeStr = d.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
    });

    if (dateStr === todayStr)     return `Today at ${timeStr}`;
    if (dateStr === yesterdayStr) return `Yesterday at ${timeStr}`;

    return d.toLocaleDateString('en-GB', {
      timeZone: 'Europe/London',
      day: 'numeric', month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ` at ${timeStr}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100vh-5rem)] max-w-5xl mx-auto">
      <Helmet>
        <title>Messages — Dashboard</title>
        <meta name="description" content="View and reply to messages from your card visitors." />
        <link rel="canonical" href="/dashboard/messages" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-1 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Messages</h1>
          {totalUnread > 0 && (
            <Badge className="bg-primary text-white border-0 text-xs">{totalUnread}</Badge>
          )}
          {/* SSE connection indicator */}
          <span title={sseConnected ? 'Live — messages push instantly' : 'Reconnecting…'}>
            {sseConnected
              ? <Wifi className="w-3.5 h-3.5 text-green-400" />
              : <WifiOff className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            }
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-border gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 bg-card border-border">
            {/* Messaging on/off */}
            <div className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Messaging</p>
                <p className="text-xs text-muted-foreground">Allow visitors to send you messages</p>
              </div>
              <Switch
                checked={messagingEnabled}
                onCheckedChange={handleToggleMessaging}
                disabled={togglingMessaging}
                className="flex-shrink-0"
              />
            </div>
            <DropdownMenuSeparator className="bg-border" />
            {/* Contact hours */}
            <button
              className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left"
              onClick={() => setShowHoursPanel(v => !v)}
            >
              <CalendarClock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Contact Hours</p>
                <p className="text-xs text-muted-foreground">
                  {contactHours.enabled ? `${contactHours.start_time}–${contactHours.end_time}` : 'Not configured'}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showHoursPanel ? 'rotate-180' : ''}`} />
            </button>
            {showHoursPanel && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-foreground">Enable contact hours</Label>
                  <Switch
                    checked={contactHours.enabled}
                    onCheckedChange={v => setContactHours(prev => ({ ...prev, enabled: v }))}
                  />
                </div>
                {contactHours.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                        <Input type="time" value={contactHours.start_time}
                          onChange={e => setContactHours(prev => ({ ...prev, start_time: e.target.value }))}
                          className="h-8 text-xs bg-background border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                        <Input type="time" value={contactHours.end_time}
                          onChange={e => setContactHours(prev => ({ ...prev, end_time: e.target.value }))}
                          className="h-8 text-xs bg-background border-border" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Days available</Label>
                      <div className="flex flex-wrap gap-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <button
                            key={day}
                            onClick={() => toggleContactDay(day)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              contactHours.days.includes(day)
                                ? 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Outside-hours notice</Label>
                      <textarea
                        value={contactHours.outside_hours_message}
                        onChange={e => setContactHours(prev => ({ ...prev, outside_hours_message: e.target.value }))}
                        className="w-full text-xs bg-background border border-border rounded-lg p-2 resize-none text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={2}
                      />
                    </div>
                  </>
                )}
                <Button size="sm" className="w-full bg-primary text-white gap-1.5" onClick={saveContactHours} disabled={savingHours}>
                  {savingHours ? 'Saving…' : 'Save contact hours'}
                </Button>
              </div>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Toggle messaging on/off from your Profile settings too.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messaging disabled banner */}
      {!messagingEnabled && (
        <div className="mb-3 flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
          <ToggleLeft className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-xs text-blue-400 flex-1">Messaging is off — visitors cannot send new messages.</p>
          <Button size="sm" variant="outline"
            className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 flex-shrink-0 gap-1 h-7 text-xs"
            onClick={() => handleToggleMessaging(true)} disabled={togglingMessaging}>
            <ToggleRight className="w-3.5 h-3.5" /> Enable
          </Button>
        </div>
      )}

      {/* ── Main conversation layout ── */}
      <div className="flex flex-1 gap-3 min-h-0">

        {/* Thread list — hidden on mobile when a thread is open */}
        <div className={`
          flex flex-col gap-2 overflow-y-auto
          w-full lg:w-72 xl:w-80 flex-shrink-0
          ${activeThread ? 'hidden lg:flex' : 'flex'}
        `}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : threads.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  When someone sends you a message from your card, it'll appear here instantly.
                </p>
              </CardContent>
            </Card>
          ) : (
            threads.map(thread => (
              <button
                key={thread.id}
                onClick={() => openThread(thread)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  activeThread?.id === thread.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
                      {(thread.sender_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{thread.sender_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{thread.sender_email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{formatTime(thread.last_message_at)}</span>
                    {thread.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                </div>
                {thread.subject && (
                  <p className="text-xs font-medium text-foreground mb-0.5 truncate pl-10">{thread.subject}</p>
                )}
                {thread.last_message && (
                  <p className="text-xs text-muted-foreground truncate pl-10">{thread.last_message}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 pl-10">
                  <Badge className={`text-xs border-0 ${thread.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {thread.status === 'open' ? '● Open' : '● Closed'}
                  </Badge>
                  {!thread.visitor_accepted && thread.status === 'open' && (
                    <Badge className="text-xs border-0 bg-blue-500/10 text-blue-400">Pending</Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Thread detail — full-screen on mobile when open */}
        <div className={`
          flex-1 flex flex-col min-h-0 min-w-0
          ${activeThread ? 'flex' : 'hidden lg:flex'}
        `}>
          {!activeThread ? (
            <Card className="bg-card border-border flex-1 flex items-center justify-center">
              <CardContent className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a conversation to view</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {sseConnected ? 'New messages will appear instantly' : 'Connecting…'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border flex-1 flex flex-col overflow-hidden">
              {/* Thread header */}
              <CardHeader className="border-b border-border pb-3 flex-shrink-0 px-3 sm:px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Back button — mobile only */}
                    <button
                      onClick={() => setActiveThread(null)}
                      className="lg:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <CardTitle className="text-sm sm:text-base truncate">{activeThread.sender_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <a href={`mailto:${activeThread.sender_email}`} className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{activeThread.sender_email}</span>
                        </a>
                      </div>
                      {activeThread.subject && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">Re: {activeThread.subject}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" className="border-border h-8 w-8 p-0" title="Copy visitor link"
                      onClick={() => copyConversationLink(activeThread)}>
                      {copiedLink ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                    <a href={`/conversation/${activeThread.id}?token=${encodeURIComponent(activeThread.visitor_token)}`}
                      target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-border h-8 w-8 p-0" title="Open visitor view">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button size="sm" variant="outline"
                      className={`border-border h-8 px-2 text-xs gap-1 ${activeThread.status === 'open' ? 'text-blue-400 border-blue-500/20' : 'text-green-400 border-green-500/30'}`}
                      onClick={() => toggleStatus(activeThread)}>
                      {activeThread.status === 'open'
                        ? <><Lock className="w-3 h-3" /><span className="hidden sm:inline">Close</span></>
                        : <><Unlock className="w-3 h-3" /><span className="hidden sm:inline">Reopen</span></>
                      }
                    </Button>
                    <Button size="sm" variant="outline"
                      className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 h-8 w-8 p-0"
                      title="Report this conversation"
                      onClick={() => { setReportDialog(activeThread); setReportReason(''); }}>
                      <Flag className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline"
                      className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 h-8 w-8 p-0"
                      title="Block this sender"
                      onClick={() => blockSender(activeThread)}
                      disabled={blocking}>
                      <Ban className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                      onClick={() => setDeleteDialog(activeThread)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Accept banner */}
              {!activeThread.visitor_accepted && activeThread.status === 'open' && (
                <div className="border-b border-border bg-blue-500/10 px-3 sm:px-4 py-3 flex items-center gap-3 flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">New message — accept to reply</p>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                      Accept to open 2-way live chat. The visitor can reply in their browser.
                    </p>
                  </div>
                  <Button size="sm" onClick={acceptVisitor} disabled={accepting} className="bg-primary gap-1.5 flex-shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                    {accepting ? 'Accepting…' : 'Accept'}
                  </Button>
                </div>
              )}

              {/* Accepted badge */}
              {activeThread.visitor_accepted && activeThread.status === 'open' && (
                <div className="border-b border-border bg-green-500/5 px-3 sm:px-4 py-2 flex items-center gap-2 flex-shrink-0">
                  <UserCheck className="w-3.5 h-3.5 text-green-400" />
                  <p className="text-xs text-green-400">Live 2-way conversation</p>
                  {sseConnected && <span className="text-xs text-green-400/60">· messages push instantly</span>}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {threadLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2.5 text-sm ${
                        msg.sender === 'owner'
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className={`text-xs mt-1 ${msg.sender === 'owner' ? 'text-white/60' : 'text-muted-foreground'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box */}
              <div className="border-t border-border p-3 sm:p-4 flex-shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
                {activeThread.status === 'closed' ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground flex-1">Conversation closed.</p>
                    <Button size="sm" variant="outline"
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10 flex-shrink-0 gap-1 h-8"
                      onClick={() => toggleStatus(activeThread)}>
                      <Unlock className="w-3 h-3" /> Reopen
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      {replyError && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive mb-2">
                          <AlertCircle className="w-3.5 h-3.5" />{replyError}
                        </div>
                      )}
                      <Textarea
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        placeholder="Type your reply… (⌘+Enter to send)"
                        className="bg-background border-border resize-none text-sm min-h-[80px]"
                        rows={3}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            sendReply();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={sendReply}
                      disabled={replying || !reply.trim()}
                      className="bg-primary gap-1.5 self-end h-10"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">{replying ? 'Sending…' : 'Send'}</span>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={open => !open && setDeleteDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Delete Conversation
            </DialogTitle>
            <DialogDescription>
              Delete the conversation with <strong>{deleteDialog?.sender_name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} className="border-border">Cancel</Button>
            <Button onClick={deleteThread} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={!!reportDialog} onOpenChange={open => !open && setReportDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Flag className="w-5 h-5 text-blue-400" /> Report Conversation
            </DialogTitle>
            <DialogDescription>
              Report the conversation with <strong>{reportDialog?.sender_name}</strong> as abusive, spam, or inappropriate.
              The conversation will be closed and flagged for admin review.
            </DialogDescription>
          </DialogHeader>
          <div className="px-1 pb-2">
            <label className="text-xs text-muted-foreground block mb-1.5">Reason (optional)</label>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="e.g. Spam, harassment, threatening language…"
              className="w-full text-sm bg-background border border-border rounded-lg p-2.5 resize-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialog(null)} className="border-border">Cancel</Button>
            <Button onClick={reportThread} disabled={reporting} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              <Flag className="w-3.5 h-3.5" />
              {reporting ? 'Reporting…' : 'Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
