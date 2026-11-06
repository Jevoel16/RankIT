import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { normalizeRole } from '../utils/roles';
import { Skeleton } from './ui';

export default function ProtectedRouter({ roles, children }) {
  const { isAuthenticated, sessionChecked, user } = useAuth();
  const location = useLocation();

  // Don't route on a cached profile until the server confirms the session.
  if (!sessionChecked) {
    return (
      <div aria-busy="true" aria-label="Checking your session">
        <Skeleton lines={6} height={20} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  const allowed = (roles || []).map(normalizeRole);
  if (allowed.length > 0 && !allowed.includes(normalizeRole(user?.role))) {
    return <Navigate to="/?notice=Access%20Denied:%20Incorrect%20Role" replace />;
  }

  return children;
}
