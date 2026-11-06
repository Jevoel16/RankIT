import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { UNAUTHORIZED_EVENT } from '../api';
import { AuthProvider, useAuth } from './useAuth';

function Status() {
  const { isAuthenticated, user } = useAuth();
  return <p>{isAuthenticated ? `signed in as ${user.role}` : 'signed out'}</p>;
}

function LoginNotice() {
  const location = useLocation();
  return <p>{location.state?.notice}</p>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ user: { id: '1', username: 'mark@admin.rankit', role: 'admin' } })
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('restores the session from /users/me and never stores a token', async () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <Status />
      </AuthProvider>
    </MemoryRouter>
  );

  expect(await screen.findByText('signed in as admin')).toBeInTheDocument();
  expect(localStorage.getItem('rankit_user')).toContain('mark@admin.rankit');
  expect(JSON.stringify(localStorage)).not.toMatch(/token/i);
  expect(fetch).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({ credentials: 'include' }));
});

test('an unauthorized response signs out and redirects to login with a notice', async () => {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <Routes>
          <Route path="/admin" element={<Status />} />
          <Route path="/login" element={<LoginNotice />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

  await screen.findByText('signed in as admin');
  act(() => {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  });

  expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
  expect(localStorage.getItem('rankit_user')).toBeNull();
});
