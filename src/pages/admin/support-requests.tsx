/**
 * Admin — Support Requests (Threaded Messaging)
 * /admin/support-requests
 *
 * Full support queue with threaded conversation view.
 * Admin can read the full message thread and reply directly.
 * Replies are emailed to the user and stored in the thread.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  HelpCircle, Mail, RefreshCw, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, User, MessageSquare, Send,
  Loader2, UserSearch, X, Search, ArrowLeft, Circle,
  ShieldAlert, Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupportRequest {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  priority: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user_name: string | null;
  plan_id: number | null;
  assigned_to: number | null;
  assigned_name: string | null;
  internal_notes: string | null;
  related_profile_id: number | null;
  related_domain_id: number | null;
  unread_admin: number;
  unread_user: number;
  message_count: number;
}

interface TicketMessage {
  id: number;
  sender_type: 'user' | 'admin';
  sender_id: number | null;
  sender_name: string;
  body: string;
  created_at: string;
}

interface TicketDetail {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  subject: string;
  status: string;
  priority: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  internal_notes: string | null;
  unread_admin: number;
  unread_user: number;
  user_name: string | null;
  plan_id: number | null;
  assigned_name: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  open:                 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress:          'bg-violet-500/10 text-violet-600 border-violet-500/20',
  waiting_for_customer: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  resolved:             'bg-green-500/10 text-green-600 border-green-500/20',
  closed:               'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  open:                 'Open',
  in_progress:          'In Progress',
  waiting_for_customer: 'Waiting for Customer',
  resolved:             'Resolved',
  closed:               'Closed',
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-slate-100 text-slate-500',
  medium: 'bg-blue-500/10 text-blue-600',
  high:   'bg-orange-500/10 text-orange-600',
  urgent: 'bg-red-500/10 text-red-600',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d.replace(' ', 'T')).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d.replace(' ', 'T')).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Thread view ───────────────────────────────────────────────────────────────

function ThreadView({
  ticketId,
  onBack,
  onUpdated,
}: {
  ticketId: number;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/support-requests/${ticketId}/messages`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) {
        setTicket(d.ticket);
        setMessages(d.messages);
        setNewStatus(d.ticket.status);
        setInternalNotes(d.ticket.internal_notes ?? '');
        onUpdated(); // refresh list unread counts
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [ticketId, onUpdated]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!replyBody.trim() && newStatus === ticket?.status && internalNotes === (ticket?.internal_notes ?? '')) return;
    setSending(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/support-requests/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body: replyBody.trim() || undefined,
          status: newStatus !== ticket?.status ? newStatus : undefined,
          internal_notes: internalNotes !== (ticket?.internal_notes ?? '') ? internalNotes : undefined,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setReplyBody('');
        await load();
      } else {
        setError(d.error ?? 'Failed to send reply');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Ticket not found.</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-3">Back to list</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-start gap-3 p-4 border-b border-slate-200 bg-white shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mt-0.5 shrink-0"
          aria-label="Back to list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-900 truncate">{ticket.subject}</h2>
            <span className="text-xs text-slate-400">#{ticket.id}</span>
            <Badge className={`text-xs border ${STATUS_STYLES[ticket.status] ?? 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </Badge>
            {ticket.unread_user > 0 && (
              <Badge className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                User hasn't read reply
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3" />
              {ticket.user_name ?? ticket.name} &lt;{ticket.email}&gt;
            </span>
            {ticket.user_id && (
              <Link
                to={`/admin/users/${ticket.user_id}`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <UserSearch className="w-3 h-3" /> View CRM
              </Link>
            )}
            <span className="text-xs text-slate-400">Opened {fmtDate(ticket.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages yet.</p>
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.sender_type === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              m.sender_type === 'admin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {m.sender_type === 'admin' ? 'S' : (m.sender_name.charAt(0) || 'U').toUpperCase()}
            </div>
            {/* Bubble */}
            <div className={`max-w-[75%] ${m.sender_type === 'admin' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.sender_type === 'admin'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
              }`}>
                {m.body}
              </div>
              <span className="text-[10px] text-slate-400 px-1">
                {m.sender_type === 'admin' ? 'Support Team' : m.sender_name} · {timeAgo(m.created_at)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply + controls */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-4 space-y-3">
        {/* Status + internal notes row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="h-7 text-xs w-44 bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_for_customer">Waiting for Customer</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {ticket.priority && (
            <Badge className={`text-xs ${PRIORITY_STYLES[ticket.priority] ?? ''}`}>
              {ticket.priority}
            </Badge>
          )}
        </div>

        {/* Internal notes */}
        <div>
          <label className="text-xs text-slate-400 font-medium block mb-1">Internal notes (not visible to user)</label>
          <Textarea
            value={internalNotes}
            onChange={e => setInternalNotes(e.target.value)}
            placeholder="Add internal notes for your team…"
            className="text-xs min-h-[52px] resize-none bg-amber-50/50 border-amber-200 placeholder:text-amber-400"
            maxLength={5000}
          />
        </div>

        {/* Reply box */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder="Type your reply to the customer… (they'll receive an email notification)"
            className="flex-1 text-sm min-h-[72px] resize-none bg-slate-50 border-slate-200"
            maxLength={5000}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={sending || (!replyBody.trim() && newStatus === ticket.status && internalNotes === (ticket.internal_notes ?? ''))}
            className="gap-1.5 shrink-0 self-end"
            size="sm"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-[10px] text-slate-400">Ctrl+Enter to send · Reply is emailed to the customer</p>
      </div>
    </div>
  );
}

