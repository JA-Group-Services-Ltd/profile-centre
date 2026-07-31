/**
 * Admin — Enquiries
 * /admin/enquiries
 *
 * View all contact form enquiries submitted through public profiles.
 * Admins can read, mark as read, flag as abuse (wires to issue-reports), and delete.
 * No user-to-user direct messaging — enquiries are one-way visitor → profile owner only.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Mail, MailOpen, ChevronDown, ChevronUp, RefreshCw,
  Flag, Trash2, AlertTriangle, CheckCircle2, Loader2,
  Shield, ExternalLink, Monitor, Wifi, WifiOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Enquiry {
  id: number;
  sender_name: string;
  sender_email: string;
  message: string;
  created_at: string;
  is_read: number;
  username: string;
  profile_name: string;
  user_email: string;
  profile_id: number;
  sender_ip: string | null;
  sender_user_agent: string | null;
  is_vpn: number | null;
  vpn_check_detail: string | null;
}

interface FlagDialog {
  enquiry: Enquiry;
  category: string;
  details: string;
  submitting: boolean;
  error: string;
}

export default function AdminEnquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [flagDialog, setFlagDialog] = useState<FlagDialog | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Enquiry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    fetch('/api/admin/enquiries', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setEnquiries(d.data); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load(false);
    intervalRef.current = setInterval(() => load(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const markRead = async (id: number) => {
    await fetch(`/api/admin/enquiries/${id}/read`, { method: 'PUT', credentials: 'include' });
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, is_read: 1 } : e));
  };

  const handleExpand = (id: number) => {
    setExpanded(ex => ex === id ? null : id);
    const e = enquiries.find(x => x.id === id);
    if (e && !e.is_read) markRead(id);
  };

  const openFlagDialog = (e: Enquiry) => {
    setFlagDialog({ enquiry: e, category: 'spam_scam', details: '', submitting: false, error: '' });
  };

  const submitFlag = async () => {
    if (!flagDialog) return;
    setFlagDialog(d => d ? { ...d, submitting: true, error: '' } : d);
    try {
      const res = await fetch('/api/admin/visitor-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profile_id: flagDialog.enquiry.profile_id,
          category: flagDialog.category,
          details: `[ENQUIRY #${flagDialog.enquiry.id} FLAGGED BY ADMIN]\n\nSender: ${flagDialog.enquiry.sender_name} <${flagDialog.enquiry.sender_email}>\nProfile: /${flagDialog.enquiry.username}\n\nMessage:\n${flagDialog.enquiry.message.slice(0, 800)}\n\nAdmin notes:\n${flagDialog.details}`,
          reporter_name: 'Admin (manual flag)',
          reporter_email: 'admin@japrofilestudio.jagroupservices.co.uk',
          good_faith_confirmed: 1,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to flag');
      setFlaggedIds(prev => new Set([...prev, flagDialog.enquiry.id]));
      setFlagDialog(null);
    } catch (err) {
      setFlagDialog(d => d ? { ...d, submitting: false, error: err instanceof Error ? err.message : 'Failed to flag' } : d);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/enquiries/${deleteConfirm.id}`, { method: 'DELETE', credentials: 'include' });
      setEnquiries(prev => prev.filter(e => e.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const unread = enquiries.filter(e => !e.is_read).length;

  return (
    <div className="max-w-4xl mx-auto">
      <Helmet>
        <title>Enquiries — Admin</title>
        <meta name="description" content="View and manage all contact form enquiries submitted through Profile Centre profiles." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/enquiries" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Flag as abuse dialog */}
      <Dialog open={!!flagDialog} onOpenChange={open => { if (!open) setFlagDialog(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Flag className="w-4 h-4 text-red-400" /> Flag Enquiry as Abuse
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This will create a report in the Reports & Moderation queue. The enquiry will remain visible here.
            </DialogDescription>
          </DialogHeader>
          {flagDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{flagDialog.enquiry.sender_name} &lt;{flagDialog.enquiry.sender_email}&gt;</p>
                <p className="line-clamp-3">{flagDialog.enquiry.message}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Abuse category</label>
                <Select value={flagDialog.category} onValueChange={v => setFlagDialog(d => d ? { ...d, category: v } : d)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spam_scam">Spam or scam</SelectItem>
                    <SelectItem value="harassment">Harassment or abuse</SelectItem>
                    <SelectItem value="inappropriate_content">Inappropriate content</SelectItem>
                    <SelectItem value="impersonation">Impersonation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Admin notes (optional)</label>
                <Textarea
                  value={flagDialog.details}
                  onChange={e => setFlagDialog(d => d ? { ...d, details: e.target.value } : d)}
                  placeholder="Add any additional context for the moderation team…"
                  className="bg-background border-border text-sm"
                  rows={3}
                />
              </div>
              {flagDialog.error && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {flagDialog.error}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setFlagDialog(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              onClick={submitFlag}
              disabled={flagDialog?.submitting}
            >
              {flagDialog?.submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
              Flag as Abuse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Enquiry</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This will permanently delete the enquiry from {deleteConfirm?.sender_name}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white gap-1.5" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Enquiries</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {enquiries.length} total{unread > 0 && <span className="text-primary ml-1">· {unread} unread</span>}
            <span className="ml-2 text-xs opacity-60">· One-way visitor contact forms only — no direct messaging</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/issue-reports" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <Shield className="w-3.5 h-3.5" /> Reports & Moderation <ExternalLink className="w-3 h-3" />
          </a>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing || loading} className="border-border gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Security note */}
      <div className="mb-5 p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Enquiry security: </span>
          All submissions are rate-limited (3/hour per IP), validated, and scanned for spam patterns. Suspicious content is auto-flagged to Reports & Moderation. Visitors can only send enquiries — no direct messaging or user-to-user communication is available.
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : enquiries.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No enquiries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map(e => (
            <Card key={e.id} className={`border transition-all ${!e.is_read ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'} ${flaggedIds.has(e.id) ? 'border-red-500/30 bg-red-500/5' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3 cursor-pointer" onClick={() => handleExpand(e.id)}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!e.is_read ? 'bg-primary/20' : 'bg-muted'}`}>
                    {e.is_read ? <MailOpen className="w-4 h-4 text-muted-foreground" /> : <Mail className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{e.sender_name}</p>
                        {flaggedIds.has(e.id) && (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1">
                            <Flag className="w-2.5 h-2.5" /> Flagged
                          </Badge>
                        )}
                        {e.is_vpn === 1 && (
                          <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs gap-1">
                            <WifiOff className="w-2.5 h-2.5" /> VPN/Proxy
                          </Badge>
                        )}
                        {!e.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">/{e.username}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</span>
                        {expanded === e.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.sender_email}</p>
                    {expanded !== e.id && <p className="text-sm text-muted-foreground mt-1 truncate">{e.message}</p>}
                  </div>
                </div>

                {expanded === e.id && (
                  <div className="mt-3 pl-11 space-y-3">
                    <div className="p-3 rounded-xl bg-muted/50 border border-border">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{e.message}</p>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Profile owner: <span className="text-foreground">{e.user_email}</span></p>
                      <p>Profile: <span className="text-foreground">/{e.username}</span>{e.profile_name ? ` (${e.profile_name})` : ''}</p>
                      <p>Received: <span className="text-foreground">{fmtDateTime(e.created_at)}</span></p>
                    </div>

                    {/* Sender network info */}
                    <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-muted-foreground" /> Sender Network Info
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground/70 font-medium">IP:</span>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-xs">
                            {e.sender_ip || 'unknown'}
                          </code>
                          {e.is_vpn === 1 ? (
                            <span className="flex items-center gap-1 text-orange-400 font-medium">
                              <WifiOff className="w-3 h-3" /> VPN / proxy / datacenter detected
                              {e.vpn_check_detail && <span className="text-orange-400/70 font-normal">({e.vpn_check_detail})</span>}
                            </span>
                          ) : e.is_vpn === 0 ? (
                            <span className="flex items-center gap-1 text-green-400/80">
                              <Wifi className="w-3 h-3" /> No VPN signals detected
                            </span>
                          ) : null}
                        </div>
                        {e.sender_user_agent && (
                          <div className="flex items-start gap-2">
                            <span className="text-foreground/70 font-medium shrink-0">UA:</span>
                            <span className="break-all leading-relaxed">{e.sender_user_agent}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <a href={`mailto:${e.sender_email}`}>
                        <Button size="sm" className="bg-primary gap-1.5 text-xs h-7 px-2.5">
                          <Mail className="w-3 h-3" /> Reply via Email
                        </Button>
                      </a>
                      {!e.is_read && (
                        <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs h-7 px-2.5" onClick={() => markRead(e.id)}>
                          <CheckCircle2 className="w-3 h-3" /> Mark Read
                        </Button>
                      )}
                      {!flaggedIds.has(e.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 text-xs h-7 px-2.5"
                          onClick={() => openFlagDialog(e)}
                        >
                          <Flag className="w-3 h-3" /> Flag as Abuse
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/20 text-red-400/70 hover:bg-red-500/10 gap-1.5 text-xs h-7 px-2.5"
                        onClick={() => setDeleteConfirm(e)}
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
