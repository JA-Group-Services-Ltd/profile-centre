import { useOnlineStatus } from './useOnlineStatus';

/**
 * useOfflineGuard
 *
 * Returns helpers for blocking mutations while the device is offline.
 *
 * Usage:
 *   const { isOnline, guardedSubmit, offlineProps } = useOfflineGuard();
 *
 *   // Wrap any async action — it no-ops silently when offline
 *   <Button onClick={guardedSubmit(handleSave)}>Save</Button>
 *
 *   // Or spread offlineProps onto a button/input to disable it + add tooltip
 *   <Button {...offlineProps}>Save</Button>
 */
export function useOfflineGuard() {
  const { isOnline } = useOnlineStatus();

  /**
   * Wraps an async handler — when offline the handler is never called.
   * Returns a plain function safe to pass to onClick / onSubmit.
   */
  function guardedSubmit<T extends unknown[]>(
    fn: (...args: T) => void | Promise<void>
  ) {
    return (...args: T) => {
      if (!isOnline) return;
      return fn(...args);
    };
  }

  /**
   * Spread these props onto any interactive element to disable it offline
   * and surface a title tooltip explaining why.
   */
  const offlineProps = isOnline
    ? {}
    : {
        disabled: true,
        title: 'You are offline — reconnect to make changes',
        'aria-disabled': true,
      };

  return { isOnline, guardedSubmit, offlineProps };
}
