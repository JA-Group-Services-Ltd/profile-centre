import { useState, useEffect } from 'react';
import { fmtMonthYear } from '@/lib/date';
import { Helmet } from '@dr.pogodin/react-helmet';
import LegalLayout from '@/components/legal/LegalLayout';
import { useBranding } from '@/lib/branding';
import { Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

interface PolicyData {
  title: string;
  version: string;
  effective_date: string;
  content: string;
  last_updated: string;
}

interface Props {
  policyKey: 'terms' | 'privacy' | 'cookies' | 'acceptable_use' | 'refunds' | 'complaints' | 'accessibility' | 'reporting' | 'security' | 'eligibility' | 'data_retention' | 'data_rights';
  canonicalPath: string;
  metaDescription: string;
}

export default function DynamicLegalPage({ policyKey, canonicalPath, metaDescription }: Props) {
  const branding = useBranding();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/legal/' + policyKey)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success && d.data) {
          setPolicy(d.data);
        } else {
          setError(true);
        }
      })
      .catch(function() { setError(true); })
      .finally(function() { setLoading(false); });
  }, [policyKey]);

  const title = policy
    ? policy.title
    : policyKey === 'terms'
    ? 'Terms of Service'
    : policyKey === 'privacy'
    ? 'Privacy Policy'
    : policyKey === 'cookies'
    ? 'Cookie Policy'
    : policyKey === 'refunds'
    ? 'Refund Policy'
    : policyKey === 'complaints'
    ? 'Complaints Policy'
    : policyKey === 'accessibility'
    ? 'Accessibility Statement'
    : policyKey === 'reporting'
    ? 'Reporting & Moderation Policy'
    : policyKey === 'security'
    ? 'Security Policy'
    : 'Acceptable Use Policy';

  const lastUpdated = policy
    ? fmtMonthYear(policy.last_updated)
    : '';

  const isHtml = policy ? policy.content.trimStart().startsWith('<') : false;

  return (
    <>
      <Helmet>
        <title>{`${title} — ${branding.platform_name}`}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={APP_URL + canonicalPath} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={APP_URL + canonicalPath} />
        <meta property="og:title" content={`${title} — ${branding.platform_name}`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:site_name" content={branding.platform_name} />
      </Helmet>
      <h1 className="sr-only">{title}</h1>
      <LegalLayout title={title} lastUpdated={lastUpdated}>
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm">This policy is not currently available. Please check back later.</p>
          </div>
        )}
        {!loading && !error && policy && (
          <div>
            {policy.version && (
              <p className="text-xs text-muted-foreground mb-6">
                Version {policy.version} · Effective {policy.effective_date}
              </p>
            )}
            {isHtml ? (
              <div
                className="legal-prose"
                dangerouslySetInnerHTML={{ __html: policy.content }}
              />
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
                    a: ({ href, children }) => <a href={href} className="text-primary underline hover:text-primary/80 transition-colors" target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>{children}</a>,
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
