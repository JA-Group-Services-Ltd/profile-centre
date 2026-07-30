import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';
import { useBranding } from '@/lib/branding';

export default function AccessibilityPage() {
  const branding = useBranding();
  return (
    <>
      <Helmet>
        <title>{`Accessibility Statement — ${branding.platform_name}`}</title>
        <meta name="description" content="Accessibility Statement for JA Profile Studio. Our commitment to making this platform accessible to all users." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/accessibility" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <h1 className="sr-only">Accessibility Statement</h1>
      <DynamicLegalPage
        policyKey="accessibility"
        canonicalPath="/legal/accessibility"
        metaDescription="Accessibility Statement for JA Profile Studio. Our commitment to making this platform accessible to all users."
      />
    </>
  );
}
