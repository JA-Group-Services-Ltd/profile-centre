import { type RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import { S } from './lib/suspense-wrapper';
import HomePage from './pages/index';
import ProdNotFoundPage from './pages/_404';
import { AuthProvider } from './lib/auth';
import { AdminAuthProvider } from './lib/admin-auth';
import AdminGuard from './lib/AdminGuard';

const NotFoundPage = ProdNotFoundPage;

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
const DashboardLinks = lazy(() => import('./pages/dashboard/links'));
const DashboardQR = lazy(() => import('./pages/dashboard/qr-code'));
const DashboardEnquiries = lazy(() => import('./pages/dashboard/enquiries'));
const DashboardAnalytics = lazy(() => import('./pages/dashboard/analytics'));
const DashboardThemes = lazy(() => import('./pages/dashboard/themes'));
const DashboardBilling = lazy(() => import('./pages/dashboard/billing'));
const DashboardMessages = lazy(() => import('./pages/dashboard/messages'));
const DashboardSettings = lazy(() => import('./pages/dashboard/settings'));
const DashboardAccount = lazy(() => import('./pages/dashboard/account'));
const DashboardBusinessProfile = lazy(() => import('./pages/dashboard/business-profile'));
const DashboardBusinessSeats = lazy(() => import('./pages/dashboard/business-seats'));
const DashboardDataRequests = lazy(() => import('./pages/dashboard/data-requests'));
const DashboardAccountClosure = lazy(() => import('./pages/dashboard/account-closure'));
const DashboardEmailSignature = lazy(() => import('./pages/dashboard/email-signature'));

// Admin pages
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/index'));
const AdminUsers = lazy(() => import('./pages/admin/users'));
const AdminProfiles = lazy(() => import('./pages/admin/profiles'));
const AdminEnquiries = lazy(() => import('./pages/admin/enquiries'));
const AdminPlans = lazy(() => import('./pages/admin/plans'));
const AdminAnalytics = lazy(() => import('./pages/admin/analytics'));
const AdminSettings = lazy(() => import('./pages/admin/settings'));
const AdminAudit = lazy(() => import('./pages/admin/audit'));
const AdminLegal = lazy(() => import('./pages/admin/legal'));
const AdminSupportRequests = lazy(() => import('./pages/admin/support-requests'));
const AdminIssueReports = lazy(() => import('./pages/admin/issue-reports'));
const AdminCRM = lazy(() => import('./pages/admin/crm'));
const AdminDataRequests = lazy(() => import('./pages/admin/data-requests'));
const AdminClosureRequests = lazy(() => import('./pages/admin/closure-requests'));
const AdminAssistedAccess = lazy(() => import('./pages/admin/assisted-access'));

// Public profile pages
const ProfileRouter = lazy(() => import('./pages/profile-router'));

// Legal pages
const PrivacyPage = lazy(() => import('./pages/legal/privacy'));
const TermsPage = lazy(() => import('./pages/legal/terms'));
const CookiesPage = lazy(() => import('./pages/legal/cookies'));
const ReportIssuePage = lazy(() => import('./pages/report-issue'));

export const routesConfig: RouteObject[] = [
  {
    path: '/',
    element: (
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    ),
  },
  {
    path: '/login',
    element: <AuthProvider><S><LoginPage /></S></AuthProvider>,
  },
  {
    path: '/register',
    element: <S><RegisterPage /></S>,
  },
  {
    path: '/logged-out',
    element: <S><LoggedOutPage /></S>,
  },
  {
    path: '/admin/logged-out',
    element: <S><AdminLoggedOutPage /></S>,
  },
  {
    path: '/conversation/:threadId',
    element: <S><ConversationPage /></S>,
  },
  {
    path: '/admin/login',
    element: <AdminAuthProvider><S><AdminLoginPage /></S></AdminAuthProvider>,
  },
  {
    path: '/dashboard',
    element: <AuthProvider><S><DashboardLayout /></S></AuthProvider>,
    children: [
      { path: 'overview', element: <S><DashboardOverview /></S> },
      { path: 'profile', element: <S><DashboardProfile /></S> },
      { path: 'links', element: <S><DashboardLinks /></S> },
      { path: 'qr-code', element: <S><DashboardQR /></S> },
      { path: 'enquiries', element: <S><DashboardEnquiries /></S> },
      { path: 'analytics', element: <S><DashboardAnalytics /></S> },
      { path: 'themes', element: <S><DashboardThemes /></S> },
      { path: 'billing', element: <S><DashboardBilling /></S> },
      { path: 'messages', element: <S><DashboardMessages /></S> },
      { path: 'settings', element: <S><DashboardSettings /></S> },
      { path: 'account', element: <S><DashboardAccount /></S> },
      { path: 'business-profile', element: <S><DashboardBusinessProfile /></S> },
      { path: 'business-seats', element: <S><DashboardBusinessSeats /></S> },
      { path: 'data-requests', element: <S><DashboardDataRequests /></S> },
      { path: 'account-closure', element: <S><DashboardAccountClosure /></S> },
      { path: 'email-signature', element: <S><DashboardEmailSignature /></S> },
    ],
  },
  {
    path: '/admin',
    element: (
      <AdminAuthProvider>
        <AdminGuard />
      </AdminAuthProvider>
    ),
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
          { path: 'settings', element: <S><AdminSettings /></S> },
          { path: 'audit', element: <S><AdminAudit /></S> },
          { path: 'legal', element: <S><AdminLegal /></S> },
          { path: 'support-requests', element: <S><AdminSupportRequests /></S> },
          { path: 'issue-reports', element: <S><AdminIssueReports /></S> },
          { path: 'crm', element: <S><AdminCRM /></S> },
          { path: 'data-requests', element: <S><AdminDataRequests /></S> },
          { path: 'closure-requests', element: <S><AdminClosureRequests /></S> },
          { path: 'assisted-access', element: <S><AdminAssistedAccess /></S> },
        ],
      },
    ],
  },
  {
    path: '/legal/privacy',
    element: <S><PrivacyPage /></S>,
  },
  {
    path: '/legal/terms',
    element: <S><TermsPage /></S>,
  },
  {
    path: '/legal/cookies',
    element: <S><CookiesPage /></S>,
  },
  {
    path: '/report-issue',
    element: <S><ReportIssuePage /></S>,
  },
  {
    path: '/profile/:seg1',
    element: <S><ProfileRouter /></S>,
  },
  {
    path: '/profile/:seg1/:seg2',
    element: <S><ProfileRouter /></S>,
  },
  {
    path: '/:seg1/:seg2',
    element: <S><ProfileRouter /></S>,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export type Path = '/' | '/login' | '/admin/login';
export type Params = Record<string, string | undefined>;
