import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const links = [
    user?.role === 'tallier' && { to: '/tallier', label: 'Scoring' },
    user?.role === 'tabulator' && { to: '/tabulator', label: 'Progress Dashboard' },
    user?.role === 'grievancecommittee' && { to: '/grievance', label: 'Grievance Dashboard' },
    user?.role === 'admin' && { to: '/admin', label: 'Event Configuration' },
    user?.role === 'superadmin' && { to: '/superadmin', label: 'Superadmin Console' }
  ].filter(Boolean);

  return (
    <nav className="navbar">
      <div className="navbar-main">
        <Link to="/" className="brand">RankIT</Link>
        <div className="nav-links">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-meta">
          <span className="role-pill">{user?.role}</span>
          <button onClick={logout} className="ghost-btn" type="button">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
