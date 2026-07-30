/**
 * Organisation Seats — /dashboard/organisation-seats
 * Renders the full Organisation Seats manager.
 * Old route /dashboard/business-seats redirects here.
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import BusinessSeatsDashboard from './business-seats';

export default function OrganisationSeatsPage() {
  return (
    <>
      <Helmet>
        <title>Organisation Seats — Dashboard</title>
        <meta name="description" content="Manage organisation seats and team members." />
        <link rel="canonical" href="/dashboard/organisation-seats" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <h1 className="sr-only">Organisation Seats</h1>
      <BusinessSeatsDashboard />
    </>
  );
}
