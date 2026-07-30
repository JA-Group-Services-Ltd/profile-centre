/**
 * useAccountSwitcher
 *
 * Manages the "switch account" flow. No data is persisted to localStorage
 * or sessionStorage — all state is in-memory for the current session only.
 *
 * "Switch account" flow:
 *   1. Navigate to /auth/logout?switch=1
 *   2. Server destroys session, redirects to Entra end_session
 *   3. Entra redirects to /logged-out?switch=1
 *   4. /logged-out detects the param → immediately redirects to /auth/login
 *
 * No personal data (name, email, user ID) is ever written to the device.
 */
// @refresh reset
import { useCallback, useEffect, useState } from 'react';
import type { User } from './auth';

export interface SavedAccount {
  id: number;
  name: string;
  email: string;
  lastSeen: string;
}

export function useAccountSwitcher(currentUser: User | null) {
  // useState #1 — matches hook slot from previous implementation (was lazy-init from localStorage).
  // Now always returns empty array; no data is read from or written to the device.
  const [savedAccounts] = useState<SavedAccount[]>(() => {
    if (!currentUser) return [];
    return [{
      id: currentUser.id,
      name: currentUser.name || currentUser.email,
      email: currentUser.email,
      lastSeen: new Date().toISOString(),
    }];
  });

  // otherAccounts is always empty — no device persistence.
  const otherAccounts: SavedAccount[] = [];

  // No-op effect — keeps hook count stable (was a localStorage sync in old version)
  useEffect(() => {}, [currentUser]);

  // No-op: nothing to remove since we don't persist anything.
  // useCallback #1 — matches hook slot from previous implementation.
  const removeAccount = useCallback((_id: number) => {}, []);

  /**
   * Switch to a different account (or add a new one).
   * Logs out the current session; /auth/logout passes ?switch=1 through
   * Entra's post_logout_redirect_uri so /logged-out auto-redirects to /auth/login.
   * useCallback #2 — matches hook slot from previous implementation.
   */
  const switchAccount = useCallback(() => {
    window.location.href = '/auth/logout?switch=1';
  }, []);

  return { savedAccounts, otherAccounts, removeAccount, switchAccount };
}
