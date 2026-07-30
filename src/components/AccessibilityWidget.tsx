/**
 * AccessibilityWidget — comprehensive floating accessibility panel.
 *
 * WCAG 2.1 AA+ controls:
 *   Vision:     High contrast, colour blindness filters, greyscale, text size,
 *               line height, letter spacing, focus highlight, reading guide
 *   Motion:     Reduce motion, pause animations
 *   Cursor:     Normal / Large / X-Large
 *   Cognitive:  Dyslexia font, reading guide, highlight links
 *   Colour:     Light mode / Dark mode override
 *   Audio:      Text-to-speech (Speak mode) — reads hovered / focused text
 *   Keyboard:   Full keyboard navigation, visible focus ring
 *
 * Preferences stored in localStorage and applied as CSS classes / inline styles on <html>.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Accessibility, X, Type, Eye, Zap, BookOpen, RotateCcw,
  AlignLeft, MousePointer2, Focus, Minus, Plus,
  ChevronDown, ChevronUp, Sun, Moon, Volume2, VolumeX,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface A11yPrefs {
  fontSize: number;           // 80–160 (%)
  highContrast: boolean;
  reducedMotion: boolean;
  dyslexiaFont: boolean;
  lineHeight: 'normal' | 'relaxed' | 'loose';
  letterSpacing: 'normal' | 'wide' | 'wider';
  cursorSize: 'normal' | 'large' | 'xl';
  focusHighlight: boolean;
  colourFilter: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'greyscale';
  readingGuide: boolean;
  pauseAnimations: boolean;
  colourMode: 'system' | 'light' | 'dark';
  highlightLinks: boolean;
  speakMode: boolean;
  speakRate: number;          // 0.5–2.0
  speakPitch: number;         // 0.5–2.0
  speakVolume: number;        // 0–1
}

const DEFAULTS: A11yPrefs = {
  fontSize: 100,
  highContrast: false,
  reducedMotion: false,
  dyslexiaFont: false,
  lineHeight: 'normal',
  letterSpacing: 'normal',
  cursorSize: 'normal',
  focusHighlight: false,
  colourFilter: 'none',
  readingGuide: false,
  pauseAnimations: false,
  colourMode: 'system',
  highlightLinks: false,
  speakMode: false,
  speakRate: 1.0,
  speakPitch: 1.0,
  speakVolume: 1.0,
};

// Accessibility preferences use sessionStorage — preferences apply for this
// browser session only and are not persisted to the device across sessions.
// This avoids storing any user data in localStorage.
const STORAGE_KEY = 'ja_a11y_prefs_v3';

const COLOUR_FILTERS: Record<string, string> = {
  none: 'none',
  protanopia: 'url(#a11y-protanopia)',
  deuteranopia: 'url(#a11y-deuteranopia)',
  tritanopia: 'url(#a11y-tritanopia)',
  greyscale: 'grayscale(100%)',
};

// ── Apply prefs to DOM ────────────────────────────────────────────────────

function applyPrefs(prefs: A11yPrefs) {
  const html = document.documentElement;

  // Font size
  html.style.fontSize = `${prefs.fontSize}%`;

  // High contrast
  html.classList.toggle('a11y-high-contrast', prefs.highContrast);

  // Reduced motion / pause animations
  html.classList.toggle('a11y-reduced-motion', prefs.reducedMotion || prefs.pauseAnimations);

  // Dyslexia font
  html.classList.toggle('a11y-dyslexia', prefs.dyslexiaFont);

  // Line height
  html.classList.remove('a11y-lh-relaxed', 'a11y-lh-loose');
  if (prefs.lineHeight === 'relaxed') html.classList.add('a11y-lh-relaxed');
  if (prefs.lineHeight === 'loose') html.classList.add('a11y-lh-loose');

  // Letter spacing
  html.classList.remove('a11y-ls-wide', 'a11y-ls-wider');
  if (prefs.letterSpacing === 'wide') html.classList.add('a11y-ls-wide');
  if (prefs.letterSpacing === 'wider') html.classList.add('a11y-ls-wider');

  // Cursor size
  html.classList.remove('a11y-cursor-large', 'a11y-cursor-xl');
  if (prefs.cursorSize === 'large') html.classList.add('a11y-cursor-large');
  if (prefs.cursorSize === 'xl') html.classList.add('a11y-cursor-xl');

  // Focus highlight
  html.classList.toggle('a11y-focus-highlight', prefs.focusHighlight);

  // Highlight links
  html.classList.toggle('a11y-highlight-links', prefs.highlightLinks);

  // Colour filter (applied to body, not html, to avoid filtering the widget itself)
  const body = document.body;
  if (body) body.style.filter = COLOUR_FILTERS[prefs.colourFilter] ?? 'none';

  // Colour mode override
  html.classList.remove('a11y-force-light', 'a11y-force-dark');
  if (prefs.colourMode === 'light') html.classList.add('a11y-force-light');
  if (prefs.colourMode === 'dark') html.classList.add('a11y-force-dark');
}

// ── Reading guide ─────────────────────────────────────────────────────────

function ReadingGuide({ active }: { active: boolean }) {
  const [y, setY] = useState(-100);
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [active]);
  if (!active) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[9998] pointer-events-none"
      style={{ top: y - 14, height: 28, background: 'rgba(59,130,246,0.12)', borderTop: '2px solid rgba(59,130,246,0.35)', borderBottom: '2px solid rgba(59,130,246,0.35)' }}
      aria-hidden="true"
    />
  );
}

// ── SVG colour-blindness filters ──────────────────────────────────────────

function ColourFilters() {
  return (
    <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true" focusable="false">
      <defs>
        <filter id="a11y-protanopia">
          <feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" />
        </filter>
        <filter id="a11y-deuteranopia">
          <feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0" />
        </filter>
        <filter id="a11y-tritanopia">
          <feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0" />
        </filter>
      </defs>
    </svg>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `a11y-section-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="border-t border-border/50 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between mb-2 text-left"
        aria-expanded={open}
        aria-controls={id}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {icon}{title}
        </div>
        {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
      {open && <div id={id} className="space-y-2">{children}</div>}
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────

function ToggleRow({ icon: Icon, label, value, onChange, description }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
        value ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
      }`}
    >
      <div className="flex items-start gap-2.5 text-left">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <span className="text-sm font-medium block">{label}</span>
          {description && <span className="text-xs opacity-70 block">{description}</span>}
        </div>
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ml-2 ${value ? 'bg-primary' : 'bg-muted'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

// ── Speak mode hook ───────────────────────────────────────────────────────

function useSpeakMode(prefs: A11yPrefs) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!prefs.speakMode || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.trim());
    u.rate = prefs.speakRate;
    u.pitch = prefs.speakPitch;
    u.volume = prefs.speakVolume;
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [prefs.speakMode, prefs.speakRate, prefs.speakPitch, prefs.speakVolume]);

  useEffect(() => {
    if (!prefs.speakMode) {
      window.speechSynthesis?.cancel();
      return;
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const text = target.getAttribute('aria-label') || target.getAttribute('title') || target.textContent || '';
      if (text.trim().length > 1 && text.trim().length < 500) speak(text);
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const text = target.getAttribute('aria-label') || target.getAttribute('placeholder') || target.textContent || '';
      if (text.trim().length > 1) speak(text);
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('focusin', handleFocus);
      window.speechSynthesis?.cancel();
    };
  }, [prefs.speakMode, speak]);
}

// ── Main widget ───────────────────────────────────────────────────────────

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULTS);
  const [liveMsg, setLiveMsg] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useSpeakMode(prefs);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as A11yPrefs;
        const merged = { ...DEFAULTS, ...parsed };
        setPrefs(merged);
        applyPrefs(merged);
      }
    } catch { /* ignore */ }
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const update = (patch: Partial<A11yPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyPrefs(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    // Announce change to screen readers
    const keys = Object.keys(patch);
    if (keys.length === 1) setLiveMsg(`${keys[0].replace(/_/g, ' ')} updated`);
  };

  const reset = () => {
    setPrefs(DEFAULTS);
    applyPrefs(DEFAULTS);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setLiveMsg('All accessibility settings reset to defaults');
  };

  const activeCount = [
    prefs.fontSize !== 100,
    prefs.highContrast,
    prefs.reducedMotion,
    prefs.dyslexiaFont,
    prefs.lineHeight !== 'normal',
    prefs.letterSpacing !== 'normal',
    prefs.cursorSize !== 'normal',
    prefs.focusHighlight,
    prefs.colourFilter !== 'none',
    prefs.readingGuide,
    prefs.pauseAnimations,
    prefs.colourMode !== 'system',
    prefs.highlightLinks,
    prefs.speakMode,
  ].filter(Boolean).length;

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <>
      <ColourFilters />
      <ReadingGuide active={prefs.readingGuide} />

      {/* ARIA live region for screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{liveMsg}</div>

      <style>{`
        /* High contrast */
        .a11y-high-contrast { filter: contrast(1.6) brightness(1.05) !important; }

        /* Reduced motion */
        .a11y-reduced-motion *, .a11y-reduced-motion *::before, .a11y-reduced-motion *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }

        /* Dyslexia font */
        .a11y-dyslexia, .a11y-dyslexia * {
          font-family: 'Arial', 'Helvetica', sans-serif !important;
          letter-spacing: 0.07em !important;
          word-spacing: 0.14em !important;
          line-height: 1.9 !important;
        }

        /* Line height */
        .a11y-lh-relaxed, .a11y-lh-relaxed * { line-height: 1.9 !important; }
        .a11y-lh-loose, .a11y-lh-loose * { line-height: 2.4 !important; }

        /* Letter spacing */
        .a11y-ls-wide, .a11y-ls-wide * { letter-spacing: 0.06em !important; }
        .a11y-ls-wider, .a11y-ls-wider * { letter-spacing: 0.12em !important; }

        /* Cursor sizes */
        .a11y-cursor-large * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M8 4l16 12-7 1 4 8-3 1-4-8-6 5z' fill='%23000' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E") 8 4, auto !important; }
        .a11y-cursor-xl * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M12 6l24 18-10 1.5 6 12-4.5 1.5-6-12-9 7.5z' fill='%23000' stroke='%23fff' stroke-width='2'/%3E%3C/svg%3E") 12 6, auto !important; }

        /* Focus highlight */
        .a11y-focus-highlight *:focus,
        .a11y-focus-highlight *:focus-visible {
          outline: 3px solid #3B82F6 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 6px rgba(59,130,246,0.25) !important;
        }

        /* Highlight links */
        .a11y-highlight-links a {
          text-decoration: underline !important;
          text-decoration-thickness: 2px !important;
          text-underline-offset: 3px !important;
          outline: 1px dashed currentColor !important;
          outline-offset: 2px !important;
        }

        /* Force light mode */
        .a11y-force-light {
          color-scheme: light !important;
          --background: 0 0% 100%;
          --foreground: 222.2 84% 4.9%;
          --card: 0 0% 100%;
          --card-foreground: 222.2 84% 4.9%;
          --muted: 210 40% 96.1%;
          --muted-foreground: 215.4 16.3% 46.9%;
          --border: 214.3 31.8% 91.4%;
          --primary: 221.2 83.2% 53.3%;
          --primary-foreground: 210 40% 98%;
        }

        /* Force dark mode */
        .a11y-force-dark {
          color-scheme: dark !important;
          --background: 222.2 84% 4.9%;
          --foreground: 210 40% 98%;
          --card: 222.2 84% 4.9%;
          --card-foreground: 210 40% 98%;
          --muted: 217.2 32.6% 17.5%;
          --muted-foreground: 215 20.2% 65.1%;
          --border: 217.2 32.6% 17.5%;
          --primary: 217.2 91.2% 59.8%;
          --primary-foreground: 222.2 47.4% 11.2%;
        }

        /* Screen reader only */
        .sr-only {
          position: absolute; width: 1px; height: 1px;
          padding: 0; margin: -1px; overflow: hidden;
          clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
        }
      `}</style>

      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Accessibility options"
            aria-modal="true"
            className="bg-card border border-border rounded-2xl shadow-2xl w-80 max-h-[82vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                <Accessibility className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Accessibility</span>
                {activeCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold" aria-label={`${activeCount} settings active`}>
                    {activeCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Close accessibility panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-0">

              {/* Colour Mode */}
              <Section title="Display Mode" icon={<Sun className="w-3 h-3" />}>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: 'system', label: 'System', icon: <Accessibility className="w-3.5 h-3.5" /> },
                    { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
                    { value: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => update({ colourMode: opt.value })}
                      aria-pressed={prefs.colourMode === opt.value}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                        prefs.colourMode === opt.value
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Text */}
              <Section title="Text" icon={<Type className="w-3 h-3" />}>
                {/* Font size */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Text size: {prefs.fontSize}%</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => update({ fontSize: Math.max(80, prefs.fontSize - 10) })}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                        aria-label="Decrease text size"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => update({ fontSize: Math.min(160, prefs.fontSize + 10) })}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                        aria-label="Increase text size"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1" role="group" aria-label="Text size presets">
                    {[80, 90, 100, 120, 140, 160].map(size => (
                      <button
                        key={size}
                        onClick={() => update({ fontSize: size })}
                        aria-pressed={prefs.fontSize === size}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-all ${
                          prefs.fontSize === size
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {size === 80 ? 'XS' : size === 90 ? 'S' : size === 100 ? 'M' : size === 120 ? 'L' : size === 140 ? 'XL' : 'XXL'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line height */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Line spacing</p>
                  <div className="flex gap-1.5" role="group" aria-label="Line spacing">
                    {(['normal', 'relaxed', 'loose'] as const).map(lh => (
                      <button key={lh} onClick={() => update({ lineHeight: lh })} aria-pressed={prefs.lineHeight === lh}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${prefs.lineHeight === lh ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {lh === 'normal' ? 'Normal' : lh === 'relaxed' ? 'Wide' : 'Wider'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Letter spacing */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Letter spacing</p>
                  <div className="flex gap-1.5" role="group" aria-label="Letter spacing">
                    {(['normal', 'wide', 'wider'] as const).map(ls => (
                      <button key={ls} onClick={() => update({ letterSpacing: ls })} aria-pressed={prefs.letterSpacing === ls}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${prefs.letterSpacing === ls ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {ls === 'normal' ? 'Normal' : ls === 'wide' ? 'Wide' : 'Wider'}
                      </button>
                    ))}
                  </div>
                </div>

                <ToggleRow icon={BookOpen} label="Dyslexia-friendly font" description="Increases spacing and uses a clearer font" value={prefs.dyslexiaFont} onChange={v => update({ dyslexiaFont: v })} />
              </Section>

              {/* Vision */}
              <Section title="Vision" icon={<Eye className="w-3 h-3" />}>
                <ToggleRow icon={Eye} label="High contrast" description="Increases colour contrast for better readability" value={prefs.highContrast} onChange={v => update({ highContrast: v })} />
                <ToggleRow icon={Focus} label="Highlight focus" description="Shows a strong blue ring around focused elements" value={prefs.focusHighlight} onChange={v => update({ focusHighlight: v })} />
                <ToggleRow icon={AlignLeft} label="Reading guide" description="Horizontal line follows your cursor to guide reading" value={prefs.readingGuide} onChange={v => update({ readingGuide: v })} />
                <ToggleRow icon={Eye} label="Highlight links" description="Underlines and outlines all links on the page" value={prefs.highlightLinks} onChange={v => update({ highlightLinks: v })} />

                {/* Colour filter */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Colour blindness filter</p>
                  <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Colour blindness filter">
                    {[
                      { value: 'none', label: 'None' },
                      { value: 'protanopia', label: 'Protanopia' },
                      { value: 'deuteranopia', label: 'Deuteranopia' },
                      { value: 'tritanopia', label: 'Tritanopia' },
                      { value: 'greyscale', label: 'Greyscale' },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => update({ colourFilter: opt.value as A11yPrefs['colourFilter'] })}
                        aria-pressed={prefs.colourFilter === opt.value}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${prefs.colourFilter === opt.value ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Motion */}
              <Section title="Motion" icon={<Zap className="w-3 h-3" />} defaultOpen={false}>
                <ToggleRow icon={Zap} label="Reduce motion" description="Minimises animations and transitions" value={prefs.reducedMotion} onChange={v => update({ reducedMotion: v })} />
                <ToggleRow icon={Zap} label="Pause all animations" description="Stops all CSS animations and transitions" value={prefs.pauseAnimations} onChange={v => update({ pauseAnimations: v })} />
              </Section>

              {/* Cursor */}
              <Section title="Cursor" icon={<MousePointer2 className="w-3 h-3" />} defaultOpen={false}>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Cursor size</p>
                  <div className="flex gap-1.5" role="group" aria-label="Cursor size">
                    {(['normal', 'large', 'xl'] as const).map(cs => (
                      <button key={cs} onClick={() => update({ cursorSize: cs })} aria-pressed={prefs.cursorSize === cs}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${prefs.cursorSize === cs ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {cs === 'normal' ? 'Normal' : cs === 'large' ? 'Large' : 'X-Large'}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Speak mode */}
              <Section title="Text to Speech" icon={<Volume2 className="w-3 h-3" />} defaultOpen={false}>
                {hasSpeech ? (
                  <>
                    <ToggleRow
                      icon={prefs.speakMode ? Volume2 : VolumeX}
                      label="Speak mode"
                      description="Reads text aloud when you hover or focus elements"
                      value={prefs.speakMode}
                      onChange={v => update({ speakMode: v })}
                    />
                    {prefs.speakMode && (
                      <div className="space-y-3 pt-1">
                        {/* Rate */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-muted-foreground">Speed: {prefs.speakRate.toFixed(1)}×</label>
                          </div>
                          <input type="range" min="0.5" max="2" step="0.1"
                            value={prefs.speakRate}
                            onChange={e => update({ speakRate: parseFloat(e.target.value) })}
                            className="w-full h-1.5 rounded-full accent-primary"
                            aria-label="Speech rate"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                            <span>Slow</span><span>Fast</span>
                          </div>
                        </div>
                        {/* Pitch */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-muted-foreground">Pitch: {prefs.speakPitch.toFixed(1)}</label>
                          </div>
                          <input type="range" min="0.5" max="2" step="0.1"
                            value={prefs.speakPitch}
                            onChange={e => update({ speakPitch: parseFloat(e.target.value) })}
                            className="w-full h-1.5 rounded-full accent-primary"
                            aria-label="Speech pitch"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                            <span>Low</span><span>High</span>
                          </div>
                        </div>
                        {/* Volume */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-muted-foreground">Volume: {Math.round(prefs.speakVolume * 100)}%</label>
                          </div>
                          <input type="range" min="0" max="1" step="0.05"
                            value={prefs.speakVolume}
                            onChange={e => update({ speakVolume: parseFloat(e.target.value) })}
                            className="w-full h-1.5 rounded-full accent-primary"
                            aria-label="Speech volume"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const u = new SpeechSynthesisUtterance('Text to speech is working correctly.');
                            u.rate = prefs.speakRate; u.pitch = prefs.speakPitch; u.volume = prefs.speakVolume;
                            window.speechSynthesis.cancel();
                            window.speechSynthesis.speak(u);
                          }}
                          className="w-full py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                        >
                          Test voice
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">Text-to-speech is not supported in your browser.</p>
                )}
              </Section>

              {/* Reset */}
              <div className="pt-3 border-t border-border/50 mt-3">
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                  aria-label="Reset all accessibility settings to defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset all to defaults
                </button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Settings are saved in your browser
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Floating trigger button */}
        <button
          ref={triggerRef}
          onClick={() => setOpen(v => !v)}
          className="relative w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center text-white hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
          aria-label={open ? 'Close accessibility options' : 'Open accessibility options'}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Accessibility options"
        >
          <Accessibility className="w-5 h-5" />
          {activeCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center font-bold shadow"
              aria-hidden="true"
            >
              {activeCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
