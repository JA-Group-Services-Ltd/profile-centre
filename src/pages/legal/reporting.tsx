import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

export default function ReportingPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Reporting &amp; Moderation Policy — JA Profile Studio</title>
        <meta name="description" content="JA Profile Studio reporting and moderation policy. How we handle reports of harmful or illegal content on public profiles." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/reporting" />
      </Helmet>
      <h1 className="sr-only">Reporting and Moderation Policy</h1>
      <DynamicLegalPage
        policyKey="reporting"
        canonicalPath="/legal/reporting"
        metaDescription="JA Profile Studio reporting and moderation policy. How we handle reports of harmful or illegal content on public profiles."
      />
    </>
  );
}
