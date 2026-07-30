/**
 * AdminGuard — wraps admin routes.
 * - If admin session is loading, shows spinner.
 * - If no admin session, redirects to /admin/login.
 * - If user is authenticated but role !== 'admin', shows Access Denied.
 * Backend middleware (requireAdmin / requireAdminApi) enforces the same check
 * server-side so this is defence-in-depth, not the only gate.
 */
import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAdminAuth } from '@/lib/admin-auth';

export default function AdminGuard() {
  const { adminUser, loading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !adminUser) {
      navigate('/admin/login', { replace: true });
    }
  }, [adminUser, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!adminUser) return null;

  // Extra safety: if somehow a non-admin user ends up here
  if (adminUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You don't have permission to access the admin portal.</p>
        <a href="/dashboard/overview" className="text-primary hover:underline text-sm">
          Go to your dashboard
        </a>
      </div>
    );
  }

  return <Outlet />;
}
