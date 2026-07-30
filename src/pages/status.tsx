/**
 * /status — Standalone service status page (NOT under /legal)
 * Fetches live data from /api/status every 60 seconds.
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Radio, Wrench, ArrowLeft, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/branding';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

type StatusValue = 'operational' | 'degraded' | 'outage' | 'maintenance';
type Category = 'core' | 'auth' | 'features' | 'integrations' | 'legal';

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  category: Category;
  status: StatusValue;
}

interface StatusResponse {
  success: boolean;
  overall: StatusValue;
  checkedAt: string;
  services: ServiceStatus[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  core:         'Core Platform',
  auth:         'Authentication',
  features:     'Features & Services',
  integrations: 'Integrations',
  legal:        'Legal & Compliance',
};

const CATEGORY_ORDER: Category[] = ['core', 'auth', 'features', 'integrations', 'legal'];

function StatusBadge({ status }: { status: StatusValue }) {
  const configs: Record<StatusValue, { label: string; className: string; icon: React.ReactNode }> = {
    operational: {
      label: 'Operational',
      className: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    degraded: {
      label: 'Degraded',
      className: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    outage: {
      label: 'Outage',
      className: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    maintenance: {
      label: 'Maintenance',
      className: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
  };
  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function OverallBanner({ overall, checkedAt, onRefresh, refreshing }: {
  overall: StatusValue;
  checkedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const configs: Record<StatusValue, { label: string; sub: string; className: string; icon: React.ReactNode }> = {
    operational: {
      label: 'All systems operational',
      sub: 'All JA Profile Studio services are running normally.',
      className: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
      icon: <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />,
    },
    degraded: {
      label: 'Some systems are degraded',
      sub: 'One or more services are experiencing reduced performance.',
      className: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
      icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />,
    },
    outage: {
      label: 'Service disruption detected',
      sub: 'One or more services are currently unavailable. Our team is investigating.',
      className: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
      icon: <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />,
    },
    maintenance: {
      label: 'Scheduled maintenance in progress',
      sub: 'Some services may be temporarily unavailable during maintenance.',
      className: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
      icon: <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />,
    },
  };
  const c = configs[overall] ?? configs.operational;
  const checkedDate = checkedAt
    ? new Date(checkedAt).toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div className={`flex items-start gap-4 p-5 rounded-2xl border ${c.className}`}>
      {c.icon}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground text-lg leading-tight">{c.label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{c.sub}</p>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          <Radio className="w-3 h-3" />
          Last checked: {checkedDate}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex-shrink-0 gap-1.5 border-border"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
}

export default function StatusPage() {
  const branding = useBranding();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const grouped = data
    ? CATEGORY_ORDER.reduce<Record<Category, ServiceStatus[]>>((acc, cat) => {
        acc[cat] = data.services.filter(s => s.category === cat);
        return acc;
      }, {} as Record<Category, ServiceStatus[]>)
    : null;

  return (
    <>
      <Helmet>
        <title>{`Service Status — ${branding.platform_name}`}</title>
        <meta name="description" content="Live operational status of JA Profile Studio services, operated by JA Group Services Ltd." />
        <link rel="canonical" href={`${APP_URL}/status`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`Service Status — ${branding.platform_name}`} />
        <meta property="og:description" content="Live operational status of JA Profile Studio services." />
        <meta property="og:url" content={`${APP_URL}/status`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Live Status</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Service Status</h1>
          <p className="text-muted-foreground leading-relaxed">
            Real-time operational status for all JA Profile Studio services, operated by{' '}
            <strong className="text-foreground">JA Group Services Ltd</strong>.
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-5 w-32 rounded bg-muted/40 animate-pulse" />
                <div className="h-40 rounded-xl bg-muted/30 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 mb-6">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Unable to load status</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Could not reach the status API. Please try again.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchStatus(true)} className="ml-auto border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400">
              Retry
            </Button>
          </div>
        )}

        {/* Live data */}
        {!loading && data && (
          <div className="space-y-8">
            {/* Overall banner */}
            <OverallBanner
              overall={data.overall}
              checkedAt={data.checkedAt}
              onRefresh={() => fetchStatus(true)}
              refreshing={refreshing}
            />

            {/* Per-category service lists */}
            {grouped && CATEGORY_ORDER.map(cat => {
              const services = grouped[cat];
              if (!services || services.length === 0) return null;
              return (
                <div key={cat}>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
                    {services.map(service => (
                      <div key={service.id} className="flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/20 transition-colors">
                        <div className="min-w-0 mr-4">
                          <p className="text-sm font-semibold text-foreground">{service.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                        </div>
                        <StatusBadge status={service.status} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="p-5 rounded-2xl bg-muted/30 border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Status legend</p>
              <div className="flex flex-wrap gap-3">
                {(['operational', 'degraded', 'outage', 'maintenance'] as StatusValue[]).map(s => (
                  <StatusBadge key={s} status={s} />
                ))}
              </div>
            </div>

            {/* Footer note */}
            <div className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-6">
              <p>
                This page reflects the live status of JA Profile Studio services operated by{' '}
                <strong className="text-foreground">JA Group Services Ltd</strong>.
                Status is checked automatically every 60 seconds. For urgent issues, contact us at{' '}
                <a href={`mailto:${branding.support_email}`} className="text-primary hover:underline">
                  {branding.support_email}
                </a>.
              </p>
              <p className="mt-3 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                <Link to="/legal" className="text-primary hover:underline">View legal documents</Link>
                {' · '}
                <Link to="/support" className="text-primary hover:underline">Contact support</Link>
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
