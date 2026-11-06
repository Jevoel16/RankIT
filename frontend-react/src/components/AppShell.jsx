import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS, navLinksForRole, normalizeRole } from '../utils/roles';
import { ConnectedAccountsModal, oauthErrorMessage } from './OAuth';
import ThemeSwitcher from './ThemeSwitcher';

const isActive = (link, pathname) => {
  if (link.exact) return pathname === link.to;
  const prefixes = link.match || [link.to];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
};

// App frame: sticky header with role navigation on desktop, a slide-in drawer on phones,
// the theme switcher, and the footer credit required by the license.
export default function AppShell({ children, bare = false }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [accountsNotice, setAccountsNotice] = useState(null);

  // Linking redirects back to "/?oauth=linked" (or ?oauth_error=...): show the result in the dialog
  // and drop the query so a reload doesn't repeat it.
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(search);
    const linked = params.get('oauth') === 'linked';
    const errorCode = params.get('oauth_error');
    if (!linked && !errorCode) return;
    setAccountsNotice(
      linked ? { tone: 'success', text: 'Account linked.' } : { tone: 'error', text: oauthErrorMessage(errorCode) }
    );
    setAccountsOpen(true);
    params.delete('oauth');
    params.delete('oauth_error');
    const rest = params.toString();
    navigate({ pathname, search: rest ? `?${rest}` : '' }, { replace: true });
  }, [isAuthenticated, search, pathname, navigate]);

  const openAccounts = () => {
    setAccountsNotice(null);
    setMenuOpen(false);
    setAccountsOpen(true);
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  if (bare) {
    return <div className="app-shell app-shell--bare">{children}</div>;
  }

  const links = isAuthenticated ? navLinksForRole(user?.role) : [];
  const role = normalizeRole(user?.role);

  const navItems = links.map((link) => (
    <NavLink
      key={link.to}
      to={link.to}
      end={link.exact}
      className={() => `shell-nav__link ${isActive(link, pathname) ? 'is-active' : ''}`}
      aria-current={isActive(link, pathname) ? 'page' : undefined}
    >
      {link.label}
    </NavLink>
  ));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="shell-header no-print">
        <div className="shell-header__inner">
          <Link to="/" className="shell-brand">
            <img src="/logo.svg" alt="" width="28" height="28" />
            <span>RankIT</span>
          </Link>

          {isAuthenticated && (
            <nav className="shell-nav shell-nav--desktop" aria-label="Main">
              {navItems}
            </nav>
          )}

          <div className="shell-actions">
            <ThemeSwitcher />
            {isAuthenticated ? (
              <>
                <span className="shell-user" title={user?.username}>
                  <span className="shell-user__name">{user?.username}</span>
                  <span className={`role-badge role-badge--${role}`}>{ROLE_LABELS[role] || role}</span>
                </span>
                <button
                  type="button"
                  className="ui-icon-btn shell-accounts-btn"
                  aria-label="Connected accounts"
                  title="Connected accounts"
                  onClick={openAccounts}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2-1.4-1.4 2-2a1 1 0 1 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0Zm2.8-2.8a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2 1.4 1.4-2 2a1 1 0 1 0 1.4 1.4L12 10.6a1 1 0 0 1 1.4 0Z" />
                  </svg>
                </button>
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm shell-logout" onClick={logout}>
                  Sign out
                </button>
                <button
                  type="button"
                  className="ui-icon-btn shell-menu-btn"
                  aria-label="Open menu"
                  aria-expanded={menuOpen}
                  aria-controls="shell-drawer"
                  onClick={() => setMenuOpen(true)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
                  </svg>
                </button>
              </>
            ) : (
              pathname !== '/login' && (
                <Link to="/login" className="ui-btn ui-btn--secondary ui-btn--sm">
                  Staff sign in
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      {isAuthenticated && (
        <div className={`shell-drawer ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
          <div className="shell-drawer__backdrop" onClick={() => setMenuOpen(false)} />
          <aside id="shell-drawer" className="shell-drawer__panel" aria-label="Menu" inert={!menuOpen}>
            <div className="shell-drawer__head">
              <span className="shell-user">
                <span className="shell-user__name">{user?.username}</span>
                <span className={`role-badge role-badge--${role}`}>{ROLE_LABELS[role] || role}</span>
              </span>
              <button type="button" className="ui-icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z" />
                </svg>
              </button>
            </div>
            <nav className="shell-nav shell-nav--drawer" aria-label="Main">
              {navItems}
            </nav>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--block" onClick={openAccounts}>
              Connected accounts
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={logout}>
              Sign out
            </button>
          </aside>
        </div>
      )}

      {isAuthenticated && (
        <ConnectedAccountsModal open={accountsOpen} onClose={() => setAccountsOpen(false)} notice={accountsNotice} />
      )}

      <main id="main-content" className="content-shell" tabIndex={-1}>
        {children}
      </main>

      <footer className="app-footer no-print">
        RankIT by{' '}
        <a href="https://github.com/Jevoel16" target="_blank" rel="noopener noreferrer">
          Sprucetrap
        </a>
      </footer>
    </div>
  );
}
