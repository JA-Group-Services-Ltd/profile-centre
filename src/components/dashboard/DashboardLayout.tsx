import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import {
  LayoutDashboard, User, Link2, QrCode, Mail, BarChart3,
  Palette, CreditCard, Settings, LogOut, Menu, X, UserCircle, PauseCircle, Phone,
  Building2, Users, Shield, FileSignature, Bell, HelpCircle,
  ChevronDown, Sparkles, UserCheck, MessageCircle, Image, List, FileText, Share2,
  UserPlus, ArrowLeftRight, XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useAccountSwitcher } from '@/lib/useAccountSwitcher';
import { useBranding } from '@/lib/branding';
import { Badge } from '@/components/ui/badge';
import TrialCountdownBanner from './TrialCountdownBanner';
import PaymentGraceBanner from './PaymentGraceBanner';
import AssistedSessionBanner from '@/components/AssistedSessionBanner';
import { Button } from '@/components/ui/button';
import ConsentModal from '@/components/ConsentModal';
import AutoLogoutProvider from '@/components/security/AutoLogoutProvider';
import MobileBottomNav from './MobileBottomNav';
import OfflineBanner from '@/components/OfflineBanner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { OnlineContext } from '@/contexts/OnlineContext';
import { useOnboarding } from '@/lib/useOnboarding';
import LegalReacceptGate from '@/components/dashboard/LegalReacceptGate';
import AssistedSetupOverlay from '@/components/dashboard/AssistedSetupOverlay';
import OfflinePinGate from '@/components/dashboard/OfflinePinGate';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  notifBadge?: boolean;
  supportBadge?: boolean;
  /**
   * Which plan tier unlocks this item.
   * always       — always visible regardless of plan (account, billing, help, etc.)
   * free         — any assigned plan including free
   * starter      — Starter, Professional, Business, Lifetime
   * professional — Professional, Business, Lifetime (business page but no team seats)
   * business     — Business or Lifetime only (team seats)
   */
  tier?: 'always' | 'free' | 'starter' | 'professional' | 'business' | 'ultimate';
}

