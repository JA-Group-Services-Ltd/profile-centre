import { RouteObject, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './lib/auth';
import { AdminAuthProvider } from './lib/admin-auth';
import AdminGuard from './lib/AdminGuard';
import SiteStatusGate from './components/SiteStatusGate';
import RootLayout from './layouts/RootLayoutNew';

const NotFoundPage = import.meta.env.DEV
  ? lazy(() => import('../export-plugins/PageNotFound'))
  : lazy(() => import('./pages/_404'));

// Public marketing pages
const HomePage = lazy(() => import('./pages/index'));
const AboutPage = lazy(() => import('./pages/about'));
const PlansPage = lazy(() => import('./pages/plans'));
const ContactPage = lazy(() => import('./pages/contact'));

// Auth pages
const LoginPage = lazy(() => import('./pages/login'));
const AdminLoginPage = lazy(() => import('./pages/admin/login'));
const RegisterPage = lazy(() => import('./pages/register'));
const LoggedOutPage = lazy(() => import('./pages/logged-out'));
const AdminLoggedOutPage = lazy(() => import('./pages/admin/logged-out'));
const ConversationPage = lazy(() => import('./pages/conversation'));

// Dashboard pages
const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout'));
const DashboardOverview = lazy(() => import('./pages/dashboard/overview'));
const DashboardProfile = lazy(() => import('./pages/dashboard/profile'));
const DashboardCustomDomains = lazy(() => import('./pages/dashboard/custom-domains'));
const DashboardLinks = lazy(() => import('./pages/dashboard/links'));
const DashboardQR = lazy(() => import('./pages/dashboard/qr-code'));
const DashboardPoster = lazy(() => import('./pages/dashboard/poster'));
const DashboardEnquiries = lazy(() => import('./pages/dashboard/enquiries'));
const DashboardAnalytics = lazy(() => import('./pages/dashboard/analytics'));
const DashboardThemes = lazy(() => import('./pages/dashboard/themes'));
const DashboardBilling = lazy(() => import('./pages/dashboard/billing'));
const DashboardSettings = lazy(() => import('./pages/dashboard/settings'));
const DashboardAccount = lazy(() => import('./pages/dashboard/account'));
const DashboardOrganisationProfile = lazy(() => import('./pages/dashboard/organisation-profile'));
const DashboardOrganisationSeats = lazy(() => import('./pages/dashboard/organisation-seats'));
const DashboardDataRequests = lazy(() => import('./pages/dashboard/data-requests'));
const DashboardAccountClosure = lazy(() => import('./pages/dashboard/account-closure'));
const DashboardEmailSignature = lazy(() => import('./pages/dashboard/email-signature'));
const DashboardSeatInvites = lazy(() => import('./pages/dashboard/seat-invites'));
const DashboardServiceComms = lazy(() => import('./pages/dashboard/service-communications'));
const DashboardNotifications = lazy(() => import('./pages/dashboard/notifications'));
const DashboardHelpCentre = lazy(() => import('./pages/dashboard/help-centre'));
const DashboardBusinessCards = lazy(() => import('./pages/dashboard/business-cards'));
const DashboardSiteEditor = lazy(() => import('./pages/dashboard/site-editor'));
const DashboardSecuritySettings = lazy(() => import('./pages/dashboard/security-settings'));
const DashboardNotificationPreferences = lazy(() => import('./pages/dashboard/notification-preferences'));
const DashboardSupportTickets = lazy(() => import('./pages/dashboard/support-tickets'));

// Admin pages
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/index'));
const AdminUsers = lazy(() => import('./pages/admin/users'));
const AdminProfiles = lazy(() => import('./pages/admin/profiles'));
const AdminEnquiries = lazy(() => import('./pages/admin/enquiries'));
const AdminPlans = lazy(() => import('./pages/admin/plans'));
const AdminAnalytics = lazy(() => import('./pages/admin/analytics'));
const AdminSettings = lazy(() => import('./pages/admin/settings'));
const AdminNotifications = lazy(() => import('./pages/admin/notifications'));
const AdminVerifyCustomer = lazy(() => import('./pages/admin/verify-customer'));
const AdminAudit = lazy(() => import('./pages/admin/audit'));
const AdminLegal = lazy(() => import('./pages/admin/legal'));
const AdminSupportRequests = lazy(() => import('./pages/admin/support-requests'));
const AdminHomepage = lazy(() => import('./pages/admin/homepage'));
const AdminAuthorityReport = lazy(() => import('./pages/admin/authority-report'));
const AdminIssueReports = lazy(() => import('./pages/admin/issue-reports'));
const AdminDataRequests = lazy(() => import('./pages/admin/data-requests'));
const AdminClosureRequests = lazy(() => import('./pages/admin/closure-requests'));
const AdminAdminAccounts = lazy(() => import('./pages/admin/admin-accounts'));
const AdminUserDetail = lazy(() => import('./pages/admin/user-detail'));
const AdminProfilePreview = lazy(() => import('./pages/admin/profile-preview'));
const AdminBusinessCards = lazy(() => import('./pages/admin/business-cards'));
const AdminAssistedAccess = lazy(() => import('./pages/admin/assisted-access'));
const AdminComposeEmail = lazy(() => import('./pages/admin/compose-email'));
const AdminAddons = lazy(() => import('./pages/admin/addons'));

// Public profile pages
const ProfileRouter = lazy(() => import('./pages/profile-router'));
const InvitePage = lazy(() => import('./pages/invite'));

// Legal pages
const LegalIndexPage = lazy(() => import('./pages/legal/index'));
const PrivacyPage = lazy(() => import('./pages/legal/privacy'));
const TermsPage = lazy(() => import('./pages/legal/terms'));
const CookiesPage = lazy(() => import('./pages/legal/cookies'));
const AcceptableUsePage = lazy(() => import('./pages/legal/acceptable-use'));
const RefundsPage = lazy(() => import('./pages/legal/refunds'));
const ComplaintsPage = lazy(() => import('./pages/legal/complaints'));
const AccessibilityPage = lazy(() => import('./pages/legal/accessibility'));
const ServiceStatusPage = lazy(() => import('./pages/legal/service-status'));
const StatusPage = lazy(() => import('./pages/status'));
const EligibilityPage = lazy(() => import('./pages/legal/eligibility'));
const DataRetentionPage = lazy(() => import('./pages/legal/data-retention'));
const ReportingPolicyPage = lazy(() => import('./pages/legal/reporting'));
const SecurityPolicyPage = lazy(() => import('./pages/legal/security'));
const DataRightsPage = lazy(() => import('./pages/legal/data-rights'));
const ReportIssuePage = lazy(() => import('./pages/report-issue'));
const SupportPage = lazy(() => import('./pages/support'));
const PublicHelpCentrePage = lazy(() => import('./pages/help'));
const ComingSoonPage = lazy(() => import('./pages/coming-soon'));

const Spin = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const RedirectToHome = () => <Navigate to="/" replace />;
const S = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<Spin />}>{children}</Suspense>;
const PublicPage = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider><RootLayout><S>{children}</S></RootLayout></AuthProvider>
);

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AuthProvider><SiteStatusGate><RootLayout><S><HomePage /></S></RootLayout></SiteStatusGate></AuthProvider>,
  },
  { path: '/about', element: <PublicPage><AboutPage /></PublicPage> },
  { path: '/plans', element: <PublicPage><PlansPage /></PublicPage> },
  { path: '/contact', element: <PublicPage><ContactPage /></PublicPage> },
  { path: '/login', element: <AuthProvider><RootLayout><S><LoginPage /></S></RootLayout></AuthProvider> },
  { path: '/register', element: <RootLayout><S><RegisterPage /></S></RootLayout> },
  { path: '/logged-out', element: <RootLayout><S><LoggedOutPage /></S></RootLayout> },
  { path: '/admin/logged-out', element: <S><AdminLoggedOutPage /></S> },
  { path: '/conversation/:threadId', element: <S><ConversationPage /></S> },
  { path: '/admin/login', element: <AdminAuthProvider><S><AdminLoginPage /></S></AdminAuthProvider> },

  {
    path: '/dashboard',
    element: <AuthProvider><S><DashboardLayout /></S></AuthProvider>,
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <S><DashboardOverview /></S> },
      { path: 'profile', element: <S><DashboardProfile /></S> },
      { path: 'custom-domains', element: <S><DashboardCustomDomains /></S> },
      { path: 'links', element: <S><DashboardLinks /></S> },
      { path: 'qr-code', element: <S><DashboardQR /></S> },
      { path: 'poster', element: <S><DashboardPoster /></S> },
      { path: 'enquiries', element: <S><DashboardEnquiries /></S> },
      { path: 'analytics', element: <S><DashboardAnalytics /></S> },
      { path: 'themes', element: <S><DashboardThemes /></S> },
      { path: 'billing', element: <S><DashboardBilling /></S> },
      { path: 'settings', element: <S><DashboardSettings /></S> },
      { path: 'security', element: <S><DashboardSecuritySettings /></S> },
      { path: 'account', element: <S><DashboardAccount /></S> },
      { path: 'organisation-profile', element: <S><DashboardOrganisationProfile /></S> },
      { path: 'organisation-seats', element: <S><DashboardOrganisationSeats /></S> },
      { path: 'business-profile', element: <Navigate to="/dashboard/organisation-profile" replace /> },
      { path: 'business-seats', element: <Navigate to="/dashboard/organisation-seats" replace /> },
      { path: 'data-requests', element: <S><DashboardDataRequests /></S> },
      { path: 'account-closure', element: <S><DashboardAccountClosure /></S> },
      { path: 'email-signature', element: <S><DashboardEmailSignature /></S> },
      { path: 'seat-invites', element: <S><DashboardSeatInvites /></S> },
      { path: 'service-communications', element: <S><DashboardServiceComms /></S> },
      { path: 'notification-preferences', element: <S><DashboardNotificationPreferences /></S> },
      { path: 'notifications', element: <S><DashboardNotifications /></S> },
      { path: 'help-centre', element: <S><DashboardHelpCentre /></S> },
      { path: 'support-tickets', element: <S><DashboardSupportTickets /></S> },
      { path: 'business-cards', element: <S><DashboardBusinessCards /></S> },
      { path: 'site-editor', element: <S><DashboardSiteEditor /></S> },
      { path: 'whatsapp', element: <Navigate to="/dashboard/profile" replace /> },
      { path: 'gallery', element: <Navigate to="/dashboard/profile" replace /> },
      { path: 'menu', element: <Navigate to="/dashboard/profile" replace /> },
      { path: 'pdf-attachments', element: <Navigate to="/dashboard/profile" replace /> },
      { path: 'social-links', element: <Navigate to="/dashboard/profile" replace /> },
      { path: 'messages', element: <Navigate to="/dashboard/overview" replace /> },
      { path: 'demo', element: <Navigate to="/dashboard/overview" replace /> },
    ],
  },

  {
    path: '/admin',
    element: <AdminAuthProvider><AdminGuard /></AdminAuthProvider>,
    children: [
      {
        element: <S><AdminLayout /></S>,
        children: [
          { index: true, element: <S><AdminDashboard /></S> },
          { path: 'users', element: <S><AdminUsers /></S> },
          { path: 'profiles', element: <S><AdminProfiles /></S> },
          { path: 'enquiries', element: <S><AdminEnquiries /></S> },
          { path: 'plans', element: <S><AdminPlans /></S> },
          { path: 'analytics', element: <S><AdminAnalytics /></S> },
          { path: 'audit', element: <S><AdminAudit /></S> },
          { path: 'settings', element: <S><AdminSettings /></S> },
          { path: 'notifications', element: <S><AdminNotifications /></S> },
          { path: 'verify-customer', element: <S><AdminVerifyCustomer /></S> },
          { path: 'legal', element: <S><AdminLegal /></S> },
          { path: 'homepage', element: <S><AdminHomepage /></S> },
          { path: 'authority-report', element: <S><AdminAuthorityReport /></S> },
          { path: 'support-requests', element: <S><AdminSupportRequests /></S> },
          { path: 'issue-reports', element: <S><AdminIssueReports /></S> },
          { path: 'crm', element: <Navigate to="/admin/users" replace /> },
          { path: 'data-requests', element: <S><AdminDataRequests /></S> },
          { path: 'closure-requests', element: <S><AdminClosureRequests /></S> },
          { path: 'admin-accounts', element: <S><AdminAdminAccounts /></S> },
          { path: 'users/:userId', element: <S><AdminUserDetail /></S> },
          { path: 'profile-preview/:id', element: <S><AdminProfilePreview /></S> },
          { path: 'business-cards', element: <S><AdminBusinessCards /></S> },
          { path: 'features', element: <Navigate to="/admin/users" replace /> },
          { path: 'assisted-access', element: <S><AdminAssistedAccess /></S> },
          { path: 'compose-email', element: <S><AdminComposeEmail /></S> },
          { path: 'addons', element: <S><AdminAddons /></S> },
          { path: 'messaging', element: <Navigate to="/admin" replace /> },
          { path: 'affiliates', element: <Navigate to="/admin" replace /> },
          { path: 'referrals', element: <Navigate to="/admin" replace /> },
          { path: 'partner-enquiries', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },

  { path: '/legal', element: <PublicPage><LegalIndexPage /></PublicPage> },
  { path: '/legal/privacy', element: <PublicPage><PrivacyPage /></PublicPage> },
  { path: '/legal/terms', element: <PublicPage><TermsPage /></PublicPage> },
  { path: '/legal/cookies', element: <PublicPage><CookiesPage /></PublicPage> },
  { path: '/legal/acceptable-use', element: <PublicPage><AcceptableUsePage /></PublicPage> },
  { path: '/legal/refunds', element: <PublicPage><RefundsPage /></PublicPage> },
  { path: '/legal/complaints', element: <PublicPage><ComplaintsPage /></PublicPage> },
  { path: '/legal/accessibility', element: <PublicPage><AccessibilityPage /></PublicPage> },
  { path: '/legal/service-status', element: <PublicPage><ServiceStatusPage /></PublicPage> },
  { path: '/status', element: <PublicPage><StatusPage /></PublicPage> },
  { path: '/legal/eligibility', element: <PublicPage><EligibilityPage /></PublicPage> },
  { path: '/legal/data-retention', element: <PublicPage><DataRetentionPage /></PublicPage> },
  { path: '/legal/reporting', element: <PublicPage><ReportingPolicyPage /></PublicPage> },
  { path: '/legal/reporting-moderation', element: <PublicPage><ReportingPolicyPage /></PublicPage> },
  { path: '/legal/security', element: <PublicPage><SecurityPolicyPage /></PublicPage> },
  { path: '/legal/data-rights', element: <PublicPage><DataRightsPage /></PublicPage> },
  { path: '/support', element: <PublicPage><SupportPage /></PublicPage> },
  { path: '/report-issue', element: <PublicPage><ReportIssuePage /></PublicPage> },
  { path: '/help', element: <PublicPage><PublicHelpCentrePage /></PublicPage> },

  { path: '/services', element: <Navigate to="/" replace /> },
  { path: '/partners', element: <Navigate to="/" replace /> },
  { path: '/affiliates', element: <Navigate to="/" replace /> },
  { path: '/partner-enquiries', element: <Navigate to="/" replace /> },
  { path: '/partnership', element: <Navigate to="/" replace /> },
  { path: '/become-a-partner', element: <Navigate to="/" replace /> },
  { path: '/coming-soon', element: <RootLayout><S><ComingSoonPage /></S></RootLayout> },
  { path: '/team-directory', element: <Navigate to="/" replace /> },
  {
    path: '/services/ja-profile-studio',
    element: <AuthProvider><RootLayout><S><RedirectToHome /></S></RootLayout></AuthProvider>,
  },

  // Public profile routes must remain after every named public route.
  { path: '/invite/:token', element: <SiteStatusGate><S><InvitePage /></S></SiteStatusGate> },
  { path: '/profile/:seg1', element: <SiteStatusGate><S><ProfileRouter /></S></SiteStatusGate> },
  { path: '/profile/:seg1/team', element: <SiteStatusGate><S><ProfileRouter /></S></SiteStatusGate> },
  { path: '/profile/:seg1/:seg2', element: <SiteStatusGate><S><ProfileRouter /></S></SiteStatusGate> },
  { path: '/:seg1/:seg2', element: <SiteStatusGate><S><ProfileRouter /></S></SiteStatusGate> },
  { path: '/:seg1', element: <SiteStatusGate><S><ProfileRouter /></S></SiteStatusGate> },
  { path: '*', element: <NotFoundPage /> },
];

export type Path = '/' | '/login' | '/admin/login' | '/about' | '/plans' | '/contact';
export type Params = Record<string, string | undefined>;
