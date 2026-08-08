import { useEffect, useMemo, useState } from 'react';
import { fmtMonthYear } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import LegalLayout from '@/components/legal/LegalLayout';
import { useBranding } from '@/lib/branding';
import { AlertCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const APP_URL = 'https://sousamurrayprofiles.jagroupservices.co.uk';

type PolicyKey =
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'acceptable_use'
  | 'refunds'
  | 'complaints'
  | 'accessibility'
  | 'reporting'
  | 'security'
  | 'eligibility'
  | 'data_retention'
  | 'data_rights';

interface PolicyData {
  title: string;
  version: string;
  effective_date: string;
  content: string;
  last_updated: string;
}

interface Props {
  policyKey: PolicyKey;
  canonicalPath: string;
  metaDescription: string;
}

const TITLES: Record<PolicyKey, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookies: 'Cookie and Storage Technologies Policy',
  acceptable_use: 'Acceptable Use Policy',
  refunds: 'Refund and Cancellation Policy',
  complaints: 'Complaints Policy',
  accessibility: 'Accessibility Statement',
  reporting: 'Reporting and Moderation Policy',
  security: 'Security Policy',
  eligibility: 'Eligibility Policy',
  data_retention: 'Data Retention Policy',
  data_rights: 'Data Subject Rights',
};

/**
 * Older Admin policy records may contain HTML. Keep that backwards-compatible,
 * but never inject the raw stored HTML into the public page. This small browser
 * sanitiser strips active content and unsafe attributes/protocols first.
 */
function sanitiseLegacyHtml(value: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  parsed.querySelectorAll('script,iframe,object,embed,form,input,button,textarea,select,option,link,meta,base,style,svg,math').forEach(node => node.remove());

  parsed.body.querySelectorAll('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const raw = attribute.value.trim();
      if (name.startsWith('on') || ['srcdoc', 'formaction', 'style'].includes(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (['href', 'src'].includes(name) && raw) {
        const allowed = raw.startsWith('/') || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:');
        if (!allowed) {
          try {
            const parsedUrl = new URL(raw, APP_URL);
            if (!['https:', 'http:'].includes(parsedUrl.protocol)) element.removeAttribute(attribute.name);
          } catch {
            element.removeAttribute(attribute.name);
          }
        }
      }
    }
    if (element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return parsed.body.innerHTML;
}

export default function DynamicLegalPage({ policyKey, canonicalPath, metaDescription }: Props) {
  const branding = useBranding();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    setError(false);

    fetch(`/api/legal/${encodeURIComponent(policyKey)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !data?.data) throw new Error('policy_unavailable');
        setPolicy(data.data);
      })
      .catch(() => setError(true))
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [policyKey]);

  const title = policy?.title || TITLES[policyKey];
  const lastUpdated = policy?.last_updated ? fmtMonthYear(policy.last_updated) : '';
  const isHtml = Boolean(policy?.content.trimStart().startsWith('<'));
  const safeHtml = useMemo(
    () => (isHtml && policy?.content ? sanitiseLegacyHtml(policy.content) : ''),
    [isHtml, policy?.content],
  );

  return (
    <>
      <Helmet>
        <title>{`${title} — ${branding.platform_name || 'Sousa Murray Profiles'}`}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={APP_URL + canonicalPath} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={APP_URL + canonicalPath} />
        <meta property="og:title" content={`${title} — ${branding.platform_name || 'Sousa Murray Profiles'}`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:site_name" content={branding.platform_name || 'Sousa Murray Profiles'} />
      </Helmet>

      <LegalLayout title={title} lastUpdated={lastUpdated}>
        {loading && (
          <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading policy</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-500/10 p-6 text-foreground">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold mb-1">Policy temporarily unavailable</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We could not load the published policy. Please try again shortly or contact{' '}
                  <a className="text-primary underline" href="mailto:contact@jagroupservices.co.uk">contact@jagroupservices.co.uk</a>.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && policy && (
          <div>
            <div className="mb-6 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {policy.version && <span>Version {policy.version}</span>}
              {policy.effective_date && <span>Effective {policy.effective_date}</span>}
            </div>

            {isHtml ? (
              <div className="legal-prose" dangerouslySetInnerHTML={{ __html: safeHtml }} />
            ) : (
              <div className="legal-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-semibold text-foreground mt-8 mb-3 pb-2 border-b border-border">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-4 mb-1">{children}</h4>,
                    p: ({ children }) => <p className="text-sm text-foreground leading-relaxed mb-4">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-sm text-foreground">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-sm text-foreground">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-primary underline hover:text-primary/80 transition-colors"
                        target={href?.startsWith('http') ? '_blank' : undefined}
                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/30 pl-4 my-4 text-muted-foreground italic">{children}</blockquote>,
                    hr: () => <hr className="border-border my-6" />,
                    table: ({ children }) => <div className="overflow-x-auto mb-4"><table className="w-full text-sm border-collapse">{children}</table></div>,
                    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                    th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-foreground border border-border text-xs">{children}</th>,
                    td: ({ children }) => <td className="px-3 py-2 text-foreground border border-border align-top">{children}</td>,
                    tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
                    code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>,
                  }}
                >
                  {policy.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </LegalLayout>
    </>
  );
}
