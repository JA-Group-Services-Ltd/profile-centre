import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

export default function DataRetentionPage() {
  return (
    <>
      <Helmet>
        <title>Data Retention Policy — Profile Centre</title>
        <meta name="description" content="Profile Centre data retention policy — how long we keep your data, what we delete and when, and your rights to request deletion." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/data-retention" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <h1 className="sr-only">Data Retention Policy</h1>
      <DynamicLegalPage
        policyKey="data_retention"
        canonicalPath="/legal/data-retention"
        metaDescription="Profile Centre data retention policy — how long we keep your data, what we delete and when, and your rights to request deletion."
      />
    </>
  );
}
