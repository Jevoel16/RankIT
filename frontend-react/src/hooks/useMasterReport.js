import { useState } from 'react';
import { fetchCategoryRankings, fetchMasterEventResults, fetchOverallRankings } from '../api';

// Loads everything the master report preview needs for one event.
// Admin-level reports also pull overall and category weighted rankings.
export default function useMasterReport({ withRankings = false } = {}) {
  const [data, setData] = useState(null);
  const [categoryRankings, setCategoryRankings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const generate = async (eventId) => {
    if (!eventId) throw new Error('Select an event first.');
    setLoading(true);
    try {
      const report = await fetchMasterEventResults(eventId);
      let nextReport = report;
      let nextCategory = null;

      if (withRankings) {
        const overall = await fetchOverallRankings();
        nextReport = {
          ...report,
          weightedRankings: overall?.rankings || [],
          weightedPointsByRank: overall?.weightedPointsByRank || {}
        };
        if (report?.category) {
          // Category rankings are optional; the main report still opens without them.
          nextCategory = await fetchCategoryRankings(report.category).catch(() => null);
        }
      }

      setData(nextReport);
      setCategoryRankings(nextCategory);
      setOpen(true);
      return nextReport;
    } finally {
      setLoading(false);
    }
  };

  return { data, categoryRankings, loading, open, generate, close: () => setOpen(false) };
}
