/**
 * MobileBottomNav — fixed bottom navigation bar for the customer dashboard on mobile.
 *
 * Shows the 4 most important nav items as large tap targets, plus a "More" button
 * that opens a full-screen drawer with all remaining items.
 *
 * Design decisions:
 * - 4 primary items + More = 5 columns (comfortable on 320px+ screens)
 * - Minimum tap target: 48px tall (WCAG 2.5.5)
 * - Labels always visible (no icon-only ambiguity)
 * - "More" drawer lists all remaining items with full labels
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, X, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  notifBadge?: boolean;
}

interface Props {
  navItems: NavItem[];
  currentPath: string;
  unreadCount: number;
  unreadNotifCount: number;
  pendingInviteCount: number;
  onLogout: () => void;
}

// The 4 items always pinned to the bottom bar (in priority order).
// We pick from the actual navItems list so plan-gated items are respected.
const PRIMARY_PATHS = [
  '/dashboard/overview',
  '/dashboard/profile',
  '/dashboard/links',
  '/dashboard/billing',
];

export default function MobileBottomNav({
  navItems,
  currentPath,
  unreadCount,
  unreadNotifCount,
  pendingInviteCount,
  onLogout,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Build the 4 primary items from the allowed nav list
  const primaryItems = PRIMARY_PATHS
    .map(p => navItems.find(i => i.path === p))
    .filter(Boolean) as NavItem[];

  // Fill up to 4 if some primary paths aren't in navItems (e.g. seat-only user)
  if (primaryItems.length < 4) {
    for (const item of navItems) {
      if (!primaryItems.find(p => p.path === item.path)) {
        primaryItems.push(item);
        if (primaryItems.length === 4) break;
      }
    }
  }

  // Everything else goes in the More drawer
  const primaryPaths = new Set(primaryItems.map(i => i.path));
  const moreItems = navItems.filter(i => !primaryPaths.has(i.path));

  // Short label for bottom bar (first word, max 8 chars)
  const shortLabel = (label: string) => {
    const first = label.split(' ')[0];
    return first.length > 8 ? first.slice(0, 7) + '…' : first;
  };

  const isMoreActive = moreOpen || moreItems.some(i => i.path === currentPath);

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/98 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {primaryItems.map(item => {
            const active = currentPath === item.path;
            const showBadge = item.badge && unreadCount > 0;
            const showNotifBadge = item.notifBadge && unreadNotifCount > 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] relative transition-colors ${
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground active:bg-muted'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <item.icon className="w-6 h-6" />
                  {(showBadge || showNotifBadge) && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {showBadge ? (unreadCount > 9 ? '9+' : unreadCount) : (unreadNotifCount > 9 ? '9+' : unreadNotifCount)}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium leading-none">{shortLabel(item.label)}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition-colors ${
              isMoreActive ? 'text-primary' : 'text-muted-foreground active:bg-muted'
            }`}
            aria-label="More navigation options"
            aria-expanded={moreOpen}
          >
            <div className="relative">
              {moreOpen ? <X className="w-6 h-6" /> : <MoreHorizontal className="w-6 h-6" />}
              {/* Badge if any more-item has unread */}
              {!moreOpen && (pendingInviteCount > 0) && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-yellow-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More drawer — slides up from bottom */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative bg-card border-t border-border rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">More</h2>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 px-3 pb-2">
              <div className="grid grid-cols-2 gap-2">
                {moreItems.map(item => {
                  const active = currentPath === item.path;
                  const showBadge = item.badge && unreadCount > 0;
                  const showNotifBadge = item.notifBadge && unreadNotifCount > 0;
                  const showInviteBadge = item.path === '/dashboard/seat-invites' && pendingInviteCount > 0;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all relative ${
                        active
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-muted/50 text-foreground hover:bg-muted border border-transparent'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="flex-1 leading-tight">{item.label}</span>
                      {(showBadge || showNotifBadge) && (
                        <Badge className="bg-red-500 text-white border-0 text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                          {showBadge ? unreadCount : unreadNotifCount}
                        </Badge>
                      )}
                      {showInviteBadge && (
                        <Badge className="bg-yellow-500 text-white border-0 text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                          {pendingInviteCount}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Log out */}
              <button
                onClick={() => { setMoreOpen(false); onLogout(); }}
                className="mt-3 w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
