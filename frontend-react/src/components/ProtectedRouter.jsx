import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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

  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to="/?notice=Access%20Denied:%20Incorrect%20Role" replace />;
  }

  return children;
}
