import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';
import { useBranding } from '@/lib/branding';

export default function RefundsPage() {
  const branding = useBranding();
  return (
    <>
      <Helmet>
        <title>{`Refund Policy — ${branding.platform_name}`}</title>
        <meta name="description" content="Refund Policy for Profile Centre. Learn about our policy on refunds, cancellations and billing disputes." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/refunds" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <h1 className="sr-only">Refund Policy</h1>
      <DynamicLegalPage
        policyKey="refunds"
        canonicalPath="/legal/refunds"
        metaDescription="Refund Policy for Profile Centre. Learn about our policy on refunds, cancellations and billing disputes."
      />
    </>
  );
}
