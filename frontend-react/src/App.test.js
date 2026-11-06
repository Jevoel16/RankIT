import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ActiveEventProvider } from './hooks/useActiveEvent';

beforeEach(() => {
  // The community page polls public endpoints; answer with "no active event".
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ noActiveEvent: true })
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders the public community page with staff login', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <ThemeProvider>
          <ActiveEventProvider>
            <App />
          </ActiveEventProvider>
        </ThemeProvider>
      </AuthProvider>
    </MemoryRouter>
  );

  expect(await screen.findByRole('link', { name: /staff login/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /sprucetrap/i })).toHaveAttribute('href', 'https://github.com/Jevoel16');
});
