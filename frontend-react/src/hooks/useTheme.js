import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'rankit_theme';
const PREFERENCES = ['light', 'dark', 'system'];
const LIGHT_QUERY = '(prefers-color-scheme: light)';

function getInitialPreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (PREFERENCES.includes(saved)) return saved;
  } catch (_error) {
    // Storage can be unavailable; fall back to the system theme.
  }
  return 'system';
}

function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getInitialPreference);
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => {
    const query = window.matchMedia?.(LIGHT_QUERY);
    if (!query) return undefined;
    const onChange = () => setSystem(query.matches ? 'light' : 'dark');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (_error) {
      // Ignore storage failures.
    }
  }, [theme, preference]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference: (next) => setPreference(PREFERENCES.includes(next) ? next : 'system'),
      // Cycles light -> dark -> system for a single toggle button.
      cyclePreference: () => setPreference((current) => PREFERENCES[(PREFERENCES.indexOf(current) + 1) % 3]),
      toggleTheme: () => setPreference(theme === 'dark' ? 'light' : 'dark')
    }),
    [theme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
