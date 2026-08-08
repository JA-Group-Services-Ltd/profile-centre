import { lazy, Suspense, useEffect, useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Globe2, Loader2, TriangleAlert } from 'lucide-react';

const PublicProfilePage = lazy(() => import('@/pages/profile'));
const BusinessProfilePage = lazy(() => import('@/pages/business-profile'));

interface ResolvedDomain {
  hostname: string;
  profile_id: number;
  kind: 'personal' | 'business' | 'business_person';
  username: string;
  biz_slug: string | null;
  person_slug: string | null;
  public_path: string;
}

function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );
}

export default function CustomDomainRoot() {
  const [resolved, setResolved] = useState<ResolvedDomain | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const hostname = window.location.hostname.toLowerCase();
    fetch(`/api/custom-domains/resolve?hostname=${encodeURIComponent(hostname)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.success) throw new Error(body.error || 'This custom domain is not active.');
        if (!cancelled) setResolved(body.data);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'This custom domain is not active.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loading />;

  if (!resolved) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <Helmet><title>Custom domain unavailable</title><meta name="robots" content="noindex" /></Helmet>
        <div className="max-w-md text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
            <TriangleAlert className="w-6 h-6 text-orange-500" />
          </div>
          <h1 className="text-xl font-bold">This custom domain is not active</h1>
          <p className="text-sm text-muted-foreground">{error || 'The domain may still be waiting for DNS or SSL verification.'}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> Powered by Sousa Murray Profiles</p>
        </div>
      </div>
    );
  }

  if (resolved.kind === 'personal') {
    return <Suspense fallback={<Loading />}><PublicProfilePage _overrideUsername={resolved.username} /></Suspense>;
  }

  const bizSlug = resolved.biz_slug || resolved.username;
  return (
    <Suspense fallback={<Loading />}>
      <BusinessProfilePage
        _overrideBizSlug={bizSlug}
        _overridePersonSlug={resolved.kind === 'business_person' ? (resolved.person_slug || '') : ''}
      />
    </Suspense>
  );
}
