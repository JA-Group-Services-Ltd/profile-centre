/**
 * AutoLogoutProvider
 *
 * Wraps the dashboard. Sends a heartbeat to the server every 60s when the
 * user is active. Polls session-status every 30s to check idle time.
 * Shows a warning modal at 18 minutes of inactivity, logs out at 20 minutes.
 *
 * ZERO localStorage — all state is server-side session + React memory.
 * Activity is detected via mousemove, keydown, click, scroll, touchstart.
 */
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Clock, LogOut } from 'lucide-react';

const HEARTBEAT_INTERVAL_MS = 60_000;   // send heartbeat every 60s
const POLL_INTERVAL_MS      = 30_000;   // poll session status every 30s
const WARN_IDLE_SECONDS     = 18 * 60;  // show warning at 18 min
const MAX_IDLE_SECONDS      = 20 * 60;  // force logout at 20 min

interface Props { children: ReactNode }

export default function AutoLogoutProvider({ children }: Props) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [suspicious, setSuspicious] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggedOutRef = useRef(false);

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/security/heartbeat', {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* silent — network blip */ }
  }, []);

  const doLogout = useCallback(async (reason: 'idle' | 'suspicious') => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;
    try {
      await fetch('/api/security/logout-idle', { method: 'POST', credentials: 'include' });
    } catch { /* best-effort */ }
    navigate(`/auth/logout?reason=${reason}`);
  }, [navigate]);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/security/session-status', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      setIdleSeconds(data.idleSeconds ?? 0);

      if (data.suspicious) {
        setSuspicious(true);
        setShowWarning(true);
        return;
      }

      if (data.idleSeconds >= MAX_IDLE_SECONDS) {
        doLogout('idle');
        return;
      }

      if (data.idleSeconds >= WARN_IDLE_SECONDS) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    } catch { /* silent */ }
  }, [doLogout]);

  // Track user activity — update ref (no state, no re-render)
  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning is showing and user is active, dismiss it
    setShowWarning(false);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'pointerdown'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    // Initial heartbeat
    sendHeartbeat();

    heartbeatTimerRef.current = setInterval(() => {
      const idleSinceLastActivity = (Date.now() - lastActivityRef.current) / 1000;
      // Only send heartbeat if user was active in the last heartbeat window
      if (idleSinceLastActivity < HEARTBEAT_INTERVAL_MS / 1000) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    pollTimerRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [onActivity, sendHeartbeat, pollStatus]);

  const remainingSeconds = Math.max(0, MAX_IDLE_SECONDS - idleSeconds);
  const remainingMins = Math.floor(remainingSeconds / 60);
  const remainingSecs = remainingSeconds % 60;

  const stayLoggedIn = async () => {
    setShowWarning(false);
    await sendHeartbeat();
  };

  return (
    <>
      {children}

      {/* Idle / suspicious session warning modal */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent
          className="bg-card border-border max-w-sm"
          onInteractOutside={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${suspicious ? 'text-red-400' : 'text-blue-400'}`}>
              {suspicious
                ? <><ShieldAlert className="w-5 h-5" /> Security Alert</>
                : <><Clock className="w-5 h-5" /> Session Expiring</>}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {suspicious
                ? 'Unusual activity has been detected on your session. For your security, you will be logged out immediately.'
                : `You have been inactive for a while. For your security, you will be automatically logged out in:`}
            </DialogDescription>
          </DialogHeader>

          {!suspicious && (
            <div className="flex items-center justify-center py-4">
              <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 bg-blue-500/10 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-blue-400 tabular-nums">
                  {String(remainingMins).padStart(2, '0')}:{String(remainingSecs).padStart(2, '0')}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">remaining</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {!suspicious && (
              <Button
                onClick={stayLoggedIn}
                className="flex-1 bg-primary"
              >
                Stay Logged In
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => doLogout(suspicious ? 'suspicious' : 'idle')}
              className={`flex items-center gap-2 ${suspicious ? 'flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-border text-muted-foreground'}`}
            >
              <LogOut className="w-4 h-4" />
              Log Out Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
