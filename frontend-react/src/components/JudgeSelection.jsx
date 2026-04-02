import { useEffect, useMemo, useState } from 'react';
import {
  assignEventTalliers,
  fetchApprovedUsersByRole,
  fetchTabulatorAssignmentSummary
} from '../api';

export default function JudgeSelection({ token, events, selectedEventId, onEventRefresh }) {
  const [talliers, setTalliers] = useState([]);
  const [selectedTallierIds, setSelectedTallierIds] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedEvent = useMemo(
    () => events.find((item) => item._id === selectedEventId) || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    const assignedIds = (selectedEvent?.assignedTallierIds || []).map((item) => (item?._id || item).toString());
    setSelectedTallierIds(assignedIds);
  }, [selectedEvent]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [approvedTalliers, summary] = await Promise.all([
          fetchApprovedUsersByRole('tallier', token),
          fetchTabulatorAssignmentSummary(token)
        ]);
        setTalliers(approvedTalliers || []);
        setSummaryRows(summary || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  const summary = useMemo(
    () => summaryRows.find((item) => item._id === selectedEventId),
    [summaryRows, selectedEventId]
  );

  const toggleTallier = (id) => {
    setSelectedTallierIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const onSave = async () => {
    if (!selectedEventId) {
      setError('Select an event first.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await assignEventTalliers(selectedEventId, selectedTallierIds, token);
      const refreshedSummary = await fetchTabulatorAssignmentSummary(token);
      setSummaryRows(refreshedSummary || []);
      setSuccess('Assigned talliers saved.');
      if (typeof onEventRefresh === 'function') {
        await onEventRefresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel stack">
      <div className="section-head">
        <h3>Manage Judges</h3>
        <span className="muted">Assign approved talliers to your event</span>
      </div>

      {selectedEvent ? (
        <p className="muted">
          Event: <strong>{selectedEvent.name}</strong>
        </p>
      ) : (
        <p className="muted">No assigned event selected.</p>
      )}

      {summary && (
        <div className="status-kpi">
          <div className="kpi-chip">
            <strong>Active Talliers</strong>
            {summary.activeTalliers}
          </div>
          <div className="kpi-chip">
            <strong>Total Assigned</strong>
            {summary.totalAssignedTalliers}
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading approved talliers...</p>
      ) : (
        <div className="search-results">
          <ul className="search-list">
            {talliers.map((tallier) => {
              const id = tallier._id;
              const checked = selectedTallierIds.includes(id);
              return (
                <li key={id}>
                  <label>
                    <input type="checkbox" checked={checked} onChange={() => toggleTallier(id)} />{' '}
                    {tallier.username}
                  </label>
                </li>
              );
            })}
            {talliers.length === 0 && <li className="muted">No approved talliers found.</li>}
          </ul>
        </div>
      )}

      <button type="button" onClick={onSave} disabled={saving || !selectedEventId}>
        {saving ? 'Saving...' : 'Save Judge Assignment'}
      </button>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </section>
  );
}