const ALL_NAV_ITEMS: NavItem[] = [
  // ── Always visible ──────────────────────────────────────────────────────
  { path: '/dashboard/notifications',            label: 'Notifications',        icon: Bell,         notifBadge: true, tier: 'always' },
  { path: '/dashboard/overview',                 label: 'Overview',             icon: LayoutDashboard,               tier: 'always' },
  { path: '/dashboard/account',                  label: 'My Account',           icon: UserCircle,                    tier: 'always' },
  { path: '/dashboard/billing',                  label: 'Plans & Billing',      icon: CreditCard,                    tier: 'always' },
  { path: '/dashboard/support-tickets',          label: 'My Support Tickets',   icon: HelpCircle,   supportBadge: true, tier: 'always' },
  { path: '/dashboard/help-centre',              label: 'Help Centre',          icon: HelpCircle,                    tier: 'always' },
  { path: '/dashboard/data-requests',            label: 'My Data & Privacy',    icon: Shield,                        tier: 'always' },
  { path: '/dashboard/security',                 label: 'Security Settings',    icon: Shield,                        tier: 'always' },
  { path: '/dashboard/settings',                 label: 'Settings',             icon: Settings,                      tier: 'always' },
  { path: '/dashboard/account-closure',          label: 'Close Account',        icon: UserCheck,                     tier: 'always' },
  { path: '/dashboard/notification-preferences', label: 'Email Notifications',  icon: Bell,                          tier: 'always' },
  { path: '/dashboard/service-communications',   label: 'Service Emails',       icon: Phone,                         tier: 'always' },
  // ── Seat-invite — shown when pending invites or already a seat member ───
  { path: '/dashboard/seat-invites',             label: 'Organisation Memberships', icon: Mail,                          tier: 'always' },

  // ── Free plan and above ─────────────────────────────────────────────────
  { path: '/dashboard/profile',                  label: 'All Profiles',             icon: User,                          tier: 'free' },
  { path: '/dashboard/profile?section=org',      label: 'Organisation Profiles',    icon: Building2,                     tier: 'professional' },

  { path: '/dashboard/themes',                   label: 'Themes',                   icon: Palette,                       tier: 'free' },

  // ── Starter and above ───────────────────────────────────────────────────
  { path: '/dashboard/links',                    label: 'Links Manager',            icon: Link2,                         tier: 'starter' },
  { path: '/dashboard/qr-code',                  label: 'QR Code',                  icon: QrCode,                        tier: 'starter' },
  { path: '/dashboard/poster',                   label: 'Profile Poster',           icon: FileSignature,                 tier: 'starter' },
  { path: '/dashboard/enquiries',                label: 'Contact Enquiries',        icon: Mail,         badge: true,     tier: 'starter' },
  { path: '/dashboard/analytics',                label: 'Analytics',                icon: BarChart3,                     tier: 'starter' },
  { path: '/dashboard/email-signature',          label: 'Email Signature',          icon: FileSignature,                 tier: 'starter' },
  { path: '/dashboard/business-cards',           label: 'Business Cards',           icon: CreditCard,                    tier: 'starter' },

  // Organisation Profile and Seats are accessed from within All Profiles — not separate nav items
];

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const { otherAccounts, removeAccount, switchAccount } = useAccountSwitcher(user);
  const { isOnline } = useOnlineStatus();
  const branding = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [policyUpdated, setPolicyUpdated] = useState(false);
  const [emailSigEnabled, setEmailSigEnabled] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [showSetupOverlay, setShowSetupOverlay] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  // Onboarding / assisted setup
  const onboarding = useOnboarding(!!user && !loading);

  // Listen for service worker update notifications
  useEffect(() => {
    const handler = () => setSwUpdateAvailable(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  // Auto-open the setup overlay only on first login (setupActive = never dismissed)
  // Once dismissed it stays closed until user manually re-opens from sidebar
  useEffect(() => {
    if (!onboarding.loading && onboarding.state.setupActive && !onboarding.state.requiresLegalReaccept) {
      setShowSetupOverlay(true);
    }
  }, [onboarding.loading]); // intentionally only on mount — don't re-trigger on state changes

  // Load feature flags once on mount
  useEffect(() => {
    fetch('/api/feature-flags')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEmailSigEnabled(d.data?.feature_email_signature === '1');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || consentChecked) return;
    Promise.all([
      fetch('/api/me/consent', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/legal-version').then(r => r.json()),
    ])
      .then(([consentData, versionData]) => {
        if (consentData.success) {
          const c = consentData.data;
          const missingRequired = !c.terms_consent || !c.privacy_consent || !c.crm_consent;
          const requiredVersion: string | null = versionData.required_consent_version ?? null;
          const userVersion: string | null = c.consent_version ?? null;
          const outdatedVersion = requiredVersion !== null && userVersion !== requiredVersion;
          if (!missingRequired && outdatedVersion) setPolicyUpdated(true);
          setShowConsent(missingRequired || outdatedVersion);
        }
        setConsentChecked(true);
      })
      .catch(() => setConsentChecked(true));
  }, [user, consentChecked]);

  // Load notification unread count + enquiries + invites on route change
  const loadCounts = () => {
    fetch('/api/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadNotifCount(d.unread ?? 0); })
      .catch(() => {});
    fetch('/api/enquiries', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setUnreadCount(d.data.filter((e: { is_read: number }) => !e.is_read).length);
      })
      .catch(() => {});
    fetch('/api/business/invites/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPendingInviteCount(d.data.length); })
      .catch(() => {});
    fetch('/api/support/tickets', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUnreadSupportCount(d.data.filter((t: { unread_user: number }) => t.unread_user > 0).length); })
      .catch(() => {});
  };

  useEffect(() => { loadCounts(); }, [location.pathname]);

  // SSE — live notification badge updates
  useEffect(() => {
    if (!user) return;
    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    sseRef.current = es;
    es.addEventListener('notification', () => {
      fetch('/api/notifications', { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.success) setUnreadNotifCount(d.unread ?? 0); })
        .catch(() => {});
    });
    return () => { es.close(); sseRef.current = null; };
  }, [user]);

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // Use server-computed entitlement fields — never re-derive plan logic on the client.
  const hasUltimate     = !!(user.hasUltimateBusinessAccess);
  const hasBusiness     = !!(user.hasBusinessAccess || user.isSeatUser);
  const hasProfessional = !!(user.hasProfessionalAccess || user.hasBusinessAccess || user.isSeatUser);
  const hasStarter      = !!(user.hasStarterAccess || user.hasProfessionalAccess || user.hasBusinessAccess || user.hasLifetimeAccess || user.trialActive);
  const hasFree         = !!(user.plan_id);
  const hasLifetime     = !!user.hasLifetimeAccess;

  // Seat-only users: seat members with no own plan — limited nav
  const isSeatOnly = user.isSeatUser && !user.hasBusinessAccess && !user.hasStarterAccess && !user.hasLifetimeAccess;

  // Items hidden for seat-only users (they have no own profile to manage)
  const SEAT_ONLY_HIDDEN = [
    '/dashboard/profile',
    '/dashboard/links',
    '/dashboard/qr-code',
    '/dashboard/poster',
    '/dashboard/email-signature',
    '/dashboard/enquiries',
    '/dashboard/analytics',
    '/dashboard/themes',
    '/dashboard/billing',
    '/dashboard/business-cards',
  ];

  // Derive a human-friendly plan label for the sidebar badge
  const seatPlanName = user.isSeatUser && user.seatWorkspaces?.[0]?.ownerPlanName
    ? `${user.seatWorkspaces[0].ownerPlanName} Seat`
    : user.isSeatUser ? 'Team Seat' : null;
  const ownPlanLabel = user.plan_name ?? null;
  const planBadgeLabel = seatPlanName ?? (user.trialActive ? 'Free Trial' : ownPlanLabel);

  const navItems = ALL_NAV_ITEMS.filter(item => {
    // Seat-only: hide profile-management items
    if (isSeatOnly && SEAT_ONLY_HIDDEN.includes(item.path)) return false;

    // Seat invites: only show when pending invites exist or user is already a seat member
    if (item.path === '/dashboard/seat-invites') return pendingInviteCount > 0 || user.isSeatUser;

    // Email Signature: Starter+ plan required (no beta gate)
    if (item.path === '/dashboard/email-signature') {
      return emailSigEnabled && hasStarter;
    }

    // Tier gates
    switch (item.tier) {
      case 'always':       return true;
      case 'free':         return hasFree || hasStarter || hasProfessional || hasBusiness || hasLifetime || !!user.trialActive;
      case 'starter':      return hasStarter;
      case 'professional': return hasProfessional || hasBusiness || hasUltimate || hasLifetime || !!user.trialActive;
      case 'business':     return hasBusiness || hasUltimate || hasLifetime;
      case 'ultimate':     return hasUltimate || hasLifetime;
      default:             return true;
    }
  });

  if (user.is_paused) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
            <PauseCircle className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Account Paused</h1>
          <p className="text-muted-foreground mb-4">
            {user.pause_reason
              ? user.pause_reason
              : 'Your account has been temporarily paused. Please contact us to reactivate.'}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            If you believe this is an error, please get in touch with our team and we'll get you back up and running.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={`mailto:${branding.contact_email || 'japrofilestudio@jagroupservices.co.uk'}`}>
              <Button className="bg-primary gap-2 w-full sm:w-auto">
                <Phone className="w-4 h-4" /> Contact Us
              </Button>
            </a>
            <Button variant="outline" className="border-border gap-2 w-full sm:w-auto" onClick={() => window.location.href = '/auth/logout'}>
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">{branding.platform_name} · JA Group Services Ltd</p>
        </div>
      </div>
    );
  }

  // Billing gate: users without an active paid plan or trial must choose a plan first.
  // Allow access to /dashboard/billing, /dashboard/account, /dashboard/settings, /dashboard/data-requests, /dashboard/notifications
  // Pages that must always be reachable regardless of plan status:
  // - billing/account/settings: so users can pick a plan or manage their account
  // - overview: landing page after login / PWA open — must never be a blank wall
  // - profile: creating a personal profile is a core free feature; blocking it
  //   creates a catch-22 where users can't do anything until they pick a plan,
  //   but they can't see the value of the product first
  const BILLING_EXEMPT = [
    '/dashboard/billing',
    '/dashboard/account',
    '/dashboard/settings',
    '/dashboard/data-requests',
    '/dashboard/notifications',
    '/dashboard/overview',
    '/dashboard/profile',
  ];
  const isExemptPath = BILLING_EXEMPT.some(p => location.pathname.startsWith(p));

  // A user is "locked out" if they have no plan at all, no trial, no lifetime access, and are not a seat member
  // Exception: never lock out an assisted access session — the admin must be able to see the dashboard
  const isLocked = !user.isAssistedSession
    && !user.trialActive && !user.hasBusinessAccess && !user.hasStarterAccess
    && !user.hasLifetimeAccess && !user.isSeatUser && !hasFree;

  // noPlan: user has no plan_id assigned at all (null/undefined)
  const noPlan = !user.plan_id;
  const showPlanBanner = noPlan && !user.trialActive && !isExemptPath;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <Link to="/" className="flex items-center">
          <span className="font-bold text-foreground">{branding.platform_name}</span>
        </Link>
      </div>

      {/* User info — clickable to open account menu */}
      <div className="px-4 py-4 border-b border-border relative" ref={userMenuRef}>
        <button
          className="flex items-center gap-3 w-full text-left hover:bg-muted/50 rounded-xl p-1 -m-1 transition-colors"
          onClick={() => setUserMenuOpen(v => !v)}
          aria-haspopup="true"
          aria-expanded={userMenuOpen}
        >
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-semibold text-sm">{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {planBadgeLabel && (
              <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                {planBadgeLabel}
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {userMenuOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {/* Account actions */}
            <Link
              to="/dashboard/account"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <UserCircle className="w-4 h-4 text-muted-foreground" />
              My Account
            </Link>
            <Link
              to="/dashboard/security"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Shield className="w-4 h-4 text-muted-foreground" />
              Security Settings
            </Link>

            {/* ── Saved accounts ── */}
            {otherAccounts.length > 0 && (
              <>
                <div className="border-t border-border/60 mx-2 my-1" />
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Saved accounts
                </p>
                {otherAccounts.map(acct => (
                  <div key={acct.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors group">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-semibold text-xs">{(acct.name || acct.email).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{acct.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{acct.email}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="Switch to this account"
                        onClick={() => { setUserMenuOpen(false); switchAccount(); }}
                        className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Remove from list"
                        onClick={() => removeAccount(acct.id)}
                        className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── Add / switch account ── */}
            <div className="border-t border-border/60 mx-2 my-1" />
            <button
              onClick={() => { setUserMenuOpen(false); switchAccount(); }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors w-full text-left"
            >
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              {otherAccounts.length > 0 ? 'Switch / add account' : 'Add another account'}
            </button>

            {/* Divider */}
            <div className="border-t border-border/60 mx-2 my-1" />

            {/* Sign out fully */}
            <button
              onClick={() => { setUserMenuOpen(false); handleLogout(); }}
              className="flex items-start gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                <span className="block font-medium">Sign out completely</span>
                <span className="block text-[10px] text-red-400/70 font-normal leading-tight mt-0.5">
                  Signs you out of JA Group Services ID
                </span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          // For items with query strings, match both path and search; otherwise match path only
          const [itemPath, itemSearch] = item.path.split('?');
          const active = itemSearch
            ? location.pathname === itemPath && location.search === `?${itemSearch}`
            : location.pathname === item.path && !location.search.includes('section=org');
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && unreadCount > 0 && (
                <Badge className="bg-red-500 text-white border-0 text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                  {unreadCount}
                </Badge>
              )}
              {item.notifBadge && unreadNotifCount > 0 && (
                <Badge className="bg-primary text-white border-0 text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </Badge>
              )}
              {item.supportBadge && unreadSupportCount > 0 && (
                <Badge className="bg-orange-500 text-white border-0 text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                  {unreadSupportCount}
                </Badge>
              )}
              {item.path === '/dashboard/seat-invites' && pendingInviteCount > 0 && (
                <Badge className="bg-yellow-500 text-white border-0 text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                  {pendingInviteCount}
                </Badge>
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="border-t border-border my-2" />

        {/* Reopen setup guide */}
        {!onboarding.state.setupActive && (
          <button
            onClick={() => { onboarding.reload(); setShowSetupOverlay(true); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            Setup Guide
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Log Out
        </button>
      </nav>
    </div>
  );

  return (
    <OnlineContext.Provider value={isOnline}>
    <AutoLogoutProvider>
    <div className="min-h-screen bg-background flex">
      <GoogleAnalytics />
      <OfflineBanner />
      {!!branding.platform_favicon_url && (
        <Helmet>
          <link rel="icon" href={branding.platform_favicon_url} />
        </Helmet>
      )}

      {/* ── Legal re-accept gate — blocks everything until user accepts updated terms ── */}
      {!onboarding.loading && onboarding.state.requiresLegalReaccept && (
        <LegalReacceptGate onAccepted={onboarding.onLegalAccepted} />
      )}

      {/* ── Assisted setup overlay — shown to new users until dismissed ── */}
      {showSetupOverlay && !onboarding.state.requiresLegalReaccept && (
        <AssistedSetupOverlay
          hasBusinessAccess={!!(user?.hasBusinessAccess || user?.hasLifetimeAccess || user?.isSeatUser)}
          hasPersonalAccess={!!(user?.hasStarterAccess || user?.hasBusinessAccess || user?.hasLifetimeAccess || user?.trialActive)}
          completedSteps={onboarding.state.completedSteps}
          onDismiss={() => { setShowSetupOverlay(false); onboarding.dismiss(); }}
          onStepComplete={onboarding.markStepComplete}
        />
      )}

      {showConsent && consentChecked && (
        <ConsentModal policyUpdated={policyUpdated} onComplete={() => setShowConsent(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-card border-r border-border flex flex-col z-50">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="font-bold text-foreground text-sm">{branding.platform_name}</span>
          </div>
          {/* Notifications bell — navigates to /dashboard/notifications */}
          <Link to="/dashboard/notifications" className="relative p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Notifications">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {/* Assisted access session banner — shown when admin is impersonating a customer */}
          <AssistedSessionBanner />

          {/* Trial countdown banner — shown when trial is active */}
          {user?.trialActive && user?.trialEndsAt && (
            <TrialCountdownBanner trialEndsAt={user.trialEndsAt} />
          )}

          {/* Payment grace period banner — shown when invoice.payment_failed and within 7-day window */}
          {user?.inPaymentGracePeriod && user?.paymentGraceUntil && (
            <PaymentGraceBanner paymentGraceUntil={user.paymentGraceUntil} />
          )}

          {/* App update banner — shown when a new service worker version is available */}
          {swUpdateAvailable && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-sm">
              <span className="text-foreground">A new version of Profile Centre is available.</span>
              <button
                onClick={() => window.location.reload()}
                className="flex-shrink-0 px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Refresh now
              </button>
            </div>
          )}

          {/* Locked gate — no plan, no trial, not a seat member */}
          {isLocked && !isExemptPath ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Choose a plan to get started</h2>
              <p className="text-muted-foreground text-sm max-w-sm mb-2 leading-relaxed">
                You don't have an active plan. Pick a plan to unlock your dashboard and start building your digital profile.
              </p>
              <p className="text-muted-foreground/60 text-xs max-w-xs mb-8">
                Not ready to commit? Claim your free 30-day trial on the billing page — no card required.
              </p>
              <Link to="/dashboard/billing">
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2 px-6">
                  <CreditCard className="w-4 h-4" /> View Plans & Billing
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* No-plan banner (seat users or edge cases) */}
              {showPlanBanner && (
                <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                  <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="flex-1 text-foreground">You don't have an active plan yet. Some features are limited.</span>
                  <Link to="/dashboard/billing">
                    <Button size="sm" className="bg-primary text-white text-xs h-7 px-3">View Plans</Button>
                  </Link>
                </div>
              )}

              {/* Offline: show PIN gate (or plain offline screen if no PIN set) */}
              {!isOnline && <OfflinePinGate><Outlet /></OfflinePinGate>}

              {/* Normal content when online */}
              {isOnline && <Outlet />}
            </>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav
        navItems={navItems}
        currentPath={location.pathname}
        unreadCount={unreadCount}
        unreadNotifCount={unreadNotifCount}
        pendingInviteCount={pendingInviteCount}
        onLogout={handleLogout}
      />
    </div>
    </AutoLogoutProvider>
    </OnlineContext.Provider>
  );
}
