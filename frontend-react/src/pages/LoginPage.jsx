import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { OAuthButtons, oauthErrorMessage } from '../components/OAuth';
import { Button, FormField } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from '../utils/roles';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Results of a Google/GitHub round trip come back as ?oauth=pending or ?oauth_error=<code>.
  const oauthError = searchParams.get('oauth_error');
  const oauthPending = searchParams.get('oauth') === 'pending';
  const pendingName = oauthPending ? searchParams.get('username') || '' : '';
  const [username, setUsername] = useState(pendingName);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(oauthError ? oauthErrorMessage(oauthError) : location.state?.notice || '');
  const [success] = useState(
    oauthPending
      ? `You're signed up${pendingName ? ` as ${pendingName}` : ''}. An admin will assign your role, then you can sign in.`
      : location.state?.success || ''
  );
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(user?.role)} replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = await login(username.trim(), password);
      // Return to the page that sent the user here; the route guard re-checks the role.
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : homePathForRole(payload.user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card">
        <header className="auth__header">
          <img src="/logo.svg" alt="" width="48" height="48" />
          <h1>Staff sign in</h1>
          <p className="muted">New here? Continue with Google or GitHub to create your account.</p>
        </header>

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

        <OAuthButtons />

        <form className="form-stack auth__password" onSubmit={onSubmit}>
          <p className="oauth__divider">
            <span>or use your password</span>
          </p>
          <FormField label="Username" hint="Your Google or GitHub username, e.g. maria.santos" required>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={100}
            />
          </FormField>
          <FormField label="Password" required>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" block loading={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </section>
  );
}
