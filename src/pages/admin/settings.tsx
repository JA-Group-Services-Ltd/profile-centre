import React, { useState, useEffect } from 'react';
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/date';
import {
  Save, Globe, Shield, Bell, CreditCard, Loader2, CheckCircle2,
  AlertCircle, Eye, EyeOff, Zap, RefreshCw, Package, ExternalLink, Palette, Sun, Moon,
  FlaskConical, Send, Users, Plus, Trash2, Edit2, Check, X, Lock,
  Globe2, Radio, ImagePlus, Link2, Clock, Settings as SettingsIcon,
  Wrench, Search, UserCheck, LogIn, KeyRound, Info, ChevronDown, ChevronUp,
  Mail, ShieldCheck, AlertTriangle, Copy, CheckCheck, MailCheck, MailX,
  BookOpen, FileDown, Database, HardDrive, Download, Calendar, RotateCcw, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { applyThemeSettings } from '@/lib/site-theme';
import { Helmet } from '@dr.pogodin/react-helmet';

interface Settings {
  site_name: string; site_url: string; support_email: string; contact_email: string;
  platform_name: string; platform_tagline: string; platform_description: string;
  platform_url: string; footer_tagline: string;
  max_free_profiles: string; max_free_links: string; allow_registration: string;
  require_email_verification: string; maintenance_mode: string; maintenance_message: string;
  analytics_enabled: string; cookie_banner_enabled: string; gdpr_enabled: string;
  terms_version: string; privacy_version: string;
  feature_email_signature: string;
  crm_require_pin: string;
}

interface StripeConfig {
  stripe_publishable_key: string; stripe_secret_key_masked?: string;
  stripe_webhook_secret: string; stripe_mode: string;
  stripe_secret_key?: string;
}

interface AdminPlan {
  id: number; name: string; slug: string;
  price_monthly: number; price_yearly: number;
  max_profiles: number; max_links: number; max_seats: number;
  has_qr_download: number; has_contact_form: number;
  has_advanced_analytics: number; has_vcard_download: number;
  has_custom_themes: number; remove_branding: number;
  has_profile_link_customisation: number; has_lifetime: number; has_messaging: number;
  is_active: number; is_public: number; max_themes: number;
  stripe_price_monthly: string | null; stripe_price_yearly: string | null;
  stripe_price_lifetime: string | null; stripe_product_id: string | null;
}

interface AdminUser {
  id: number; email: string; name: string; role: string;
  plan_id: number | null; plan_name: string | null;
  created_at: string; is_paused: number;
}

const defaultSettings: Settings = {
  site_name: 'Sousa Murray Profiles', site_url: 'https://sousamurrayprofiles.jagroupservices.co.uk',
  platform_name: 'Sousa Murray Profiles', platform_tagline: 'Your digital business card, reimagined.',
  platform_description: 'A professional digital profile service for UK-based individuals and businesses. Share your contact details, links and QR code in one place.',
  platform_url: 'https://sousamurrayprofiles.jagroupservices.co.uk',
  footer_tagline: 'Part of JA Group Services Ltd',
  support_email: 'contact@jagroupservices.co.uk', contact_email: 'contact@jagroupservices.co.uk',
  max_free_profiles: '1', max_free_links: '5', allow_registration: '1',
  require_email_verification: '0', maintenance_mode: '0',
  maintenance_message: 'We are performing scheduled maintenance. We will be back shortly.',
  analytics_enabled: '1', cookie_banner_enabled: '1', gdpr_enabled: '1',
  terms_version: '1.0', privacy_version: '1.0',
  feature_email_signature: '1',
  crm_require_pin: '0',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ThemeConfig {
  site_color_mode: string;
  site_primary_color: string;
  site_secondary_color: string;
  site_accent_color: string;
}

const defaultTheme: ThemeConfig = {
  site_color_mode: 'dark',
  site_primary_color: '#3B82F6',
  site_secondary_color: '#513bf6',
  site_accent_color: '#3B82F6',
};

// ─── Troubleshooting Tab ───────────────────────────────────────────────────────

function TroubleshootingSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function IssueRow({ title, cause, fix }: { title: string; cause: string; fix: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border bg-muted/20">
          <div className="pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Likely cause</p>
            <p className="text-sm text-foreground">{cause}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resolution</p>
            <p className="text-sm text-foreground">{fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TroubleshootingTab() {
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<null | { found: boolean; user?: { id: number; name: string; email: string; role: string; plan_name: string | null; subscription_status: string | null; trial_started_at: string | null; lifetime_access: number; is_paused: number; created_at: string } }>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const lookupUser = async () => {
    if (!lookupEmail.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(lookupEmail.trim())}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setLookupResult({ found: true, user: data.data[0] });
      } else {
        setLookupResult({ found: false });
      }
    } catch {
      setLookupResult({ found: false });
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Admin troubleshooting reference</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use this tab to diagnose login issues, session problems, and account access errors. All user management actions are in the CRM.
          </p>
        </div>
      </div>

      {/* User lookup */}
      <TroubleshootingSection icon={<Search className="w-4 h-4 text-primary" />} title="Quick user lookup">
        <p className="text-xs text-muted-foreground">Search by email to check a user's plan, trial status, and account state.</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={lookupEmail}
            onChange={e => setLookupEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupUser()}
            placeholder="user@example.com"
            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button onClick={lookupUser} disabled={lookupLoading} size="sm" className="bg-primary gap-1.5">
            {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Look up
          </Button>
        </div>
        {lookupResult && (
          lookupResult.found && lookupResult.user ? (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">User found</span>
              </div>
              {[
                ['ID', String(lookupResult.user.id)],
                ['Name', lookupResult.user.name],
                ['Email', lookupResult.user.email],
                ['Role', lookupResult.user.role],
                ['Plan', lookupResult.user.plan_name ?? 'Free (no plan)'],
                ['Subscription', lookupResult.user.subscription_status ?? 'None'],
                ['Trial started', lookupResult.user.trial_started_at ? fmtDate(lookupResult.user.trial_started_at) : 'Not claimed'],
                ['Lifetime access', lookupResult.user.lifetime_access ? 'Yes' : 'No'],
                ['Account paused', lookupResult.user.is_paused ? 'Yes' : 'No'],
                ['Member since', fmtDate(lookupResult.user.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <a href={`/admin/crm?search=${encodeURIComponent(lookupResult.user.email)}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  Open in CRM <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-blue-400" /> No user found with that email address.
            </div>
          )
        )}
      </TroubleshootingSection>

      {/* Login issues */}
      <TroubleshootingSection icon={<LogIn className="w-4 h-4 text-primary" />} title="Login issues">
        <IssueRow
          title="User cannot log in — redirected back to login page"
          cause="The user's Microsoft account is not registered in the Sousa Murray Profiles CIAM tenant (3c0074dd), or the redirect URI for the customer OIDC flow is not registered in Azure."
          fix="Check Azure AD B2C tenant 3c0074dd → App registrations → Redirect URIs. Ensure the production URL is listed. If the user is new, they may need to complete self-service registration first. Check the audit log for any failed OIDC callback entries."
        />
        <IssueRow
          title="Admin cannot log in to the admin portal"
          cause="The admin's Microsoft account is not in the workforce tenant (53477196), or the admin portal redirect URI is not registered."
          fix="Check Azure AD tenant 53477196 → App registrations → Redirect URIs. Ensure /admin/callback is listed for the production domain. Verify the user has been added to the tenant and is not blocked. Check AZURE_AD_ADMIN_* secrets are set correctly."
        />
        <IssueRow
          title="Login loop — user is authenticated but immediately redirected back"
          cause="Session cookie is not being set correctly. This can happen if the domain or SameSite cookie settings are misconfigured, or if the user's browser is blocking third-party cookies."
          fix="Verify SESSION_SECRET is set in secrets. Check that the production domain matches the cookie domain setting. Ask the user to clear cookies and try again in a private/incognito window. Check server logs for session store errors."
        />
        <IssueRow
          title="'User not found' error after successful Microsoft login"
          cause="The OIDC callback received a valid token but the user record does not exist in the Sousa Murray Profiles database. This can happen if the account was deleted or if the OID claim does not match."
          fix="Check the users table for the email address. If the user exists but with a different OID, update the oid column via the CRM. If the user does not exist, they need to register. Check the OIDC callback handler logs for the raw claims received."
        />
        <IssueRow
          title="Session expires immediately / user is logged out after a few seconds"
          cause="The session store is not persisting correctly, or the SESSION_SECRET has changed since the session was created (invalidating all existing sessions)."
          fix="Check that SESSION_SECRET has not been rotated recently. Verify the SQLite session store is writing to /private/db correctly. Check server logs for 'session store error' messages. If SESSION_SECRET was changed, all users will need to log in again — this is expected."
        />
        <IssueRow
          title="Session fingerprint mismatch — user auto-logged out"
          cause="The auto-logout system detected a change in User-Agent or Accept-Language header mid-session. This is a security feature and is working as intended."
          fix="This is expected behaviour if the user switched browsers, updated their browser, or changed language settings. Ask the user to log in again. If this is happening repeatedly for the same user without explanation, check if they are behind a proxy that modifies headers."
        />
      </TroubleshootingSection>

      {/* Plan & trial issues */}
      <TroubleshootingSection icon={<Zap className="w-4 h-4 text-primary" />} title="Plan, trial & access issues">
        <IssueRow
          title="User claims they started a trial but has no access"
          cause="The trial_started_at field is set but the 30-day window has expired, or the entitlement function is not returning trialActive = true."
          fix="Use the user lookup above to check trial_started_at. Calculate if 30 days have passed. If the trial is genuinely expired, the user needs to subscribe. If the trial should still be active, check the entitlement.ts calculation and the server clock."
        />
        <IssueRow
          title="User has a paid plan but cannot access paid features"
          cause="The subscription record exists but its status is not 'active' or 'trialing'. Common causes: Stripe webhook not received, payment failed (past_due), or the plan_id on the user record does not match the subscription."
          fix="Check the subscriptions table for the user. Verify the Stripe webhook is registered and receiving events. Check Stripe dashboard for the subscription status. If the webhook is missing events, use Stripe's 'Resend' feature. Ensure STRIPE_WEBHOOK_SECRET is correct."
        />
        <IssueRow
          title="Free user can access paid features"
          cause="The entitlement function may have a bug, or the user has been manually granted access via a database edit outside the admin portal."
          fix="Check the user's plan_id, subscription status, lifetime_access, and trial_started_at in the database. Verify getEffectiveUserAccess() returns hasFreeAccess = true for this user. Check the audit log for any manual grants."
        />
        <IssueRow
          title="User cannot claim their free trial"
          cause="The trial has already been claimed (trial_started_at is set), the user has an active paid plan, or the /api/trial/claim endpoint returned an error."
          fix="Check trial_started_at in the user lookup above. If it is set, the trial was already claimed. If the user believes they never started a trial, check the audit log for 'trial_claimed' entries. Trials cannot be reset — the user must subscribe to a paid plan."
        />
      </TroubleshootingSection>

      {/* OIDC / Azure reference */}
      <TroubleshootingSection icon={<KeyRound className="w-4 h-4 text-primary" />} title="OIDC & Azure configuration reference">
        <div className="space-y-3">
          {[
            { label: 'Customer CIAM tenant', value: '3c0074dd-…', note: 'Used for all customer logins via /login' },
            { label: 'Admin workforce tenant', value: '53477196-…', note: 'Used for admin portal logins via /admin/login' },
            { label: 'Customer callback path', value: '/auth/callback', note: 'Must be registered in CIAM app registration' },
            { label: 'Admin callback path', value: '/admin/auth/callback', note: 'Must be registered in workforce app registration' },
            { label: 'Required secrets', value: 'AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID, AZURE_AD_ADMIN_CLIENT_ID, AZURE_AD_ADMIN_CLIENT_SECRET, AZURE_AD_ADMIN_TENANT_ID', note: 'All must be set in Secrets manager' },
          ].map(({ label, value, note }) => (
            <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                </div>
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-foreground flex-shrink-0">{value}</code>
              </div>
            </div>
          ))}
        </div>
      </TroubleshootingSection>

      {/* Useful links */}
      <TroubleshootingSection icon={<ExternalLink className="w-4 h-4 text-primary" />} title="Useful admin links">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'CRM — all users', href: '/admin/crm' },
            { label: 'Audit log', href: '/admin/audit' },
            { label: 'Support requests', href: '/admin/support-requests' },
            { label: 'Data requests (SAR)', href: '/admin/data-requests' },
            { label: 'Issue reports', href: '/admin/issue-reports' },
            { label: 'Notifications', href: '/admin/notifications' },
          ].map(({ label, href }) => (
            <a key={href} href={href} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-sm text-foreground">
              <ExternalLink className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              {label}
            </a>
          ))}
        </div>
      </TroubleshootingSection>
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Stripe
  const [stripe, setStripe] = useState<StripeConfig>({
    stripe_publishable_key: '', stripe_secret_key: '', stripe_webhook_secret: '', stripe_mode: 'test',
  });
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeSaveStatus, setStripeSaveStatus] = useState<SaveStatus>('idle');
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Stripe Products
  interface StripeProductRow { id: string; name: string; description: string; active: number; synced_at: string; prices: { id: string; currency: string; unit_amount: number; recurring_interval: string | null }[]; }
  const [products, setProducts] = useState<StripeProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ products: number; prices: number } | null>(null);
  const [syncError, setSyncError] = useState('');

  // Stripe — track which fields are being actively replaced
  const [replacingWebhookSecret, setReplacingWebhookSecret] = useState(false);

  // Theme / Appearance
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [themeSaveStatus, setThemeSaveStatus] = useState<SaveStatus>('idle');

  // Branding (logo / favicon)
  interface BrandingConfig { platform_logo_url: string; platform_favicon_url: string; }
  const [branding, setBranding] = useState<BrandingConfig>({ platform_logo_url: '', platform_favicon_url: '' });
  const [brandingSaveStatus, setBrandingSaveStatus] = useState<SaveStatus>('idle');
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);

  // Footer links editor
  interface FooterLink { label: string; href: string; external?: boolean; }
  interface FooterColumn { heading: string; links: FooterLink[]; }
  const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
    { heading: 'Product', links: [
      { label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' },
      { label: 'FAQ', href: '/#faq' }, { label: 'Help Centre', href: '/help' },
      { label: 'Install App', href: '__install__' },
    ]},
    { heading: 'Support', links: [
      { label: 'Contact Support', href: '/support' }, { label: 'Report an Issue', href: '/report-issue' },
      { label: 'Service Status', href: '/status' }, { label: 'Help Centre', href: '/dashboard/help-centre' },
      { label: 'JA Group Services Ltd', href: 'https://jagroupservices.co.uk', external: true },
    ]},
    { heading: 'Legal', links: [
      { label: 'Terms of Service', href: '/legal/terms' }, { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Cookie Policy', href: '/legal/cookies' }, { label: 'Acceptable Use', href: '/legal/acceptable-use' },
      { label: 'Refund Policy', href: '/legal/refunds' }, { label: 'Complaints Policy', href: '/legal/complaints' },
      { label: 'Reporting Policy', href: '/legal/reporting' }, { label: 'Security Policy', href: '/legal/security' },
      { label: 'Accessibility', href: '/legal/accessibility' }, { label: 'Eligibility Policy', href: '/legal/eligibility' },
      { label: 'Data Retention', href: '/legal/data-retention' }, { label: 'Data Subject Rights', href: '/legal/data-rights' },
    ]},
  ];
  const [footerColumns, setFooterColumns] = useState<FooterColumn[]>(DEFAULT_FOOTER_COLUMNS);
  const [footerLinksSaveStatus, setFooterLinksSaveStatus] = useState<SaveStatus>('idle');
  const [expandedCol, setExpandedCol] = useState<number | null>(null);

  // Notification test
  type TestNotifType = 'signup' | 'message' | 'support' | 'plan_change';
  const [testNotifType, setTestNotifType] = useState<TestNotifType>('signup');
  const [testNotifStatus, setTestNotifStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testNotifMsg, setTestNotifMsg] = useState('');

  // Email status state
  type DnsStatus = 'pass' | 'fail' | 'none' | 'pending' | 'error';
  interface DnsRecord { type: string; name: string; ionosSubdomain?: string; value: string; ttl: number; purpose: string; status: DnsStatus; note?: string; }
  interface EmailStatusData {
    domain: string; fromAddress: string; replyToAddress: string; dkimSelector: string;
    spf: { status: DnsStatus; record: string | null; detail: string };
    dkim: { status: DnsStatus; record: string | null; detail: string; dnsName: string };
    dmarc: { status: DnsStatus; record: string | null; detail: string; policy: string | null };
    requiredRecords: DnsRecord[];
    overallStatus: 'healthy' | 'action_required' | 'degraded';
    deliverabilityTips: string[];
    dkimKeyInstructions?: { summary: string; steps: string[] };
  }
  const [emailStatus, setEmailStatus] = useState<EmailStatusData | null>(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);
  const [emailStatusCheckedAt, setEmailStatusCheckedAt] = useState<string | null>(null);
  const [emailStatusError, setEmailStatusError] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testEmailMsg, setTestEmailMsg] = useState('');
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Admin PIN management ───────────────────────────────────────────────────
  const [pinHasPin, setPinHasPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinNewPin, setPinNewPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pinShowNew, setPinShowNew] = useState(false);

  const loadPinStatus = async () => {
    try {
      const res = await fetch('/api/admin/pin/status', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setPinHasPin(d.hasPin);
    } catch { /* ignore */ }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinNewPin.length < 4) { setPinMsg({ type: 'error', text: 'PIN must be at least 4 digits.' }); return; }
    if (pinNewPin !== pinConfirm) { setPinMsg({ type: 'error', text: 'PINs do not match.' }); return; }
    setPinLoading(true); setPinMsg(null);
    try {
      const res = await fetch('/api/admin/pin/set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ pin: pinNewPin, currentPin: pinHasPin ? pinCurrent : undefined }),
      });
      const d = await res.json();
      if (d.success) {
        setPinMsg({ type: 'success', text: d.message });
        setPinHasPin(true); setPinNewPin(''); setPinConfirm(''); setPinCurrent('');
      } else {
        setPinMsg({ type: 'error', text: d.error || 'Failed to set PIN.' });
      }
    } catch { setPinMsg({ type: 'error', text: 'Network error.' }); }
    setPinLoading(false);
  };

  const handleRemovePin = async () => {
    if (!pinCurrent) { setPinMsg({ type: 'error', text: 'Enter your current PIN to remove it.' }); return; }
    if (!confirm('Remove your admin PIN? You will not be prompted for a PIN on next login.')) return;
    setPinLoading(true); setPinMsg(null);
    try {
      const res = await fetch('/api/admin/pin/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ currentPin: pinCurrent }),
      });
      const d = await res.json();
      if (d.success) {
        setPinMsg({ type: 'success', text: 'PIN removed.' });
        setPinHasPin(false); setPinCurrent('');
      } else {
        setPinMsg({ type: 'error', text: d.error || 'Failed to remove PIN.' });
      }
    } catch { setPinMsg({ type: 'error', text: 'Network error.' }); }
    setPinLoading(false);
  };

  // ── Plans management (inline in settings) ─────────────────────────────────
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansSaving, setPlansSaving] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editPlanData, setEditPlanData] = useState<Partial<AdminPlan>>({});
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', slug: '', price_monthly: '', price_yearly: '', max_profiles: '1', max_links: '5', max_seats: '1', is_public: false, stripe_price_monthly: '', stripe_price_yearly: '' });
  const [creatingPlan, setCreatingPlan] = useState(false);

  // ── Assign plan to user ────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignStatus, setAssignStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [assignMsg, setAssignMsg] = useState('');

  const loadPlans = () => {
    setPlansLoading(true);
    fetch('/api/admin/plans', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.data); })
      .finally(() => setPlansLoading(false));
  };

  const loadUsers = () => {
    setUsersLoading(true);
    fetch('/api/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data); })
      .finally(() => setUsersLoading(false));
  };

  const togglePlanPublic = async (plan: AdminPlan) => {
    const res = await fetch(`/api/admin/plans/${plan.id}/toggle-public`, { method: 'PUT', credentials: 'include' });
    const d = await res.json();
    if (d.success) setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, is_public: d.is_public } : p));
  };

  const togglePlanActive = async (plan: AdminPlan) => {
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: plan.is_active ? 0 : 1 }),
    });
    const d = await res.json();
    if (d.success) setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, is_active: d.data.is_active } : p));
  };

  const savePlanEdit = async (id: number) => {
    setPlansSaving(true);
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPlanData),
    });
    const d = await res.json();
    if (d.success) { setPlans(ps => ps.map(p => p.id === id ? d.data : p)); setEditingPlanId(null); }
    else setPlansError(d.error || 'Save failed');
    setPlansSaving(false);
  };

  const deletePlan = async (plan: AdminPlan) => {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE', credentials: 'include' });
    const d = await res.json();
    if (d.success) setPlans(ps => ps.filter(p => p.id !== plan.id));
    else setPlansError(d.error || 'Delete failed');
  };

  const createPlan = async () => {
    if (!newPlan.name || !newPlan.slug) { setPlansError('Name and slug are required'); return; }
    setCreatingPlan(true);
    const res = await fetch('/api/admin/plans', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newPlan,
        price_monthly: parseFloat(newPlan.price_monthly) || 0,
        price_yearly: parseFloat(newPlan.price_yearly) || 0,
        max_profiles: parseInt(newPlan.max_profiles) || 1,
        max_links: parseInt(newPlan.max_links) || 5,
        max_seats: parseInt(newPlan.max_seats) || 1,
        is_public: newPlan.is_public ? 1 : 0,
      }),
    });
    const d = await res.json();
    if (d.success) { setPlans(ps => [...ps, d.data]); setShowCreatePlan(false); setNewPlan({ name: '', slug: '', price_monthly: '', price_yearly: '', max_profiles: '1', max_links: '5', max_seats: '1', is_public: false, stripe_price_monthly: '', stripe_price_yearly: '' }); }
    else setPlansError(d.error || 'Create failed');
    setCreatingPlan(false);
  };

  const assignPlan = async () => {
    if (!assignUserId) { setAssignMsg('Select a user'); setAssignStatus('error'); return; }
    setAssignStatus('saving');
    const res = await fetch(`/api/admin/users/${assignUserId}/assign-plan`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: (assignPlanId && assignPlanId !== '__none__') ? parseInt(assignPlanId) : null, note: assignNote }),
    });
    const d = await res.json();
    if (d.success) {
      setAssignStatus('saved');
      setAssignMsg('Plan assigned successfully');
      setUsers(us => us.map(u => u.id === parseInt(assignUserId) ? { ...u, plan_id: (assignPlanId && assignPlanId !== '__none__') ? parseInt(assignPlanId) : null, plan_name: (assignPlanId && assignPlanId !== '__none__') ? plans.find(p => p.id === parseInt(assignPlanId))?.name ?? null : null } : u));
      setTimeout(() => { setAssignStatus('idle'); setAssignMsg(''); }, 3000);
    } else {
      setAssignStatus('error');
      setAssignMsg(d.error || 'Failed to assign plan');
    }
  };

  // ── Site Status ───────────────────────────────────────────────────────────
  type SiteStatusValue = 'normal' | 'coming_soon' | 'maintenance';
  const [siteStatus, setSiteStatusState] = useState<SiteStatusValue>('normal');
  const [siteStatusLoading, setSiteStatusLoading] = useState(false);
  const [siteStatusSaving, setSiteStatusSaving] = useState(false);
  const [siteStatusSaved, setSiteStatusSaved] = useState(false);
  const [siteStatusError, setSiteStatusError] = useState('');

  // ── Coming Soon Countdown ─────────────────────────────────────────────────
  const [csLaunchDate, setCsLaunchDate] = useState('');
  const [csHeadline, setCsHeadline] = useState('Coming Soon');
  const [csSubtext, setCsSubtext] = useState('We are putting the finishing touches on something great.');
  const [csSaving, setCsSaving] = useState(false);
  const [csSaved, setCsSaved] = useState(false);
  const [csError, setCsError] = useState('');

  const loadComingSoonConfig = () => {
    fetch('/api/coming-soon-config')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCsLaunchDate(d.launchDate ? new Date(d.launchDate).toISOString().slice(0, 16) : '');
          setCsHeadline(d.headline || 'Coming Soon');
          setCsSubtext(d.subtext || '');
        }
      })
      .catch(() => {});
  };

  const saveComingSoonConfig = async () => {
    setCsSaving(true);
    setCsError('');
    try {
      const launchDateIso = csLaunchDate ? new Date(csLaunchDate).toISOString() : '';
      const res = await fetch('/api/admin/coming-soon', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchDate: launchDateIso, headline: csHeadline, subtext: csSubtext }),
      });
      const d = await res.json();
      if (d.success) {
        setCsSaved(true);
        setTimeout(() => setCsSaved(false), 3000);
      } else {
        setCsError(d.error || 'Failed to save');
      }
    } catch {
      setCsError('Network error');
    }
    setCsSaving(false);
  };

  const loadSiteStatus = () => {
    setSiteStatusLoading(true);
    fetch('/api/site-status')
      .then(r => r.json())
      .then(d => { if (d.success) setSiteStatusState(d.status); })
      .finally(() => setSiteStatusLoading(false));
    loadComingSoonConfig();
  };

  const saveSiteStatus = async () => {
    setSiteStatusSaving(true);
    setSiteStatusError('');
    try {
      const res = await fetch('/api/site-status', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: siteStatus }),
      });
      const d = await res.json();
      if (d.success) {
        setSiteStatusSaved(true);
        setTimeout(() => setSiteStatusSaved(false), 3000);
      } else {
        setSiteStatusError(d.error || 'Failed to save');
      }
    } catch {
      setSiteStatusError('Network error');
    }
    setSiteStatusSaving(false);
  };

  const sendTestNotification = async () => {
    setTestNotifStatus('sending');
    setTestNotifMsg('');
    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: testNotifType }),
      });
      const data = await res.json();
      if (data.success) {
        setTestNotifStatus('sent');
        setTestNotifMsg(data.message);
      } else {
        setTestNotifStatus('error');
        setTestNotifMsg(data.error || 'Failed to send test notification.');
      }
    } catch {
      setTestNotifStatus('error');
      setTestNotifMsg('Network error. Check the server logs.');
    }
    setTimeout(() => setTestNotifStatus('idle'), 8000);
  };

  const loadEmailStatus = async (forceRefresh = false) => {
    setEmailStatusLoading(true);
    setEmailStatusError('');
    try {
      const url = `/api/admin/email/status${forceRefresh ? '?refresh=1' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setEmailStatus(data.data as EmailStatusData);
        setEmailStatusCheckedAt(data.checkedAt);
      } else {
        setEmailStatusError(data.error || 'Failed to load email status.');
      }
    } catch {
      setEmailStatusError('Network error. Could not load email authentication status.');
    } finally {
      setEmailStatusLoading(false);
    }
  };

  const sendTestEmailFn = async () => {
    setTestEmailStatus('sending');
    setTestEmailMsg('');
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmailAddr.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailStatus('sent');
        setTestEmailMsg(data.message);
      } else {
        setTestEmailStatus('error');
        setTestEmailMsg(data.error || 'Failed to send test email.');
      }
    } catch {
      setTestEmailStatus('error');
      setTestEmailMsg('Network error. Check the server logs.');
    }
    setTimeout(() => setTestEmailStatus('idle'), 10000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const loadProducts = () => {
    setProductsLoading(true);
    fetch('/api/admin/stripe/products', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setProducts(d.data); })
      .finally(() => setProductsLoading(false));
  };

  const syncProducts = async () => {
    setSyncing(true);
    setSyncError('');
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/stripe/sync-products', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.synced);
        loadProducts();
      } else {
        setSyncError(data.error || 'Sync failed');
      }
    } catch {
      setSyncError('Network error during sync');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/stripe/config', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/theme', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/branding', { credentials: 'include' }).then(r => r.json()),
    ]).then(([settingsData, stripeData, themeData, brandingData]) => {
      if (settingsData.success) setSettings({ ...defaultSettings, ...settingsData.data });
      if (stripeData.success) setStripe(s => ({ ...s, ...stripeData.data }));
      if (themeData.success) setTheme(t => ({ ...t, ...themeData.data }));
      if (brandingData.success) {
        setBranding(b => ({ ...b, platform_logo_url: brandingData.data.platform_logo_url ?? '', platform_favicon_url: brandingData.data.platform_favicon_url ?? '' }));
        if (brandingData.data.footer_links) {
          try {
            const parsed = JSON.parse(brandingData.data.footer_links);
            if (Array.isArray(parsed) && parsed.length > 0) setFooterColumns(parsed);
          } catch { /* keep defaults */ }
        }
      }
      setLoading(false);
      setStripeLoading(false);
    });
    loadSiteStatus();
  }, []);

  const set = (key: keyof Settings, value: string) => setSettings(s => ({ ...s, [key]: value }));
  const toggle = (key: keyof Settings) => setSettings(s => ({ ...s, [key]: s[key] === '1' ? '0' : '1' }));
  const setS = (key: keyof StripeConfig, value: string) => setStripe(s => ({ ...s, [key]: value }));
  const setT = (key: keyof ThemeConfig, value: string) => setTheme(t => ({ ...t, [key]: value }));

  const save = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(settings),
      });
      const data = await res.json();
      setSaveStatus(data.success ? 'saved' : 'error');
      if (data.success) setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); }
  };

  const saveStripe = async () => {
    setStripeSaveStatus('saving');
    try {
      const payload: Record<string, string> = {
        stripe_publishable_key: stripe.stripe_publishable_key,
        stripe_webhook_secret: stripe.stripe_webhook_secret,
        stripe_mode: stripe.stripe_mode,
        // stripe_secret_key is intentionally excluded — must be set via developer software settings only
      };
      const res = await fetch('/api/admin/stripe/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(payload),
      });
      const data = await res.json();
      setStripeSaveStatus(data.success ? 'saved' : 'error');
      if (data.success) {
        setTimeout(() => setStripeSaveStatus('idle'), 3000);
        setReplacingWebhookSecret(false);
        // Re-fetch to get masked key status
        const fresh = await fetch('/api/admin/stripe/config', { credentials: 'include' }).then(r => r.json());
        if (fresh.success) setStripe(s => ({ ...s, ...fresh.data, stripe_secret_key: '' }));
      }
    } catch { setStripeSaveStatus('error'); }
  };

  const saveTheme = async () => {
    setThemeSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(theme),
      });
      const data = await res.json();
      setThemeSaveStatus(data.success ? 'saved' : 'error');
      if (data.success) {
        applyThemeSettings(theme);
        setTimeout(() => setThemeSaveStatus('idle'), 3000);
      }
    } catch { setThemeSaveStatus('error'); }
  };

  const saveBranding = async () => {
    setBrandingSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/branding', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(branding),
      });
      const data = await res.json();
      setBrandingSaveStatus(data.success ? 'saved' : 'error');
      if (data.success) setTimeout(() => setBrandingSaveStatus('idle'), 3000);
    } catch { setBrandingSaveStatus('error'); }
  };

  const saveFooterLinks = async () => {
    setFooterLinksSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/branding', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ footer_links: JSON.stringify(footerColumns) }),
      });
      const data = await res.json();
      setFooterLinksSaveStatus(data.success ? 'saved' : 'error');
      if (data.success) setTimeout(() => setFooterLinksSaveStatus('idle'), 3000);
    } catch { setFooterLinksSaveStatus('error'); }
  };

  const uploadImage = async (file: File, slot: string, onUrl: (url: string) => void, setUploading: (v: boolean) => void) => {
    setUploading(true);
    try {
      const res = await fetch(`/api/admin/upload-image?slot=${slot}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const data = await res.json();
      if (data.success) onUrl(data.url);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const SaveBtn = ({ status, onClick }: { status: SaveStatus; onClick: () => void }) => (
    <Button onClick={onClick} disabled={status === 'saving'} className="bg-primary hover:bg-primary/90 gap-2">
      {status === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        : status === 'saved' ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
        : status === 'error' ? <><AlertCircle className="w-4 h-4" /> Error</>
        : <><Save className="w-4 h-4" /> Save Changes</>}
    </Button>
  );

  if (loading || stripeLoading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-muted/30 animate-pulse" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <Helmet>
        <title>System Settings — Admin Portal</title>
        <meta name="description" content="Configure platform-wide settings, Stripe, branding and compliance." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/settings" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Page header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground mt-0.5">Configure platform-wide settings, Stripe, branding and compliance</p>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-muted/60 mb-6 flex-wrap h-auto gap-1 p-1 rounded-2xl border border-border">
          <TabsTrigger value="general" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> General</span>
          </TabsTrigger>
          <TabsTrigger value="stripe" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Stripe
              {stripe.stripe_publishable_key ? (
                <Badge className={`text-xs border-0 ml-1 ${stripe.stripe_mode === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {stripe.stripe_mode === 'live' ? 'Live' : 'Test'}
                </Badge>
              ) : (
                <Badge className="text-xs border-0 ml-1 bg-muted text-muted-foreground">Not set</Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="products" onClick={loadProducts} className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Products</span>
          </TabsTrigger>
          <TabsTrigger value="plans" onClick={() => { loadPlans(); loadUsers(); }} className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Plans</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Email</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="site-status" onClick={loadSiteStatus} className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Site Status
              {siteStatus !== 'normal' && (
                <Badge className={`text-xs border-0 ml-1 ${siteStatus === 'coming_soon' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                  {siteStatus === 'coming_soon' ? 'Coming Soon' : 'Maintenance'}
                </Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Troubleshooting</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Manual</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="rounded-xl text-xs sm:text-sm">
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Backup</span>
          </TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="space-y-6">
          <div className="flex justify-end"><SaveBtn status={saveStatus} onClick={save} /></div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> General
              </CardTitle>
              <CardDescription>Basic platform identity and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Platform Name</Label>
                  <Input value={settings.site_name} onChange={e => set('site_name', e.target.value)} className="bg-background border-border" />
                  <p className="text-xs text-muted-foreground">Internal admin label</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Platform URL</Label>
                  <Input value={settings.site_url} onChange={e => set('site_url', e.target.value)} className="bg-background border-border" placeholder="https://…" />
                  <p className="text-xs text-muted-foreground">Internal admin reference</p>
                </div>
              </div>

              {/* ── Site-wide branding (used by header, footer, emails, PDFs) ── */}
              <div className="pt-2 border-t border-border space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Site-wide Branding</p>
                <p className="text-xs text-muted-foreground">These values appear in the header, footer, emails, QR codes, and PDF posters across the entire site.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Brand Name (site-wide)</Label>
                  <Input value={settings.platform_name} onChange={e => set('platform_name', e.target.value)} className="bg-background border-border" placeholder="Sousa Murray Profiles" />
                  <p className="text-xs text-muted-foreground">Shown in header, footer, emails, and browser tabs</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Live Site URL (site-wide)</Label>
                  <Input value={settings.platform_url} onChange={e => set('platform_url', e.target.value)} className="bg-background border-border" placeholder="https://…" />
                  <p className="text-xs text-muted-foreground">Used in QR codes, PDF posters, and email links — must be your live domain</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">Tagline</Label>
                  <Input value={settings.platform_tagline} onChange={e => set('platform_tagline', e.target.value)} className="bg-background border-border" placeholder="Your digital business card, reimagined." />
                  <p className="text-xs text-muted-foreground">Short strapline shown in SEO meta and some page headers</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">Footer Description</Label>
                  <Textarea value={settings.platform_description} onChange={e => set('platform_description', e.target.value)} className="bg-background border-border text-sm resize-none" rows={2} placeholder="A professional digital profile service…" />
                  <p className="text-xs text-muted-foreground">Shown in the footer brand column on every page</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Footer Tagline</Label>
                  <Input value={settings.footer_tagline} onChange={e => set('footer_tagline', e.target.value)} className="bg-background border-border" placeholder="Part of JA Group Services Ltd" />
                  <p className="text-xs text-muted-foreground">Appears in the footer copyright line, e.g. "Part of JA Group Services Ltd"</p>
                </div>
              </div>

              {/* ── Footer Navigation Columns ── */}
              <div className="pt-2 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Footer Navigation</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Edit the link columns shown in the site footer. Drag to reorder links within each column.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setFooterColumns(DEFAULT_FOOTER_COLUMNS)}
                    >
                      <RotateCcw className="w-3 h-3" /> Reset defaults
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-primary"
                      onClick={saveFooterLinks}
                      disabled={footerLinksSaveStatus === 'saving'}
                    >
                      {footerLinksSaveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                       footerLinksSaveStatus === 'saved' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> :
                       <Save className="w-3 h-3" />}
                      {footerLinksSaveStatus === 'saved' ? 'Saved' : 'Save links'}
                    </Button>
                  </div>
                </div>

                {/* Add column */}
                <div className="flex justify-end">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => {
                      setFooterColumns(cols => [...cols, { heading: 'New Column', links: [] }]);
                      setExpandedCol(footerColumns.length);
                    }}
                  >
                    <Plus className="w-3 h-3" /> Add column
                  </Button>
                </div>

                <div className="space-y-2">
                  {footerColumns.map((col, ci) => (
                    <div key={ci} className="rounded-xl border border-border overflow-hidden">
                      {/* Column header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                        <button
                          className="flex-1 flex items-center gap-2 text-left"
                          onClick={() => setExpandedCol(expandedCol === ci ? null : ci)}
                        >
                          {expandedCol === ci
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          <span className="text-sm font-medium text-foreground">{col.heading}</span>
                          <span className="text-xs text-muted-foreground">({col.links.length} links)</span>
                        </button>
                        {/* Move column left/right */}
                        <button
                          disabled={ci === 0}
                          onClick={() => setFooterColumns(cols => { const c = [...cols]; [c[ci-1], c[ci]] = [c[ci], c[ci-1]]; return c; })}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                          title="Move left"
                        >
                          <ChevronDown className="w-3.5 h-3.5 rotate-90 text-muted-foreground" />
                        </button>
                        <button
                          disabled={ci === footerColumns.length - 1}
                          onClick={() => setFooterColumns(cols => { const c = [...cols]; [c[ci], c[ci+1]] = [c[ci+1], c[ci]]; return c; })}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                          title="Move right"
                        >
                          <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setFooterColumns(cols => cols.filter((_, i) => i !== ci))}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          title="Delete column"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {expandedCol === ci && (
                        <div className="px-3 py-3 space-y-3">
                          {/* Column heading */}
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground w-16 flex-shrink-0">Heading</Label>
                            <Input
                              value={col.heading}
                              onChange={e => setFooterColumns(cols => cols.map((c, i) => i === ci ? { ...c, heading: e.target.value } : c))}
                              className="h-7 text-xs bg-background border-border"
                            />
                          </div>

                          {/* Links */}
                          <div className="space-y-1.5">
                            {col.links.map((link, li) => (
                              <div key={li} className="flex items-center gap-1.5">
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  <button
                                    disabled={li === 0}
                                    onClick={() => setFooterColumns(cols => cols.map((c, i) => i !== ci ? c : { ...c, links: c.links.map((l, j) => j === li - 1 ? c.links[li] : j === li ? c.links[li-1] : l) }))}
                                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                                    title="Move up"
                                  ><ChevronDown className="w-3 h-3 rotate-180 text-muted-foreground" /></button>
                                  <button
                                    disabled={li === col.links.length - 1}
                                    onClick={() => setFooterColumns(cols => cols.map((c, i) => i !== ci ? c : { ...c, links: c.links.map((l, j) => j === li ? c.links[li+1] : j === li + 1 ? c.links[li] : l) }))}
                                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                                    title="Move down"
                                  ><ChevronDown className="w-3 h-3 text-muted-foreground" /></button>
                                </div>
                                <Input
                                  value={link.label}
                                  onChange={e => setFooterColumns(cols => cols.map((c, i) => i !== ci ? c : { ...c, links: c.links.map((l, j) => j === li ? { ...l, label: e.target.value } : l) }))}
                                  placeholder="Label"
                                  className="h-7 text-xs bg-background border-border flex-1"
                                />
                                <Input
                                  value={link.href}
                                  onChange={e => setFooterColumns(cols => cols.map((c, i) => i !== ci ? c : { ...c, links: c.links.map((l, j) => j === li ? { ...l, href: e.target.value } : l) }))}
                                  placeholder="/path or https://…"
                                  className="h-7 text-xs bg-background border-border flex-1"
                                />
                                <button
                                  onClick={() => setFooterColumns(cols => cols.map((c, i) => i !== ci ? c : { ...c, links: c.links.filter((_, j) => j !== li) }))}
                                  className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                                  title="Remove link"
                                ><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                          </div>

                          {/* Add link */}
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs gap-1 w-full"
                            onClick={() => setFooterColumns(cols => cols.map((c, i) => i !== ci ? c : { ...c, links: [...c.links, { label: '', href: '' }] }))}
                          >
                            <Plus className="w-3 h-3" /> Add link
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Support Email</Label>
                  <Input value={settings.support_email} onChange={e => set('support_email', e.target.value)} className="bg-background border-border" type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Contact Email</Label>
                  <Input value={settings.contact_email} onChange={e => set('contact_email', e.target.value)} className="bg-background border-border" type="email" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Registration & Limits
              </CardTitle>
              <CardDescription>Control who can register and default free-tier limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Allow New Registrations</p>
                  <p className="text-xs text-muted-foreground mt-0.5">New users can sign up via the customer portal</p>
                </div>
                <Switch checked={settings.allow_registration === '1'} onCheckedChange={() => toggle('allow_registration')} />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Require Email Verification</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Users must verify their email before accessing the dashboard</p>
                </div>
                <Switch checked={settings.require_email_verification === '1'} onCheckedChange={() => toggle('require_email_verification')} />
              </div>
              <Separator className="bg-border" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Free Plan — Max Profiles</Label>
                  <Input value={settings.max_free_profiles} onChange={e => set('max_free_profiles', e.target.value)} type="number" min="1" className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Free Plan — Max Links per Profile</Label>
                  <Input value={settings.max_free_links} onChange={e => set('max_free_links', e.target.value)} type="number" min="1" className="bg-background border-border" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Maintenance Mode
              </CardTitle>
              <CardDescription>Take the platform offline for maintenance with a custom message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Maintenance Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All users except admins will see the maintenance message</p>
                </div>
                <Switch checked={settings.maintenance_mode === '1'} onCheckedChange={() => toggle('maintenance_mode')} />
              </div>
              {settings.maintenance_mode === '1' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Maintenance Message</Label>
                  <Textarea value={settings.maintenance_message} onChange={e => set('maintenance_message', e.target.value)}
                    className="bg-background border-border resize-none" rows={3} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Feature Flags
              </CardTitle>
              <CardDescription>Enable or disable optional features for all users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Email Signature Generator</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow users to create and download professional email signatures</p>
                </div>
                <Switch checked={settings.feature_email_signature === '1'} onCheckedChange={() => toggle('feature_email_signature')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stripe" className="space-y-6">
          <div className="flex justify-end"><SaveBtn status={stripeSaveStatus} onClick={saveStripe} /></div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Stripe API Keys
              </CardTitle>
              <CardDescription>
                Keys are stored securely in the database. Find them in your{' '}
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2">Stripe Dashboard → API Keys</a>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Mode toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Live Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stripe.stripe_mode === 'live'
                      ? 'Real payments are being processed'
                      : 'Test mode — no real charges'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`border-0 ${stripe.stripe_mode === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {stripe.stripe_mode === 'live' ? 'Live' : 'Test'}
                  </Badge>
                  <Switch
                    checked={stripe.stripe_mode === 'live'}
                    onCheckedChange={v => setS('stripe_mode', v ? 'live' : 'test')}
                  />
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Publishable key */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Publishable Key <span className="text-muted-foreground/60">(pk_test_… or pk_live_…)</span>
                </Label>
                <Input
                  value={stripe.stripe_publishable_key}
                  onChange={e => setS('stripe_publishable_key', e.target.value)}
                  placeholder="pk_test_…"
                  className="bg-background border-border font-mono text-sm"
                />
              </div>

              {/* Secret key — read-only status; must be set via developer software, not here */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Secret Key <span className="text-muted-foreground/60">(sk_test_… or sk_live_…)</span>
                </Label>
                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/10 flex items-start gap-3">
                  <Lock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-400">Secret key cannot be set here</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The Stripe secret key must be configured in your <strong className="text-foreground">developer software</strong> (Settings → Secrets). This prevents it from being stored in the database or exposed in the admin portal.
                    </p>
                    {stripe.stripe_secret_key_masked ? (
                      <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1.5">
                        <Check className="w-3 h-3" /> Secret key is configured: <span className="font-mono">{stripe.stripe_secret_key_masked}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 mt-1.5">No secret key detected — add <code className="bg-muted px-1 rounded text-xs">STRIPE_SECRET_KEY</code> via your developer software settings.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Webhook secret */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Webhook Signing Secret <span className="text-muted-foreground/60">(whsec_…)</span>
                </Label>
                {stripe.stripe_webhook_secret && !replacingWebhookSecret ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                      <span className="font-mono text-sm text-muted-foreground flex-1">whsec_••••••••••••••••</span>
                      <Badge className="bg-green-500/10 text-green-400 border-0 text-xs">Configured</Badge>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="border-border flex-shrink-0"
                      onClick={() => { setReplacingWebhookSecret(true); setS('stripe_webhook_secret', ''); }}>
                      Replace
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <Input
                        type={showWebhookSecret ? 'text' : 'password'}
                        value={stripe.stripe_webhook_secret}
                        onChange={e => setS('stripe_webhook_secret', e.target.value)}
                        placeholder="whsec_…"
                        className="bg-background border-border font-mono text-sm pr-10"
                        autoFocus={replacingWebhookSecret}
                      />
                      <button type="button" onClick={() => setShowWebhookSecret(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {replacingWebhookSecret && (
                      <button type="button" onClick={() => { setReplacingWebhookSecret(false); setS('stripe_webhook_secret', ''); }}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        ← Cancel replacement
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Set your webhook endpoint to <code className="bg-muted px-1 py-0.5 rounded text-xs">/api/stripe/webhook</code> in the Stripe Dashboard
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Connection status */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Integration Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Publishable Key', ok: !!stripe.stripe_publishable_key },
                { label: 'Secret Key', ok: !!(stripe.stripe_secret_key || stripe.stripe_secret_key_masked) },
                { label: 'Webhook Secret', ok: !!stripe.stripe_webhook_secret },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <Badge className={`border-0 text-xs ${item.ok ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {item.ok ? '✓ Configured' : 'Not set'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Stripe Products ── */}
        <TabsContent value="products" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" /> Stripe Products & Prices
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Sync products and prices from your Stripe account. Use these IDs when configuring plan Stripe price IDs.
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" className="border-border gap-1.5" onClick={loadProducts} disabled={productsLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${productsLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5" onClick={syncProducts} disabled={syncing || !stripe.stripe_publishable_key}>
                    <Zap className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing…' : 'Sync from Stripe'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!stripe.stripe_publishable_key && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-4">
                  Configure your Stripe keys in the <strong>Stripe</strong> tab first, then sync products.
                </div>
              )}
              {syncError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">{syncError}</div>
              )}
              {syncResult && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-4">
                  Synced {syncResult.products} product{syncResult.products !== 1 ? 's' : ''} and {syncResult.prices} price{syncResult.prices !== 1 ? 's' : ''} from Stripe.
                </div>
              )}

              {productsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">No products synced yet.</p>
                  <p className="text-muted-foreground text-xs mt-1">Click "Sync from Stripe" to import your products.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map(p => (
                    <div key={p.id} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{p.name}</span>
                            <Badge className={`text-xs border-0 ${p.active ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                              {p.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                          <code className="text-xs text-muted-foreground font-mono mt-1 block">{p.id}</code>
                        </div>
                        <a
                          href={`https://dashboard.stripe.com/products/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {p.prices.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Prices</p>
                          {p.prices.map(pr => (
                            <div key={pr.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-muted-foreground">{pr.id}</code>
                                <Badge className="text-xs border-0 bg-muted text-muted-foreground">
                                  {pr.recurring_interval ? `${pr.recurring_interval}ly` : 'one-time'}
                                </Badge>
                              </div>
                              <span className="text-foreground font-medium">
                                {pr.unit_amount != null
                                  ? `${(pr.unit_amount / 100).toFixed(2)} ${pr.currency?.toUpperCase()}`
                                  : 'Custom'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Last synced: {new Date(p.synced_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Plans ── */}
        <TabsContent value="plans" className="space-y-6">
          {/* Plan list */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" /> Plan Management
                  </CardTitle>
                  <CardDescription>Create, edit, and control visibility of subscription plans. Only plans marked Public appear on the pricing page.</CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" className="border-border gap-1.5" onClick={loadPlans} disabled={plansLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${plansLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5" onClick={() => setShowCreatePlan(v => !v)}>
                    <Plus className="w-3.5 h-3.5" /> {showCreatePlan ? 'Cancel' : 'New Plan'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {plansError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{plansError}</div>
              )}

              {/* Create plan form */}
              {showCreatePlan && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">New Plan</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Plan Name *</Label>
                      <Input value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Professional" className="bg-background border-border h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Slug * (URL-safe)</Label>
                      <Input value={newPlan.slug} onChange={e => setNewPlan(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="e.g. professional" className="bg-background border-border h-8 text-sm font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Monthly Price (£)</Label>
                      <Input type="number" value={newPlan.price_monthly} onChange={e => setNewPlan(p => ({ ...p, price_monthly: e.target.value }))} placeholder="0.00" className="bg-background border-border h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Yearly Price (£)</Label>
                      <Input type="number" value={newPlan.price_yearly} onChange={e => setNewPlan(p => ({ ...p, price_yearly: e.target.value }))} placeholder="0.00" className="bg-background border-border h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Max Profiles</Label>
                      <Input type="number" value={newPlan.max_profiles} onChange={e => setNewPlan(p => ({ ...p, max_profiles: e.target.value }))} className="bg-background border-border h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Max Links</Label>
                      <Input type="number" value={newPlan.max_links} onChange={e => setNewPlan(p => ({ ...p, max_links: e.target.value }))} className="bg-background border-border h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Max Seats</Label>
                      <Input type="number" value={newPlan.max_seats} onChange={e => setNewPlan(p => ({ ...p, max_seats: e.target.value }))} className="bg-background border-border h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Stripe Monthly Price ID</Label>
                      <Input value={newPlan.stripe_price_monthly} onChange={e => setNewPlan(p => ({ ...p, stripe_price_monthly: e.target.value }))} placeholder="price_…" className="bg-background border-border h-8 text-sm font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Stripe Yearly Price ID</Label>
                      <Input value={newPlan.stripe_price_yearly} onChange={e => setNewPlan(p => ({ ...p, stripe_price_yearly: e.target.value }))} placeholder="price_…" className="bg-background border-border h-8 text-sm font-mono" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={newPlan.is_public} onCheckedChange={v => setNewPlan(p => ({ ...p, is_public: v }))} />
                      <span className="text-sm text-foreground">Show on public pricing page</span>
                    </div>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 gap-1.5" onClick={createPlan} disabled={creatingPlan}>
                      {creatingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Create Plan
                    </Button>
                  </div>
                </div>
              )}

              {/* Plan list */}
              {plansLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />)}</div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No plans yet. Create one above.</div>
              ) : (
                <div className="space-y-2">
                  {plans.map(plan => (
                    <div key={plan.id} className="rounded-xl border border-border bg-muted/10 p-3">
                      {editingPlanId === plan.id ? (
                        <div className="space-y-3">
                          <div className="grid sm:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <Input value={editPlanData.name ?? plan.name} onChange={e => setEditPlanData(d => ({ ...d, name: e.target.value }))} className="bg-background border-border h-7 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Monthly (£)</Label>
                              <Input type="number" value={editPlanData.price_monthly ?? plan.price_monthly} onChange={e => setEditPlanData(d => ({ ...d, price_monthly: parseFloat(e.target.value) }))} className="bg-background border-border h-7 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Yearly (£)</Label>
                              <Input type="number" value={editPlanData.price_yearly ?? plan.price_yearly} onChange={e => setEditPlanData(d => ({ ...d, price_yearly: parseFloat(e.target.value) }))} className="bg-background border-border h-7 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Stripe Monthly ID</Label>
                              <Input value={editPlanData.stripe_price_monthly ?? plan.stripe_price_monthly ?? ''} onChange={e => setEditPlanData(d => ({ ...d, stripe_price_monthly: e.target.value }))} placeholder="price_…" className="bg-background border-border h-7 text-xs font-mono" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Stripe Yearly ID</Label>
                              <Input value={editPlanData.stripe_price_yearly ?? plan.stripe_price_yearly ?? ''} onChange={e => setEditPlanData(d => ({ ...d, stripe_price_yearly: e.target.value }))} placeholder="price_…" className="bg-background border-border h-7 text-xs font-mono" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Stripe Product ID</Label>
                              <Input value={editPlanData.stripe_product_id ?? plan.stripe_product_id ?? ''} onChange={e => setEditPlanData(d => ({ ...d, stripe_product_id: e.target.value }))} placeholder="prod_…" className="bg-background border-border h-7 text-xs font-mono" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setEditingPlanId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                            <button onClick={() => savePlanEdit(plan.id)} disabled={plansSaving} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10">
                              {plansSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">{plan.slug}</span>
                              {plan.price_monthly === 0 ? (
                                <Badge className="bg-muted text-muted-foreground border-0 text-xs">Free</Badge>
                              ) : (
                                <Badge className="bg-blue-500/10 text-blue-400 border-0 text-xs">£{plan.price_monthly}/mo{plan.price_yearly > 0 ? ` · £${plan.price_yearly}/yr` : ''}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Public/Hidden toggle */}
                            <button
                              onClick={() => togglePlanPublic(plan)}
                              title={plan.is_public ? 'Visible on public pricing page — click to hide' : 'Hidden from public pricing page — click to publish'}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${plan.is_public ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                            >
                              {plan.is_public ? <Globe2 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              {plan.is_public ? 'Public' : 'Hidden'}
                            </button>
                            {/* Active toggle */}
                            <Switch checked={!!plan.is_active} onCheckedChange={() => togglePlanActive(plan)} />
                            <button onClick={() => { setEditingPlanId(plan.id); setEditPlanData({}); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deletePlan(plan)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assign plan to user */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Assign Plan to User
              </CardTitle>
              <CardDescription>Directly assign or change a plan for any user — bypasses Stripe billing. Use for manual upgrades, trials, or corrections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">User</Label>
                  <div className="flex gap-2">
                    <Select value={assignUserId} onValueChange={setAssignUserId}>
                      <SelectTrigger className="bg-background border-border flex-1">
                        <SelectValue placeholder="Select user…" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name || u.email} — {u.plan_name || 'No plan'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="border-border flex-shrink-0" onClick={loadUsers} disabled={usersLoading}>
                      <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Plan to assign</Label>
                  <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select plan… (or none to remove)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Remove plan (no plan) —</SelectItem>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} {p.price_monthly > 0 ? `— £${p.price_monthly}/mo` : '(Free)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Internal note (optional — logged in audit trail)</Label>
                <Input value={assignNote} onChange={e => setAssignNote(e.target.value)} placeholder="e.g. Manual upgrade for trial period" className="bg-background border-border" />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={assignPlan}
                  disabled={assignStatus === 'saving' || !assignUserId}
                  className="bg-primary hover:bg-primary/90 gap-2"
                  size="sm"
                >
                  {assignStatus === 'saving' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…</>
                    : assignStatus === 'saved' ? <><CheckCircle2 className="w-3.5 h-3.5" /> Assigned</>
                    : <><Users className="w-3.5 h-3.5" /> Assign Plan</>}
                </Button>
                {assignMsg && (
                  <span className={`text-sm ${assignStatus === 'saved' ? 'text-green-400' : 'text-destructive'}`}>{assignMsg}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Email ── */}
        <TabsContent value="email" className="space-y-6">

          {/* ── Email Deliverability / DNS Auth ── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Email Deliverability
                  </CardTitle>
                  <CardDescription className="mt-1">
                    DKIM, SPF and DMARC status for <span className="font-mono text-xs text-foreground">jagroupservices.co.uk</span>.
                    Add these DNS records to ensure emails land in the inbox, not spam.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => loadEmailStatus(true)}
                  disabled={emailStatusLoading}
                >
                  {emailStatusLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  {emailStatus ? 'Re-check DNS' : 'Check DNS'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Not yet loaded */}
              {!emailStatus && !emailStatusLoading && !emailStatusError && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <Mail className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Click <strong>Check DNS</strong> to run a live check of your email authentication records.</p>
                </div>
              )}

              {/* Loading */}
              {emailStatusLoading && (
                <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking DNS records…
                </div>
              )}

              {/* Error */}
              {emailStatusError && !emailStatusLoading && (
                <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{emailStatusError}</span>
                </div>
              )}

              {/* Results */}
              {emailStatus && !emailStatusLoading && (() => {
                const statusBadge = (s: string) => {
                  if (s === 'pass') return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Pass</span>;
                  if (s === 'pending') return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" />Pending</span>;
                  if (s === 'none') return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5"><AlertTriangle className="w-3 h-3" />Missing</span>;
                  if (s === 'fail') return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5"><AlertCircle className="w-3 h-3" />Fail</span>;
                  return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/40 border border-border rounded-full px-2 py-0.5"><AlertCircle className="w-3 h-3" />Error</span>;
                };

                return (
                  <>
                    {/* Overall status banner */}
                    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border text-sm font-medium ${
                      emailStatus.overallStatus === 'healthy'
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : emailStatus.overallStatus === 'action_required'
                        ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                    }`}>
                      {emailStatus.overallStatus === 'healthy'
                        ? <MailCheck className="w-4 h-4 shrink-0" />
                        : <MailX className="w-4 h-4 shrink-0" />}
                      <span>
                        {emailStatus.overallStatus === 'healthy' && 'All checks passing — emails should deliver reliably.'}
                        {emailStatus.overallStatus === 'action_required' && 'DNS records missing — emails may go to spam until fixed.'}
                        {emailStatus.overallStatus === 'degraded' && 'Some checks failing — deliverability may be affected.'}
                      </span>
                      {emailStatusCheckedAt && (
                        <span className="ml-auto text-xs font-normal opacity-70 shrink-0">
                          Checked {fmtTime(emailStatusCheckedAt)}
                        </span>
                      )}
                    </div>

                    {/* Three check rows */}
                    <div className="space-y-2">
                      {[
                        { label: 'SPF', detail: emailStatus.spf.detail, status: emailStatus.spf.status, record: emailStatus.spf.record },
                        { label: 'DKIM', detail: emailStatus.dkim.detail, status: emailStatus.dkim.status, record: emailStatus.dkim.record },
                        { label: 'DMARC', detail: emailStatus.dmarc.detail, status: emailStatus.dmarc.status, record: emailStatus.dmarc.record },
                      ].map(row => (
                        <div key={row.label} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                          <span className="text-xs font-mono font-bold text-foreground w-12 shrink-0 mt-0.5">{row.label}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">{row.detail}</p>
                            {row.record && (
                              <p className="text-xs font-mono text-foreground/60 mt-1 truncate">{row.record}</p>
                            )}
                          </div>
                          <div className="shrink-0">{statusBadge(row.status)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Deliverability tips */}
                    {emailStatus.deliverabilityTips.length > 0 && (
                      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 space-y-1.5">
                        <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Action required</p>
                        <ul className="space-y-1">
                          {emailStatus.deliverabilityTips.map((tip, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-orange-400 mt-0.5">•</span>{tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* DKIM key unavailable — prominent how-to banner */}
                    {(emailStatus as any).dkimKeyUnavailable && emailStatus.dkim.status !== 'pass' && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          How to get your DKIM public key and add it in IONOS
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Airo signs your outbound emails with its own private key (selector: <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">airo</code>). You need to add the matching public key to your IONOS DNS so receiving mail servers can verify the signature.
                        </p>
                        <ol className="space-y-2">
                          {[
                            <>
                              <span className="font-semibold text-foreground">Get the key from GoDaddy Airo:</span>{' '}
                              In GoDaddy Airo, go to <strong>Settings → Custom Domain</strong> for this app. Airo will show you the DNS records to add — including the DKIM TXT record with the full{' '}
                              <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">v=DKIM1; k=rsa; p=...</code> value. This key is unique to your app.
                            </>,
                            <>
                              <span className="font-semibold text-foreground">Log in to IONOS:</span>{' '}
                              Go to <strong>Domains &amp; SSL → jagroupservices.co.uk → DNS</strong> and click <strong>Add record → TXT</strong>.
                            </>,
                            <>
                              <span className="font-semibold text-foreground">Fill in the record:</span>{' '}
                              <br />
                              <span className="text-muted-foreground/70 text-[11px]">Subdomain:</span>{' '}
                              <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">airo._domainkey.japrofilestudio</code>
                              <br />
                              <span className="text-muted-foreground/70 text-[11px]">Value:</span>{' '}
                              <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">v=DKIM1; k=rsa; p=&lt;the key from Airo&gt;</code>
                              <br />
                              <span className="text-muted-foreground/70 text-[11px]">TTL:</span>{' '}
                              <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">3600</code>
                              <br />
                              <span className="text-muted-foreground/70">IONOS appends <code className="font-mono">.jagroupservices.co.uk</code> automatically — do not include it in the Subdomain field.</span>
                            </>,
                            <>
                              <span className="font-semibold text-foreground">Save and re-check:</span>{' '}
                              Click Re-check DNS above. DNS propagation on IONOS is usually a few minutes but can take up to 48 hours.
                            </>,
                          ].map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold mt-0.5">{idx + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* DNS records to add */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">DNS records — add in IONOS</p>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Zone: jagroupservices.co.uk</span>
                      </div>
                      <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400 space-y-1">
                        <p className="font-semibold">IONOS tip — Subdomain field only</p>
                        <p>IONOS appends <code className="font-mono">.jagroupservices.co.uk</code> automatically. Enter only the prefix shown in the "IONOS Subdomain" column below — not the full hostname.</p>
                      </div>
                      {emailStatus.requiredRecords.map((rec, i) => {
                        const isDkimRecord = rec.name.startsWith('airo._domainkey');
                        const keyUnavailable = isDkimRecord && (emailStatus as any).dkimKeyUnavailable;
                        return (
                          <div key={i} className={`rounded-xl border px-4 py-3 space-y-2 ${
                            rec.status === 'pass' ? 'border-green-500/20 bg-green-500/5' : 'border-border bg-muted/20'
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{rec.type}</span>
                                <span className="text-xs text-muted-foreground truncate">{rec.purpose}</span>
                              </div>
                              {statusBadge(rec.status)}
                            </div>

                            {/* IONOS subdomain field */}
                            {rec.ionosSubdomain && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">IONOS Subdomain field:</p>
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 text-xs font-mono text-foreground bg-background border border-border rounded-lg px-3 py-2 break-all">
                                    {rec.ionosSubdomain}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(rec.ionosSubdomain!, `sub-${i}`)}
                                    className="shrink-0 p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                                    title="Copy subdomain"
                                  >
                                    {copiedKey === `sub-${i}`
                                      ? <CheckCheck className="w-3.5 h-3.5 text-green-400" />
                                      : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Value */}
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Value:</p>
                              {keyUnavailable && rec.status !== 'pass' ? (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  <div className="text-xs text-amber-400 space-y-1">
                                    <p className="font-semibold">You need to look up the public key first</p>
                                    <p>Go to <a href="https://mxtoolbox.com/SuperTool.aspx" target="_blank" rel="noopener noreferrer" className="underline">MXToolbox TXT Lookup</a> → enter <code className="font-mono">airo._domainkey.airoapp.ai</code> → copy the <code className="font-mono">p=</code> value → add it as shown in the instructions above.</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <code className="flex-1 text-xs font-mono text-foreground/80 bg-background border border-border rounded-lg px-3 py-2 break-all leading-relaxed">
                                    {rec.value}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(rec.value, `rec-${i}`)}
                                    className="shrink-0 p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                                    title="Copy value"
                                  >
                                    {copiedKey === `rec-${i}`
                                      ? <CheckCheck className="w-3.5 h-3.5 text-green-400" />
                                      : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Full DNS name for verification */}
                            <p className="text-xs text-muted-foreground/60 font-mono">Full name (for MXToolbox verification): {rec.name}</p>

                            {rec.note && (
                              <details className="group">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" /> Notes &amp; instructions
                                </summary>
                                <pre className="mt-2 text-xs text-muted-foreground/70 whitespace-pre-wrap border-t border-border pt-2 font-sans leading-relaxed">{rec.note}</pre>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* ── Test Email ── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" /> Send Test Email
              </CardTitle>
              <CardDescription>
                Send a test email to verify the Airo gateway is delivering correctly. Check your inbox and spam folder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="recipient@example.com (leave blank to use admin email)"
                  value={testEmailAddr}
                  onChange={e => setTestEmailAddr(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  onClick={sendTestEmailFn}
                  disabled={testEmailStatus === 'sending'}
                  className="gap-1.5 shrink-0"
                >
                  {testEmailStatus === 'sending'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                    : <><Send className="w-3.5 h-3.5" /> Send</>}
                </Button>
              </div>
              {testEmailMsg && (
                <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm border ${
                  testEmailStatus === 'sent' || testEmailStatus === 'idle'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {testEmailStatus === 'error'
                    ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{testEmailMsg}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Stripe transactional note ── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Stripe Transactional Email
              </CardTitle>
              <CardDescription>
                Payment receipts, subscription confirmations and billing emails are sent directly by Stripe — no configuration needed here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2 text-sm text-muted-foreground">
                <ul className="list-disc list-inside space-y-1 text-xs pl-1">
                  <li>Payment receipts and invoices</li>
                  <li>Subscription created / updated / cancelled</li>
                  <li>Payment failed / card expiry reminders</li>
                  <li>Refund confirmations</li>
                </ul>
                <p className="text-xs mt-3">
                  To customise Stripe email branding, go to{' '}
                  <a href="https://dashboard.stripe.com/settings/branding" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Stripe Dashboard → Branding
                  </a>.
                </p>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Compliance ── */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="flex justify-end"><SaveBtn status={saveStatus} onClick={save} /></div>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Privacy & Compliance
              </CardTitle>
              <CardDescription>GDPR, cookie consent, and policy version tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">GDPR Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enforce GDPR-compliant data handling across the platform</p>
                </div>
                <Switch checked={settings.gdpr_enabled === '1'} onCheckedChange={() => toggle('gdpr_enabled')} />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Cookie Consent Banner</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Show cookie consent banner to new visitors</p>
                </div>
                <Switch checked={settings.cookie_banner_enabled === '1'} onCheckedChange={() => toggle('cookie_banner_enabled')} />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Analytics Tracking</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enable platform-wide analytics collection</p>
                </div>
                <Switch checked={settings.analytics_enabled === '1'} onCheckedChange={() => toggle('analytics_enabled')} />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Full CRM Security</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Require admin PIN verification before accessing customer records and account details</p>
                </div>
                <Switch checked={settings.crm_require_pin === '1'} onCheckedChange={() => toggle('crm_require_pin')} />
              </div>
              <Separator className="bg-border" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Terms of Service Version</Label>
                  <Input value={settings.terms_version} onChange={e => set('terms_version', e.target.value)} className="bg-background border-border" placeholder="e.g. 1.0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Privacy Policy Version</Label>
                  <Input value={settings.privacy_version} onChange={e => set('privacy_version', e.target.value)} className="bg-background border-border" placeholder="e.g. 1.0" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Appearance ── */}
        <TabsContent value="appearance" className="space-y-6">
          <div className="flex justify-end gap-2">
            <SaveBtn status={brandingSaveStatus} onClick={saveBranding} />
            <SaveBtn status={themeSaveStatus} onClick={saveTheme} />
          </div>

          {/* Logo & Favicon */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-primary" /> Logo &amp; Favicon
              </CardTitle>
              <CardDescription>Upload your platform logo and browser favicon. Supported formats: PNG, JPG, SVG, GIF (max 4 MB).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Platform Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-16 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {branding.platform_logo_url
                      ? <img src={branding.platform_logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                      : <ImagePlus className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          uploadImage(f, 'logo', url => setBranding(b => ({ ...b, platform_logo_url: url })), setLogoUploading);
                        }} />
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted/50 transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                          {logoUploading ? 'Uploading…' : 'Upload image'}
                        </span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={branding.platform_logo_url}
                        onChange={e => setBranding(b => ({ ...b, platform_logo_url: e.target.value }))}
                        placeholder="https://… or /airo-assets/uploads/…"
                        className="bg-background border-border text-xs h-8"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Shown in the site header and footer. Recommended: transparent PNG, min 200×60 px.</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Favicon */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Favicon</Label>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {branding.platform_favicon_url
                      ? <img src={branding.platform_favicon_url} alt="Favicon" className="max-w-full max-h-full object-contain p-1" />
                      : <Globe2 className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          uploadImage(f, 'favicon', url => setBranding(b => ({ ...b, platform_favicon_url: url })), setFaviconUploading);
                        }} />
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted/50 transition-colors ${faviconUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {faviconUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                          {faviconUploading ? 'Uploading…' : 'Upload image'}
                        </span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={branding.platform_favicon_url}
                        onChange={e => setBranding(b => ({ ...b, platform_favicon_url: e.target.value }))}
                        placeholder="https://… or /airo-assets/uploads/…"
                        className="bg-background border-border text-xs h-8"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Shown in browser tabs. Recommended: square PNG or ICO, 32×32 or 64×64 px.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="w-4 h-4 text-primary" /> Colour Mode
              </CardTitle>
              <CardDescription>Choose whether the public-facing site displays in light or dark mode. The admin portal always stays in dark mode.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {(['light', 'dark'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setT('site_color_mode', mode)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      theme.site_color_mode === mode
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/80 bg-muted/20'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      mode === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-200'
                    }`}>
                      {mode === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-blue-400" />}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground capitalize">{mode}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mode === 'dark' ? 'Dark background, light text' : 'Light background, dark text'}
                      </p>
                    </div>
                    {theme.site_color_mode === mode && (
                      <Badge className="bg-primary text-white border-0 text-xs">Active</Badge>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                This setting applies to the public website only. The admin portal always uses dark mode so it remains readable.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" /> Brand Colours
              </CardTitle>
              <CardDescription>Set the primary, secondary, and accent colours used across the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {([
                { key: 'site_primary_color' as const, label: 'Primary Colour', desc: 'Buttons, active states, highlights' },
                { key: 'site_secondary_color' as const, label: 'Secondary Colour', desc: 'Secondary buttons and backgrounds' },
                { key: 'site_accent_color' as const, label: 'Accent Colour', desc: 'Hover states and decorative accents' },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer shadow-sm"
                      style={{ backgroundColor: theme[key] }}
                    />
                    <input
                      type="color"
                      value={theme[key]}
                      onChange={e => setT(key, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title={`Pick ${label}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Input
                    value={theme[key]}
                    onChange={e => setT(key, e.target.value)}
                    className="bg-background border-border w-32 font-mono text-xs"
                    placeholder="#3B82F6"
                    maxLength={7}
                  />
                </div>
              ))}

              <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Preview:</strong> Changes are applied immediately when you click Save Changes. The page will update without a reload.
                </p>
                <div className="flex gap-2 mt-3">
                  <div className="h-8 px-3 rounded-lg flex items-center text-xs font-medium text-white" style={{ backgroundColor: theme.site_primary_color }}>
                    Primary
                  </div>
                  <div className="h-8 px-3 rounded-lg flex items-center text-xs font-medium text-white" style={{ backgroundColor: theme.site_secondary_color }}>
                    Secondary
                  </div>
                  <div className="h-8 px-3 rounded-lg flex items-center text-xs font-medium text-white" style={{ backgroundColor: theme.site_accent_color }}>
                    Accent
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Site Status ── */}
        <TabsContent value="site-status" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                Site Status
              </CardTitle>
              <CardDescription>
                Control whether the public website is live, in coming soon mode, or under maintenance.
                The admin portal remains accessible in all modes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {siteStatusLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading current status…</span>
                </div>
              ) : (
                <>
                  {/* Current status badge */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
                    <div className={`w-3 h-3 rounded-full ${siteStatus === 'normal' ? 'bg-green-400' : siteStatus === 'coming_soon' ? 'bg-blue-400' : 'bg-orange-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Current Site Status:{' '}
                        <span className={siteStatus === 'normal' ? 'text-green-400' : siteStatus === 'coming_soon' ? 'text-blue-400' : 'text-orange-400'}>
                          {siteStatus === 'normal' ? 'Normal' : siteStatus === 'coming_soon' ? 'Coming Soon' : 'Maintenance'}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {siteStatus === 'normal'
                          ? 'The public website is fully accessible.'
                          : siteStatus === 'coming_soon'
                          ? 'Public visitors see the Coming Soon page. Admin portal remains accessible.'
                          : 'Public visitors see the Maintenance page. Admin portal remains accessible.'}
                      </p>
                    </div>
                  </div>

                  {/* Mode selector */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Select mode:</p>
                    {([
                      { value: 'normal', label: 'Normal', desc: 'Public website is fully accessible to all visitors.', color: 'green' },
                      { value: 'coming_soon', label: 'Coming Soon', desc: 'Public visitors see a branded Coming Soon page. Login, dashboard and admin remain accessible.', color: 'blue' },
                      { value: 'maintenance', label: 'Maintenance', desc: 'Public visitors see a Maintenance in Progress page. Login, dashboard and admin remain accessible.', color: 'orange' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSiteStatusState(opt.value)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          siteStatus === opt.value
                            ? opt.color === 'green' ? 'border-green-500/50 bg-green-500/5'
                              : opt.color === 'blue' ? 'border-blue-500/50 bg-blue-500/5'
                              : 'border-orange-500/50 bg-orange-500/5'
                            : 'border-border hover:border-muted-foreground/30 bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            siteStatus === opt.value
                              ? opt.color === 'green' ? 'border-green-400 bg-green-400'
                                : opt.color === 'blue' ? 'border-blue-400 bg-blue-400'
                                : 'border-orange-400 bg-orange-400'
                              : 'border-muted-foreground/40'
                          }`}>
                            {siteStatus === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {siteStatusError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {siteStatusError}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={saveSiteStatus}
                      disabled={siteStatusSaving}
                      className="bg-primary hover:bg-primary/90 gap-2"
                    >
                      {siteStatusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Site Status
                    </Button>
                    {siteStatusSaved && (
                      <span className="flex items-center gap-1.5 text-sm text-green-400">
                        <CheckCircle2 className="w-4 h-4" /> Site status updated successfully.
                      </span>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <p className="text-xs font-medium text-foreground mb-2">Important notes:</p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li>• The admin portal at <code className="bg-muted px-1 rounded">/admin</code> is always accessible regardless of site status.</li>
                      <li>• Authentication routes are never blocked — you cannot lock yourself out.</li>
                      <li>• Customer dashboards remain accessible to logged-in customers.</li>
                      <li>• The setting is stored in the database and persists across restarts.</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Coming Soon Countdown ── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Coming Soon Countdown
              </CardTitle>
              <CardDescription>
                Set a launch date and the countdown will appear live on the Coming Soon page.
                Leave the date blank to hide the countdown. All data is stored in the database — never in the browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Headline */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Page Headline</Label>
                <Input
                  value={csHeadline}
                  onChange={e => setCsHeadline(e.target.value)}
                  placeholder="Coming Soon"
                  className="bg-background border-border"
                  maxLength={100}
                />
              </div>

              {/* Subtext */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Subtext</Label>
                <textarea
                  value={csSubtext}
                  onChange={e => setCsSubtext(e.target.value)}
                  placeholder="We are putting the finishing touches on something great."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Launch date/time */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Launch Date &amp; Time (UK local time)</Label>
                <Input
                  type="datetime-local"
                  value={csLaunchDate}
                  onChange={e => setCsLaunchDate(e.target.value)}
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to hide the countdown. The timer ticks live on the Coming Soon page.
                </p>
              </div>

              {/* Preview */}
              {csLaunchDate && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary">
                  Countdown target: <strong>{new Date(csLaunchDate).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              )}

              {csError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {csError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={saveComingSoonConfig}
                  disabled={csSaving}
                  className="bg-primary hover:bg-primary/90 gap-2"
                >
                  {csSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Countdown Settings
                </Button>
                {csSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" /> Saved successfully.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Troubleshooting ── */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <TroubleshootingTab />

          {/* ── Notification Pipeline Test ── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" /> Test Admin Notifications
              </CardTitle>
              <CardDescription>
                Fire a test notification to verify the internal admin notification pipeline. In-app only — no email is sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Notification Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { value: 'signup',      label: 'New Signup' },
                    { value: 'message',     label: 'New Message' },
                    { value: 'support',     label: 'Support Request' },
                    { value: 'plan_change', label: 'Plan Change' },
                  ] as { value: TestNotifType; label: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTestNotifType(opt.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        testNotifType === opt.value
                          ? 'bg-primary text-white border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={sendTestNotification}
                  disabled={testNotifStatus === 'sending'}
                  className="gap-2"
                  size="sm"
                >
                  {testNotifStatus === 'sending' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Send Test Notification</>
                  )}
                </Button>
              </div>
              {testNotifMsg && (
                <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ${
                  testNotifStatus === 'sent' || testNotifStatus === 'idle'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {testNotifStatus === 'error'
                    ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  }
                  <span>{testNotifMsg}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Platform Manual ── */}
        <TabsContent value="manual" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <CardTitle>Platform Manual</CardTitle>
              </div>
              <CardDescription>Download the complete Sousa Murray Profiles platform manual as a PDF. Includes admin guide, user dashboard guide, API reference, and all policies. For internal staff use only — do not distribute externally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <p className="font-semibold text-sm text-foreground">Full Manual</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Complete reference — admin guide + user dashboard guide. All sections, API reference, and policies.</p>
                  <a href="/api/admin/manual/pdf?section=all" target="_blank" rel="noopener noreferrer">
                    <Button className="w-full bg-primary hover:bg-primary/90 gap-2 text-sm">
                      <FileDown className="w-4 h-4" /> Download Full Manual
                    </Button>
                  </a>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <p className="font-semibold text-sm text-foreground">Admin Guide</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Administrator-only guide covering the admin portal, user management, security, API reference, and compliance.</p>
                  <a href="/api/admin/manual/pdf?section=admin" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full border-border gap-2 text-sm">
                      <FileDown className="w-4 h-4" /> Download Admin Guide
                    </Button>
                  </a>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <p className="font-semibold text-sm text-foreground">User Guide</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">User-facing guide covering the dashboard, profiles, QR codes, business cards, analytics, and account settings.</p>
                  <a href="/api/admin/manual/pdf?section=user" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full border-border gap-2 text-sm">
                      <FileDown className="w-4 h-4" /> Download User Guide
                    </Button>
                  </a>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-semibold mb-1">Confidential — Internal Use Only</p>
                <p className="text-xs">The Admin Guide contains internal security architecture details and API endpoints. Never distribute externally. The User Guide may be shared with users as a support resource.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Backup & Export ── */}
        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ─── Backup & Export Tab ──────────────────────────────────────────────────────

interface BackupFile {
  filename: string;
  size: number;
  created_at: string;
}

interface TableInfo {
  name: string;
  row_count: number;
}

function BackupTab() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ enabled: boolean; interval_hours: number; max_backups: number; last_run: string | null }>({ enabled: true, interval_hours: 24, max_backups: 30, last_run: null });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<'saved' | 'error' | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // GoDaddy Tables sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: Record<string, number>; syncedAt: string; mysqlUserCount?: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ mysqlUserCount: number; recentSyncs: any[] } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  function showMsg(type: 'ok' | 'error', text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function loadBackups() {
    setLoadingBackups(true);
    try {
      const r = await fetch('/api/admin/backup/list');
      const d = await r.json();
      setBackups(d.backups ?? []);
    } catch { /* ignore */ }
    setLoadingBackups(false);
  }

  async function loadTables() {
    setLoadingTables(true);
    try {
      const r = await fetch('/api/admin/backup/export/tables');
      const d = await r.json();
      setTables(d.tables ?? []);
    } catch { /* ignore */ }
    setLoadingTables(false);
  }

  async function loadSchedule() {
    try {
      const r = await fetch('/api/admin/backup/schedule');
      const d = await r.json();
      setSchedule(d);
    } catch { /* ignore */ }
  }

  async function loadSyncStatus() {
    setLoadingStatus(true);
    try {
      const r = await fetch('/api/admin/sync');
      if (r.ok) {
        const d = await r.json();
        setSyncStatus(d);
      }
    } catch { /* ignore */ }
    setLoadingStatus(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await fetch('/api/admin/sync', { method: 'POST' });
      const d = await r.json();
      if (d.success) {
        setSyncResult(d);
        showMsg('ok', `Sync complete — ${d.synced?.users ?? 0} users mirrored to GoDaddy Tables`);
        loadSyncStatus();
      } else {
        showMsg('error', d.error ?? 'Sync failed');
      }
    } catch { showMsg('error', 'Network error during sync'); }
    setSyncing(false);
  }

  useEffect(() => {
    loadBackups();
    loadTables();
    loadSchedule();
    loadSyncStatus();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const r = await fetch('/api/admin/backup/create', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        showMsg('ok', `Backup created: ${d.filename} (${(d.size / 1024).toFixed(1)} KB)`);
        loadBackups();
      } else {
        showMsg('error', d.error ?? 'Backup failed');
      }
    } catch { showMsg('error', 'Network error'); }
    setCreating(false);
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete backup ${filename}? This cannot be undone.`)) return;
    setDeletingFile(filename);
    try {
      const r = await fetch(`/api/admin/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.ok) { showMsg('ok', 'Backup deleted'); loadBackups(); }
      else showMsg('error', d.error ?? 'Delete failed');
    } catch { showMsg('error', 'Network error'); }
    setDeletingFile(null);
  }

  async function handleExportJson() {
    setExportingJson(true);
    try {
      const r = await fetch('/api/admin/backup/export/json');
      if (!r.ok) { showMsg('error', 'Export failed'); setExportingJson(false); return; }
      const blob = await r.blob();
      const cd = r.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const name = match?.[1] ?? 'export.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      showMsg('ok', 'JSON export downloaded');
    } catch { showMsg('error', 'Export failed'); }
    setExportingJson(false);
  }

  async function handleExportCsv(table: string) {
    setExportingCsv(table);
    try {
      const r = await fetch(`/api/admin/backup/export/csv/${encodeURIComponent(table)}`);
      if (!r.ok) { showMsg('error', 'CSV export failed'); setExportingCsv(null); return; }
      const blob = await r.blob();
      const cd = r.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const name = match?.[1] ?? `${table}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      showMsg('ok', `${table}.csv downloaded`);
    } catch { showMsg('error', 'CSV export failed'); }
    setExportingCsv(null);
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    try {
      const r = await fetch('/api/admin/backup/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      const d = await r.json();
      if (d.ok) { setScheduleMsg('saved'); setTimeout(() => setScheduleMsg(null), 3000); }
      else setScheduleMsg('error');
    } catch { setScheduleMsg('error'); }
    setSavingSchedule(false);
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function fmtTs(iso: string) {
    try { return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return iso; }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${msg.type === 'ok' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* ── GoDaddy Tables Sync ─────────────────────────────────────────── */}
      <Card className="bg-card border-border border-blue-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            GoDaddy Tables Mirror
            <Badge className="ml-auto bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">GDPR &amp; Audit</Badge>
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Mirrors all customer data (users, profiles, subscriptions, audit log, GDPR requests) into GoDaddy's managed database. Visible in the <strong>Database Tables</strong> viewer and exportable directly from GoDaddy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Users mirrored', value: loadingStatus ? '…' : String(syncStatus?.mysqlUserCount ?? 0) },
              { label: 'Tables', value: '7' },
              { label: 'Last sync', value: loadingStatus ? '…' : (syncStatus?.recentSyncs?.[0] ? fmtTs(syncStatus.recentSyncs[0].synced_at ?? syncStatus.recentSyncs[0].syncedAt) : 'Never') },
              { label: 'Storage', value: 'GoDaddy MySQL' },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-muted/40 border border-border px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Sync result */}
          {syncResult && (
            <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-3 text-xs space-y-1">
              <p className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sync completed at {fmtTs(syncResult.syncedAt)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-2">
                {Object.entries(syncResult.synced).map(([k, v]) => (
                  <span key={k} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{v}</span> {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync to GoDaddy Tables now'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Run after publishing to mirror all live data. Safe to run multiple times — uses upsert.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Backup */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" /> Database Snapshots
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Create a clean copy of the live SQLite database. Snapshots are stored in <code className="text-xs bg-muted px-1 py-0.5 rounded">/private/db/backups/</code> — not web-accessible. Up to 30 snapshots are kept; oldest are pruned automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={handleCreate} disabled={creating} className="bg-primary hover:bg-primary/90 gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              {creating ? 'Creating snapshot…' : 'Create Snapshot Now'}
            </Button>
            <Button variant="outline" onClick={loadBackups} className="gap-2 border-border">
              <RotateCcw className="w-4 h-4" /> Refresh
            </Button>
          </div>

          {loadingBackups ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading snapshots…
            </div>
          ) : backups.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm rounded-xl border border-dashed border-border">
              No snapshots yet. Create your first one above.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Filename</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Created</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Size</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b, i) => (
                    <tr key={b.filename} className={`border-b border-border last:border-0 ${i === 0 ? 'bg-green-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && <Badge className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-0">Latest</Badge>}
                          <span className="font-mono text-xs text-foreground truncate max-w-[180px]">{b.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{fmtTs(b.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{fmtSize(b.size)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/api/admin/backup/download/${encodeURIComponent(b.filename)}`} download={b.filename}>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 border-border">
                              <Download className="w-3 h-3" /> Download
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-500 hover:bg-red-500/10"
                            onClick={() => handleDelete(b.filename)}
                            disabled={deletingFile === b.filename}
                          >
                            {deletingFile === b.filename ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-backup Schedule */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Auto-backup Schedule
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Automatic snapshots run on the server. The scheduler checks every hour and creates a snapshot when the interval has elapsed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Enable auto-backup</p>
              <p className="text-xs text-muted-foreground">Automatically create snapshots on the configured interval</p>
            </div>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={v => setSchedule(s => ({ ...s, enabled: v }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Interval</Label>
              <Select
                value={String(schedule.interval_hours)}
                onValueChange={v => setSchedule(s => ({ ...s, interval_hours: Number(v) }))}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Every 6 hours</SelectItem>
                  <SelectItem value="12">Every 12 hours</SelectItem>
                  <SelectItem value="24">Every 24 hours (daily)</SelectItem>
                  <SelectItem value="48">Every 48 hours</SelectItem>
                  <SelectItem value="168">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Max snapshots to keep</Label>
              <Select
                value={String(schedule.max_backups)}
                onValueChange={v => setSchedule(s => ({ ...s, max_backups: Number(v) }))}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 (one week daily)</SelectItem>
                  <SelectItem value="14">14 (two weeks)</SelectItem>
                  <SelectItem value="30">30 (one month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {schedule.last_run && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Last auto-backup: {fmtTs(schedule.last_run)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveSchedule} disabled={savingSchedule} className="bg-primary hover:bg-primary/90 gap-2">
              {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Schedule
            </Button>
            {scheduleMsg === 'saved' && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>}
            {scheduleMsg === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Error saving</span>}
          </div>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Data Export
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Export live data for auditing, GDPR compliance, or off-platform analysis. All exports are logged in the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Full Database Export (JSON)</p>
              <p className="text-xs text-muted-foreground mt-0.5">All tables exported as a single JSON file. Suitable for full data audits and off-site archiving.</p>
            </div>
            <Button onClick={handleExportJson} disabled={exportingJson} className="bg-primary hover:bg-primary/90 gap-2 shrink-0">
              {exportingJson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingJson ? 'Exporting…' : 'Download JSON'}
            </Button>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Export Individual Table (CSV)</p>
            {loadingTables ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tables…
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Table</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Rows</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map(t => (
                      <tr key={t.name} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground">{t.name}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{t.row_count.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1 border-border"
                            onClick={() => handleExportCsv(t.name)}
                            disabled={exportingCsv === t.name}
                          >
                            {exportingCsv === t.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                            CSV
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-400">
            <p className="font-semibold mb-0.5">GDPR / UK GDPR Note</p>
            <p>All data exports are logged in the audit trail with the admin ID, timestamp, format, and row count. Exported data must be handled in accordance with your data retention and processing policies. Do not store exports containing personal data beyond the minimum necessary period.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
