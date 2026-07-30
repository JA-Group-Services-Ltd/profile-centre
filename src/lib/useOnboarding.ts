/**
 * useOnboarding
 *
 * Fetches and manages onboarding state for the current user.
 * Used by DashboardLayout to show/hide the AssistedSetupOverlay
 * and LegalReacceptGate.
 *
 * The setup guide shows once on first login and stays dismissed
 * permanently once the user closes it. It can be re-opened at
 * any time from the sidebar "Setup Guide" button.
 */
import { useState, useEffect, useCallback } from 'react';

export interface OnboardingState {
  setupActive: boolean;
  completedSteps: string[];
  dismissedAt: string | null;
  requiresLegalReaccept: boolean;
  currentTermsVersion: string;
  legalReacceptedAt: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  setupActive: false,
  completedSteps: [],
  dismissedAt: null,
  requiresLegalReaccept: false,
  currentTermsVersion: '2.0',
  legalReacceptedAt: null,
};

export function useOnboarding(enabled: boolean) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    try {
      const r = await fetch('/api/onboarding/state', { credentials: 'include' });
      const d = await r.json();
      if (d.success) setState(d.data);
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  const markStepComplete = useCallback(async (stepId: string) => {
    setState(prev => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(stepId)
        ? prev.completedSteps
        : [...prev.completedSteps, stepId],
    }));
    try {
      await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stepId }),
      });
    } catch { /* non-fatal */ }
  }, []);

  const dismiss = useCallback(async () => {
    setState(prev => ({ ...prev, setupActive: false, dismissedAt: new Date().toISOString() }));
    try {
      await fetch('/api/onboarding/dismiss', { method: 'POST', credentials: 'include' });
    } catch { /* non-fatal */ }
  }, []);

  const onLegalAccepted = useCallback(() => {
    setState(prev => ({
      ...prev,
      requiresLegalReaccept: false,
      legalReacceptedAt: new Date().toISOString(),
    }));
  }, []);

  return {
    state,
    loading,
    markStepComplete,
    dismiss,
    onLegalAccepted,
    reload: load,
  };
}
