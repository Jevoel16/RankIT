import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const links = [
    (user?.role === 'tallier' || user?.role === 'tabulator') && { to: '/tabulator', label: 'Tabulation' },
    user?.role === 'grievance' && { to: '/grievance', label: 'Grievance Configuration' },
    user?.role === 'admin' && { to: '/admin', label: 'Event Configuration' },
    user?.role === 'superadmin' && { to: '/superadmin', label: 'Superadmin Console' }
  ].filter(Boolean);

  return (
    <nav className="navbar">
      <div className="navbar-main">
        <Link to="/" className="brand">
          <img src="/logo.ico" alt="" className="brand-logo-icon" aria-hidden="true" />
          <span>RankIT</span>
        </Link>
        <div className="nav-links">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={
                item.to === '/tabulator'
                  ? (location.pathname === '/tabulator' || location.pathname.startsWith('/tabulate/') ? 'active' : '')
                  : (location.pathname === item.to ? 'active' : '')
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-meta">
          <span className="role-pill">{user?.username || user?.name || user?.role}</span>
          <button onClick={logout} className="ghost-btn" type="button">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
