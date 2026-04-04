import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { register as registerRequest } from '../api';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('tabulator');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const stateStorageKey = 'rankit_login_state';
  const actionsStorageKey = 'rankit_login_actions';

  const recordUserAction = (actionType, value) => {
    try {
      const saved = localStorage.getItem(actionsStorageKey);
      const history = saved ? JSON.parse(saved) : [];
      history.push({
        actionType,
        value,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(actionsStorageKey, JSON.stringify(history.slice(-200)));
    } catch (_error) {
      // Ignore storage failures.
    }
  };

  useEffect(() => {
    document.body.classList.add('auth-page-lock');
    return () => {
      document.body.classList.remove('auth-page-lock');
    };
  }, []);

  useEffect(() => {
    setStorageReady(false);

    try {
      const saved = localStorage.getItem(stateStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMode(parsed.mode === 'register' ? 'register' : 'login');
        setUsername(parsed.username || '');
        setRole(parsed.role === 'grievance' ? 'grievance' : 'tabulator');
      }
    } catch (_error) {
      // Ignore malformed storage.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    try {
      localStorage.setItem(
        stateStorageKey,
        JSON.stringify({
          mode,
          username,
          role
        })
      );
    } catch (_error) {
      // Ignore storage failures.
    }
  }, [storageReady, mode, username, role]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    recordUserAction('auth_mode_changed', mode);
  }, [storageReady, mode]);

  useEffect(() => {
    if (!storageReady || mode !== 'register') {
      return;
    }
    recordUserAction('register_role_selected', role);
  }, [storageReady, mode, role]);

  if (isAuthenticated) {
    const to =
      user?.role === 'tabulator'
        ? '/tabulator'
        : user?.role === 'grievance'
          ? '/grievance'
          : user?.role === 'superadmin'
            ? '/superadmin'
            : '/admin';
    return <Navigate to={to} replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const payload = await registerRequest({ username, password, role });
        setSuccess(payload?.message || 'Registration submitted. Pending Admin Approval.');
        recordUserAction('register_submitted', { username: String(username || '').trim(), role });
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        recordUserAction('login_submitted', { username: String(username || '').trim() });
        const payload = await login(username, password);
        const from = location.state?.from || '';
        const rolePath =
          payload.user.role === 'tabulator'
            ? '/tabulator'
            : payload.user.role === 'grievance'
              ? '/grievance'
              : payload.user.role === 'superadmin'
                ? '/superadmin'
                : '/admin';

        const canUseFrom =
          payload.user.role === 'tabulator' && from.startsWith('/tabulate/');

        navigate(canUseFrom ? from : rolePath, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <Link to="/" className="community-brand auth-brand-link" aria-label="Go to community rankings">
        <img src="/logo.ico" alt="" className="brand-logo-icon" aria-hidden="true" />
        <span>RankIT</span>
      </Link>
      <div className="auth-panel-stack">
        <div className="sub-tabs" role="tablist" aria-label="Authentication Mode">
          <button
            type="button"
            className={`subtab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`subtab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setError('');
              setSuccess('');
            }}
          >
            Register
          </button>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          placeholder={mode === 'register' ? 'your_name (will be username@role.rankit)' : 'username@role.rankit'}
        />
        {mode === 'login' && (
          <small className="auth-input-hint">
            Format: username@role.rankit (e.g., john@tabulator.rankit)
          </small>
        )}
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {mode === 'register' && (
          <>
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <label htmlFor="register-role">Role</label>
            <select id="register-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="tabulator">Tabulator</option>
              <option value="grievance">Grievance</option>
            </select>
            <small className="auth-input-hint auth-input-hint-tight">
              Your username will be formatted as: <strong>your_name@{role}.rankit</strong>
            </small>
          </>
        )}
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit" disabled={loading}>
          {loading ? (mode === 'register' ? 'Submitting...' : 'Signing in...') : mode === 'register' ? 'Register' : 'Login'}
        </button>
        </form>
      </div>
    </main>
  );
}
