/**
 * /conversation/:threadId?token=xxx
 * Public page — lets a visitor continue a 2-way conversation with a card owner.
 * No login required. Access is gated by the visitor_token issued when the first
 * message was sent.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Send, MessageCircle, Lock, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useBranding } from '@/lib/branding';

interface ConvMessage {
  id: number;
  sender: 'visitor' | 'owner';
  body: string;
  created_at: string;
}

interface ConvThread {
  id: number;
  status: 'open' | 'closed';
  visitor_accepted: number;
  sender_name: string;
  subject: string | null;
  profile_name: string;
}

export default function ConversationPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const branding = useBranding();

  const [thread, setThread] = useState<ConvThread | null>(null);
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!threadId || !token) { setError('Invalid conversation link.'); setLoading(false); return; }
    try {
      const res = await fetch(`/api/messages/thread/${threadId}/visitor?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Could not load conversation.'); setLoading(false); return; }
      setThread(data.data.thread);
      setMessages(data.data.messages);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [threadId, token]);

  // Poll for new messages every 8 seconds while open
  useEffect(() => {
    if (!thread || thread.status === 'closed' || !thread.visitor_accepted) return;
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [thread?.status, thread?.visitor_accepted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    const body = reply.trim();
    setSendError('');
    setSending(true);
    setReply('');
    try {
      const res = await fetch(`/api/messages/thread/${threadId}/visitor-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, visitor_token: token }),
      });
      const data = await res.json();
      if (data.success) {
        await load(); // reload to get server-side message
      } else {
        setSendError(data.error || 'Failed to send.');
        setReply(body);
      }
    } catch {
      setSendError('Network error — please try again.');
      setReply(body);
    } finally {
      setSending(false);
    }
  };

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

    const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
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

  const platformName = branding.platform_name ?? 'JA Profile Studio';

  return (
    <>
      <Helmet>
        <title>{`Conversation — ${platformName}`}</title>
        <meta name="description" content={`Continue your conversation on ${platformName}.`} />
        <link rel="canonical" href={`https://japrofilestudio.jagroupservices.co.uk/conversation/${threadId ?? ''}`} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border px-4 py-3 flex-shrink-0">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <h1 className="sr-only">Conversation — {platformName}</h1>
            <Link to="/" className="flex items-center">
              <span className="font-bold text-sm text-foreground">{platformName}</span>
            </Link>
            {thread && (
              <Badge className={`text-xs border-0 ${thread.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                {thread.status === 'open' ? '● Live' : '● Closed'}
              </Badge>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold mb-1">Conversation not found</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : thread ? (
            <>
              {/* Thread info */}
              <div className="mb-4 p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {thread.profile_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Conversation with {thread.profile_name}</p>
                    {thread.subject && <p className="text-xs text-muted-foreground">Re: {thread.subject}</p>}
                  </div>
                </div>
              </div>

              {/* Pending acceptance state */}
              {!thread.visitor_accepted && thread.status === 'open' && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-7 h-7 text-blue-400" />
                    </div>
                    <h2 className="font-semibold text-foreground mb-2">Waiting for {thread.profile_name}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Your message has been delivered. Once {thread.profile_name} accepts the conversation, you'll be able to reply here.
                    </p>
                    <Button variant="outline" size="sm" onClick={load} className="gap-1.5 border-border">
                      <RefreshCw className="w-3.5 h-3.5" /> Check for updates
                    </Button>
                  </div>
                </div>
              )}

              {/* Closed state */}
              {thread.status === 'closed' && (
                <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">This conversation has been closed by {thread.profile_name}.</p>
                </div>
              )}

              {/* Messages */}
              {(thread.visitor_accepted || thread.status === 'closed') && (
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        msg.sender === 'visitor'
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-card border border-border text-foreground rounded-bl-sm'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        <p className={`text-xs mt-1 ${msg.sender === 'visitor' ? 'text-white/60' : 'text-muted-foreground'}`}>
                          {msg.sender === 'visitor' ? 'You' : thread.profile_name} · {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Reply box */}
              {thread.visitor_accepted && thread.status === 'open' && (
                <div className="flex-shrink-0 border-t border-border pt-4">
                  {sendError && <p className="text-xs text-destructive mb-2">{sendError}</p>}
                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Type your reply…"
                      className="flex-1 resize-none text-sm bg-card border-border"
                      rows={3}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply(); }
                      }}
                    />
                    <Button onClick={sendReply} disabled={sending || !reply.trim()} className="bg-primary self-end gap-1.5">
                      <Send className="w-4 h-4" />
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">⌘+Enter to send quickly</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
