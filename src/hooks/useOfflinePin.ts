/**
 * useOfflinePin — DISABLED
 *
 * The offline PIN feature has been removed. No PIN hash is stored anywhere
 * on the client (no localStorage, no sessionStorage). All PIN verification
 * goes through the server at /api/security/pin/verify.
 *
 * These stubs are kept so existing call sites compile without changes.
 */

export async function recordPinSuccess(_pin: string, _userId: number | string): Promise<void> {
  // No-op — offline PIN storage removed for security
}

export function clearOfflinePin(): void {
  // No-op — nothing stored
}

export function hasStoredOfflinePin(_userId?: number | string): boolean {
  return false;
}

export async function verifyOfflinePin(_pin: string, _userId: number | string): Promise<boolean> {
  return false;
}
