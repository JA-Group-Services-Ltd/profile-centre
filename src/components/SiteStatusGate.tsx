/**
 * SiteStatusGate
 *
 * Wraps public-facing pages. Before rendering children it fetches
 * /api/site-status and shows the Coming Soon or Maintenance page
 * when the admin has activated those modes.
 *
 * Admin routes (/admin/*), auth routes (/auth/*, /admin/auth/*) and API
 * routes (/api/*) are NEVER gated — this component is only mounted on
 * public page routes.
 *
 * ADMIN BYPASS: If the user has an active admin session (/api/admin/auth/me
 * returns success), they see the real site regardless of status. This allows
 * the workforce admin team to review the site while it is in coming-soon or
 * maintenance mode.
 */
import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy-load so they don't bloat the initial module graph
const ComingSoonPage = lazy(() => import('@/pages/coming-soon'));
const MaintenancePage = lazy(() => import('@/pages/maintenance'));

type SiteStatus = 'normal' | 'coming_soon' | 'maintenance';

interface Props {
  children: ReactNode;
}

export default function SiteStatusGate({ children }: Props) {
  const [status, setStatus] = useState<SiteStatus>('normal');
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Run both checks in parallel — admin check and site status check
    Promise.all([
      fetch('/api/site-status').then(r => r.json()).catch(() => ({ success: true, status: 'normal' })),
      fetch('/api/auth/admin/me', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([statusData, adminData]) => {
      if (statusData.success) setStatus(statusData.status as SiteStatus);
      if (adminData.success) setIsAdmin(true);
    }).finally(() => setChecked(true));
  }, []);

  // Show a minimal spinner while we check — avoids a blank flash
  if (!checked) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  // Admin workforce users always see the real site, even in maintenance/coming-soon mode
  if (isAdmin) return <>{children}</>;

  if (status === 'coming_soon') return (
    <Suspense fallback={null}>
      <ComingSoonPage />
    </Suspense>
  );

  if (status === 'maintenance') return (
    <Suspense fallback={null}>
      <MaintenancePage />
    </Suspense>
  );

  return <>{children}</>;
}
