/**
 * Dashboard — My Seat Invites
 * /dashboard/seat-invites
 *
 * Shows pending business seat invites for the logged-in user.
 * They can accept (join the business) or decline.
 * Active seats are also listed with an option to leave.
 */
import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, CheckCircle2, XCircle, Clock, LogOut, RefreshCw, Crown, Shield, User, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface PendingInvite {
  id: number;
  token: string;
  role: string;
  created_at: string;
  expires_at: string;
  business_name: string;
  biz_slug: string;
  profile_id: number;
  invited_by_name: string;
}

interface ActiveSeat {
  id: number;
  profile_id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
  business_name?: string;
  biz_slug?: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  owner:           { label: 'Owner',           color: 'bg-orange-500/10 text-orange-400 border-0',  icon: <Crown className="w-3 h-3" /> },
  admin:           { label: 'Admin',           color: 'bg-purple-500/10 text-purple-400 border-0', icon: <Crown className="w-3 h-3" /> },
  manager:         { label: 'Manager',         color: 'bg-blue-500/10 text-blue-400 border-0',     icon: <Shield className="w-3 h-3" /> },
  editor:          { label: 'Editor',          color: 'bg-green-500/10 text-green-400 border-0',   icon: <User className="w-3 h-3" /> },
  viewer:          { label: 'Viewer',          color: 'bg-muted text-muted-foreground border-0',   icon: <User className="w-3 h-3" /> },
  billing_manager: { label: 'Billing Manager', color: 'bg-orange-500/10 text-orange-400 border-0', icon: <Shield className="w-3 h-3" /> },
  // Legacy aliases
  member:          { label: 'Viewer',          color: 'bg-muted text-muted-foreground border-0',   icon: <User className="w-3 h-3" /> },
};

// ─── Main component ───────────────────────────────────────────────────────

export default function SeatInvitesPage() {
  const { user } = useAuth();

  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [activeSeats, setActiveSeats] = useState<ActiveSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, 'accepting' | 'declining' | 'leaving'>>({});
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  const load = async () => {
    setLoading(true);
    try {
      // Load pending invites
      const invRes = await fetch('/api/business/invites/me', { credentials: 'include' });
      const invData = await invRes.json();
      if (invData.success) setInvites(invData.data);

      // Load active seats (from profiles/me — filter business seats)
      const seatsRes = await fetch('/api/business/seats/me', { credentials: 'include' });
      const seatsData = await seatsRes.json();
      if (seatsData.success) setActiveSeats(seatsData.data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const accept = async (invite: PendingInvite) => {
    setActionStates(s => ({ ...s, [invite.token]: 'accepting' }));
    try {
      const res = await fetch(`/api/business/invites/${invite.token}/accept`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept');
      setMessages(m => ({ ...m, [invite.token]: { type: 'success', text: `You've joined ${invite.business_name}.` } }));
      await load();
    } catch (err) {
      setMessages(m => ({ ...m, [invite.token]: { type: 'error', text: err instanceof Error ? err.message : 'Failed' } }));
    } finally {
      setActionStates(s => { const n = { ...s }; delete n[invite.token]; return n; });
    }
  };

  const decline = async (invite: PendingInvite) => {
    setActionStates(s => ({ ...s, [invite.token]: 'declining' }));
    try {
      const res = await fetch(`/api/business/invites/${invite.token}/decline`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline');
      setMessages(m => ({ ...m, [invite.token]: { type: 'success', text: `Invite from ${invite.business_name} declined.` } }));
      await load();
    } catch (err) {
      setMessages(m => ({ ...m, [invite.token]: { type: 'error', text: err instanceof Error ? err.message : 'Failed' } }));
    } finally {
      setActionStates(s => { const n = { ...s }; delete n[invite.token]; return n; });
    }
  };

  const leave = async (seat: ActiveSeat) => {
    if (!confirm(`Leave ${seat.business_name ?? 'this business'}? You will lose access to their business profile.`)) return;
    const key = `leave-${seat.profile_id}`;
    setActionStates(s => ({ ...s, [key]: 'leaving' }));
    try {
      const res = await fetch('/api/business/seats/me/leave', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profileId: seat.profile_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to leave');
      await load();
    } catch (err) {
      setMessages(m => ({ ...m, [key]: { type: 'error', text: err instanceof Error ? err.message : 'Failed' } }));
    } finally {
      setActionStates(s => { const n = { ...s }; delete n[key]; return n; });
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-20">
        {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  const hasAnything = invites.length > 0 || activeSeats.length > 0;

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Business Memberships — Dashboard</title>
        <meta name="description" content="View and manage your business seat invites and active memberships." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/seat-invites" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Memberships</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Pending invites and businesses you're a member of
          </p>
        </div>
        <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" /> Pending Invites
              <Badge className="bg-orange-500/10 text-orange-400 border-0 text-xs">{invites.length}</Badge>
            </CardTitle>
            <CardDescription>
              Review and accept or decline each invitation below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {invites.map(invite => {
              const roleInfo = ROLE_LABELS[invite.role] ?? ROLE_LABELS.member;
              const msg = messages[invite.token];
              const state = actionStates[invite.token];
              return (
                <div key={invite.id} className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{invite.business_name}</p>
                      <p className="text-xs text-muted-foreground">Invited by {invite.invited_by_name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={`${roleInfo.color} flex items-center gap-1 text-xs`}>
                          {roleInfo.icon} {roleInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Expires {fmtDate(invite.expires_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {msg && (
                    <p className={`text-xs px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-400/10 text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                      {msg.text}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-primary gap-1.5 flex-1 sm:flex-none"
                      disabled={!!state}
                      onClick={() => accept(invite)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {state === 'accepting' ? 'Accepting…' : 'Accept'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border gap-1.5 flex-1 sm:flex-none"
                      disabled={!!state}
                      onClick={() => decline(invite)}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {state === 'declining' ? 'Declining…' : 'Decline'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active memberships */}
      {activeSeats.length > 0 && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> Active Memberships
              <Badge className="bg-green-400/10 text-green-400 border-0 text-xs">{activeSeats.length}</Badge>
            </CardTitle>
            <CardDescription>
              Businesses you're currently a member of. You can leave at any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {activeSeats.map(seat => {
              const roleInfo = ROLE_LABELS[seat.role] ?? ROLE_LABELS.member;
              const key = `leave-${seat.profile_id}`;
              const msg = messages[key];
              const state = actionStates[key];
              return (
                <div key={seat.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {seat.business_name ?? `Business #${seat.profile_id}`}
                    </p>
                    {seat.biz_slug && (
                      <Link
                        to="/dashboard/business-profile"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" /> Go to Business Workspace
                      </Link>
                    )}
                    {msg && (
                      <p className={`text-xs mt-0.5 ${msg.type === 'error' ? 'text-destructive' : 'text-green-400'}`}>{msg.text}</p>
                    )}
                  </div>
                  <Badge className={`${roleInfo.color} flex items-center gap-1 text-xs flex-shrink-0`}>
                    {roleInfo.icon} {roleInfo.label}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive gap-1.5 flex-shrink-0"
                    disabled={!!state}
                    onClick={() => leave(seat)}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {state === 'leaving' ? 'Leaving…' : 'Leave'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!hasAnything && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No invites or memberships</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            When a business owner adds you to their team, the invite will appear here for you to accept or decline.
          </p>
        </div>
      )}
    </div>
  );
}
