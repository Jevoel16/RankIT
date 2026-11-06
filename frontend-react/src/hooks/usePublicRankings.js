import { useEffect, useRef, useState } from 'react';
import { fetchPublicCategoryRankings, fetchPublicLeaderboard, fetchPublicOverallLeaderboard } from '../api';

// Polls a public endpoint while the tab is visible. `key` changes restart polling.
function usePolling(load, key, intervalMs) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    let timer;

    const load = async () => {
      try {
        const data = await loadRef.current();
        if (active) setState({ data, error: '', loading: false });
      } catch (error) {
        if (active) setState((prev) => ({ ...prev, error: error.message, loading: false }));
      }
    };
    // Refreshes pause while the tab is hidden and catch up when it is shown again.
    const tick = () => document.visibilityState !== 'hidden' && load();

    setState((prev) => ({ ...prev, loading: true }));
    load();
    if (intervalMs) timer = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [key, intervalMs]);

  return state;
}

export function useEventLeaderboard({ category = '', eventId = '' }, intervalMs = 10000) {
  return usePolling(() => fetchPublicLeaderboard(category, eventId), `${category}|${eventId}`, intervalMs);
}

export function useCategoryRankings(categoryName, enabled = true, intervalMs = 15000) {
  return usePolling(
    () => (enabled && categoryName ? fetchPublicCategoryRankings(categoryName) : Promise.resolve(null)),
    `${categoryName}|${enabled}`,
    enabled && categoryName ? intervalMs : 0
  );
}

export function useOverallRankings(enabled = true, intervalMs = 15000) {
  return usePolling(
    () => (enabled ? fetchPublicOverallLeaderboard() : Promise.resolve(null)),
    String(enabled),
    enabled ? intervalMs : 0
  );
}

// Remembers each row's previous rank so the UI can show movement between polls.
export function useRankMovement(rows) {
  const previous = useRef(new Map());
  const [movement, setMovement] = useState(new Map());

  useEffect(() => {
    const next = new Map();
    rows.forEach((row) => {
      const before = previous.current.get(row.key);
      if (before && before !== row.rank) next.set(row.key, before > row.rank ? 'up' : 'down');
    });
    previous.current = new Map(rows.map((row) => [row.key, row.rank]));
    setMovement(next);
  }, [rows]);

  return movement;
}
