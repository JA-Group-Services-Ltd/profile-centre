/**
 * ThemeToggle
 * Cycles through light → dark → system modes.
 * When the user is logged in, the preference is saved to the server so it
 * persists across sessions and devices.
 * No localStorage — privacy-safe.
 */
import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Pref = 'light' | 'dark' | 'system';

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyPref(pref: Pref) {
  const root = document.documentElement;
  const isDark = pref === 'dark' || (pref === 'system' && getSystemPrefersDark());
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

async function loadSavedPref(): Promise<Pref> {
  try {
    const res = await fetch('/api/me/appearance', { credentials: 'include' });
    if (!res.ok) return 'dark';
    const data = await res.json();
    return (data.preference as Pref) ?? 'dark';
  } catch {
    return 'dark';
  }
}

async function savePref(pref: Pref) {
  try {
    await fetch('/api/me/appearance', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preference: pref }),
    });
  } catch { /* non-fatal */ }
}

interface ThemeToggleProps {
  className?: string;
  /** If true, shows a full labelled button row (for settings pages) */
  expanded?: boolean;
}

export default function ThemeToggle({ className = '', expanded = false }: ThemeToggleProps) {
  const [pref, setPref] = useState<Pref>('dark');
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    loadSavedPref().then(p => {
      setPref(p);
      applyPref(p);
      setLoaded(true);
    });
  }, []);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyPref('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [pref]);

  const cycle = () => {
    const order: Pref[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(pref) + 1) % order.length];
    setPref(next);
    applyPref(next);
    savePref(next);
  };

  const icons: Record<Pref, React.ReactNode> = {
    light: <Sun className="w-4 h-4" />,
    dark: <Moon className="w-4 h-4" />,
    system: <Monitor className="w-4 h-4" />,
  };

  const labels: Record<Pref, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  };

  const isDark = document.documentElement.classList.contains('dark');

  if (!loaded) return null;

  if (expanded) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {(['light', 'dark', 'system'] as Pref[]).map(p => (
          <button
            key={p}
            onClick={() => { setPref(p); applyPref(p); savePref(p); }}
            aria-label={`Switch to ${labels[p]} mode`}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${pref === p
                ? 'bg-primary text-primary-foreground shadow-sm'
                : isDark
                  ? 'bg-white/10 hover:bg-white/15 text-muted-foreground border border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-muted-foreground border border-slate-200'
              }
            `}
          >
            {icons[p]}
            <span>{labels[p]}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={cycle}
      aria-label={`Appearance: ${labels[pref]} — click to change`}
      title={`Appearance: ${labels[pref]} — click to change`}
      className={`
        relative flex items-center justify-center w-9 h-9 rounded-xl
        transition-all duration-200
        ${isDark
          ? 'bg-white/10 hover:bg-white/20 text-orange-400 border border-white/15'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
        }
        ${className}
      `}
    >
      {icons[pref]}
    </button>
  );
}
