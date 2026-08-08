import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  type RouteObject,
  useLocation,
} from 'react-router-dom';

import AiroErrorBoundary from '../export-plugins/AiroErrorBoundary';
import CookieBannerErrorBoundary from '@/components/CookieBannerErrorBoundary';
import Spinner from './components/Spinner';
import { routes } from './routes';
import { SiteThemeProvider } from './lib/site-theme';
import AccessibilityWidget from '@/components/AccessibilityWidget';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';
import { AdminAuthProvider } from '@/lib/admin-auth';

const CookieBanner = lazy(() =>
  import('@/components/CookieBanner').catch((error) => {
    console.warn('Failed to load CookieBanner:', error);
    return { default: () => null };
  })
);
const CustomDomainRoot = lazy(() => import('@/components/custom-domains/CustomDomainRoot'));
const DashboardCustomDomains = lazy(() => import('@/pages/dashboard/custom-domains'));
const AdminUserCustomDomains = lazy(() => import('@/pages/admin/user-custom-domains'));

const SpinnerFallback = () => (
  <div className="flex justify-center py-8 h-screen items-center">
    <Spinner />
  </div>
);

/** Renders accessibility + cookie widgets only on the public homepage */
function HomepageWidgets() {
  const location = useLocation();
  if (location.pathname !== '/') return null;
  return (
    <>
      <CookieBannerErrorBoundary>
        <Suspense fallback={null}>
          <CookieBanner />
        </Suspense>
      </CookieBannerErrorBoundary>
      <AccessibilityWidget />
    </>
  );
}

function RootShell() {
  return (
    <>
      <Suspense fallback={<SpinnerFallback />}>
        <Outlet />
      </Suspense>
      <HomepageWidgets />
    </>
  );
}

const routeTree: RouteObject[] = [
  {
    element:
      import.meta.env.MODE === 'development' ? (
        <AiroErrorBoundary><RootShell /></AiroErrorBoundary>
      ) : (
        <RootShell />
      ),
    children: routes,
  },
];

const router = createBrowserRouter(routeTree);

function isManagedProfilesHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
  if (host === 'jagroupservices.co.uk' || host.endsWith('.jagroupservices.co.uk')) return true;
  if (host.endsWith('.pages.dev') || host.endsWith('.workers.dev')) return true;
  return false;
}

function FloatingShortcut({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="fixed right-4 bottom-24 lg:bottom-6 z-[75] rounded-full border border-border bg-card shadow-lg px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
    >
      🌐 {label}
    </a>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  const customHostname = !isManagedProfilesHostname(window.location.hostname);

  // A verified customer hostname renders its assigned public profile at the clean
  // root URL rather than exposing the canonical /profile/... route.
  if (customHostname && pathname === '/') {
    return (
      <SiteThemeProvider>
        <Toaster />
        <BrowserRouter>
          <Suspense fallback={<SpinnerFallback />}><CustomDomainRoot /></Suspense>
        </BrowserRouter>
      </SiteThemeProvider>
    );
  }

  // Standalone customer management page. Using a normal full navigation keeps this
  // isolated from the historic dashboard route tree while the feature settles in.
  if (pathname === '/dashboard/custom-domains' || pathname === '/dashboard/custom-domains/') {
    return (
      <SiteThemeProvider>
        <Toaster />
        <AuthProvider>
          <Suspense fallback={<SpinnerFallback />}><DashboardCustomDomains /></Suspense>
        </AuthProvider>
      </SiteThemeProvider>
    );
  }

  const adminDomainsMatch = pathname.match(/^\/admin\/users\/(\d+)\/custom-domains\/?$/);
  if (adminDomainsMatch) {
    return (
      <SiteThemeProvider>
        <Toaster />
        <AdminAuthProvider>
          <Suspense fallback={<SpinnerFallback />}>
            <AdminUserCustomDomains userId={Number(adminDomainsMatch[1])} />
          </Suspense>
        </AdminAuthProvider>
      </SiteThemeProvider>
    );
  }

  const dashboardShortcut = !customHostname && pathname.startsWith('/dashboard/') && pathname !== '/dashboard/custom-domains';
  const adminUserMatch = pathname.match(/^\/admin\/users\/(\d+)\/?$/);

  return (
    <SiteThemeProvider>
      <Toaster />
      <RouterProvider router={router} />
      {dashboardShortcut && <FloatingShortcut href="/dashboard/custom-domains" label="Custom Domains" />}
      {adminUserMatch && <FloatingShortcut href={`/admin/users/${adminUserMatch[1]}/custom-domains`} label="Customer Domains" />}
    </SiteThemeProvider>
  );
}
