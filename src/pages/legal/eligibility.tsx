import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

export default function EligibilityPage() {
  return (
    <>
      <Helmet>
        <title>Eligibility Policy — JA Profile Studio</title>
        <meta name="description" content="JA Profile Studio eligibility policy — this service is available to UK-based users aged 18 and over only." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/eligibility" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <h1 className="sr-only">Eligibility Policy</h1>
      <DynamicLegalPage
        policyKey="eligibility"
        canonicalPath="/legal/eligibility"
        metaDescription="JA Profile Studio eligibility policy — this service is available to UK-based users aged 18 and over only."
      />
    </>
  );
}