// ── Ticket list item ──────────────────────────────────────────────────────────

function TicketRow({
  r,
  active,
  onClick,
}: {
  r: SupportRequest;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-colors hover:bg-slate-50 ${
        active ? 'bg-primary/5 border-l-2 border-l-primary' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {r.unread_admin > 0 && (
              <Circle className="w-2 h-2 fill-primary text-primary shrink-0" />
            )}
            <span className={`text-sm font-semibold truncate ${r.unread_admin > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
              {r.subject}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">{r.user_name ?? r.name} · {r.email}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge className={`text-[10px] border px-1.5 py-0 ${STATUS_STYLES[r.status] ?? 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABELS[r.status] ?? r.status}
            </Badge>
            {r.priority && r.priority !== 'low' && (
              <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_STYLES[r.priority] ?? ''}`}>
                {r.priority}
              </Badge>
            )}
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" /> {r.message_count ?? 1}
            </span>
            <span className="text-[10px] text-slate-400">{timeAgo(r.updated_at ?? r.created_at)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSupportRequests() {
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/support-requests', { credentials: 'include' });
      const d = await r.json();
      if (d.success) setTickets(d.data);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || t.subject.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const unreadCount = tickets.filter(t => t.unread_admin > 0).length;
  const openCount   = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col -m-4 sm:-m-6 lg:-m-8">
      <Helmet>
        <title>Support Requests — Admin</title>
        <meta name="description" content="Manage and respond to customer support tickets." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/support-requests" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: ticket list ── */}
        <div className={`flex flex-col border-r border-slate-200 bg-white ${activeId ? 'hidden md:flex md:w-80 lg:w-96 shrink-0' : 'flex-1 md:w-80 lg:w-96 md:flex-none md:shrink-0'}`}>

          {/* List header */}
          <div className="px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary" /> Support Requests
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {openCount} open{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                </p>
              </div>
              <button
                onClick={() => { setLoading(true); setRefreshKey(k => k + 1); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tickets…"
                className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_for_customer">Waiting for Customer</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Inbox className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No tickets found</p>
                <p className="text-xs mt-1">{search || filterStatus !== 'all' ? 'Try adjusting your filters' : 'All clear!'}</p>
              </div>
            ) : (
              filtered.map(t => (
                <TicketRow
                  key={t.id}
                  r={t}
                  active={activeId === t.id}
                  onClick={() => setActiveId(t.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: thread view ── */}
        <div className={`flex-1 flex flex-col overflow-hidden bg-white ${activeId ? 'flex' : 'hidden md:flex'}`}>
          {activeId ? (
            <ThreadView
              key={activeId}
              ticketId={activeId}
              onBack={() => setActiveId(null)}
              onUpdated={() => setRefreshKey(k => k + 1)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">Select a ticket</p>
                <p className="text-xs mt-1">Choose a support request from the list to view the conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
