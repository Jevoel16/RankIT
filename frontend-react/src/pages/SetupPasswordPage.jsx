import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPasswordSetup, submitPasswordSetup } from '../api';
import { Button, FormField, Skeleton } from '../components/ui';
import { homePathForRole } from '../utils/roles';

// Shown once, right after the first Google/GitHub sign-in: the user picks a password
// so they can also sign in with their username.
export default function SetupPasswordPage() {
  const [username, setUsername] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPasswordSetup()
      .then((payload) => active && setUsername(payload.username))
      .catch(() => active && setLoadError('This step has expired. Continue with Google or GitHub again.'));
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const payload = await submitPasswordSetup(password, confirmPassword);
      if (payload.status === 'active') {
        // Full reload so the app picks up the new session cookie.
        window.location.assign(homePathForRole(payload.user.role));
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="auth">
      <div className="auth__card">
        <header className="auth__header">
          <img src="/logo.svg" alt="" width="48" height="48" />
          <h1>{done ? 'You are signed up' : 'Set your password'}</h1>
          {username && !done && (
            <p className="muted">
              Your username is <strong>{username}</strong>. You can sign in with it and this password, or keep using
              Google/GitHub.
            </p>
          )}
        </header>

        {loadError && (
          <div className="auth__done">
            <p className="form-message form-message--error" role="alert">
              {loadError}
            </p>
            <Link className="ui-btn ui-btn--primary ui-btn--md" to="/login">
              Back to sign in
            </Link>
          </div>
        )}

        {!loadError && username === null && <Skeleton lines={4} />}

        {done && (
          <div className="auth__done">
            <p className="form-message form-message--success" role="status">
              An admin will assign your role. Once they do, sign in as <strong>{username}</strong>.
            </p>
            <Link className="ui-btn ui-btn--secondary ui-btn--md" to="/">
              Go to live rankings
            </Link>
          </div>
        )}

        {username && !done && (
          <form className="form-stack" onSubmit={onSubmit}>
            <input type="hidden" name="username" value={username} autoComplete="username" readOnly />
            <FormField label="Password" hint="At least 8 characters." required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                autoFocus
              />
            </FormField>
            <FormField label="Confirm password" required>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                maxLength={128}
              />
            </FormField>
            {error && (
              <p className="form-message form-message--error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" block loading={saving} disabled={password.length < 8}>
              Save password
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
