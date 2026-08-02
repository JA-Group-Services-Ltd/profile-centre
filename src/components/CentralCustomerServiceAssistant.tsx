import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, LifeBuoy, Send, UserRound, X } from 'lucide-react';

type BranchConfig = {
  assistantEnabled?: boolean;
  aiEnabled?: boolean;
  humanTakeoverEnabled?: boolean;
  anonymousEnabled?: boolean;
  maintenanceEnabled?: boolean;
  assistantName?: string;
  greeting?: string;
  awayMessage?: string;
  maintenanceMessage?: string;
  emergencyNotice?: string;
};

type SupportMessage = {
  id: string;
  senderType: string;
  senderName: string;
  body: string;
};

type KnowledgeArticle = {
  id?: string;
  title?: string;
  summary?: string;
};

const API = '/api/customer-service';
const SITE_NAME = 'Profile Centre';
const DEFAULT_NAME = 'Profile Centre Support Assistant';

function makeId(prefix: string) {
  try { return `${prefix}-${crypto.randomUUID()}`; }
  catch { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API}/${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || payload?.message || 'Customer support is temporarily unavailable.');
  return payload;
}

function normaliseMessage(value: Record<string, unknown>): SupportMessage {
  return {
    id: String(value.id || value.externalMessageId || value.external_message_id || makeId('message')),
    senderType: String(value.senderType || value.sender_type || 'system'),
    senderName: String(value.senderName || value.sender_name || 'Customer Service'),
    body: String(value.body || ''),
  };
}

export default function CentralCustomerServiceAssistant() {
  const [config, setConfig] = useState<BranchConfig>({ assistantEnabled: false });
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adviserRequested, setAdviserRequested] = useState(false);
  const sessionId = useRef(makeId('profile-centre-support'));
  const conversationCreated = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hidden = typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/portal'));
  const assistantName = config.assistantName || DEFAULT_NAME;
  const greeting = useMemo(() => {
    if (config.maintenanceEnabled) return config.maintenanceMessage || 'Customer support is temporarily unavailable while maintenance is completed.';
    return config.greeting || 'Hello. I can help with Profile Centre accounts, profiles and sharing, or pass your enquiry to a Head Office Customer Adviser.';
  }, [config]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api('config'), api('knowledge')]).then(results => {
      if (!active) return;
      const configResult = results[0];
      if (configResult.status === 'fulfilled') setConfig(configResult.value.config || configResult.value.branch || configResult.value || {});
      const knowledgeResult = results[1];
      if (knowledgeResult.status === 'fulfilled') setArticles(knowledgeResult.value.articles || knowledgeResult.value.knowledge || []);
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open || !conversationCreated.current) return;
    let active = true;
    const poll = async () => {
      try {
        const data = await api(`conversations/${encodeURIComponent(sessionId.current)}/messages`);
        if (active) setMessages((data.messages || []).map((item: Record<string, unknown>) => normaliseMessage(item)));
      } catch { /* retry */ }
    };
    void poll();
    const timer = window.setInterval(poll, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  async function ensureConversation() {
    if (conversationCreated.current) return;
    await api('conversations', {
      method: 'POST',
      body: JSON.stringify({
        externalConversationId: sessionId.current,
        authenticated: false,
        category: 'general',
        priority: 'normal',
        pagePath: window.location.pathname,
        pageTitle: document.title,
        serviceContext: { website: SITE_NAME, channel: 'public_website' },
      }),
    });
    conversationCreated.current = true;
  }

  async function refreshMessages() {
    const data = await api(`conversations/${encodeURIComponent(sessionId.current)}/messages`);
    setMessages((data.messages || []).map((item: Record<string, unknown>) => normaliseMessage(item)));
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const body = input.trim();
    if (body.length < 2 || busy) return;
    setBusy(true);
    setError('');
    setInput('');
    try {
      await ensureConversation();
      await api(`conversations/${encodeURIComponent(sessionId.current)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          externalMessageId: makeId('customer'),
          senderType: 'customer',
          senderName: 'Profile Centre customer',
          body,
          metadata: { pagePath: window.location.pathname },
        }),
      });
      await refreshMessages();
    } catch (reason) {
      setInput(body);
      setError(reason instanceof Error ? reason.message : 'Your message could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function requestAdviser() {
    if (busy || adviserRequested) return;
    setBusy(true);
    setError('');
    try {
      await ensureConversation();
      await api(`conversations/${encodeURIComponent(sessionId.current)}/events`, {
        method: 'POST',
        body: JSON.stringify({ eventType: 'request_human', pagePath: window.location.pathname, metadata: { requestedFrom: SITE_NAME } }),
      });
      setAdviserRequested(true);
      await refreshMessages();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A Customer Adviser could not be requested.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || hidden || !config.assistantEnabled) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(value => !value)} className="fixed bottom-5 right-5 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-violet-700 text-white shadow-2xl transition hover:bg-violet-800 focus:outline-none focus:ring-4 focus:ring-violet-200 dark:focus:ring-violet-900" aria-label={open ? 'Close customer support' : 'Open customer support'}>
        {open ? <X className="h-6 w-6" /> : <LifeBuoy className="h-6 w-6" />}
      </button>

      {open && (
        <section role="dialog" aria-label={assistantName} className="fixed inset-x-3 bottom-24 z-[79] flex max-h-[min(720px,calc(100vh-8rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl sm:left-auto sm:right-5 sm:w-[420px] dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Bot className="h-5 w-5" /></span><div><p className="text-sm font-bold">{assistantName}</p><p className="text-[11px] text-slate-300">Connected to JA Group Services Head Office</p></div></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close"><X className="h-4 w-4" /></button>
          </header>
          {config.emergencyNotice && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{config.emergencyNotice}</div>}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/60">
            <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">{greeting}</div>
            {articles.slice(0, 3).map(article => <div key={article.id || article.title} className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100"><strong className="block text-sm">{article.title}</strong>{article.summary && <span className="mt-1 block leading-5">{article.summary}</span>}</div>)}
            {messages.map(message => { const customer = message.senderType === 'customer'; return <div key={message.id} className={`flex ${customer ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${customer ? 'rounded-tr-md bg-violet-700 text-white' : 'rounded-tl-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide opacity-70">{message.senderName}</span>{message.body}</div></div>; })}
            {adviserRequested && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">A Head Office Customer Adviser has been requested. The conversation will remain in this window.</div>}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">{error}</div>}
            <div ref={bottomRef} />
          </div>
          {!config.maintenanceEnabled && <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"><form onSubmit={sendMessage} className="flex gap-2"><input value={input} onChange={event => setInput(event.target.value)} maxLength={2000} placeholder="Type your enquiry…" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-violet-950" /><button disabled={busy || input.trim().length < 2} className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-700 text-white disabled:opacity-50" aria-label="Send message"><Send className="h-4 w-4" /></button></form>{config.humanTakeoverEnabled !== false && <button type="button" onClick={requestAdviser} disabled={busy || adviserRequested} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"><UserRound className="h-4 w-4" />{adviserRequested ? 'Customer Adviser requested' : 'Request a Head Office Customer Adviser'}</button>}</div>}
        </section>
      )}
    </>
  );
}
