import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRouter({ roles, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const normalizedRole = user?.role === 'tallier' ? 'tabulator' : user?.role;
  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => (role === 'tallier' ? 'tabulator' : role))
    : roles;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (normalizedRoles && normalizedRoles.length > 0 && !normalizedRoles.includes(normalizedRole)) {
    return <Navigate to="/?notice=Access%20Denied:%20Incorrect%20Role" replace />;
  }

  return children;
}
