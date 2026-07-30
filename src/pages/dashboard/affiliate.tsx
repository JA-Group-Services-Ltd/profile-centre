/**
 * Dashboard — Affiliate Programme (REMOVED)
 * This feature has been discontinued. Redirect to overview.
 */
import { Navigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
export default function DashboardAffiliateRemoved() {
  return (
    <>
      <Helmet>
        <title>Affiliate — JA Profile Studio</title>
        <meta name="description" content="Affiliate programme." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/dashboard/affiliate" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 className="sr-only">Affiliate</h1>
      <Navigate to="/dashboard/overview" replace />
    </>
  );
}
