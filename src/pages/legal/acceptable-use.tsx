import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

export default function AcceptableUsePage() {
  return (
    <>
      <Helmet>
        <title>Acceptable Use Policy — Sousa Murray Profiles</title>
        <meta name="description" content="Acceptable Use Policy for Sousa Murray Profiles. Read the rules governing acceptable use of the platform." />
        <link rel="canonical" href={`${APP_URL}/legal/acceptable-use`} />
      </Helmet>
      <h1 className="sr-only">Acceptable Use Policy</h1>
      <DynamicLegalPage
        policyKey="acceptable_use"
        canonicalPath="/legal/acceptable-use"
        metaDescription="Acceptable Use Policy for Sousa Murray Profiles. Read the rules governing acceptable use of the platform."
      />
    </>
  );
}
