import { createContext, useContext, useMemo, useState } from 'react';
import { login as loginRequest } from '../api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'rankit_auth';

function getStoredAuth() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (_error) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth);

  const login = async (username, password) => {
    const payload = await loginRequest(username, password);
    const nextAuth = { token: payload.token, user: payload.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
    setAuth(nextAuth);
    return nextAuth;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  };

  const value = useMemo(
    () => ({
      auth,
      user: auth?.user || null,
      token: auth?.token || null,
      isAuthenticated: Boolean(auth?.token),
      login,
      logout
    }),
    [auth]
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
