import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Globe, Mail, CreditCard,
  BarChart3, Settings, LogOut, Menu, X, Shield, ScrollText,
  FileText, Bell, HelpCircle, AlertTriangle,
  Database, UserX, ShieldCheck, ShieldAlert,
  Users, Lock, MoreHorizontal, Send, ChevronRight,
  KeyRound, Building2, Package, Phone,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/admin-auth';
import { useBranding } from '@/lib/branding';
import AdminPinGate from './AdminPinGate';

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/admin/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    label: 'Users & Profiles',
    items: [
      { path: '/admin/users',            label: 'Users & CRM',          icon: Users },
      { path: '/admin/verify-customer',  label: 'Telephone Verify',     icon: Phone },
      { path: '/admin/profiles',         label: 'All Profiles',         icon: Globe },
      { path: '/admin/data-requests',    label: 'Data Requests',        icon: Database },
      { path: '/admin/closure-requests', label: 'Closure Requests',     icon: UserX },
      { path: '/admin/assisted-access',  label: 'Assisted Access',      icon: Lock },
    ],
  },
  {
    label: 'Communications',
    items: [
      { path: '/admin/compose-email',    label: 'Compose Email',      icon: Send },
      { path: '/admin/notifications',    label: 'Push Notifications', icon: Bell },
      { path: '/admin/enquiries',        label: 'Enquiries',          icon: Mail },
      { path: '/admin/support-requests', label: 'Support Requests',   icon: HelpCircle },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { path: '/admin/business-cards', label: 'Business Cards',    icon: Building2 },
      { path: '/admin/plans',          label: 'Plans & Pricing',   icon: CreditCard },
      { path: '/admin/addons',         label: 'Add-ons',           icon: Package },

    ],
  },
  {
    label: 'Moderation',
    items: [
      { path: '/admin/issue-reports', label: 'Reports & Moderation', icon: AlertTriangle },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { path: '/admin/admin-accounts', label: 'Admin Accounts',   icon: ShieldCheck },
      { path: '/admin/settings',       label: 'System Settings',  icon: Settings },
    ],
  },
  {
    label: 'Legal & Compliance',
    items: [
      { path: '/admin/legal',              label: 'Legal Policies',          icon: FileText },
      { path: '/admin/authority-report',   label: 'Authority Report',        icon: ShieldAlert },
      { path: '/admin/homepage',           label: 'Homepage Content',        icon: Globe },
    ],
  },
];

// ── Sidebar content ───────────────────────────────────────────────────────────

