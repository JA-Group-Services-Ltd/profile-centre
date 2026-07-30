import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

export default function DataRightsPage() {
  return (
    <>
      <Helmet>
        <title>Data Subject Rights — JA Profile Studio</title>
        <meta name="description" content="Your data subject rights under UK GDPR — access, rectification, erasure, portability, and how to exercise them with JA Profile Studio." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/data-rights" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <h1 className="sr-only">Data Subject Rights</h1>
      <DynamicLegalPage
        policyKey="data_rights"
        canonicalPath="/legal/data-rights"
        metaDescription="Your data subject rights under UK GDPR — access, rectification, erasure, portability, and how to exercise them with JA Profile Studio."
      />
    </>
  );
}
