/**
 * SiteThemeProvider
 * Reads site_color_mode, site_primary_color, site_secondary_color, site_accent_color
 * from /api/branding (public endpoint) and applies them to the document root.
 *
 * - Adds/removes the `dark` class on <html> based on site_color_mode.
 * - Overrides --primary, --secondary, --accent CSS variables with admin-set hex values.
 *
 * This runs once on mount and whenever the branding cache is refreshed.
 */
import { useEffect, type ReactNode } from 'react';

interface ThemeSettings {
  site_color_mode?: string;
  site_primary_color?: string;
  site_secondary_color?: string;
  site_accent_color?: string;
}

/** Convert a hex colour (#RRGGBB) to an HSL string suitable for CSS variables (e.g. "217 91% 60%"). */
function hexToHslString(hex: string): string | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement;

  // Dark / light mode — NEVER apply to admin portal routes
  // The admin portal always stays dark to remain readable regardless of site setting
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (!isAdminRoute) {
    const mode = settings.site_color_mode ?? 'dark';
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } else {
    // Always ensure dark mode on admin routes
    root.classList.add('dark');
  }

  // Brand colours — set as HSL values so Tailwind opacity modifiers work
  const primary = settings.site_primary_color;
  const secondary = settings.site_secondary_color;
  const accent = settings.site_accent_color;

  if (primary) {
    const hsl = hexToHslString(primary);
    if (hsl) {
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
    }
  }
  if (secondary) {
    const hsl = hexToHslString(secondary);
    if (hsl) root.style.setProperty('--secondary', hsl);
  }
  if (accent) {
    const hsl = hexToHslString(accent);
    if (hsl) root.style.setProperty('--accent', hsl);
  }
}

let themeApplied = false;

/** Try to load the logged-in user's appearance preference and apply it.
 *  Returns true if a user preference was found and applied. */
async function applyUserPreference(): Promise<boolean> {
  try {
    const res = await fetch('/api/me/appearance', { credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.success) return false;
    const pref: string = data.preference ?? 'dark';
    const root = document.documentElement;
    const isAdminRoute = window.location.pathname.startsWith('/admin');
    if (isAdminRoute) {
      root.classList.add('dark');
      return true;
    }
    if (pref === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersDark ? root.classList.add('dark') : root.classList.remove('dark');
    } else if (pref === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    return true;
  } catch {
    return false;
  }
}

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (themeApplied) return;

    // On dashboard routes, try user preference first; fall back to site branding setting
    const isDashboard = window.location.pathname.startsWith('/dashboard');

    if (isDashboard) {
      applyUserPreference().then(applied => {
        if (!applied) {
          // Not logged in or no preference — fall back to site branding
          fetch('/api/branding')
            .then(r => r.json())
            .then(data => { if (data.success) applyTheme(data.data); })
            .catch(() => document.documentElement.classList.add('dark'));
        }
        themeApplied = true;
      });
    } else {
      fetch('/api/branding')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            applyTheme(data.data);
            themeApplied = true;
          }
        })
        .catch(() => {
          document.documentElement.classList.add('dark');
        });
    }
  }, []);

  return <>{children}</>;
}

/** Call this after admin saves theme changes to immediately apply without page reload. */
export function applyThemeSettings(settings: ThemeSettings) {
  themeApplied = false; // allow re-apply
  applyTheme(settings);
  themeApplied = true;
}
