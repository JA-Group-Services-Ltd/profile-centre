/**
 * Admin — Messaging (REMOVED)
 * /admin/messaging
 *
 * Direct user-to-user messaging has been removed from the platform.
 * Staff-to-user communication is handled exclusively via Compose Email (/admin/compose-email).
 */
import { Navigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';

export default function AdminMessagingRemoved() {
  return (
    <>
      <Helmet>
        <title>Messaging — Admin Portal</title>
        <meta name="description" content="Direct messaging has been removed. Staff-to-user communication is handled via Compose Email." />
        <link rel="canonical" href="https://japrofilestudio.jagroupservices.co.uk/admin/messaging" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <h1 className="sr-only">Messaging — Removed</h1>
      <Navigate to="/admin" replace />
    </>
  );
}
