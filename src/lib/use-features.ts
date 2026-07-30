/**
 * useFeatures — customer-facing feature gate hook
 *
 * Fetches /api/features/me and returns a map of slug → resolved_access.
 * Components use this to decide whether to show, hide, or show a locked/coming-soon card.
 *
 * resolved_access values:
 *   'active' | 'included' | 'paid_addon' | 'quote_required' | 'coming_soon' | 'upgrade_prompt' | null (hidden)
 */
import { useState, useEffect, useCallback } from 'react';

export type FeatureAccess =
  | 'active'
  | 'included'
  | 'paid_addon'
  | 'quote_required'
  | 'coming_soon'
  | 'upgrade_prompt'
  | null;

export interface ResolvedFeature {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: string;
  pricing_type: string;
  fixed_price: number | null;
  from_price: number | null;
  coming_soon_text: string | null;
  show_coming_soon: number;
  allow_register_interest: number;
  require_admin_approval: number;
  dashboard_icon_visible: number;
  resolved_access: FeatureAccess;
}

interface UseFeaturesResult {
  features: ResolvedFeature[];
  featureMap: Record<string, ResolvedFeature>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Returns the resolved access for a slug, or null if hidden/not found */
  getAccess: (slug: string) => FeatureAccess;
  /** True if the feature is accessible (active/included/paid_addon/quote_required) */
  isAccessible: (slug: string) => boolean;
  /** True if the feature should show a coming-soon card */
  isComingSoon: (slug: string) => boolean;
  /** True if the feature should show an upgrade prompt */
  isUpgradePrompt: (slug: string) => boolean;
}

export function useFeatures(): UseFeaturesResult {
  const [features, setFeatures] = useState<ResolvedFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/features/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load features');
      const data = await res.json();
      if (data.success) {
        setFeatures(data.data ?? []);
      } else {
        setError(data.error ?? 'Unknown error');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const featureMap = features.reduce<Record<string, ResolvedFeature>>((acc, f) => {
    acc[f.slug] = f;
    return acc;
  }, {});

  const getAccess = (slug: string): FeatureAccess => featureMap[slug]?.resolved_access ?? null;

  const isAccessible = (slug: string): boolean => {
    const access = getAccess(slug);
    return access === 'active' || access === 'included' || access === 'paid_addon' || access === 'quote_required';
  };

  const isComingSoon = (slug: string): boolean => getAccess(slug) === 'coming_soon';

  const isUpgradePrompt = (slug: string): boolean => getAccess(slug) === 'upgrade_prompt';

  return { features, featureMap, loading, error, refresh, getAccess, isAccessible, isComingSoon, isUpgradePrompt };
}
