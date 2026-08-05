/**
 * LegalReacceptGate
 *
 * Full-screen modal that blocks dashboard access until the user re-accepts
 * the current Terms of Service and Privacy Policy.
 *
 * Shown when:
 *  - User has never accepted the current version (legal_reaccept_version !== CURRENT)
 *  - Or they have never accepted at all
 *
 * Dismissed only by clicking "I Accept" with both checkboxes ticked.
 */
import { useState } from 'react';
import { Shield, FileText, Lock, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onAccepted: () => void;
}

export default function LegalReacceptGate({ onAccepted }: Props) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = termsAccepted && privacyAccepted && !saving;

  const handleAccept = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/legal/reaccept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
      });
      const d = await r.json();
      if (d.success) {
        onAccepted();
      } else {
        setError(d.error || 'Could not save your acceptance. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-primary/10 border-b border-border px-6 py-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Updated Terms &amp; Privacy Policy</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                We've updated our legal documents. Please review and accept to continue using Sousa Murray Profiles.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              To keep your account active and compliant with UK GDPR and our service terms, we need your confirmation that you have read and agree to the latest versions of our policies.
            </p>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setTermsAccepted(v => !v)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer
                    ${termsAccepted ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}
                >
                  {termsAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm text-foreground leading-relaxed">
                  I have read and agree to the{' '}
                  <a href="/legal/terms" target="_blank" rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5">
                    Terms of Service <ExternalLink className="w-3 h-3" />
                  </a>
                  {' '}and{' '}
                  <a href="/legal/acceptable_use" target="_blank" rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5">
                    Acceptable Use Policy <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setPrivacyAccepted(v => !v)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer
                    ${privacyAccepted ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}
                >
                  {privacyAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm text-foreground leading-relaxed">
                  I have read and agree to the{' '}
                  <a href="/legal/privacy" target="_blank" rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5">
                    Privacy Policy <ExternalLink className="w-3 h-3" />
                  </a>
                  {' '}and{' '}
                  <a href="/legal/data_retention" target="_blank" rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5">
                    Data Retention Policy <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Info note */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Your acceptance is recorded securely with a timestamp. You can view all legal documents at any time from the Help Centre or footer links.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <Button
              className="w-full gap-2"
              disabled={!canSubmit}
              onClick={handleAccept}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><FileText className="w-4 h-4" /> I Accept — Continue to Dashboard</>
              }
            </Button>
            {(!termsAccepted || !privacyAccepted) && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Please tick both boxes above to continue.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
