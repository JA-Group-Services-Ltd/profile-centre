/**
 * Dashboard — Settings & Personalisation
 * /dashboard/settings
 *
 * Sections:
 *  1. Your Profile URL (quick copy)
 *  2. Display Name
 *  3. Email (read-only, managed by JA Group Services ID)
 *  4. Personalisation — display density, date format, language, card style
 *  5. Notification Preferences
 *  6. Security — Support PIN
 *  7. Danger Zone — delete / close account
 *
 * All preferences saved to server via /api/users/:id/settings — NO localStorage.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Save, Trash2, Check, AlertTriangle, Info, UserX, Copy, ExternalLink,
  Globe, Bell, Palette, HardDrive, RefreshCw, LogOut, ShieldAlert,
} from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '@/lib/branding';
import SupportPinCard from '@/components/security/SupportPinCard';
import ThemeToggle from '@/components/ThemeToggle';

// ── Personalisation defaults ──────────────────────────────────────────────────

interface PersonalisationPrefs {
  display_density: 'comfortable' | 'compact' | 'spacious';
  date_format: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
  dashboard_card_style: 'default' | 'minimal' | 'glass';
  show_profile_completion: boolean;
  show_quick_actions: boolean;
  show_analytics_preview: boolean;
  email_notifications_enabled: boolean;
  email_on_service_message: boolean;
  email_on_new_enquiry: boolean;
  email_on_plan_change: boolean;
  email_on_business_card_update: boolean;
}

const PREFS_DEFAULTS: PersonalisationPrefs = {
  display_density: 'comfortable',
  date_format: 'dd/mm/yyyy',
  dashboard_card_style: 'default',
  show_profile_completion: true,
  show_quick_actions: true,
  show_analytics_preview: true,
  email_notifications_enabled: true,
  email_on_service_message: true,
  email_on_new_enquiry: true,
  email_on_plan_change: true,
  email_on_business_card_update: true,
};

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, title, description, children }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Appearance section ────────────────────────────────────────────────────────

function AppearanceSection() {
  return (
    <Section
      icon={<Palette className="w-4 h-4" />}
      title="Appearance"
      description="Choose how JA Profile Studio looks for you. Your preference is saved to your account and applies across all your devices."
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-3">Colour mode</p>
          <ThemeToggle expanded />
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Light</span> — white background, dark text.{' '}
          <span className="font-medium">Dark</span> — dark background, light text.{' '}
          <span className="font-medium">System</span> — follows your device setting automatically.
        </p>
      </div>
    </Section>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="flex-shrink-0" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const branding = useBranding();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [prefs, setPrefs] = useState<PersonalisationPrefs>(PREFS_DEFAULTS);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Fetch the user's profile to show their public URL
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profiles/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          const personal = d.data.find((p: { profile_type: string; username: string }) => p.profile_type !== 'business');
          if (personal?.username) setProfileUsername(personal.username);
        }
      })
      .catch(() => {});

    // Load saved preferences from server
    fetch('/api/users/me/preferences', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success && d.data) setPrefs({ ...PREFS_DEFAULTS, ...d.data }); })
      .catch(() => {});
  }, []);

  const profileUrl = profileUsername
    ? `${branding.platform_url || 'https://japrofilestudio.jagroupservices.co.uk'}/profile/${profileUsername}`
    : null;

  const copyUrl = async () => {
    if (!profileUrl) return;
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveProfile = async () => {
    setError('');
    if (!name.trim()) { setError('Name cannot be empty.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user?.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const savePrefs = async () => {
    setPrefsSaving(true);
    try {
      await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(prefs),
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch { /* non-fatal */ } finally {
      setPrefsSaving(false);
    }
  };

  const setP = <K extends keyof PersonalisationPrefs>(key: K, value: PersonalisationPrefs[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  // ── Storage & Cache actions ───────────────────────────────────────────────

  type CacheAction = 'cache' | 'local' | 'full';
  const [cacheAction, setCacheAction] = useState<CacheAction | null>(null);
  const [cacheDone, setCacheDone]     = useState<CacheAction | null>(null);
  const [showFullResetDialog, setShowFullResetDialog] = useState(false);

  /** Delete all SW caches and force a fresh reload */
  const clearSwCaches = useCallback(async () => {
    // Tell the SW to drop its page + API caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_REVALIDATE' });
    }
    // Also nuke every cache directly from the page
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  }, []);

  /** Wipe localStorage + sessionStorage (keeps the auth cookie) */
  const clearLocalStorage = useCallback(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
  }, []);

  const handleClearCache = useCallback(async () => {
    setCacheAction('cache');
    try {
      await clearSwCaches();
      setCacheDone('cache');
      setTimeout(() => {
        setCacheDone(null);
        // Soft-reload to re-fetch fresh assets
        window.location.reload();
      }, 1200);
    } finally {
      setCacheAction(null);
    }
  }, [clearSwCaches]);

  const handleClearLocal = useCallback(async () => {
    setCacheAction('local');
    try {
      clearLocalStorage();
      await new Promise(r => setTimeout(r, 600));
      setCacheDone('local');
      setTimeout(() => setCacheDone(null), 2500);
    } finally {
      setCacheAction(null);
    }
  }, [clearLocalStorage]);

  const handleFullReset = useCallback(async () => {
    setShowFullResetDialog(false);
    setCacheAction('full');
    try {
      await clearSwCaches();
      clearLocalStorage();
      // Unregister the service worker so it re-installs fresh
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      await new Promise(r => setTimeout(r, 600));
      // Sign out and hard-reload
      window.location.href = '/auth/logout';
    } finally {
      setCacheAction(null);
    }
  }, [clearSwCaches, clearLocalStorage]);

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await fetch(`/api/users/${user?.id}`, { method: 'DELETE', credentials: 'include' });
      window.location.href = '/auth/logout';
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Settings — JA Profile Studio Dashboard</title>
        <meta name="description" content="Manage your account settings, display name, personalisation and notification preferences." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/settings" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, personalise your experience, and control notifications</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
      )}

      {/* ── Your Profile URL ── */}
      {profileUrl && (
        <Section icon={<Globe className="w-4 h-4" />} title="Your Profile URL" description="Share this link — it's your public digital business card">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border">
            <code className="flex-1 text-sm text-foreground font-mono truncate">{profileUrl}</code>
            <button
              onClick={copyUrl}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            To change your username, go to <a href="/dashboard/profile" className="text-primary hover:underline">My Profile</a>.
          </p>
        </Section>
      )}

      {/* ── Display Name ── */}
      <Section icon={<Save className="w-4 h-4" />} title="Display Name" description="This is how your name appears across your profiles and the platform">
        <div className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1.5 bg-background border-border"
              placeholder="Your full name"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving} className="bg-primary gap-2">
              {saved
                ? <><Check className="w-4 h-4" /> Saved!</>
                : saving
                  ? 'Saving…'
                  : <><Save className="w-4 h-4" /> Save Changes</>}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Email — read only ── */}
      <Section icon={<Info className="w-4 h-4" />} title="Email Address" description="Managed by your JA Group Services ID account — cannot be changed here">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              To change your email, contact JA Group Services support.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Personalisation ── */}
      <Section icon={<Palette className="w-4 h-4" />} title="Personalisation" description="Customise how the dashboard looks and feels for you">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Density</Label>
              <Select value={prefs.display_density} onValueChange={v => setP('display_density', v as PersonalisationPrefs['display_density'])}>
                <SelectTrigger className="text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact — more on screen</SelectItem>
                  <SelectItem value="comfortable">Comfortable — balanced</SelectItem>
                  <SelectItem value="spacious">Spacious — easier to read</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Date Format</Label>
              <Select value={prefs.date_format} onValueChange={v => setP('date_format', v as PersonalisationPrefs['date_format'])}>
                <SelectTrigger className="text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd/mm/yyyy">DD/MM/YYYY (UK)</SelectItem>
                  <SelectItem value="mm/dd/yyyy">MM/DD/YYYY (US)</SelectItem>
                  <SelectItem value="yyyy-mm-dd">YYYY-MM-DD (ISO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dashboard Card Style</Label>
              <Select value={prefs.dashboard_card_style} onValueChange={v => setP('dashboard_card_style', v as PersonalisationPrefs['dashboard_card_style'])}>
                <SelectTrigger className="text-sm bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default — standard cards</SelectItem>
                  <SelectItem value="minimal">Minimal — clean and simple</SelectItem>
                  <SelectItem value="glass">Glass — frosted effect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dashboard Widgets</p>
            <ToggleRow
              label="Profile completion ring"
              description="Show your profile completeness score on the overview"
              checked={prefs.show_profile_completion}
              onChange={v => setP('show_profile_completion', v)}
            />
            <ToggleRow
              label="Quick actions panel"
              description="Show shortcut buttons on the overview page"
              checked={prefs.show_quick_actions}
              onChange={v => setP('show_quick_actions', v)}
            />
            <ToggleRow
              label="Analytics preview"
              description="Show a mini analytics chart on the overview"
              checked={prefs.show_analytics_preview}
              onChange={v => setP('show_analytics_preview', v)}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPrefs(PREFS_DEFAULTS)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Reset to defaults
            </Button>
            <Button onClick={savePrefs} disabled={prefsSaving} className="bg-primary gap-2">
              {prefsSaved
                ? <><Check className="w-4 h-4" /> Saved!</>
                : prefsSaving
                  ? 'Saving…'
                  : <><Save className="w-4 h-4" /> Save Preferences</>}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Appearance ── */}
      <AppearanceSection />

      {/* ── Notification Preferences ── */}
      <Section icon={<Bell className="w-4 h-4" />} title="Notification Preferences" description="Control which email notifications you receive from JA Profile Studio">
        <div className="space-y-0">
          <ToggleRow
            label="Email notifications"
            description="Master switch — turn off to stop all email notifications"
            checked={prefs.email_notifications_enabled}
            onChange={v => setP('email_notifications_enabled', v)}
          />
          {prefs.email_notifications_enabled && (
            <>
              <ToggleRow
                label="Service messages and notices"
                description="When JA Profile Studio sends you an account notice, billing alert, or service update"
                checked={prefs.email_on_service_message}
                onChange={v => setP('email_on_service_message', v)}
              />
              <ToggleRow
                label="New enquiry received"
                description="When someone submits an enquiry through your profile"
                checked={prefs.email_on_new_enquiry}
                onChange={v => setP('email_on_new_enquiry', v)}
              />
              <ToggleRow
                label="Plan or subscription changes"
                description="When your plan is activated, changed, or expires"
                checked={prefs.email_on_plan_change}
                onChange={v => setP('email_on_plan_change', v)}
              />
              <ToggleRow
                label="Business Card request updates"
                description="When your Business Card request status changes or you receive a message"
                checked={prefs.email_on_business_card_update}
                onChange={v => setP('email_on_business_card_update', v)}
              />
            </>
          )}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={savePrefs} disabled={prefsSaving} variant="outline" className="gap-2 border-border">
            {prefsSaved
              ? <><Check className="w-4 h-4 text-green-400" /> Saved!</>
              : prefsSaving
                ? 'Saving…'
                : <><Save className="w-4 h-4" /> Save Preferences</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Essential service emails (security alerts, account closure confirmations, Stripe invoices) are always sent regardless of these settings.
          For granular per-category control, visit <a href="/dashboard/notification-preferences" className="text-primary underline">Email Notification Preferences</a>.
        </p>
      </Section>

      {/* ── Security — Support PIN ── */}
      <SupportPinCard />

      {/* ── Storage & Cache ── */}
      <Section
        icon={<HardDrive className="w-4 h-4" />}
        title="Storage & Cache"
        description="Fix loading issues, clear stale data, or do a full reset if something isn't working"
      >
        <div className="space-y-3">

          {/* Clear cache */}
          <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border bg-muted/20">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                Clear app cache
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Removes cached pages and API responses. The app reloads and fetches everything fresh from the server. Use this if pages look outdated or stuck.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={cacheAction !== null}
              className="flex-shrink-0 border-border gap-1.5 min-w-[90px]"
            >
              {cacheDone === 'cache' ? (
                <><Check className="w-3.5 h-3.5 text-green-400" /> Done</>
              ) : cacheAction === 'cache' ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Clearing…</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Clear</>
              )}
            </Button>
          </div>

          {/* Clear local data */}
          <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border bg-muted/20">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                Clear local data
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Wipes browser storage (localStorage and sessionStorage) for this site. Resets any locally saved preferences or temporary state. You stay logged in.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLocal}
              disabled={cacheAction !== null}
              className="flex-shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1.5 min-w-[90px]"
            >
              {cacheDone === 'local' ? (
                <><Check className="w-3.5 h-3.5 text-green-400" /> Done</>
              ) : cacheAction === 'local' ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Clearing…</>
              ) : (
                <><HardDrive className="w-3.5 h-3.5" /> Clear</>
              )}
            </Button>
          </div>

          {/* Full reset */}
          <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                Full reset &amp; sign out
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Clears all caches, local data, and unregisters the service worker — then signs you out. Use this if the app is behaving unexpectedly or you want a completely clean slate.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullResetDialog(true)}
              disabled={cacheAction !== null}
              className="flex-shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 min-w-[90px]"
            >
              {cacheAction === 'full' ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resetting…</>
              ) : (
                <><LogOut className="w-3.5 h-3.5" /> Reset</>
              )}
            </Button>
          </div>

        </div>
      </Section>

      {/* ── Danger Zone ── */}
      <Card className="bg-card border-red-500/20 mt-6">
        <CardHeader>
          <CardTitle className="text-base text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently deletes your account, all profiles, links, and data. Cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2 flex-shrink-0"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Account Closure ── */}
      <Card className="bg-card border-blue-500/20 mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-blue-400">
            <UserX className="w-4 h-4" /> Close My Account
          </CardTitle>
          <CardDescription>
            Submit a formal account closure request. Our team will review and confirm within 5 business days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Unlike instant deletion, a closure request is reviewed by our team. This gives you a chance to cancel if you change your mind, and ensures your data is handled correctly under UK GDPR.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-2"
            onClick={() => navigate('/dashboard/account-closure')}
          >
            <UserX className="w-4 h-4" /> Request Account Closure
          </Button>
        </CardContent>
      </Card>

      {/* ── Full Reset confirmation dialog ── */}
      <Dialog open={showFullResetDialog} onOpenChange={setShowFullResetDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> Full Reset &amp; Sign Out
            </DialogTitle>
            <DialogDescription>
              This will clear all cached data, wipe browser storage, unregister the service worker, and sign you out. Your account and profile data on the server are not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>After the reset you will need to sign back in. The app will re-download fresh assets on your next visit.</p>
            <p className="text-xs">This is useful if the app is stuck, showing old content, or behaving unexpectedly.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFullResetDialog(false)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleFullReset}
              className="bg-red-500 hover:bg-red-600 text-white gap-2"
            >
              <LogOut className="w-4 h-4" /> Reset &amp; Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, all profiles, links, and data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Type <strong>DELETE</strong> to confirm</Label>
            <Input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="mt-1.5 bg-background border-border"
              placeholder="DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="border-border">Cancel</Button>
            <Button
              onClick={deleteAccount}
              disabled={deleteConfirm !== 'DELETE' || deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? 'Deleting…' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
