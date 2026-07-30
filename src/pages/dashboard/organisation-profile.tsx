/**
 * Organisation Profile — /dashboard/organisation-profile
 * Renders the full Organisation Profile editor.
 * Old route /dashboard/business-profile redirects here.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import BusinessProfileDashboard from './business-profile';

export default function OrganisationProfilePage() {
  return (
    <>
      <Helmet>
        <title>Organisation Profile — Dashboard</title>
        <meta name="description" content="Edit your organisation profile, team, services and opening hours." />
        <link rel="canonical" href="/dashboard/organisation-profile" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <h1 className="sr-only">Organisation Profile</h1>
      <BusinessProfileDashboard />
    </>
  );
}
