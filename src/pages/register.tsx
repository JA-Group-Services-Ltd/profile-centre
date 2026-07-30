import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Registration is handled via Microsoft OIDC — redirect to login
export default function RegisterPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/login', { replace: true }); }, [navigate]);
  return null;
}
