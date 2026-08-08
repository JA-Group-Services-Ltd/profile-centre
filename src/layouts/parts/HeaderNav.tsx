// @refresh reset
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import CustomerWebsitesMenu, { MobileCustomerWebsitesMenu } from '@/components/CustomerWebsitesMenu';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Home', isLink: true },
  { href: '/about', label: 'About', isLink: true },
  { href: '/plans', label: 'Plans', isLink: true },
  { href: '/#features', label: 'Features', isLink: false },
  { href: '/help', label: 'Help', isLink: true },
  { href: '/contact', label: 'Contact', isLink: true },
];

export default function SiteNavHeader() {
  const location = useLocation();
  const branding = useBranding();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'Account';

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 md:h-[72px] items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group" aria-label="Sousa Murray Profiles — home">
            {branding.platform_logo_url ? (
              <img src={branding.platform_logo_url} alt={branding.platform_name || 'Sousa Murray Profiles'} className="h-12 w-auto max-w-[170px] object-contain shrink-0 md:h-14 md:max-w-[200px]" />
            ) : (
              <span className="font-extrabold text-lg tracking-tight text-primary">Sousa Murray Profiles</span>
            )}
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map(item => item.isLink ? (
              <Link
                key={item.href}
                to={item.href}
                aria-current={location.pathname === item.href ? 'page' : undefined}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${location.pathname === item.href ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">{item.label}</a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2.5">
            <ThemeToggle />
            {loading ? (
              <div className="h-8 w-24 rounded-xl bg-muted animate-pulse" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(value => !value)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground" aria-expanded={dropdownOpen} aria-haspopup="true">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">{firstName.charAt(0).toUpperCase()}</div>
                  <span className="max-w-[100px] truncate">{firstName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-card shadow-xl py-1.5 z-50">
                    <div className="px-3 py-2 border-b border-border mb-1"><p className="text-xs font-semibold text-foreground truncate">{user.name}</p><p className="text-xs text-muted-foreground truncate">{user.email}</p></div>
                    <Link to="/dashboard/overview" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"><LayoutDashboard className="w-4 h-4 text-primary" /> Dashboard</Link>
                    <Link to="/dashboard/profile" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"><User className="w-4 h-4 text-primary" /> All Profiles</Link>
                    <div className="border-t border-border mt-1 pt-1">
                      <button onClick={() => { setDropdownOpen(false); logout(); }} className="flex items-start gap-2.5 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <LogOut className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><span className="block font-medium">Sign out</span><span className="block text-[10px] opacity-70 font-normal leading-tight mt-0.5">Signs you out of JA Group Services ID</span></span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm" className="font-medium">Log In</Button></Link>
                <Link to="/login"><Button size="sm" className="font-semibold rounded-xl px-5">Create Profile</Button></Link>
              </>
            )}
            <CustomerWebsitesMenu />
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setOpen(!open)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="lg:hidden border-t border-border bg-card px-4 py-4 space-y-1" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {NAV_ITEMS.map(item => item.isLink ? (
            <Link key={item.href} to={item.href} className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[46px]" onClick={() => setOpen(false)}>{item.label}</Link>
          ) : (
            <a key={item.href} href={item.href} className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[46px]" onClick={() => setOpen(false)}>{item.label}</a>
          ))}
          <Link to="/status" className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[46px]" onClick={() => setOpen(false)}>Service Status</Link>
          <MobileCustomerWebsitesMenu onNavigate={() => setOpen(false)} />

          {!loading && (
            <div className="pt-3 border-t border-border space-y-2">
              {user ? (
                <>
                  <div className="px-4 py-2 rounded-xl bg-muted/40"><p className="text-xs font-semibold text-foreground">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
                  <Link to="/dashboard/overview" onClick={() => setOpen(false)}><Button variant="outline" className="w-full justify-start gap-2 min-h-[48px] text-sm font-medium"><LayoutDashboard className="w-4 h-4" /> Dashboard</Button></Link>
                  <Link to="/dashboard/profile" onClick={() => setOpen(false)}><Button variant="outline" className="w-full justify-start gap-2 min-h-[48px] text-sm font-medium"><User className="w-4 h-4" /> All Profiles</Button></Link>
                  <Button variant="ghost" className="w-full justify-start gap-2 min-h-[48px] text-sm font-medium text-destructive hover:bg-destructive/10" onClick={() => { setOpen(false); logout(); }}><LogOut className="w-4 h-4" /> Sign out</Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login" className="w-full" onClick={() => setOpen(false)}><Button variant="outline" className="w-full min-h-[48px] text-sm font-semibold">Log In</Button></Link>
                  <Link to="/login" className="w-full" onClick={() => setOpen(false)}><Button className="w-full min-h-[48px] text-sm font-semibold">Create Profile</Button></Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
