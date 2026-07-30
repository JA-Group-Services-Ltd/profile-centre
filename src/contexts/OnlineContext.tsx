/**
 * OnlineContext
 *
 * Provides `isOnline` to any component in the tree without prop-drilling.
 * DashboardLayout is the provider. Dashboard pages and components consume it
 * via `useIsOnline()` to skip fetches or show offline-aware empty states.
 *
 * Why a context rather than calling useOnlineStatus() everywhere:
 *  - useOnlineStatus() runs its own probe + heartbeat on every call site.
 *  - A single provider at the layout level runs one probe and shares the result.
 */
import { createContext, useContext } from 'react';

export const OnlineContext = createContext<boolean>(true);

/** Returns true when the device has confirmed internet connectivity. */
export function useIsOnline(): boolean {
  return useContext(OnlineContext);
}
