import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchEvents, fetchEventTallies, fetchEventUnlockStatus, fetchMasterEventResults } from '../api';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { useAuth } from '../hooks/useAuth';
import JudgeSelection from '../components/JudgeSelection';
import ProgressBar from '../components/ProgressBar';
import ResultTable from '../components/ResultTable';
import MasterReportPreviewModal from '../components/MasterReportPreviewModal';
import PrintReportPreviewModal from '../components/PrintReportPreviewModal';
import TabulationReportPDF from '../components/TabulationReportPDF';
import TablePager from '../components/TablePager';
import usePagination from '../hooks/usePagination';

export default function TabulatorPage() {
  const { token, user } = useAuth();
  const { activeEventId, setActiveEvent } = useActiveEvent();
  const { eventId: eventIdFromRoute } = useParams();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unlockState, setUnlockState] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reportPreviewData, setReportPreviewData] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [error, setError] = useState('');

  const dashboardPagination = usePagination(rankings, 10);

  const loadEvents = async () => {
    const data = await fetchEvents(token);
    setEvents(data);
    if (data.length > 0) {
      const matched = eventIdFromRoute && data.some((item) => item._id === eventIdFromRoute);
      const fromActiveContext = activeEventId && data.some((item) => item._id === activeEventId);
      const fallbackId = matched ? eventIdFromRoute : fromActiveContext ? activeEventId : data[0]._id;
      setSelectedEventId((prev) => (data.some((item) => item._id === prev) ? prev : fallbackId));
    } else {
      setSelectedEventId('');
    }
  };

  const onGenerateMasterReport = async () => {
    if (!selectedEventId) {
      setError('Select an event before generating the master report.');
      return;
    }

    try {
      setPdfLoading(true);
      setError('');
      const reportData = await fetchMasterEventResults(selectedEventId, token);
      setReportPreviewData(reportData);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        await loadEvents();
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, [token, eventIdFromRoute, activeEventId]);

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
    setActiveTab('dashboard');
  }, [selectedEventId]);

  const eventName = useMemo(
    () => events.find((event) => event._id === selectedEventId)?.name || 'Selected Event',
    [events, selectedEventId]
  );

  const tabulationReportData = useMemo(
    () => ({
      eventName,
      currentTallies: unlockState?.currentTallies || 0,
      requiredTalliers: unlockState?.requiredTalliers || 0,
      finalized: Boolean(unlockState?.unlocked),
      generatedByName: user?.username || 'Unknown User',
      generatedAt: new Date().toISOString(),
      rows: rankings || []
    }),
    [eventName, unlockState, user, rankings]
  );

  const tabulationReportDocument = useMemo(
    () => <TabulationReportPDF reportData={tabulationReportData} />,
    [tabulationReportData]
  );

  const tabulationReportFileName = `${String(eventName || 'event').replace(/\s+/g, '_')}_tabulation_report.pdf`;

  return (
    <section className="panel">
      <h2>Gatekeeper Dashboard</h2>
      <p className="muted">Live poll every 5 seconds updates tallies and unlock status.</p>

      <div className="sub-tabs" role="tablist" aria-label="Tabulator Actions">
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'judges' ? 'active' : ''}`}
          onClick={() => setActiveTab('judges')}
        >
          Manage Judges
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'rankings' ? 'active' : ''}`}
          onClick={() => setActiveTab('rankings')}
        >
          View Final Rankings
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          Download Tabulation PDF
        </button>
      </div>

      <label htmlFor="tab-event">Event</label>
      <select
        id="tab-event"
        value={selectedEventId}
        onChange={(e) => {
          const nextEventId = e.target.value;
          setSelectedEventId(nextEventId);
          setActiveEvent({ eventId: nextEventId, source: 'tabulator-manual' });
        }}
      >
        {events.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name}
          </option>
        ))}
      </select>

      {activeTab === 'dashboard' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
          <div className="section-head">
            <h3>Dashboard</h3>
            <span className="muted">Submission progress view</span>
          </div>

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
                  <th>Current Net Avg</th>
                </tr>
              </thead>
              <tbody>
                {dashboardPagination.paginatedItems.map((row) => {
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
                      <td>{row.finalScore ?? row.averageScore ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePager
            page={dashboardPagination.page}
            totalPages={dashboardPagination.totalPages}
            totalItems={dashboardPagination.totalItems}
            canPrev={dashboardPagination.canPrev}
            canNext={dashboardPagination.canNext}
            onPrev={dashboardPagination.goPrev}
            onNext={dashboardPagination.goNext}
          />
          </div>
        </div>
      )}

      {activeTab === 'judges' && (
        <div className="tab-content-shell">
          <JudgeSelection
            token={token}
            events={events}
            selectedEventId={selectedEventId}
            onEventRefresh={loadEvents}
          />
        </div>
      )}

      {activeTab === 'rankings' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
          <div className="section-head">
            <h3>Final Rankings</h3>
            <span className="muted">Unlocked when required judges submit</span>
          </div>

          {!unlockState?.unlocked ? (
            <p className="muted">
              Rankings are locked until {unlockState?.requiredTalliers || 0} judges have submitted scores.
            </p>
          ) : (
            <ResultTable rankings={rankings} />
          )}
          </div>
        </div>
      )}

      {activeTab === 'print' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
            <div className="section-head">
              <h3>Download Tabulation PDF</h3>
              <span className="muted">Preview and download current event tabulation</span>
            </div>

            <p className="muted">
              Generate a download-ready report for <strong>{eventName}</strong> using the current event rankings and submission summary.
            </p>

            <button type="button" className="ghost-btn no-print" onClick={() => setPrintPreviewOpen(true)}>
              Preview Tabulation PDF
            </button>
            <button type="button" className="ghost-btn no-print" onClick={onGenerateMasterReport} disabled={pdfLoading}>
              {pdfLoading ? 'Preparing Master Report...' : 'Preview Master Report'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <MasterReportPreviewModal
        open={previewOpen}
        reportData={reportPreviewData}
        onClose={() => setPreviewOpen(false)}
      />

      <PrintReportPreviewModal
        open={printPreviewOpen}
        title="Tabulation Report Preview"
        subtitle="Review before download"
        onClose={() => setPrintPreviewOpen(false)}
        fileName={tabulationReportFileName}
        pdfDocument={tabulationReportDocument}
        downloadLabel="Download Tabulation PDF"
        reportType="tabulation_report"
        eventId={selectedEventId}
      />
    </section>
  );
}
