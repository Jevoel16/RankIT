import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { register as registerRequest } from '../api';
import { Button, FormField, TabPanel, Tabs } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from '../utils/roles';

const TABS_ID = 'auth-mode';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('tabulator');
  const [error, setError] = useState(location.state?.notice || '');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(user?.role)} replace />;
  }

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const payload = await registerRequest({ username: username.trim(), password, role });
        setSuccess(payload?.message || 'Registration submitted. An admin will approve your account.');
        setMode('login');
        setUsername(payload?.user?.username || '');
        setPassword('');
        setConfirmPassword('');
      } else {
        const payload = await login(username.trim(), password);
        // Return to the page that sent the user here; the route guard re-checks the role.
        const from = location.state?.from;
        navigate(from && from !== '/login' ? from : homePathForRole(payload.user.role), { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <section className="auth">
      <div className="auth__card">
        <header className="auth__header">
          <img src="/logo.png" alt="" width="48" height="48" />
          <h1>{isRegister ? 'Request staff access' : 'Staff sign in'}</h1>
          <p className="muted">
            {isRegister
              ? 'Tabulators and grievance officers can request an account.'
              : 'For event admins, tabulators and grievance officers.'}
          </p>
        </header>

        <Tabs
          baseId={TABS_ID}
          label="Sign in or register"
          tabs={[
            { id: 'login', label: 'Sign in' },
            { id: 'register', label: 'Register' }
          ]}
          value={mode}
          onChange={switchMode}
          className="auth__tabs"
        />

        <TabPanel baseId={TABS_ID} id={mode} active>
          <form className="form-stack" onSubmit={onSubmit} noValidate={false}>
            <FormField
              label="Username"
              hint={isRegister ? `You will sign in as name@${role}.rankit` : 'For example: maria@tabulator.rankit'}
              required
            >
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={100}
              />
            </FormField>
            <FormField label="Password" hint={isRegister ? 'At least 8 characters.' : undefined} required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={isRegister ? 8 : undefined}
              />
            </FormField>
            {isRegister && (
              <>
                <FormField label="Confirm password" required>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </FormField>
                <FormField label="Role">
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="tabulator">Tabulator</option>
                    <option value="grievance">Grievance</option>
                  </select>
                </FormField>
              </>
            )}

            {error && (
              <p className="form-message form-message--error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="form-message form-message--success" role="status">
                {success}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" block loading={loading}>
              {isRegister ? 'Request access' : 'Sign in'}
            </Button>
          </form>
        </TabPanel>
      </div>
    </section>
  );
}
