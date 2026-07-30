/**
 * Admin authentication context — reads from the admin session (adminUserId).
 * Completely separate from the customer auth context (useAuth / AuthProvider).
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  plan_id: number;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  loginAdmin: () => void;
  logoutAdmin: () => void;
  refreshAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAdmin = async () => {
    try {
      const res = await fetch('/api/auth/admin/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.data.user);
      } else {
        setAdminUser(null);
      }
    } catch {
      setAdminUser(null);
    }
  };

  useEffect(() => {
    refreshAdmin().finally(() => setLoading(false));
  }, []);

  const loginAdmin = () => {
    window.location.href = '/admin/auth/start';
  };

  const logoutAdmin = () => {
    window.location.href = '/admin/logout';
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, loading, loginAdmin, logoutAdmin, refreshAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
