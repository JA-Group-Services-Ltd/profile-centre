// @refresh reset
// v8 — full layout inline; no TheHeader; no external imports that could be stale
import { Helmet } from '@dr.pogodin/react-helmet';
import { type ReactNode } from 'react';
import { ScrollRestoration } from 'react-router-dom';
import Website from '@/layouts/Website';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import SiteNavHeader from './parts/HeaderNav';
import Footer from '@/layouts/parts/Footer';
import OfflineBanner from '@/components/OfflineBanner';
import PwaSplashScreen from '@/components/PwaSplashScreen';
import PwaNavBar from '@/components/PwaNavBar';
import InstallAppModal from '@/components/InstallAppModal';
import CentralCustomerServiceAssistant from '@/components/CentralCustomerServiceAssistant';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <Website>
      <GoogleAnalytics />
      <PwaSplashScreen />
      <OfflineBanner />
      <Helmet>
        <title>Sousa Murray Profiles | Your Digital Business Card, Reimagined</title>
        <meta name="description" content="Create a stunning digital profile that showcases who you are and what you do — share it with a single link. Free to start." />
        <link rel="icon" type="image/png" href="/airo-assets/images/favicon/ja-smart-profile" />
      </Helmet>
      <ScrollRestoration />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[99999] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-primary focus:text-primary-foreground focus:font-semibold focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <SiteNavHeader />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <PwaNavBar />
      <InstallAppModal />
      <CentralCustomerServiceAssistant />
    </Website>
  );
}
