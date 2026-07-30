/**
 * /dashboard/site-editor — permanently redirected.
 * The custom HTML/CSS editor has been removed. Users customise their profiles
 * through the built-in profile builders instead.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';

export default function SiteEditorRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/dashboard/business-profile', { replace: true });
  }, [navigate]);
  return (
    <>
      <Helmet>
        <title>Redirecting — Dashboard</title>
        <meta name="description" content="Redirecting to the profile builder." />
        <link rel="canonical" href="/dashboard/business-profile" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <h1 className="sr-only">Redirecting to profile builder</h1>
    </>
  );
}
