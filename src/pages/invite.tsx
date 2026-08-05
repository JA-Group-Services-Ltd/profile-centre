/**
 * Public Seat Invite Acceptance Page
 * /invite/:token
 *
 * - Fetches invite details from DB via token (no auth required to view)
 * - If user is not logged in, prompts them to sign in first (stores token in sessionStorage)
 * - If logged in, shows full invite card with Accept / Decline buttons
 * - All state is database-driven — no localStorage, no auto-accept
 */
import { useState, useEffect } from 'react';
import { fmtDate } from '@/lib/date';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, CheckCircle2, XCircle, Clock, Crown, Shield, User,
  AlertTriangle, LogIn, ArrowRight, Loader2, Sparkles,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface InviteData {
  id: number;
  token: string;
  email: string;
  role: string;
  status: string;
  expired: boolean;
  created_at: string;
  expires_at: string;
  profile_id: number;
  business_name: string;
  biz_slug: string;
  invited_by_name: string;
}

// ─── Role display map ─────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  owner:           { label: 'Owner',           color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',  icon: <Crown className="w-3.5 h-3.5" />, description: 'Full control over the business profile' },
  admin:           { label: 'Admin',           color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: <Crown className="w-3.5 h-3.5" />, description: 'Manage team members and profile settings' },
  manager:         { label: 'Manager',         color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       icon: <Shield className="w-3.5 h-3.5" />, description: 'Edit profile content and manage links' },
  editor:          { label: 'Editor',          color: 'bg-green-500/10 text-green-400 border-green-500/20',    icon: <User className="w-3.5 h-3.5" />, description: 'Edit profile content' },
  viewer:          { label: 'Viewer',          color: 'bg-muted text-muted-foreground border-border',          icon: <User className="w-3.5 h-3.5" />, description: 'View the business profile only' },
  billing_manager: { label: 'Billing Manager', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: <Shield className="w-3.5 h-3.5" />, description: 'Manage billing and subscription' },
};

