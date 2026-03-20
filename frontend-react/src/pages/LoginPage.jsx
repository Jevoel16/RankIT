import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { register as registerRequest } from '../api';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('tallier');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    const to =
      user?.role === 'tallier'
        ? '/tallier'
        : user?.role === 'tabulator'
          ? '/tabulator'
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
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const payload = await login(username, password);
        const rolePath =
          payload.user.role === 'tallier'
            ? '/tallier'
            : payload.user.role === 'tabulator'
              ? '/tabulator'
              : payload.user.role === 'superadmin'
                ? '/superadmin'
              : '/admin';
        navigate(rolePath, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>RankIT Access</h1>
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
        <p className="muted">
          {mode === 'register'
            ? 'Create a tallier or tabulator account. Approval is required before login.'
            : 'Sign in with your role account.'}
        </p>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
        />
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
              <option value="tallier">Tallier</option>
              <option value="tabulator">Tabulator</option>
            </select>
          </>
        )}
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit" disabled={loading}>
          {loading ? (mode === 'register' ? 'Submitting...' : 'Signing in...') : mode === 'register' ? 'Register' : 'Login'}
        </button>
      </form>
    </main>
  );
}
