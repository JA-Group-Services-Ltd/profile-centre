/**
 * Dashboard — Email Notification Preferences
 *
 * Lets users manage which optional email notifications they receive.
 * Essential notifications (security, billing, SAR, legal) are always on
 * and cannot be disabled — they are shown as locked.
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  Bell, Shield, CreditCard, FileText, Scale,
  HelpCircle, User, Mail, Info, Lock, Loader2, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface NotifPref {
  enabled: boolean;
  essential: boolean;
  label: string;
  description: string;
}

type PrefsData = Record<string, NotifPref>;

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  security_alerts:       Shield,
  billing_notices:       CreditCard,
  sar_updates:           FileText,
  legal_notices:         Scale,
  support_replies:       HelpCircle,
  profile_status:        User,
  enquiry_notifications: Mail,
  service_updates:       Info,
};

export default function NotificationPreferencesPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PrefsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch('/api/users/me/notification-prefs', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setPrefs(d.data);
        else setError('Failed to load preferences.');
      })
      .catch(() => setError('Failed to load preferences.'))
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = (key: string) => {
    if (!prefs) return;
    const pref = prefs[key];
    if (pref.essential) return; // cannot toggle essential
    setPrefs(prev => prev ? { ...prev, [key]: { ...pref, enabled: !pref.enabled } } : prev);
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prefs)) {
        if (!v.essential) payload[k] = v.enabled;
      }
      const r = await fetch('/api/users/me/notification-prefs', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const essentialEntries = prefs ? Object.entries(prefs).filter(([, v]) => v.essential) : [];
  const optionalEntries  = prefs ? Object.entries(prefs).filter(([, v]) => !v.essential) : [];

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>Email Notification Preferences — Dashboard</title>
        <meta name="description" content="Manage your email notification preferences." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/notification-preferences" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Email Notifications</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control which email notifications you receive from Sousa Murray Profiles.
        </p>
      </div>

      {/* Info notice */}
      <div className="mb-6 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <Bell className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-300">About service emails</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Essential notifications (security, billing, legal) are always sent and cannot be disabled — they protect your account and keep you informed of important changes.
            Marketing emails are managed separately and require your explicit consent.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : error && !prefs ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      ) : prefs ? (
        <div className="space-y-6">

          {/* Essential — always on */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">Essential notifications</CardTitle>
                <Badge className="bg-muted text-muted-foreground border-0 text-xs">Always on</Badge>
              </div>
              <CardDescription className="text-xs">
                These notifications cannot be disabled. They protect your account and ensure you receive legally required communications.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {essentialEntries.map(([key, pref]) => {
                const Icon = CATEGORY_ICONS[key] ?? Bell;
                return (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{pref.label}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Lock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Required</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pref.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Optional — user can toggle */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Optional notifications</CardTitle>
              <CardDescription className="text-xs">
                You can turn these on or off at any time. Changes take effect immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {optionalEntries.map(([key, pref]) => {
                const Icon = CATEGORY_ICONS[key] ?? Bell;
                return (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => toggle(key)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${pref.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`w-4 h-4 ${pref.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium ${pref.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {pref.label}
                        </p>
                        <Switch
                          checked={pref.enabled}
                          onCheckedChange={() => toggle(key)}
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pref.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Save button */}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            {saved && (
              <div className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Preferences saved
              </div>
            )}
            {!saved && <div />}
            <Button
              onClick={save}
              disabled={saving}
              className="bg-primary text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save preferences'}
            </Button>
          </div>

          {/* Marketing note */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Marketing emails</strong> — promotional content, newsletters, and offers are coming soon and are not yet available. This section will be updated when marketing communications launch.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