// ─── Main component ───────────────────────────────────────────────────────

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);

  const [actionState, setActionState] = useState<'idle' | 'accepting' | 'declining' | 'done_accepted' | 'done_declined' | 'error'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  // ── 1. Fetch invite details (public, no auth needed) ──────────────────
  useEffect(() => {
    if (!token) return;
    setLoadingInvite(true);
    fetch(`/api/business/invites/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setInvite(d.data);
        else setFetchError(d.error || 'Invite not found');
      })
      .catch(() => setFetchError('Could not load invite. Please try again.'))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  // ── 2. After login redirect: nothing to clean up (token is in the URL) ──
  useEffect(() => {
    // Token is in the URL path (/invite/:token) — no sessionStorage to clear.
  }, [authLoading, user, token]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSignIn = () => {
    // Token is already in the URL (/invite/:token) — after login, the user
    // is redirected back here automatically. No sessionStorage needed.
    window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  };

  const handleAccept = async () => {
    if (!token) return;
    setActionState('accepting');
    setActionError(null);
    try {
      const res = await fetch(`/api/business/invites/${token}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept invite');
      setActionState('done_accepted');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
      setActionState('error');
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActionState('declining');
    setActionError(null);
    try {
      const res = await fetch(`/api/business/invites/${token}/decline`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline invite');
      setActionState('done_declined');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
      setActionState('error');
    }
  };

  // ── Shared page wrapper ───────────────────────────────────────────────

  const PageShell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Platform branding */}
      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2 group">
          {branding.platform_logo_url
            ? <img src={branding.platform_logo_url} alt={branding.platform_name} className="h-8 w-auto object-contain" />
            : <span className="font-bold text-xl text-foreground group-hover:text-primary transition-colors">{branding.platform_name}</span>
          }
        </Link>
      </div>
      {children}
      <p className="text-center text-xs text-muted-foreground mt-8">
        Questions?{' '}
        <a href={`mailto:${branding.support_email || branding.contact_email || 'contact@jagroupservices.co.uk'}`}
          className="hover:text-foreground transition-colors underline underline-offset-2">
          Get in touch
        </a>
      </p>
    </div>
  );

  // ── Render states ─────────────────────────────────────────────────────

  const isLoading = loadingInvite || authLoading;

  if (isLoading) {
    return (
      <PageShell>
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  if (fetchError || !invite) {
    return (
      <PageShell>
        <Helmet>
          <title>Invite Not Found — {branding.platform_name}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">This invite isn't valid</h1>
          <p className="text-muted-foreground text-sm">
            {fetchError ?? 'This invite link has already been used, expired, or doesn\'t exist. Ask the person who invited you to send a fresh one.'}
          </p>
          <Link to="/">
            <Button variant="outline" className="mt-2 border-border">Back to homepage</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const roleInfo = ROLE_LABELS[invite.role] ?? ROLE_LABELS.viewer;
  const isAlreadyActioned = invite.status !== 'pending';
  const isExpired = invite.expired;
  const expiresFormatted = invite.expires_at
    ? fmtDate(invite.expires_at, 'long')
    : null;

  // ── Success states ────────────────────────────────────────────────────

  if (actionState === 'done_accepted') {
    return (
      <PageShell>
        <Helmet>
          <title>Welcome to {invite.business_name} — {branding.platform_name}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">You're in!</h1>
            <p className="text-muted-foreground text-sm mt-2">
              You've joined <strong className="text-foreground">{invite.business_name}</strong> as a <strong className="text-foreground">{roleInfo.label}</strong>. Head to your dashboard to get started.
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-white gap-2 mt-2 w-full sm:w-auto"
            onClick={() => navigate('/dashboard/business-profile')}
          >
            Go to Business Profile <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </PageShell>
    );
  }

  if (actionState === 'done_declined') {
    return (
      <PageShell>
        <Helmet>
          <title>Invite Declined — {branding.platform_name}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Invite declined</h1>
          <p className="text-muted-foreground text-sm">
            No problem — you've declined the invitation from <strong className="text-foreground">{invite.business_name}</strong>. You can close this page.
          </p>
          <Link to="/dashboard/overview">
            <Button variant="outline" className="mt-2 border-border">Go to Dashboard</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  // ── Main invite card ──────────────────────────────────────────────────

  return (
    <PageShell>
      <Helmet>
        <title>You've been invited to {invite.business_name} — {branding.platform_name}</title>
        <meta name="description" content={`${invite.invited_by_name} has invited you to join ${invite.business_name} on ${branding.platform_name}.`} />
        <link rel="canonical" href={`https://japrofilestudio.jagroupservices.co.uk/invite/${token}`} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-md">
        {/* Invite card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
          {/* Coloured top stripe */}
          <div className="h-1.5 bg-gradient-to-r from-primary to-secondary w-full" />

          <div className="p-6 space-y-5">
            {/* Business identity */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> You've been invited to join
                </p>
                <h1 className="text-lg font-bold text-foreground leading-tight truncate">{invite.business_name}</h1>
                <p className="text-xs text-muted-foreground">by {invite.invited_by_name}</p>
              </div>
            </div>

            {/* Role */}
            <div className="rounded-xl bg-muted/20 border border-border/60 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                {roleInfo.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">Your role</span>
                  <Badge className={`${roleInfo.color} flex items-center gap-1 text-xs border`}>
                    {roleInfo.icon} {roleInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{roleInfo.description}</p>
              </div>
            </div>

            {/* Expiry */}
            {expiresFormatted && !isAlreadyActioned && !isExpired && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                This invite expires on {expiresFormatted}
              </div>
            )}

            {/* Already actioned / expired states */}
            {(isAlreadyActioned || isExpired) && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-400">
                  {isExpired
                    ? 'This invite has expired. Ask the business owner to send you a new one.'
                    : invite.status === 'accepted'
                      ? 'This invite has already been accepted.'
                      : invite.status === 'declined'
                        ? 'This invite has already been declined.'
                        : 'This invite is no longer valid.'}
                </p>
              </div>
            )}

            {/* Action error */}
            {actionState === 'error' && actionError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{actionError}</p>
              </div>
            )}

            {/* CTA — not logged in */}
            {!user && !isAlreadyActioned && !isExpired && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground text-center">
                  Sign in to accept or decline this invitation.
                </p>
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-white gap-2"
                  onClick={handleSignIn}
                >
                  <LogIn className="w-4 h-4" /> Sign in to respond
                </Button>
              </div>
            )}

            {/* CTA — logged in, wrong email */}
            {user && user.email.toLowerCase() !== invite.email.toLowerCase() && !isAlreadyActioned && !isExpired && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 space-y-2">
                <p className="text-sm font-semibold text-blue-400">Wrong account signed in</p>
                <p className="text-xs text-blue-400/80">
                  This invite was sent to <strong>{invite.email}</strong> but you're currently signed in as <strong>{user.email}</strong>. Please sign in with the correct account.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-1.5 w-full mt-1"
                  onClick={handleSignIn}
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign in with a different account
                </Button>
              </div>
            )}

            {/* CTA — logged in, correct email, invite is pending */}
            {user && user.email.toLowerCase() === invite.email.toLowerCase() && !isAlreadyActioned && !isExpired && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground text-center">
                  Signed in as <strong className="text-foreground">{user.email}</strong>
                </p>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
                    disabled={actionState === 'accepting' || actionState === 'declining'}
                    onClick={handleAccept}
                  >
                    {actionState === 'accepting'
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
                      : <><CheckCircle2 className="w-4 h-4" /> Accept invite</>
                    }
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-border gap-2"
                    disabled={actionState === 'accepting' || actionState === 'declining'}
                    onClick={handleDecline}
                  >
                    {actionState === 'declining'
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Declining…</>
                      : <><XCircle className="w-4 h-4" /> Decline</>
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
