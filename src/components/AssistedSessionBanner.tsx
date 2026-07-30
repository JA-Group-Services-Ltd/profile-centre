/**
 * AssistedSessionBanner
 *
 * Shown at the top of every dashboard page when an admin is currently
 * impersonating a customer via Assisted Access.
 *
 * Polls /api/assisted-access/session-info every 30 s to detect expiry
 * or customer-side revocation.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionInfo {
  requestId: number;
  adminName: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  targetUserId: number;
  expiresAt: string | null;
  accessAreas: string; // JSON array string
  status: string;
}

function fmtExpiry(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = d.getTime() - now;
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m remaining`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m remaining` : `${hrs}h remaining`;
  } catch { return ''; }
}

export default function AssistedSessionBanner() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [exiting, setExiting] = useState(false);
  const [timeLabel, setTimeLabel] = useState('');

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/assisted-access/session-info', { credentials: 'include' });
      const d = await res.json();
      if (d.success && d.data) {
        setSession(d.data);
        setTimeLabel(fmtExpiry(d.data.expiresAt));
      } else {
        setSession(null);
      }
    } catch {
      // Network error — don't clear session, keep showing banner
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const poll = setInterval(fetchSession, 30_000);
    return () => clearInterval(poll);
  }, [fetchSession]);

  // Update time label every minute
  useEffect(() => {
    if (!session?.expiresAt) return;
    const tick = setInterval(() => setTimeLabel(fmtExpiry(session.expiresAt)), 60_000);
    return () => clearInterval(tick);
  }, [session?.expiresAt]);

  const handleExit = async () => {
    setExiting(true);
    try {
      await fetch('/api/admin/assisted-access/end-impersonation', {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* best-effort */ }
    setSession(null);
    setExiting(false);
    navigate('/admin/assisted-access');
  };

  if (!session) return null;

  const areas: string[] = (() => { try { return JSON.parse(session.accessAreas); } catch { return []; } })();
  const isExpiringSoon = session.expiresAt
    ? new Date(session.expiresAt).getTime() - Date.now() < 15 * 60 * 1000
    : false;

  return (
    <div className={`w-full z-50 border-b px-4 py-2.5 flex items-center gap-3 flex-wrap ${
      isExpiringSoon
        ? 'bg-orange-500/10 border-orange-500/30'
        : 'bg-amber-500/10 border-amber-500/30'
    }`}>
      {/* Icon */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isExpiringSoon
          ? <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
          : <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
        }
        <span className={`text-xs font-semibold ${isExpiringSoon ? 'text-orange-300' : 'text-amber-300'}`}>
          Assisted Access Session
        </span>
      </div>

      {/* Who you're acting as */}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-amber-200/90">
          Acting as{' '}
          <strong className="text-amber-100">
            {session.targetUserName || session.targetUserEmail || `User #${session.targetUserId}`}
          </strong>
          {session.targetUserEmail && session.targetUserName && (
            <span className="text-amber-200/60 ml-1">({session.targetUserEmail})</span>
          )}
        </span>
        {areas.length > 0 && (
          <span className="ml-2 text-xs text-amber-200/50">
            · {areas.map(a => a.replace(/_/g, ' ')).join(', ')}
          </span>
        )}
      </div>

      {/* Expiry */}
      {timeLabel && (
        <div className="flex items-center gap-1 text-xs text-amber-200/70 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {timeLabel}
        </div>
      )}

      {/* Exit button */}
      <Button
        size="sm"
        onClick={handleExit}
        disabled={exiting}
        className={`h-7 text-xs gap-1.5 flex-shrink-0 ${
          isExpiringSoon
            ? 'bg-orange-600 hover:bg-orange-700 text-white'
            : 'bg-amber-600 hover:bg-amber-700 text-white'
        }`}
      >
        {exiting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
        Exit Session
      </Button>
    </div>
  );
}
