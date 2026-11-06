import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { OAuthButtons, oauthErrorMessage } from './OAuth';

const respond = (body) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body
    }))
  );

afterEach(() => vi.unstubAllGlobals());

test('shows a button for each provider the server enables', async () => {
  respond({ providers: [{ id: 'github', label: 'GitHub' }] });
  render(<OAuthButtons mode="register" role="grievance" />);

  const link = await screen.findByRole('link', { name: /register with github/i });
  expect(link).toHaveAttribute('href', '/api/auth/github/start?mode=register&role=grievance');
  expect(screen.queryByRole('link', { name: /google/i })).not.toBeInTheDocument();
});

test('renders nothing when no provider is configured', async () => {
  respond({ providers: [] });
  const { container } = render(<OAuthButtons mode="login" />);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

test('maps unknown error codes to a generic message', () => {
  expect(oauthErrorMessage('not_linked')).toMatch(/no rankit account/i);
  expect(oauthErrorMessage('<script>')).toBe('Sign-in failed. Please try again.');
});
