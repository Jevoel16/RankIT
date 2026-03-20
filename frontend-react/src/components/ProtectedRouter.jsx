import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRouter({ roles, children }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    const fallback =
      user?.role === 'tallier'
        ? '/tallier'
        : user?.role === 'tabulator'
          ? '/tabulator'
          : user?.role === 'superadmin'
            ? '/superadmin'
            : '/admin';

    return <Navigate to={fallback} replace />;
  }

  return children;
}
