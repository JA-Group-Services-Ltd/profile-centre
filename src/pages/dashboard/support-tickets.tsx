/**
 * Dashboard — My Support Tickets
 * /dashboard/support-tickets
 *
 * Logged-in users can:
 *  - Submit a new ticket without re-entering their name/email (pre-filled from auth)
 *  - View all their tickets
 *  - Reply to threads directly from the dashboard
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  HelpCircle, MessageSquare, Send, Loader2, ArrowLeft,
  CheckCircle2, Clock, AlertCircle, X, Plus, Circle, Inbox,
  ChevronDown, Lock, Shield, CreditCard, FileText, Mail, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'account_access',       label: 'Account access',         icon: Lock },
  { value: 'security_concern',     label: 'Security concern',       icon: Shield },
  { value: 'billing',              label: 'Billing',                icon: CreditCard },
  { value: 'business_cards',       label: 'Business cards',         icon: FileText },
  { value: 'email_signature',      label: 'Email signature',        icon: Mail },
  { value: 'technical_issue',      label: 'Technical issue',        icon: HelpCircle },
  { value: 'privacy_data_request', label: 'Privacy / data request', icon: User },
  { value: 'other',                label: 'Other',                  icon: HelpCircle },
];

const STATUS_STYLES: Record<string, string> = {
  open:                 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress:          'bg-violet-500/10 text-violet-600 border-violet-500/20',
  waiting_for_customer: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  resolved:             'bg-green-500/10 text-green-600 border-green-500/20',
  closed:               'bg-muted text-muted-foreground border-border',
};

const STATUS_LABELS: Record<string, string> = {
  open:                 'Open',
  in_progress:          'In Progress',
  waiting_for_customer: 'Waiting for your reply',
  resolved:             'Resolved',
  closed:               'Closed',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  open:                 Clock,
  in_progress:          AlertCircle,
  waiting_for_customer: MessageSquare,
  resolved:             CheckCircle2,
  closed:               X,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ticket {
  id: number;
  subject: string;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  unread_user: number;
  message_count: number;
}

interface TicketMessage {
  id: number;
  sender_type: 'user' | 'admin';
  sender_name: string;
  body: string;
  created_at: string;
}

interface TicketDetail {
  id: number;
  subject: string;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
  unread_user: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── New Ticket Form ───────────────────────────────────────────────────────────

function NewTicketForm({
  defaultName,
  defaultEmail,
  onSuccess,
  onCancel,
}: {
  defaultName: string;
  defaultEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: defaultName,
    email: defaultEmail,
    category: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.category || !form.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => onSuccess(), 1200);
      } else {
        setError(data.error || 'Failed to submit. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
        <p className="text-sm font-semibold text-foreground">Request submitted</p>
        <p className="text-xs text-muted-foreground">Loading your tickets…</p>
      </div>
    );
  }

  const isLoggedIn = !!defaultName && !!defaultEmail;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      {/* Name + Email — shown but locked if logged in */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nt-name">
            Full name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="nt-name"
            value={form.name}
            onChange={e => set('name')(e.target.value)}
            placeholder="Your name"
            readOnly={isLoggedIn}
            className={isLoggedIn ? 'bg-muted/50 cursor-default' : ''}
            required
          />
          {isLoggedIn && (
            <p className="text-[10px] text-muted-foreground">From your account</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nt-email">
            Email address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="nt-email"
            type="email"
            value={form.email}
            onChange={e => set('email')(e.target.value)}
            placeholder="you@example.com"
            readOnly={isLoggedIn}
            className={isLoggedIn ? 'bg-muted/50 cursor-default' : ''}
            required
          />
          {isLoggedIn && (
            <p className="text-[10px] text-muted-foreground">From your account</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="nt-category">
          Category <span className="text-red-500">*</span>
        </Label>
        <Select value={form.category} onValueChange={set('category')}>
          <SelectTrigger id="nt-category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="nt-subject">Subject <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          id="nt-subject"
          value={form.subject}
          onChange={e => set('subject')(e.target.value)}
          placeholder="Brief summary of your issue"
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <Label htmlFor="nt-message">
          Message <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="nt-message"
          value={form.message}
          onChange={e => set('message')(e.target.value)}
          placeholder="Please describe your issue in as much detail as possible."
          rows={5}
          maxLength={5000}
          required
        />
        <p className="text-[10px] text-muted-foreground text-right">{form.message.length}/5000</p>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Submitting…' : 'Submit request'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        By submitting you agree to our{' '}
        <a href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        We will reply here and by email.
      </p>
    </form>
  );
}

// ── Thread view ───────────────────────────────────────────────────────────────

function ThreadView({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/tickets/${ticketId}/messages`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) { setTicket(d.ticket); setMessages(d.messages); }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!replyBody.trim()) return;
    setSending(true); setError('');
    try {
      const r = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      const d = await r.json();
      if (d.success) { setReplyBody(''); await load(); }
      else setError(d.error ?? 'Failed to send message');
    } catch { setError('Network error. Please try again.'); }
    finally { setSending(false); }
  };

  if (loading) return (
    <div className="space-y-3 p-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
    </div>
  );

  if (!ticket) return (
    <div className="p-8 text-center text-muted-foreground">
      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">Ticket not found.</p>
      <Button variant="ghost" size="sm" onClick={onBack} className="mt-3">Back</Button>
    </div>
  );

  const StatusIcon = STATUS_ICONS[ticket.status] ?? Clock;
  const isClosed = ticket.status === 'closed';

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-start gap-3 p-4 border-b border-border bg-card shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5 shrink-0"
          aria-label="Back to tickets"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">{ticket.subject}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={`text-xs border flex items-center gap-1 ${STATUS_STYLES[ticket.status] ?? 'bg-muted text-muted-foreground'}`}>
              <StatusIcon className="w-2.5 h-2.5" />
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </Badge>
            <span className="text-xs text-muted-foreground">Opened {fmtDateTime(ticket.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages yet.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.sender_type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
              m.sender_type === 'admin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {m.sender_type === 'admin' ? 'S' : 'Y'}
            </div>
            <div className={`max-w-[75%] flex flex-col gap-1 ${m.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.sender_type === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-card border border-border text-foreground rounded-tl-sm shadow-sm'
              }`}>
                {m.body}
              </div>
              <span className="text-[10px] text-muted-foreground px-1">
                {m.sender_type === 'admin' ? 'Support Team' : 'You'} · {timeAgo(m.created_at)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="shrink-0 border-t border-border bg-card p-4">
        {isClosed ? (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm">
            <X className="w-4 h-4 shrink-0" />
            <span>This ticket is closed. Open a new request if you need further help.</span>
          </div>
        ) : (
          <>
            <div className="flex gap-2 items-end">
              <Textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Reply to the support team…"
                className="flex-1 text-sm min-h-[72px] resize-none"
                maxLength={5000}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); } }}
              />
              <Button
                onClick={handleSend}
                disabled={sending || !replyBody.trim()}
                className="gap-1.5 shrink-0 self-end"
                size="sm"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            <p className="text-[10px] text-muted-foreground mt-1.5">Ctrl+Enter to send · Our team will reply by email and here</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardSupportTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/support/tickets', { credentials: 'include' });
      const d = await r.json();
      if (d.success) setTickets(d.data);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unreadCount = tickets.filter(t => t.unread_user > 0).length;

  // Pre-fill values from auth context
  const defaultName  = user?.name  ?? '';
  const defaultEmail = user?.email ?? '';

  // ── Thread view ──────────────────────────────────────────────────────────
  if (activeId) {
    return (
      <>
        <Helmet>
          <title>Support Ticket — Profile Centre</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="h-[calc(100vh-3.5rem)] -m-4 sm:-m-6 lg:-m-8 flex flex-col">
          <ThreadView key={activeId} ticketId={activeId} onBack={() => { setActiveId(null); load(); }} />
        </div>
      </>
    );
  }

  // ── New ticket form (inline, full-width) ─────────────────────────────────
  if (showNewForm) {
    return (
      <>
        <Helmet>
          <title>New Support Request — Profile Centre</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setShowNewForm(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Back to tickets"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">New support request</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Our team will reply here and by email</p>
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <NewTicketForm
              defaultName={defaultName}
              defaultEmail={defaultEmail}
              onSuccess={() => { setShowNewForm(false); load(); }}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        </div>
      </>
    );
  }

  // ── Ticket list ──────────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>My Support Tickets — Profile Centre</title>
        <meta name="description" content="View and reply to your support tickets." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/support-tickets" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
              <HelpCircle className="w-6 h-6 text-primary" /> My Support Tickets
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading
                ? 'Loading…'
                : tickets.length === 0
                  ? 'No tickets yet'
                  : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}${unreadCount > 0 ? ` · ${unreadCount} with new replies` : ''}`}
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewForm(true)}>
            <Plus className="w-3.5 h-3.5" /> New request
          </Button>
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <Inbox className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">No support tickets yet</p>
              <p className="text-xs mt-1">Submit a request and our team will get back to you here and by email.</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 mt-2" onClick={() => setShowNewForm(true)}>
              <Plus className="w-3.5 h-3.5" /> Submit a request
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const StatusIcon = STATUS_ICONS[t.status] ?? Clock;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {t.unread_user > 0 && (
                          <Circle className="w-2 h-2 fill-primary text-primary shrink-0" />
                        )}
                        <span className={`text-sm font-semibold truncate ${t.unread_user > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                          {t.subject}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] border flex items-center gap-1 ${STATUS_STYLES[t.status] ?? 'bg-muted text-muted-foreground'}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                        {t.unread_user > 0 && (
                          <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            New reply
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5" /> {t.message_count}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(t.updated_at ?? t.created_at)}</span>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5 -rotate-90" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
