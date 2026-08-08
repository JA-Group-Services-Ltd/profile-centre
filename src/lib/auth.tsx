import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface SeatWorkspace {
  profileId: number;
  businessName: string;
  bizSlug: string;
  role: string;
  permissions: {
    canEditProfile: boolean;
    canEditLinks: boolean;
    canViewAnalytics: boolean;
    canViewEnquiries: boolean;
    canManageEnquiries: boolean;
    canViewMessages: boolean;
    canManageMessages: boolean;
    canManageSeats: boolean;
    canManageRoles: boolean;
    canManageBilling: boolean;
    canManageSettings: boolean;
    canManageThemes: boolean;
    canExportData: boolean;
    canDeleteWorkspace: boolean;
  };
  ownerHasActiveBusinessPlan: boolean;
  /** Human-readable plan name of the workspace owner, e.g. "Professional" */
  ownerPlanName: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  plan_id: number;
  lifetime_access: number;
  created_at: string;
  customer_number: string | null;
  has_stripe_customer: number;
  plan_name: string | null;
  plan_slug: string | null;
  has_messaging: number | null;
  max_seats: number | null;
  subscription_status: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  is_paused: number;
  pause_reason: string | null;
  // ── Computed entitlement fields (from server-side getEffectiveUserAccess) ──
  hasBusinessAccess: boolean;
  hasUltimateBusinessAccess: boolean;
  hasProfessionalAccess: boolean;
  hasBusinessProfileAccess: boolean;
  hasStarterAccess: boolean;
  hasFreeAccess: boolean;
  hasNoActivePlan: boolean;
  hasLifetimeAccess: boolean;
  hasCustomDomainAccess: boolean;
  isDowngraded: boolean;
  isSeatUser: boolean;
  seatWorkspaces: SeatWorkspace[];
  // ── Free trial ──────────────────────────────────────────────────────────────
  trialActive: boolean;
  trialEndsAt: string | null;
  trialExpired: boolean;
  // ── Post-trial plan selection ────────────────────────────────────────────────
  inPlanSelectionPeriod: boolean;
  planSelectionDeadline: string | null;
  isNoPlan: boolean;
  accountStatus: string;
  // ── Payment grace period ─────────────────────────────────────────────────────
  inPaymentGracePeriod: boolean;
  paymentGraceUntil: string | null;
  paymentOverdue: boolean;
  // ── Beta features ────────────────────────────────────────────────────────────
  hasEmailSignatureBeta?: boolean;
  // ── Plan capability — direct from DB, use instead of flag chains ─────────────
  max_org_profiles: number;
  // ── Assisted access session ──────────────────────────────────────────────────
  isAssistedSession?: boolean;
  assistedRequestId?: number;
  assistedAdminId?: number;
  assistedAdminName?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginCustomer: () => void;
  loginAdmin: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  /** Redirect to Microsoft Entra External ID (customer tenant) */
  const loginCustomer = () => {
    window.location.href = '/auth/login';
  };

  /** Redirect to Microsoft Entra workforce tenant (admin OIDC — bypasses the admin login page) */
  const loginAdmin = () => {
    window.location.href = '/admin/auth/start';
  };

  const logout = () => {
    window.location.href = '/auth/logout';
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginCustomer, loginAdmin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

const NULL_AUTH: AuthContextType = {
  user: null,
  loading: false,
  loginCustomer: () => {},
  loginAdmin: () => {},
  logout: () => {},
  refreshUser: async () => {},
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  // Return a safe no-op context when used outside AuthProvider (e.g. public pages)
  return ctx ?? NULL_AUTH;
}
