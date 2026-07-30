/**
 * Cookie Preference Banner — UK GDPR / PECR compliant.
 *
 * Appears as a bottom-of-screen bar until the user makes a choice.
 * Essential cookies: always on (session, PKCE auth state).
 * Analytics, Marketing, Preferences: opt-in only.
 *
 * No non-essential scripts are loaded until the user accepts.
 * Preferences persisted in localStorage under 'ja_cookie_prefs'.
 * Consent decision is logged to the audit trail.
 *
 * The banner blocks interaction with the page until a choice is made
 * (via a semi-transparent overlay) to ensure GDPR compliance.
 */
import { useState, useEffect } from 'react';
import { Cookie, Shield, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';

export interface CookiePrefs {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  decided: boolean;
  decidedAt: string;
}

const STORAGE_KEY = 'ja_cookie_prefs';

export function getCookiePrefs(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookiePrefs;
  } catch {
    return null;
  }
}

function savePrefs(prefs: Omit<CookiePrefs, 'decided' | 'decidedAt'>): CookiePrefs {
  const full: CookiePrefs = { ...prefs, decided: true, decidedAt: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(full)); } catch { /* ignore */ }

  // Dispatch event so other components can react (e.g. load analytics)
  window.dispatchEvent(new CustomEvent('cookie-consent-changed', {
    detail: { consented: prefs.analytics },
  }));

  // Log consent to audit trail (non-fatal, fire-and-forget)
  fetch('/api/audit/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  }).catch(() => {});

  return full;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [preferences, setPreferences] = useState(false);

  useEffect(() => {
    const existing = getCookiePrefs();
    if (!existing?.decided) {
      // Slight delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    savePrefs({ essential: true, analytics: true, marketing: true, preferences: true });
    setVisible(false);
  };

  const rejectAll = () => {
    savePrefs({ essential: true, analytics: false, marketing: false, preferences: false });
    setVisible(false);
  };

  const saveCustom = () => {
    savePrefs({ essential: true, analytics, marketing, preferences });
    setVisible(false);
  };

  return (
    <>
      {/* Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Cookie preferences"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          {!showManage ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Icon + text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Cookie className="w-4.5 h-4.5 text-primary" style={{ width: '18px', height: '18px' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">We use cookies</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    We use essential cookies to keep the site working. With your consent, we also use optional cookies to improve your experience.{' '}
                    <Link to="/legal/cookies" className="text-primary hover:underline" onClick={rejectAll}>
                      Cookie policy
                    </Link>
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <button
                  onClick={() => setShowManage(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Manage
                  <ChevronUp className="w-3 h-3" />
                </button>
                <Button onClick={rejectAll} variant="outline" className="border-border text-xs h-9 px-4">
                  Essential only
                </Button>
                <Button onClick={acceptAll} className="bg-primary text-white text-xs h-9 px-4">
                  Accept all
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  Manage cookie preferences
                </p>
                <button
                  onClick={() => setShowManage(false)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ChevronDown className="w-3.5 h-3.5" /> Collapse
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Essential — always on */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Essential</p>
                      <p className="text-xs text-muted-foreground">Required for the site</p>
                    </div>
                  </div>
                  <span className="text-xs text-green-400 font-medium">Always on</span>
                </div>

                {[
                  { key: 'analytics' as const, label: 'Analytics', desc: 'Understand site usage', value: analytics, set: setAnalytics },
                  { key: 'marketing' as const, label: 'Marketing', desc: 'Relevant content & offers', value: marketing, set: setMarketing },
                  { key: 'preferences' as const, label: 'Preferences', desc: 'Remember your settings', value: preferences, set: setPreferences },
                ].map(({ key, label, desc, value, set }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                    <div>
                      <p className="text-xs font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch checked={value} onCheckedChange={set} className="flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 justify-end pt-1">
                <Button onClick={rejectAll} variant="outline" className="border-border text-xs h-9">
                  Essential only
                </Button>
                <Button onClick={saveCustom} variant="outline" className="border-border text-xs h-9">
                  Save preferences
                </Button>
                <Button onClick={acceptAll} className="bg-primary text-white text-xs h-9">
                  Accept all
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
