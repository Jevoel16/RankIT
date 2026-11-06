import { useCallback, useEffect, useState } from 'react';
import { fetchLinkedAccounts, fetchOAuthProviders, oauthStartUrl, unlinkProvider } from '../api';
import { Button, Modal } from './ui';

// Fixed messages for the codes the API puts in ?oauth_error=; unknown codes get a generic text.
export const OAUTH_ERRORS = {
  cancelled: 'Sign-in was cancelled.',
  invalid_state: 'That sign-in link expired. Please try again.',
  invalid_request: 'That sign-in request was not valid. Please try again.',
  provider_error: 'Could not reach the sign-in provider. Please try again.',
  unverified_email: 'Your Google email address is not verified yet.',
  not_linked:
    'No RankIT account is linked to that account yet. Register with it, or sign in with your password and link it under Connected accounts.',
  pending: 'Pending Admin Approval.',
  rejected: 'Account rejected by admin.',
  linked_elsewhere: 'That account is already linked to another RankIT user.',
  session_required: 'Sign in first, then link the account.',
  disabled: 'That sign-in option is not available.'
};

export const oauthErrorMessage = (code) => OAUTH_ERRORS[code] || 'Sign-in failed. Please try again.';

export function ProviderIcon({ provider }) {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"
      />
    </svg>
  );
}

// Loads which providers the server has configured; an unreachable API simply shows none.
export function useOAuthProviders() {
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    let active = true;
    fetchOAuthProviders()
      .then((payload) => active && setProviders(Array.isArray(payload?.providers) ? payload.providers : []))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, []);
  return providers;
}

export function OAuthButtons({ mode, role }) {
  const providers = useOAuthProviders();
  if (providers.length === 0) return null;

  const verb = mode === 'register' ? 'Register with' : 'Continue with';
  return (
    <div className="oauth">
      <p className="oauth__divider">
        <span>or</span>
      </p>
      {providers.map((provider) => (
        <a
          key={provider.id}
          className="ui-btn ui-btn--secondary ui-btn--md ui-btn--block oauth__btn"
          href={oauthStartUrl(provider.id, mode === 'register' ? { mode, role } : { mode })}
        >
          <ProviderIcon provider={provider.id} />
          {verb} {provider.label}
        </a>
      ))}
    </div>
  );
}

export function ConnectedAccountsModal({ open, onClose, notice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(
    () =>
      fetchLinkedAccounts()
        .then((payload) => {
          setData(payload);
          setError('');
        })
        .catch((err) => setError(err.message)),
    []
  );

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const onUnlink = async (provider) => {
    setBusy(provider);
    try {
      await unlinkProvider(provider);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const providers = data?.providers || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connected accounts"
      description="Sign in to RankIT with Google or GitHub instead of your password."
      size="sm"
    >
      <div className="form-stack">
        {notice?.text && (
          <p className={`form-message form-message--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.text}
          </p>
        )}
        {error && (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
        {data && providers.length === 0 && <p className="muted">No sign-in providers are set up on this server.</p>}
        <ul className="oauth-links">
          {providers.map((provider) => (
            <li key={provider.id} className="oauth-links__item">
              <ProviderIcon provider={provider.id} />
              <span className="oauth-links__text">
                <strong>{provider.label}</strong>
                <span className="muted">{provider.linked ? provider.account || 'Linked' : 'Not linked'}</span>
              </span>
              {provider.linked ? (
                <Button size="sm" variant="ghost" loading={busy === provider.id} onClick={() => onUnlink(provider.id)}>
                  Unlink
                </Button>
              ) : (
                <a className="ui-btn ui-btn--secondary ui-btn--sm" href={oauthStartUrl(provider.id, { mode: 'link' })}>
                  Link
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
