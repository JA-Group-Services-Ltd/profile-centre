import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';
import { useBranding } from '@/lib/branding';

export default function ComplaintsPage() {
  const branding = useBranding();
  return (
    <>
      <Helmet>
        <title>{`Complaints Policy — ${branding.platform_name}`}</title>
        <meta name="description" content="Complaints Policy for JA Profile Studio. How to raise a complaint and what to expect from JA Group Services Ltd." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/complaints" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <h1 className="sr-only">Complaints Policy</h1>
      <DynamicLegalPage
        policyKey="complaints"
        canonicalPath="/legal/complaints"
        metaDescription="Complaints Policy for JA Profile Studio. How to raise a complaint and what to expect from JA Group Services Ltd."
      />
    </>
  );
}
