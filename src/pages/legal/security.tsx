import { Helmet } from '@dr.pogodin/react-helmet';
import DynamicLegalPage from './DynamicLegalPage';

export default function SecurityPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Security Policy — JA Profile Studio</title>
        <meta name="description" content="JA Profile Studio security policy. Our approach to keeping your account and data secure." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/legal/security" />
      </Helmet>
      <h1 className="sr-only">Security Policy</h1>
      <DynamicLegalPage
        policyKey="security"
        canonicalPath="/legal/security"
        metaDescription="JA Profile Studio security policy. Our approach to keeping your account and data secure."
      />
    </>
  );
}
