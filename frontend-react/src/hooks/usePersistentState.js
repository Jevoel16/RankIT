import { useEffect, useState } from 'react';

const read = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch (_error) {
    return fallback;
  }
};

// useState that survives reloads (per browser). Use for UI conveniences such as the open tab,
// never for data that must be shared or trusted.
export default function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback));

  useEffect(() => {
    setValue(read(key, fallback));
    // Re-read only when the key changes (e.g. another user signs in on this browser).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Storage can be full or disabled; the UI still works without it.
    }
  }, [key, value]);

  return [value, setValue];
}
