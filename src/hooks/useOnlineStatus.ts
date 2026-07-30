import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useOnlineStatus
 *
 * Accurate offline detection for mobile devices.
 *
 * WHY navigator.onLine IS NOT ENOUGH:
 *   On mobile, navigator.onLine / the browser 'online' event only tells you
 *   whether the device has a network interface active — not whether that
 *   interface actually has internet access. A phone on a captive-portal Wi-Fi,
 *   a weak 1-bar signal, or an airplane-mode toggle can all report `online`
 *   while every real request fails.
 *
 * STRATEGY — two-layer detection:
 *   1. navigator.onLine / window events  → fast, zero-cost, used as the
 *      initial hint and to trigger probes immediately on state changes.
 *   2. Connectivity probe (HEAD /api/health) → confirms real internet access.
 *      - Runs once on mount.
 *      - Runs immediately whenever the browser fires 'online' or 'offline'.
 *      - Runs on a 30-second heartbeat while the app is in the foreground.
 *      - Pauses when the tab is hidden (visibilitychange) to save battery.
 *      - 5-second timeout so a dead connection is detected quickly.
 *
 * RETURNED VALUES:
 *   isOnline   — true when the probe confirms real connectivity (or on first
 *                render before the first probe completes, falls back to
 *                navigator.onLine so the UI isn't unnecessarily pessimistic).
 *   wasOffline — true for 4 seconds after connectivity is restored, so the
 *                "back online" banner can show briefly then auto-dismiss.
 */

const PROBE_URL = '/api/health';
const PROBE_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 30_000;

async function probeConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(PROBE_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  // Initialise from navigator.onLine so the very first render is sensible.
  // The probe will correct this within a few hundred milliseconds.
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  // Track whether we've ever confirmed connectivity so we don't flash
  // "back online" on the very first successful probe.
  const everConfirmedOnline = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyResult = useCallback((online: boolean) => {
    setIsOnline(prev => {
      if (online === prev) return prev; // no change — avoid re-render

      if (online) {
        // Only show "back online" if we previously knew we were offline
        if (everConfirmedOnline.current) {
          setWasOffline(true);
          setTimeout(() => setWasOffline(false), 4_000);
        }
        everConfirmedOnline.current = true;
      }
      return online;
    });

    if (online) everConfirmedOnline.current = true;
  }, []);

  const runProbe = useCallback(async () => {
    const result = await probeConnectivity();
    applyResult(result);
  }, [applyResult]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(runProbe, HEARTBEAT_MS);
  }, [runProbe]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Run probe immediately on mount
    runProbe();
    startHeartbeat();

    // Browser network events — run a probe immediately on change
    const handleOnline  = () => runProbe();
    const handleOffline = () => {
      // navigator says offline — trust it immediately (no probe needed)
      applyResult(false);
      runProbe(); // still probe in case it's a false alarm
    };

    // Pause heartbeat when tab is hidden, resume + re-probe when visible
    const handleVisibility = () => {
      if (document.hidden) {
        stopHeartbeat();
      } else {
        runProbe();
        startHeartbeat();
      }
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopHeartbeat();
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [runProbe, applyResult, startHeartbeat, stopHeartbeat]);

  return { isOnline, wasOffline };
}
