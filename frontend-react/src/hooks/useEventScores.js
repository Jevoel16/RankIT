import { useCallback, useEffect, useState } from 'react';
import { fetchContestants, fetchEventScores } from '../api';

const EMPTY = { contestants: [], records: [], rankings: [], sports: { standings: [], bracket: null, topFour: [] } };

// Contestants plus recorded score sheets and standings for one event.
export default function useEventScores(eventId, { onError } = {}) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId) {
      setData(EMPTY);
      return;
    }
    setLoading(true);
    try {
      const [contestants, scores] = await Promise.all([fetchContestants(eventId), fetchEventScores(eventId)]);
      setData({
        contestants: contestants || [],
        records: scores?.records || [],
        rankings: scores?.rankings || [],
        sports: {
          standings: scores?.sports?.standings || [],
          bracket: scores?.sports?.bracket || null,
          topFour: scores?.sports?.topFour || []
        }
      });
    } catch (error) {
      onError?.(error.message);
    } finally {
      setLoading(false);
    }
    // onError is a toast callback and must not trigger refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, loading, reload };
}
