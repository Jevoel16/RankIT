import { useCallback, useEffect, useState } from 'react';
import { fetchEvents } from '../api';

// Loads the events the signed-in user may see; `reload` refreshes after edits.
export default function useEvents({ onError } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEvents();
      setEvents(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      onError?.(error.message);
      return [];
    } finally {
      setLoading(false);
    }
    // onError is a toast callback; identity changes must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { events, loading, reload };
}
