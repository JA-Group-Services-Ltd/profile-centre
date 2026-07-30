/**
 * NotificationBell — bell icon with unread badge.
 * Clicking navigates to /dashboard/notifications (full page).
 * Polls /api/notifications every 30s for the unread count only.
 */
import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setUnread(data.unread ?? 0);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={() => navigate('/dashboard/notifications')}
      className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
    >
      <Bell className="w-5 h-5 text-muted-foreground" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
