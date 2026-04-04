import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchContestants,
  fetchEvents,
  fetchEventScores,
  fileContestantGrievance,
  fetchMasterEventResults
} from '../api';
import { useAuth } from '../hooks/useAuth';
import usePagination from '../hooks/usePagination';
import TablePager from '../components/TablePager';
import MasterReportPreviewModal from '../components/MasterReportPreviewModal';

export default function GrievancePage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('grieve');
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rankings, setRankings] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetContestantId, setTargetContestantId] = useState('');
  const [reason, setReason] = useState('');
  const [deductionPoints, setDeductionPoints] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportPreviewData, setReportPreviewData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [storageReady, setStorageReady] = useState(false);
  const preferredEventIdRef = useRef('');
  const actorKey = useMemo(() => user?.id || user?._id || user?.username || 'grievance', [user]);
  const stateStorageKey = useMemo(() => `rankit_grievance_state_${actorKey}`, [actorKey]);
  const actionsStorageKey = useMemo(() => `rankit_grievance_actions_${actorKey}`, [actorKey]);

  const recordUserAction = (actionType, value) => {
    try {
      const saved = localStorage.getItem(actionsStorageKey);
      const history = saved ? JSON.parse(saved) : [];
      history.push({
        actionType,
        value,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(actionsStorageKey, JSON.stringify(history.slice(-300)));
    } catch (_error) {
      // Ignore storage failures.
    }
  };

  useEffect(() => {
    setStorageReady(false);

    try {
      const saved = localStorage.getItem(stateStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setActiveTab(parsed.activeTab || 'grieve');
        preferredEventIdRef.current = parsed.selectedEventId || '';
        setSelectedEventId(parsed.selectedEventId || '');
      }
    } catch (_error) {
      // Ignore malformed storage.
    } finally {
      setStorageReady(true);
    }
  }, [stateStorageKey]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    try {
      localStorage.setItem(
        stateStorageKey,
        JSON.stringify({
          activeTab,
          selectedEventId
        })
      );
    } catch (_error) {
      // Ignore storage failures.
    }
  }, [storageReady, stateStorageKey, activeTab, selectedEventId]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    recordUserAction('active_tab_changed', activeTab);
  }, [storageReady, activeTab]);

  useEffect(() => {
    if (!storageReady || !selectedEventId) {
      return;
    }
    recordUserAction('special_event_selected', selectedEventId);
  }, [storageReady, selectedEventId]);

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
      fetchEventScores(eventId, token),
      fetchContestants(eventId, token)
    ]);

    setRankings(rankingData?.rankings || []);
    setContestants(contestantData || []);
  };

  useEffect(() => {
    async function init() {
      try {
        const data = await fetchEvents(token);
        const specialEvents = (data || []).filter((item) => item?.category === 'Special Events Category');
        setEvents(specialEvents);
        const preferredEventId = preferredEventIdRef.current;
        const resolvedEventId = specialEvents.some((item) => item._id === preferredEventId)
          ? preferredEventId
          : (specialEvents?.[0]?._id || '');
        setSelectedEventId(resolvedEventId);
        await loadDashboardData(resolvedEventId);
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
      recordUserAction('grievance_filed', {
        eventId: selectedEventId,
        contestantId: targetContestantId,
        deductionPoints: Number(deductionPoints)
      });
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onPreviewDeductionNotes = async () => {
    if (!selectedEventId) {
      setError('Select a special event first.');
      return;
    }

    try {
      setPreviewLoading(true);
      setError('');
      const reportData = await fetchMasterEventResults(selectedEventId, token);
      setReportPreviewData(reportData);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <section className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="Grievance Sections">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'grieve' ? 'active' : ''}`}
          onClick={() => setActiveTab('grieve')}
        >
          Grieve
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          Download Deduction Notes PDF
        </button>
      </div>

      <section className="panel stack">

      {activeTab === 'grieve' && (
        <>
          <label htmlFor="grievance-event">Special Event</label>
          <select
            id="grievance-event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={events.length === 0}
          >
            {events.length === 0 && <option value="">No special events available</option>}
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
        </>
      )}

      {activeTab === 'print' && (
        <div className="panel stack tab-content-panel">
          <div className="section-head">
            <h3>Download Deduction Notes PDF</h3>
          </div>

          <label htmlFor="grievance-event-print">Special Event</label>
          <select
            id="grievance-event-print"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={events.length === 0}
          >
            {events.length === 0 && <option value="">No special events available</option>}
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>

          <div className="action-cell">
            <button type="button" className="ghost-btn no-print" onClick={onPreviewDeductionNotes} disabled={previewLoading || !selectedEventId}>
              {previewLoading ? 'Preparing Deduction Notes...' : 'Preview Deduction Notes PDF'}
            </button>
          </div>
        </div>
      )}

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

      <MasterReportPreviewModal
        open={previewOpen}
        reportData={reportPreviewData}
        onClose={() => setPreviewOpen(false)}
        viewerRole="grievance"
        preferredTab="deduction"
      />
      </section>
    </section>
  );
}
