/**
 * Dashboard — Organisation Seats Manager
 * /dashboard/organisation-seats
 *
 * Lets the organisation owner invite staff by email, manage roles, and remove members.
 */
import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { useAuth } from '@/lib/auth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, UserPlus, Trash2, Mail, Clock, CheckCircle2,
  XCircle, Crown, Shield, User, RefreshCw, Building2, Link2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface Seat {
  id: number; email: string; name: string; role: string; status: string;
  created_at: string; user_name: string | null;
  entra_linked: number;
}
interface Invite {
  id: number; email: string; name: string; role: string; status: string;
  created_at: string; expires_at: string;
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

export default function BusinessSeatsPage() {
  const { user } = useAuth();

  const [profileId, setProfileId] = useState<number | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [maxSeats, setMaxSeats] = useState(5);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const loadSeats = async (pid: number) => {
    const res = await fetch(`/api/business/${pid}/seats`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      setSeats(data.data.seats);
      setInvites(data.data.invites);
      setMaxSeats(data.data.max_seats);
    }
  };

  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(async d => {
        if (!d.success) return setNoProfile(true);
        const biz = (d.data as Array<Record<string, unknown>>).find(p => p.profile_type === 'business');
        if (!biz) return setNoProfile(true);
        const pid = biz.id as number;
        setProfileId(pid);
        await loadSeats(pid);
      })
      .catch(() => setNoProfile(true))
      .finally(() => setLoading(false));
  }, [user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setInviteError(''); setInviteSuccess(''); setInviting(true);
    try {
      const res = await fetch(`/api/business/${profileId}/seats/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite');
      setInviteSuccess(data.type === 'direct'
        ? `${inviteEmail} has been added as a seat member.`
        : `Invite created for ${inviteEmail}. They'll appear here once they accept from their dashboard.`
      );
      setInviteEmail(''); setInviteName(''); setInviteRole('member');
      await loadSeats(profileId);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const removeSeat = async (seatId: number) => {
    if (!profileId || !confirm('Remove this seat member?')) return;
    await fetch(`/api/business/${profileId}/seats/${seatId}`, { method: 'DELETE', credentials: 'include' });
    await loadSeats(profileId);
  };

  const cancelInvite = async (inviteId: number) => {
    if (!profileId) return;
    await fetch(`/api/business/${profileId}/invites/${inviteId}`, { method: 'DELETE', credentials: 'include' });
    await loadSeats(profileId);
  };

  const changeRole = async (seatId: number, role: string) => {
    if (!profileId) return;
    await fetch(`/api/business/${profileId}/seats/${seatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    await loadSeats(profileId);
  };

  const activeSeats = seats.filter(s => s.status === 'active');
  const totalUsed = activeSeats.length + invites.length; // active + pending slots reserved

  // ── Loading / no profile ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-20">
        {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (noProfile || !profileId) {
    return (
      <div className="max-w-2xl mx-auto pb-20">
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Building2 className="w-14 h-14 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">No Organisation Profile Found</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            You need an organisation profile to manage seats. Create one from the All Profiles page.
          </p>
          <Button asChild className="bg-primary mt-2">
            <a href="/dashboard/profile">Go to Profile</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Organisation Seats — Dashboard</title>
        <meta name="description" content="Manage organisation seats and team members." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/organisation-seats" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organisation Seats</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage staff access to your organisation profile
          </p>
        </div>
        <button onClick={() => profileId && loadSeats(profileId)}
          className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Seat usage */}
      <Card className="bg-card border-border mb-6">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeSeats.length} / {maxSeats} seats active
                </p>
                <p className="text-xs text-muted-foreground">
                  {invites.length > 0
                    ? `${invites.length} pending invite${invites.length !== 1 ? 's' : ''} · ${maxSeats - totalUsed} slot${maxSeats - totalUsed !== 1 ? 's' : ''} free`
                    : `${maxSeats - totalUsed} slot${maxSeats - totalUsed !== 1 ? 's' : ''} remaining`
                  }
                </p>
              </div>
            </div>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalUsed / maxSeats) * 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invite form */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Invite a Team Member
          </CardTitle>
          <CardDescription>
            Enter their email address. They'll see a pending invite in their dashboard when they log in and can choose to accept or decline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Email Address <span className="text-destructive">*</span></Label>
                <Input
                  type="email" required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="mt-1.5 bg-background border-border"
                  placeholder="colleague@company.com"
                />
              </div>
              <div>
                <Label>Name (optional)</Label>
                <Input
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="mt-1.5 bg-background border-border"
                  placeholder="Jane Smith"
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="viewer">Viewer — can view the business workspace</option>
                <option value="editor">Editor — can edit profile and links</option>
                <option value="manager">Manager — can manage content and enquiries</option>
                <option value="admin">Admin — full access except billing/delete</option>
                <option value="billing_manager">Billing Manager — billing access only</option>
              </select>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            {inviteSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> {inviteSuccess}
              </div>
            )}
            <Button type="submit" disabled={inviting || totalUsed >= maxSeats} className="bg-primary gap-2 w-full sm:w-auto">
              <UserPlus className="w-4 h-4" />
              {inviting ? 'Sending…' : totalUsed >= maxSeats ? 'Seat limit reached' : 'Send Invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active seats */}
      {activeSeats.length > 0 && (
        <Card className="bg-card border-border mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> Active Members
              <Badge className="bg-green-400/10 text-green-400 border-0 text-xs">{activeSeats.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {activeSeats.map(seat => {
              const roleInfo = ROLE_LABELS[seat.role] ?? ROLE_LABELS.member;
              return (
                <div key={seat.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <span className="text-primary font-bold text-sm">{(seat.name || seat.email).charAt(0).toUpperCase()}</span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{seat.user_name || seat.name || seat.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{seat.email}</p>
                  </div>
                  {/* Role selector */}
                  <select
                    value={seat.role}
                    onChange={e => changeRole(seat.id, e.target.value)}
                    className="rounded-lg border border-border bg-background text-foreground text-xs px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="billing_manager">Billing Manager</option>
                  </select>
                  <Badge className={`${roleInfo.color} flex items-center gap-1 text-xs flex-shrink-0`}>
                    {roleInfo.icon} {roleInfo.label}
                  </Badge>
                  {/* JA Group Services ID link status */}
                  <Badge className={`flex items-center gap-1 text-xs flex-shrink-0 border-0 ${seat.entra_linked ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'}`}
                    title={seat.entra_linked ? 'Linked to JA Group Services ID' : 'Not yet linked to JA Group Services ID'}>
                    <Link2 className="w-3 h-3" />
                    {seat.entra_linked ? 'ID Linked' : 'No ID'}
                  </Badge>
                  <button onClick={() => removeSeat(seat.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <Card className="bg-card border-border mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" /> Pending Invites
              <Badge className="bg-orange-400/10 text-orange-400 border-0 text-xs">{invites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{invite.name || invite.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {fmtDate(invite.expires_at)}
                  </p>
                </div>
                <Badge className="bg-orange-500/10 text-orange-400 border-0 text-xs flex-shrink-0">
                  {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                </Badge>
                <button onClick={() => cancelInvite(invite.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  title="Cancel invite">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {activeSeats.length === 0 && invites.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No team members yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Invite your first team member using the form above. They'll appear here once added.
          </p>
        </div>
      )}
    </div>
  );
}
