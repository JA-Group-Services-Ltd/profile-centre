/**
 * Admin — Notifications
 * Send notifications to individual users (searched by name/email),
 * by role, or to all users. Also shows a log of recently sent notifications.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Bell, Send, Users, User, Globe, CheckCircle2, AlertCircle,
  Loader2, Info, Shield, CreditCard, Settings, HelpCircle,
  AlertTriangle, RefreshCw, Search, X, Trash2, Pencil, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Target = 'user' | 'role' | 'all';
type NotifType =
  | 'service_update' | 'account' | 'account_update'
  | 'billing' | 'payment' | 'security' | 'security_alert'
  | 'support' | 'support_reply' | 'warning' | 'info';

const TYPE_OPTIONS: { value: NotifType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'service_update',  label: 'Service Update',  icon: Info,          color: 'text-cyan-400' },
  { value: 'info',            label: 'Info',            icon: Info,          color: 'text-primary' },
  { value: 'account_update',  label: 'Account Update',  icon: Settings,      color: 'text-blue-400' },
  { value: 'billing',         label: 'Billing',         icon: CreditCard,    color: 'text-blue-400' },
  { value: 'payment',         label: 'Payment',         icon: CreditCard,    color: 'text-blue-400' },
  { value: 'security_alert',  label: 'Security Alert',  icon: Shield,        color: 'text-red-400' },
  { value: 'support_reply',   label: 'Support Reply',   icon: HelpCircle,    color: 'text-purple-400' },
  { value: 'warning',         label: 'Warning',         icon: AlertTriangle, color: 'text-orange-400' },
];

interface UserResult { id: number; name: string; email: string }
interface SentNotif {
  id: number; user_id: number; user_email: string; user_name: string;
  type: string; title: string; body: string | null; is_read: number; created_at: string;
}

function formatTime(dt: string): string {
  return fmtDateTime(dt);
}

export default function AdminNotificationsPage() {
  const [target, setTarget] = useState<Target>('all');
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [role, setRole] = useState('user');
  const [type, setType] = useState<NotifType>('service_update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [log, setLog] = useState<SentNotif[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLog = async () => {
    setLogLoading(true);
    try {
      const res = await fetch('/api/admin/notifications?limit=50', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setLog(data.data);
    } catch { /* silent */ } finally { setLogLoading(false); }
  };

  useEffect(() => { loadLog(); }, []);

  // Debounced user search
  const searchUsers = useCallback((q: string) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim() || q.length < 2) { setUserResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/admin/notifications/user-search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setUserResults(data.data);
      } catch { /* silent */ } finally { setSearchLoading(false); }
    }, 300);
  }, []);

  useEffect(() => { searchUsers(userSearch); }, [userSearch, searchUsers]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this notification? This removes it from the recipient\'s inbox.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
      setLog(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ } finally { setDeletingId(null); }
  };

  const startEdit = (n: SentNotif) => {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditBody(n.body || '');
  };

  const saveEdit = async (id: number) => {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const data = await res.json();
      if (data.success) {
        setLog(prev => prev.map(n => n.id === id ? { ...n, title: editTitle, body: editBody || null } : n));
        setEditingId(null);
      }
    } catch { /* silent */ } finally { setEditSaving(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (target === 'user' && !selectedUser) return;
    setSending(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        target, type,
        title: title.trim(),
        body: body.trim() || undefined,
        link: link.trim() || undefined,
      };
      if (target === 'user') payload.userId = selectedUser!.id;
      if (target === 'role') payload.role = role;

      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ ok: true, message: data.message });
        setTitle(''); setBody(''); setLink('');
        setSelectedUser(null); setUserSearch('');
        loadLog();
      } else {
        setResult({ ok: false, message: data.error || 'Failed to send' });
      }
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally { setSending(false); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Helmet>
        <title>Send Notifications — Admin</title>
        <meta name="description" content="Send service notifications to users from the admin panel." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/notifications" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Send Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Push service updates, alerts, and messages to users</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Compose form */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Compose Notification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">

              {/* Target selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Send to</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'all',  label: 'All Users',  icon: Globe },
                    { id: 'role', label: 'By Role',    icon: Users },
                    { id: 'user', label: 'One User',   icon: User },
                  ] as { id: Target; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setTarget(opt.id); setSelectedUser(null); setUserSearch(''); setUserResults([]); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        target === opt.id
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role selector */}
              {target === 'role' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Role</Label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  >
                    <option value="user">user — all customers</option>
                    <option value="admin">admin — admin accounts only</option>
                  </select>
                </div>
              )}

              {/* User search */}
              {target === 'user' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Search user by name or email</Label>

                  {selectedUser ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{selectedUser.name || '(no name)'}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                        <p className="text-xs text-muted-foreground/60">ID #{selectedUser.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          placeholder="Type name or email…"
                          className="pl-9 bg-background border-border"
                        />
                        {searchLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {userResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                          {userResults.map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setSelectedUser(u); setUserSearch(''); setUserResults([]); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                            >
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{u.name || '(no name)'}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                              <span className="text-xs text-muted-foreground/60 flex-shrink-0">#{u.id}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {userSearch.length >= 2 && !searchLoading && userResults.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5 px-1">No users found matching "{userSearch}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Notification type</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                        type === opt.value
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <opt.icon className={`w-3.5 h-3.5 flex-shrink-0 ${type === opt.value ? 'text-primary' : opt.color}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Scheduled maintenance on 5 July"
                  className="bg-background border-border"
                  maxLength={200}
                  required
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Body (optional)</Label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Additional detail shown when the user expands the notification…"
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Link */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Link (optional)</Label>
                <Input
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="/dashboard/billing"
                  className="bg-background border-border font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Internal path shown as "View details" button.</p>
              </div>

              {/* Result */}
              {result && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                  result.ok
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {result.ok
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {result.message}
                </div>
              )}

              <Button
                type="submit"
                disabled={sending || !title.trim() || (target === 'user' && !selectedUser)}
                className="w-full bg-primary gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending
                  ? 'Sending…'
                  : target === 'all'
                    ? 'Send to all users'
                    : target === 'role'
                      ? `Send to role: ${role}`
                      : selectedUser
                        ? `Send to ${selectedUser.name || selectedUser.email}`
                        : 'Select a user first'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent log */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                Recently Sent
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadLog} className="text-muted-foreground h-7 px-2">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : log.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No notifications sent yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {log.map(n => {
                  const opt = TYPE_OPTIONS.find(t => t.value === n.type);
                  const IconComp = opt?.icon ?? Info;
                  const isEditing = editingId === n.id;
                  return (
                    <div key={n.id} className="p-3 rounded-xl bg-muted/30 border border-border">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="bg-background border-border text-sm h-8"
                            placeholder="Title"
                            maxLength={200}
                          />
                          <textarea
                            value={editBody}
                            onChange={e => setEditBody(e.target.value)}
                            rows={2}
                            maxLength={1000}
                            placeholder="Body (optional)"
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs gap-1 bg-primary" onClick={() => saveEdit(n.id)} disabled={editSaving}>
                              {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <IconComp className={`w-4 h-4 flex-shrink-0 mt-0.5 ${opt?.color ?? 'text-primary'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                              <Badge className="text-[10px] border-0 px-1.5 py-0 h-4 bg-muted text-muted-foreground">{n.type}</Badge>
                              {n.is_read
                                ? <Badge className="text-[10px] border-0 px-1.5 py-0 h-4 bg-green-500/10 text-green-400">Read</Badge>
                                : <Badge className="text-[10px] border-0 px-1.5 py-0 h-4 bg-primary/10 text-primary">Unread</Badge>}
                            </div>
                            {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>}
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              → {n.user_name || n.user_email} <span className="opacity-60">#{n.user_id}</span>
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">{formatTime(n.created_at)}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => startEdit(n)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit notification"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(n.id)}
                              disabled={deletingId === n.id}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                              title="Delete notification"
                            >
                              {deletingId === n.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
