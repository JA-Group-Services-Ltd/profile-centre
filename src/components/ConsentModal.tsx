/**
 * ConsentModal
 * Shown after first login (and whenever any required consent item is missing).
 *
 * STRUCTURE (UK GDPR compliant):
 *   Required — legal acknowledgements (Terms, Privacy, Essential Account Records)
 *   Optional — preference choices (Service Improvement, Product Updates)
 *   Note: Marketing Emails option is intentionally omitted — marketing emails are not yet
 *   available. The consent field is preserved in the DB for future use.
 *
 * Required items use checkboxes (must be actively ticked).
 * Optional items use switches (off by default, never pre-ticked).
 * Pre-existing consent is pre-loaded so returning users only tick what's missing.
 */
import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, Loader2, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useBranding } from '@/lib/branding';

interface ConsentState {
  terms_consent: boolean;
  privacy_consent: boolean;
  crm_consent: boolean;         // Essential account records — required
  marketing_consent: boolean;   // Optional
  data_improve_consent: boolean;// Optional
  updates_consent: boolean;     // Optional
}

interface Props {
  onComplete: () => void;
  policyUpdated?: boolean;
}

const CONSENT_VERSION = '1.1';

export default function ConsentModal({ onComplete, policyUpdated = false }: Props) {
  const branding = useBranding();
  const [step, setStep] = useState<'intro' | 'choices' | 'done'>('intro');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false); // tracks if user tried to submit without completing

  const [consent, setConsent] = useState<ConsentState>({
    terms_consent: false,
    privacy_consent: false,
    crm_consent: false,
    marketing_consent: false,
    data_improve_consent: false,
    updates_consent: false,
  });

  // Pre-load existing consent so returning users don't re-tick already-agreed items
  useEffect(() => {
    fetch('/api/me/consent', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const c = d.data;
          setConsent(prev => ({
            ...prev,
            terms_consent: !!c.terms_consent,
            privacy_consent: !!c.privacy_consent,
            crm_consent: !!c.crm_consent,
            marketing_consent: !!c.marketing_consent,
            data_improve_consent: !!c.data_improve_consent,
            updates_consent: !!c.updates_consent,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const toggleOptional = (key: keyof ConsentState) =>
    setConsent(c => ({ ...c, [key]: !c[key] }));

  const tickRequired = (key: keyof ConsentState) =>
    setConsent(c => ({ ...c, [key]: !c[key] }));

  const canProceed = consent.terms_consent && consent.privacy_consent && consent.crm_consent;

  const handleSubmit = async () => {
    setAttempted(true);
    if (!canProceed) return;
    setSaving(true);
    setError('');
    try {
      // Get the current required version so we stamp the user's record correctly
      let consentVersion = CONSENT_VERSION;
      try {
        const vr = await fetch('/api/legal-version').then(r => r.json());
        if (vr.required_consent_version) consentVersion = vr.required_consent_version;
      } catch { /* use default */ }

      const res = await fetch('/api/me/consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          terms_consent: 1,
          privacy_consent: 1,
          crm_consent: 1,
          marketing_consent: consent.marketing_consent ? 1 : 0,
          data_improve_consent: consent.data_improve_consent ? 1 : 0,
          updates_consent: consent.updates_consent ? 1 : 0,
          consent_version: consentVersion,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save preferences');
      setStep('done');
      setTimeout(onComplete, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Which required items are still missing (used to highlight after attempted submit)
  const missing = {
    terms: !consent.terms_consent,
    privacy: !consent.privacy_consent,
    crm: !consent.crm_consent,
  };
  const missingCount = Object.values(missing).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Intro ── */}
        {step === 'intro' && (
          <div className="p-8 text-center space-y-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${policyUpdated ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
              <Shield className={`w-8 h-8 ${policyUpdated ? 'text-blue-400' : 'text-primary'}`} />
            </div>
            <div>
              {policyUpdated ? (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-2">Our policies have been updated</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    We've updated our Terms &amp; Conditions and/or Privacy Policy. Please review the changes and re-confirm your agreement to continue using <strong>{branding.platform_name}</strong>.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-2">Before you get started</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Welcome to <strong>{branding.platform_name}</strong>. We need a moment to explain how we use your data and confirm your preferences — as required by UK GDPR.
                  </p>
                </>
              )}
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-left space-y-2 text-sm text-muted-foreground">
              {policyUpdated ? (
                <>
                  <p>✓ Review the updated Terms &amp; Conditions and Privacy Policy</p>
                  <p>✓ Re-confirm your agreement to continue using the platform</p>
                  <p>✓ Your optional preferences remain unchanged</p>
                </>
              ) : (
                <>
                  <p>✓ Required legal acknowledgements are clearly separated</p>
                  <p>✓ Optional marketing choices are yours to make — nothing is pre-ticked</p>
                  <p>✓ You can update optional preferences any time in <strong>My Data &amp; Privacy</strong></p>
                </>
              )}
            </div>
            <Button onClick={() => setStep('choices')} className={`w-full h-11 ${policyUpdated ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary'}`}>
              {policyUpdated ? 'Review Updated Policies' : 'Review & Set My Preferences'}
            </Button>
          </div>
        )}

        {/* ── Choices ── */}
        {step === 'choices' && (
          <div className="flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {policyUpdated ? 'Updated Policies — Please Re-confirm' : 'Privacy, Terms and Communication Preferences'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Version {CONSENT_VERSION} · {branding.platform_name}
              </p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

              {/* ── Required section ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Required — Legal Acknowledgements
                  </p>
                  {attempted && missingCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {missingCount} item{missingCount > 1 ? 's' : ''} still needed
                    </span>
                  )}
                </div>
                <div className="space-y-3">

                  {/* Terms */}
                  <RequiredRow
                    title="Terms &amp; Conditions"
                    description="You must accept our Terms of Service to create and use an account on this platform."
                    statusLabel="Accepted"
                    checked={consent.terms_consent}
                    onChange={() => tickRequired('terms_consent')}
                    link="/legal/terms"
                    highlight={attempted && missing.terms}
                  />

                  {/* Privacy */}
                  <RequiredRow
                    title="Privacy Policy"
                    description="Acknowledgement that you have been shown our Privacy Policy and understand how we collect, store and process your personal data under UK GDPR."
                    statusLabel="Acknowledged"
                    checked={consent.privacy_consent}
                    onChange={() => tickRequired('privacy_consent')}
                    link="/legal/privacy"
                    highlight={attempted && missing.privacy}
                  />

                  {/* Essential account records */}
                  <div className={`p-4 rounded-xl border transition-colors ${
                    consent.crm_consent
                      ? 'border-primary/40 bg-primary/5'
                      : attempted && missing.crm
                        ? 'border-destructive/60 bg-destructive/5'
                        : 'border-border bg-muted/20'
                  }`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => tickRequired('crm_consent')}
                        className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                          consent.crm_consent
                            ? 'bg-primary border-primary'
                            : attempted && missing.crm
                              ? 'border-destructive bg-transparent'
                              : 'border-muted-foreground bg-transparent'
                        }`}
                      >
                        {consent.crm_consent && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">Essential Account &amp; Activity Records</p>
                          <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-medium">Required</span>
                          {consent.crm_consent
                            ? <span className="text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-medium">Acknowledged</span>
                            : attempted && missing.crm
                              ? <span className="text-xs bg-destructive/15 text-destructive px-1.5 py-0.5 rounded font-medium">Please tick this</span>
                              : null
                          }
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Required for account administration, customer support, audit logging, security, subscription management and service operation. This is not marketing consent — it is necessary to provide the service.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Optional section ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Optional — Your Choice
                </p>
                <p className="text-xs text-muted-foreground mb-3">None of these are required to use the service. Nothing is pre-selected.</p>
                <div className="space-y-3">

                  <OptionalRow
                    title="Service Improvement"
                    description="Allow anonymised usage data, feedback and research to help us improve the platform beyond essential security and diagnostics."
                    checked={consent.data_improve_consent}
                    onChange={() => toggleOptional('data_improve_consent')}
                  />

                  <OptionalRow
                    title="Product Updates"
                    description="Receive emails about new features, announcements and general platform updates. Essential service notices, billing and security alerts are always sent regardless of this setting."
                    checked={consent.updates_consent}
                    onChange={() => toggleOptional('updates_consent')}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border space-y-3">
              {attempted && !canProceed && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive leading-relaxed">
                    <strong>All three required items must be acknowledged</strong> before you can continue.
                    Please scroll up and tick any items highlighted in red.
                  </p>
                </div>
              )}
              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full bg-primary h-11"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save My Preferences &amp; Continue
              </Button>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                You can update optional preferences at any time in <strong>My Data &amp; Privacy</strong>.
              </p>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">All set!</h2>
            <p className="text-muted-foreground text-sm">Your preferences have been saved. Taking you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Required row (checkbox) ────────────────────────────────────────────────

function RequiredRow({
  title, description, statusLabel, checked, onChange, link, highlight,
}: {
  title: string;
  description: string;
  statusLabel: string;
  checked: boolean;
  onChange: () => void;
  link?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border transition-colors ${
      checked
        ? 'border-primary/40 bg-primary/5'
        : highlight
          ? 'border-destructive/60 bg-destructive/5'
          : 'border-border bg-muted/20'
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onChange}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
            checked
              ? 'bg-primary border-primary'
              : highlight
                ? 'border-destructive bg-transparent'
                : 'border-muted-foreground bg-transparent'
          }`}
        >
          {checked && <Check className="w-3 h-3 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground" dangerouslySetInnerHTML={{ __html: title }} />
            <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-medium">Required</span>
            {checked
              ? <span className="text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-medium">{statusLabel}</span>
              : highlight
                ? <span className="text-xs bg-destructive/15 text-destructive px-1.5 py-0.5 rounded font-medium">Please tick this</span>
                : null
            }
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              Read full document <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Optional row (switch) ──────────────────────────────────────────────────

function OptionalRow({
  title, description, checked, onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
      checked ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'
    }`}>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            checked ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'
          }`}>
            {checked ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