function SidebarContent({
  isActive,
  onClose,
  user,
  branding,
  onLogout,
}: {
  isActive: (path: string, exact?: boolean) => boolean;
  onClose: () => void;
  user: { name?: string; email?: string };
  branding: { platform_name?: string };
  onLogout: () => void;
}) {
  const initials = (user.name || user.email || 'A').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">

      {/* Brand header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Admin Portal</p>
            <p className="text-xs text-slate-400">{branding.platform_name}</p>
          </div>
        </div>
      </div>

      {/* Admin identity */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-xs">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate">{user.name || user.email}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold shrink-0 border border-primary/20 uppercase tracking-wide">
            Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item.path, item.exact);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                        {item.badge}
                      </span>
                    )}
                    {active && <ChevronRight className="w-3.5 h-3.5 text-white/60 shrink-0" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-slate-200 space-y-0.5">
        <Link
          to="/admin/admin-accounts?tab=pin"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
        >
          <KeyRound className="w-4 h-4 text-slate-400" />
          Manage PIN
        </Link>
        <Link
          to="/dashboard/overview"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
        >
          <Users className="w-4 h-4 text-slate-400" />
          Customer Dashboard
        </Link>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { adminUser } = useAdminAuth();
  const user = adminUser!;
  const branding = useBranding();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin portal always uses light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const handleLogout = () => {
    fetch('/api/admin/pin/clear', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.href = '/admin/logout';
  };

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/');

  const currentNav = navGroups.flatMap(g => g.items).find(i => isActive(i.path, i.exact));
  const currentGroup = navGroups.find(g => g.items.some(i => isActive(i.path, i.exact)));
  const initials = (user.name || user.email || 'A').charAt(0).toUpperCase();

  return (
    <AdminPinGate>
      <div className="admin-portal min-h-screen bg-slate-50 flex">

        {/* Desktop sidebar — fixed */}
        <aside className="hidden lg:flex w-60 xl:w-64 flex-col border-r border-slate-200 bg-white shrink-0 fixed inset-y-0 left-0 z-30 shadow-sm">
          <SidebarContent
            isActive={isActive}
            onClose={() => {}}
            user={user}
            branding={branding}
            onLogout={handleLogout}
          />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-72 bg-white flex flex-col z-50 shadow-2xl">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent
                isActive={isActive}
                onClose={() => setSidebarOpen(false)}
                user={user}
                branding={branding}
                onLogout={handleLogout}
              />
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 lg:ml-60 xl:ml-64 flex flex-col min-h-screen">

          {/* Top bar */}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xl px-4 sm:px-6 py-0 flex items-center gap-4 shadow-sm h-14">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-400 hidden sm:block shrink-0">Admin</span>
              {currentGroup && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block shrink-0" />
                  <span className="text-xs text-slate-400 hidden sm:block shrink-0">{currentGroup.label}</span>
                </>
              )}
              {currentNav && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-sm font-semibold text-slate-800 truncate">{currentNav.label}</span>
                </>
              )}
              {!currentNav && (
                <span className="text-sm font-semibold text-slate-800">Admin Portal</span>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                to="/admin/compose-email"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                <Send className="w-3.5 h-3.5" /> Compose
              </Link>
              <Link
                to="/admin/notifications"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Send notification"
              >
                <Bell className="w-4 h-4" />
              </Link>
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">{initials}</span>
                </div>
                <span className="text-xs font-medium text-slate-700">{(user.name || user.email || '').split(' ')[0]}</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <AdminMobileBottomNav isActive={isActive} onLogout={handleLogout} />
      </div>
    </AdminPinGate>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────

const ADMIN_PRIMARY: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: 'Users & CRM', icon: Users },
  { path: '/admin/profiles', label: 'Profiles', icon: Globe },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

const ADMIN_MORE: NavItem[] = [
  { path: '/admin/analytics',      label: 'Analytics',       icon: BarChart3 },
  { path: '/admin/audit',          label: 'Audit Log',       icon: ScrollText },
  { path: '/admin/compose-email',  label: 'Compose Email',   icon: Send },
  { path: '/admin/notifications',  label: 'Notifications',   icon: Bell },
  { path: '/admin/data-requests',  label: 'Data Requests',   icon: Database },
  { path: '/admin/closure-requests', label: 'Closures',      icon: UserX },
  { path: '/admin/enquiries',      label: 'Enquiries',       icon: Mail },
  { path: '/admin/business-cards', label: 'Business Cards',  icon: Building2 },
  { path: '/admin/support-requests', label: 'Support',       icon: HelpCircle },
  { path: '/admin/issue-reports',  label: 'Reports',         icon: AlertTriangle },
  { path: '/admin/assisted-access', label: 'Assisted Access', icon: Lock },
  { path: '/admin/plans',          label: 'Plans',           icon: CreditCard },
  { path: '/admin/admin-accounts', label: 'Admins',          icon: ShieldCheck },
  { path: '/admin/legal',          label: 'Legal',           icon: FileText },
];

function AdminMobileBottomNav({
  isActive,
  onLogout,
}: {
  isActive: (path: string, exact?: boolean) => boolean;
  onLogout: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = !moreOpen && ADMIN_MORE.some(i => isActive(i.path));

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/98 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {ADMIN_PRIMARY.map(item => {
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition-colors ${
                  active ? 'text-primary' : 'text-slate-400'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition-colors ${
              isMoreActive || moreOpen ? 'text-primary' : 'text-slate-400'
            }`}
            aria-label="More admin options"
            aria-expanded={moreOpen}
          >
            {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div
            className="relative bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl max-h-[78vh] flex flex-col"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-5 pb-2 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">All Sections</h2>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-2">
              <div className="grid grid-cols-2 gap-2">
                {ADMIN_MORE.map(item => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="flex-1 leading-tight text-xs">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={() => { setMoreOpen(false); onLogout(); }}
                className="mt-3 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
