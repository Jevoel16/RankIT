import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { normalizeRole } from '../utils/roles';

export default function ProtectedRouter({ roles, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  const allowed = (roles || []).map(normalizeRole);
  if (allowed.length > 0 && !allowed.includes(normalizeRole(user?.role))) {
    return <Navigate to="/?notice=Access%20Denied:%20Incorrect%20Role" replace />;
  }

  return children;
}
