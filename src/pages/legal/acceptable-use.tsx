import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

const APP_URL = 'https://japrofilestudio.jagroupservices.co.uk';

export default function AcceptableUsePage() {
  return (
    <>
      <Helmet>
        <title>Acceptable Use Policy — Profile Centre</title>
        <meta name="description" content="Acceptable Use Policy for Profile Centre. Read the rules governing acceptable use of the platform." />
        <link rel="canonical" href={`${APP_URL}/legal/acceptable-use`} />
      </Helmet>
      <h1 className="sr-only">Acceptable Use Policy</h1>
      <DynamicLegalPage
        policyKey="acceptable_use"
        canonicalPath="/legal/acceptable-use"
        metaDescription="Acceptable Use Policy for Profile Centre. Read the rules governing acceptable use of the platform."
      />
    </>
  );
}
