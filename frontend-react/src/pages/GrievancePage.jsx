import { useEffect, useMemo, useState } from 'react';
import {
  fetchContestants,
  fetchEvents,
  fetchEventTallies,
  fileContestantGrievance
} from '../api';
import { useAuth } from '../hooks/useAuth';
import usePagination from '../hooks/usePagination';
import TablePager from '../components/TablePager';

export default function GrievancePage() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rankings, setRankings] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetContestantId, setTargetContestantId] = useState('');
  const [reason, setReason] = useState('');
  const [deductionPoints, setDeductionPoints] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const rankingsPagination = usePagination(rankings, 10);

  const selectedContestant = useMemo(
    () => contestants.find((item) => item._id === targetContestantId) || null,
    [contestants, targetContestantId]
  );

  const loadDashboardData = async (eventId) => {
    if (!eventId) {
      setRankings([]);
      setContestants([]);
      return;
    }

    const [rankingData, contestantData] = await Promise.all([
      fetchEventTallies(eventId, token),
      fetchContestants(eventId, token)
    ]);

    setRankings(rankingData?.rankings || []);
    setContestants(contestantData || []);
  };

  useEffect(() => {
    async function init() {
      try {
        const data = await fetchEvents(token);
        setEvents(data || []);
        const firstEventId = data?.[0]?._id || '';
        setSelectedEventId(firstEventId);
        await loadDashboardData(firstEventId);
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, [token]);

  useEffect(() => {
    loadDashboardData(selectedEventId).catch((err) => setError(err.message));
  }, [selectedEventId]);

  const openModal = (contestantId) => {
    setTargetContestantId(contestantId);
    setReason('');
    setDeductionPoints(1);
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTargetContestantId('');
    setReason('');
    setDeductionPoints(1);
  };

  const onFileGrievance = async (event) => {
    event.preventDefault();
    if (!targetContestantId) {
      setError('Select a contestant first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await fileContestantGrievance(
        targetContestantId,
        {
          reason: String(reason || '').trim(),
          deductionPoints: Number(deductionPoints)
        },
        token
      );

      await loadDashboardData(selectedEventId);
      setSuccess('Grievance filed and deduction applied.');
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel stack">
      <div className="section-head">
        <h2>Grievance Dashboard</h2>
        <span className="muted">View preliminary scores and apply deductions</span>
      </div>

      <label htmlFor="grievance-event">Event</label>
      <select
        id="grievance-event"
        value={selectedEventId}
        onChange={(e) => setSelectedEventId(e.target.value)}
      >
        {events.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name}
          </option>
        ))}
      </select>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contestant</th>
              <th>Raw Avg</th>
              <th>Deductions</th>
              <th>Final Score</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rankings.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">No rankings available for this event.</td>
              </tr>
            )}
            {rankingsPagination.paginatedItems.map((row, index) => (
              <tr key={row.contestantId || `${row.contestantName}-${index}`}>
                <td>{(rankingsPagination.page - 1) * rankingsPagination.pageSize + index + 1}</td>
                <td>{row.contestantName}</td>
                <td>{row.rawAverageScore ?? row.averageScore}</td>
                <td>{row.deductionPoints ?? 0}</td>
                <td>{row.finalScore ?? row.averageScore}</td>
                <td>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => openModal(row.contestantId)}
                  >
                    File Grievance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        page={rankingsPagination.page}
        totalPages={rankingsPagination.totalPages}
        totalItems={rankingsPagination.totalItems}
        canPrev={rankingsPagination.canPrev}
        canNext={rankingsPagination.canNext}
        onPrev={rankingsPagination.goPrev}
        onNext={rankingsPagination.goNext}
      />

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <h3>File Grievance</h3>
              <span className="muted">Apply score deduction</span>
            </div>
            <p className="muted">Contestant: {selectedContestant?.name || '-'}</p>

            <form className="stack" onSubmit={onFileGrievance}>
              <label htmlFor="grievance-reason">Reason</label>
              <textarea
                id="grievance-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Attitude issue"
                required
              />

              <label htmlFor="grievance-deduction">Deduction Points</label>
              <input
                id="grievance-deduction"
                type="number"
                min={0.01}
                step={0.01}
                value={deductionPoints}
                onChange={(e) => setDeductionPoints(e.target.value)}
                required
              />

              <div className="action-cell">
                <button type="submit" disabled={loading}>
                  {loading ? 'Applying...' : 'Apply Deduction'}
                </button>
                <button type="button" className="ghost-btn" onClick={closeModal} disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
