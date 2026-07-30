// Redirect legacy /legal/service-status → /status
import { Navigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';

export default function ServiceStatusRedirect() {
  return (
    <>
      <Helmet>
        <title>Service Status — JA Profile Studio</title>
        <meta name="description" content="Live operational status of JA Profile Studio services." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/status" />
      </Helmet>
      <h1 className="sr-only">Service Status</h1>
      <Navigate to="/status" replace />
    </>
  );
}
