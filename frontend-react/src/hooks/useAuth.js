import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UNAUTHORIZED_EVENT,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest
} from '../api';

const AuthContext = createContext(null);
// Only the non-secret profile is cached so the UI can render instantly; the session itself
// lives in an httpOnly cookie and is re-validated with /users/me on load.
const STORAGE_KEY = 'rankit_user';
const LEGACY_KEY = 'rankit_auth';

function readStoredUser() {
  try {
    localStorage.removeItem(LEGACY_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (_error) {
    return null;
  }
}

function storeUser(user) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Storage can be unavailable (private mode); the cookie session still works.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    storeUser(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((payload) => {
        if (cancelled) return;
        storeUser(payload.user);
        setUser(payload.user);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      navigate('/login', { replace: true, state: { notice: 'Your session expired. Please sign in again.' } });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearSession, navigate]);

  const login = useCallback(async (username, password) => {
    const payload = await loginRequest(username, password);
    storeUser(payload.user);
    setUser(payload.user);
    return payload;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (_error) {
      // Clear local state even if the network call fails.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      // Kept for callers that still pass it; the cookie carries the session now.
      token: null,
      isAuthenticated: Boolean(user),
      login,
      logout
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
