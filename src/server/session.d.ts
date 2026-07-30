import 'express-session';

declare module 'express-session' {
  interface SessionData {
    // ── Customer session ──────────────────────────────────────────────────
    /** Authenticated customer user ID */
    userId?: number;
    /** Authenticated customer user role */
    userRole?: string;
    /** PKCE code verifier for customer OIDC flow */
    customerOidcCodeVerifier?: string;
    /** State parameter for customer OIDC flow */
    customerOidcState?: string;
    /** id_token stored at login — used as id_token_hint on logout */
    customerIdToken?: string;
    /** Referral code to attribute to this signup (set during /auth/login, consumed in /auth/callback) */
    pendingReferralCode?: string;

    // ── Admin session ─────────────────────────────────────────────────────
    /** Authenticated admin user ID */
    adminUserId?: number;
    /** Authenticated admin user role (always 'admin') */
    adminUserRole?: string;
    /** PKCE code verifier for admin OIDC flow */
    adminOidcCodeVerifier?: string;
    /** State parameter for admin OIDC flow */
    adminOidcState?: string;
    /** id_token stored at login — used as id_token_hint on logout */
    adminIdToken?: string;

    // ── Admin PIN gate ────────────────────────────────────────────────────
    /**
     * Set to true after the admin successfully verifies their PIN.
     * NEVER store the PIN itself — only this boolean flag.
     * Cleared on logout and after PIN_SESSION_TIMEOUT_MS of inactivity.
     */
    adminPinVerified?: boolean;
    /**
     * Unix timestamp (ms) of the last successful PIN verification or
     * activity heartbeat. Used to enforce the 15-minute inactivity
     * timeout server-side. Cleared alongside adminPinVerified.
     */
    adminPinVerifiedAt?: number;

    // ── Account security PIN session ──────────────────────────────────────
    /**
     * Unix timestamp (ms) of the last successful account PIN verification.
     * Used to skip re-prompting within a 15-minute window.
     */
    accountPinVerifiedAt?: number;

    // ── Profile PIN unlock ────────────────────────────────────────────────
    /** Profile IDs that have been PIN-unlocked in this session (dashboard) */
    unlockedProfiles?: number[];
    /** Profile IDs whose public view has been PIN-unlocked in this session (visitors) */
    unlockedPublicProfiles?: number[];

    // ── Legacy (kept for backwards compat, unused in new flows) ──────────
    /** @deprecated use customerOidcCodeVerifier or adminOidcCodeVerifier */
    oidcCodeVerifier?: string;
    /** @deprecated use customerOidcState or adminOidcState */
    oidcState?: string;
    /** @deprecated no longer used */
    oidcType?: 'customer' | 'admin';
  }
}
