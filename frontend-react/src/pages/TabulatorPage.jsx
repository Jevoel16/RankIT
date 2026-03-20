import { useEffect, useMemo, useState } from 'react';
import { fetchEvents, fetchEventTallies, fetchEventUnlockStatus } from '../api';
import { useAuth } from '../hooks/useAuth';
import ProgressBar from '../components/ProgressBar';
import ResultTable from '../components/ResultTable';

export default function TabulatorPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [unlockState, setUnlockState] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [showRankings, setShowRankings] = useState(false);
  const [error, setError] = useState('');

  const onPrint = () => {
    window.print();
  };

  useEffect(() => {
    async function init() {
      try {
        const data = await fetchEvents(token);
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId(data[0]._id);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, [token]);

  useEffect(() => {
    if (!selectedEventId) return;

    let active = true;

    async function pollData() {
      try {
        const [state, tallyData] = await Promise.all([
          fetchEventUnlockStatus(selectedEventId, token),
          fetchEventTallies(selectedEventId, token)
        ]);

        if (!active) return;
        setUnlockState(state);
        setRankings(tallyData.rankings || []);
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    pollData();
    const timer = setInterval(pollData, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedEventId, token]);

  useEffect(() => {
    setShowRankings(false);
  }, [selectedEventId]);

  const eventName = useMemo(
    () => events.find((event) => event._id === selectedEventId)?.name || 'Selected Event',
    [events, selectedEventId]
  );

  return (
    <section className="panel">
      <h2>Gatekeeper Dashboard</h2>
      <p className="muted">Live poll every 5 seconds updates tallies and unlock status.</p>

      <label htmlFor="tab-event">Event</label>
      <select id="tab-event" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
        {events.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name}
          </option>
        ))}
      </select>

      {unlockState && (
        <div className="status-card">
          <h3>{eventName}</h3>
          <ProgressBar current={unlockState.currentTallies} total={unlockState.requiredTalliers} />
          <p className="badge-row">
            Status:{' '}
            <span className={`badge ${unlockState.unlocked ? 'ok' : 'warn'}`}>
              {unlockState.currentTallies}/{unlockState.requiredTalliers} Judges Submitted
            </span>
          </p>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contestant</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((row) => {
              const current = Number(row.submissions || 0);
              const total = Number(unlockState?.requiredTalliers || 0);
              return (
                <tr key={row.contestantId || row.contestantName}>
                  <td>{row.contestantName}</td>
                  <td>
                    <span className={`badge ${current >= total ? 'ok' : 'warn'}`}>
                      {current}/{total} Judges Submitted
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className={unlockState?.unlocked ? '' : 'disabled-ui'}
        disabled={!unlockState?.unlocked}
        onClick={() => setShowRankings(true)}
      >
        View Final Rankings
      </button>

      <button type="button" className="ghost-btn no-print" onClick={onPrint}>
        Print Tabulation PDF
      </button>

      {showRankings && unlockState?.unlocked && <ResultTable rankings={rankings} />}
      {error && <p className="error">{error}</p>}

      <section className="print-only print-report">
        <h2>Tabulation Report</h2>
        <p>Event: {eventName}</p>
        <p>
          Status:{' '}
          {unlockState
            ? `${unlockState.currentTallies}/${unlockState.requiredTalliers} Judges Submitted`
            : 'No status yet'}
        </p>
        <p>Printed: {new Date().toLocaleString()}</p>

        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contestant</th>
              <th>Average Score</th>
              <th>Submissions</th>
            </tr>
          </thead>
          <tbody>
            {(rankings || []).map((item, index) => (
              <tr key={item.contestantId || `${item.contestantName}-${index}`}>
                <td>{index + 1}</td>
                <td>{item.contestantName}</td>
                <td>{item.averageScore}</td>
                <td>{item.submissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
