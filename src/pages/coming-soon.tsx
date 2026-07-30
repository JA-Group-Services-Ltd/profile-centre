/**
 * Coming Soon page
 *
 * Shows a live countdown to the admin-configured launch date.
 * All data is fetched from /api/coming-soon-config — never localStorage.
 * Countdown ticks client-side once the target date is loaded.
 */
import { useState, useEffect, useRef } from 'react';
import { coming_soon } from 'virtual:content';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function getCountdown(targetIso: string): CountdownParts {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const totalSecs = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSecs / 86400),
    hours: Math.floor(totalSecs % 86400 / 3600),
    minutes: Math.floor(totalSecs % 3600 / 60),
    seconds: totalSecs % 60,
    expired: false
  };
}

function CountdownUnit({ value, label }: {value: number;label: string;}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-card border border-border flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>);

}

export default function ComingSoonPage() {
  const branding = useBranding();
  const name = branding.platform_name || 'JA Profile Studio';

  const [launchDate, setLaunchDate] = useState<string>('');
  const [headline, setHeadline] = useState('Coming Soon');
  const [subtext, setSubtext] = useState('We are putting the finishing touches on something great.');
  const [countdown, setCountdown] = useState<CountdownParts | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch config from server — no localStorage
  useEffect(() => {
    fetch('/api/coming-soon-config').
    then((r) => r.json()).
    then((d) => {
      if (d.success) {
        if (d.headline) setHeadline(d.headline);
        if (d.subtext) setSubtext(d.subtext);
        if (d.launchDate) setLaunchDate(d.launchDate);
      }
    }).
    catch(() => {});
  }, []);

  // Start countdown once we have a launch date
  useEffect(() => {
    if (!launchDate) {setCountdown(null);return;}

    setCountdown(getCountdown(launchDate));

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setCountdown(getCountdown(launchDate));
    }, 1000);

    return () => {if (tickRef.current) clearInterval(tickRef.current);};
  }, [launchDate]);

  const showCountdown = countdown && !countdown.expired;

  return (
    <>
      <Helmet>
        <title>{`${headline} — ${name}`}</title>
        <meta name="description" content={`${name} is launching soon. ${subtext}`} />
        <link rel="canonical" href={APP_URL + '/'} />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content={`${headline} — ${name}`} />
        <meta property="og:description" content={subtext} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2">
            {branding.platform_logo_url ?
            <img src={branding.platform_logo_url} alt={name} className="h-8 w-auto object-contain" /> :

            <span className="font-bold text-foreground text-lg">{name}</span>
            }
          </div>
        </header>

        {/* Main content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8">
              <Clock className="w-10 h-10 text-primary" />
            </div>

            {/* Eyebrow */}
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">
              {name}
            </p>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight" style={{ color: "#09419a" }}>
              {headline}
            </h1>

            {/* Subheading */}
            <p className="text-xl text-muted-foreground mb-4 leading-relaxed max-w-lg mx-auto" style={{ color: "#0f1729" }}>
              {subtext}
            </p>
            <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mb-10">
              {name} is a digital business card platform that lets you create, share, and manage your professional profile — all in one place.
            </p>

            {/* Live countdown */}
            {showCountdown &&
            <div className="mb-12">
                <p className="text-sm text-muted-foreground mb-5">Launching in</p>
                <div className="flex items-start justify-center gap-3 sm:gap-5">
                  <CountdownUnit value={countdown.days} label="Days" />
                  <div className="text-2xl font-bold text-muted-foreground mt-4">:</div>
                  <CountdownUnit value={countdown.hours} label="Hours" />
                  <div className="text-2xl font-bold text-muted-foreground mt-4">:</div>
                  <CountdownUnit value={countdown.minutes} label="Minutes" />
                  <div className="text-2xl font-bold text-muted-foreground mt-4">:</div>
                  <CountdownUnit value={countdown.seconds} label="Seconds" />
                </div>
              </div>
            }

            {/* Features preview */}
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left mb-10">
              {coming_soon.features.map((f, i) =>
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </div>
              )}
            </div>

            {/* No sign-in link on coming soon — access is not available yet */}
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 px-6 py-6 border-t border-border">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
            <p className="shrink-0">&copy; {new Date().getFullYear()} {branding.legal_company_name || name}. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href="/legal/privacy" className="hover:text-foreground transition-colors whitespace-nowrap">Privacy Policy</a>
              <a href="/legal/terms" className="hover:text-foreground transition-colors whitespace-nowrap">Terms of Service</a>
              <a href="/legal/cookies" className="hover:text-foreground transition-colors whitespace-nowrap">Cookie Policy</a>
              {branding.contact_email && (
                <a
                  href={`mailto:${branding.contact_email}`}
                  className="hover:text-foreground transition-colors"
                  style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                >
                  {branding.contact_email}
                </a>
              )}
            </div>
          </div>
        </footer>
      </div>
    </>);

}