import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchContestants, fetchEvents, fetchTallierScoreSheet, submitTally } from '../api';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { useAuth } from '../hooks/useAuth';
import ScoreInputCard from '../components/ScoreInputCard';
import PrintReportPreviewModal from '../components/PrintReportPreviewModal';
import TallyReportPDF from '../components/TallyReportPDF';

export default function TallierPage() {
  const { token, user } = useAuth();
  const { activeEventId, setActiveEvent } = useActiveEvent();
  const { eventId: eventIdFromRoute } = useParams();
  const [events, setEvents] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [activeTab, setActiveTab] = useState('scoring');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [contestantId, setContestantId] = useState('');
  const [scores, setScores] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submittedByContestant, setSubmittedByContestant] = useState({});
  const [printCriteria, setPrintCriteria] = useState([]);
  const [printRows, setPrintRows] = useState([]);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await fetchEvents(token);
        setEvents(data);
        if (data.length > 0) {
          const matched = eventIdFromRoute && data.some((item) => item._id === eventIdFromRoute);
          const fromActiveContext = activeEventId && data.some((item) => item._id === activeEventId);
          setSelectedEventId(matched ? eventIdFromRoute : fromActiveContext ? activeEventId : data[0]._id);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadEvents();
  }, [token, eventIdFromRoute, activeEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId]
  );

  const tallyReportData = useMemo(
    () => ({
      eventName: selectedEvent?.name || '-',
      generatedByName: user?.username || 'Unknown User',
      generatedAt: new Date().toISOString(),
      criteria: printCriteria,
      rows: printRows
    }),
    [selectedEvent, user, printCriteria, printRows]
  );

  const tallyReportDocument = useMemo(
    () => <TallyReportPDF reportData={tallyReportData} />,
    [tallyReportData]
  );

  const tallyReportFileName = `${String(selectedEvent?.name || 'event').replace(/\s+/g, '_')}_tally_report.pdf`;

  useEffect(() => {
    const fresh = {};
    (selectedEvent?.criteria || []).forEach((criterion) => {
      fresh[criterion.label] = 0;
    });
    setScores(fresh);
    setStatus('');
    setError('');
    setActiveTab('scoring');
  }, [selectedEventId, selectedEvent]);

  useEffect(() => {
    setStatus('');
    setError('');
  }, [contestantId]);

  const currentSubmissionKey = `${selectedEventId || ''}:${contestantId || ''}`;
  const isCurrentContestantSubmitted = Boolean(submittedByContestant[currentSubmissionKey]);

  useEffect(() => {
    async function loadContestants() {
      if (!selectedEventId) {
        setContestants([]);
        setContestantId('');
        return;
      }

      try {
        const data = await fetchContestants(selectedEventId, token);
        setContestants(data);
        setActiveEvent({ eventId: selectedEventId, contestants: data, source: 'tallier' });
        setContestantId((prev) => (data.some((item) => item._id === prev) ? prev : data[0]?._id || ''));
      } catch (err) {
        setContestants([]);
        setContestantId('');
        setError(err.message);
      }
    }

    loadContestants();
  }, [selectedEventId, token, setActiveEvent]);

  useEffect(() => {
    async function loadScoreSheet() {
      if (!selectedEventId) {
        setPrintCriteria([]);
        setPrintRows([]);
        return;
      }

      try {
        const sheet = await fetchTallierScoreSheet(selectedEventId, token);
        setPrintCriteria(sheet.criteria || []);
        setPrintRows(sheet.rows || []);
      } catch (_err) {
        setPrintCriteria([]);
        setPrintRows([]);
      }
    }

    loadScoreSheet();
  }, [selectedEventId, token]);

  const setScore = (label, value) => {
    setScores((prev) => ({ ...prev, [label]: value }));
  };

  const selectedContestant = useMemo(
    () => contestants.find((item) => item._id === contestantId),
    [contestants, contestantId]
  );

  const scoreRows = useMemo(
    () =>
      (selectedEvent?.criteria || []).map((criterion) => ({
        label: criterion.label,
        value: Number(scores[criterion.label] || 0),
        maxScore: Number(criterion.maxScore || 0)
      })),
    [selectedEvent, scores]
  );

  const totalScore = scoreRows.reduce((sum, row) => sum + row.value, 0);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const payloadScores = (selectedEvent?.criteria || []).map((criterion) => ({
      criteriaName: criterion.label,
      value: Number(scores[criterion.label] || 0)
    }));

    try {
      await submitTally(
        {
          eventId: selectedEventId,
          contestantId,
          scores: payloadScores
        },
        token
      );

      setSubmittedByContestant((prev) => ({
        ...prev,
        [currentSubmissionKey]: true
      }));
      try {
        const sheet = await fetchTallierScoreSheet(selectedEventId, token);
        setPrintCriteria(sheet.criteria || []);
        setPrintRows(sheet.rows || []);
      } catch (_err) {
        // Keep current UI flow even if score sheet refresh fails.
      }
      setStatus('Score submitted successfully. This contestant is now locked to prevent duplicate entry.');
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('duplicate score submission')) {
        setSubmittedByContestant((prev) => ({
          ...prev,
          [currentSubmissionKey]: true
        }));
        setStatus('This contestant was already scored by you for this event. Select another contestant.');
        return;
      }
      setError(err.message);
    }
  };

  return (
    <section className="panel">
      <h2>Tallier Scoring Form</h2>
      <p className="muted">Criteria are fetched from event configuration and rendered dynamically.</p>

      <div className="sub-tabs" role="tablist" aria-label="Tallier Actions">
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'scoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoring')}
        >
          Tallier Scoring Form
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          Download Tally PDF
        </button>
      </div>

      {activeTab === 'scoring' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
            <form onSubmit={onSubmit} className="stack">
              <label htmlFor="event-select">Event</label>
              <select
                id="event-select"
                value={selectedEventId}
                onChange={(e) => {
                  const nextEventId = e.target.value;
                  setSelectedEventId(nextEventId);
                  setActiveEvent({ eventId: nextEventId, source: 'tallier-manual' });
                }}
                required
              >
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.name}
                  </option>
                ))}
              </select>

              <label htmlFor="contestant-id">Contestant</label>
              <select
                id="contestant-id"
                value={contestantId}
                onChange={(e) => setContestantId(e.target.value)}
                required
                disabled={contestants.length === 0}
              >
                {contestants.length === 0 && <option value="">No contestants available</option>}
                {contestants.map((contestant) => (
                  <option key={contestant._id} value={contestant._id}>
                    {contestant.contestantNumber ? `#${contestant.contestantNumber} - ` : ''}
                    {contestant.name}
                  </option>
                ))}
              </select>

              <div className="score-grid">
                {(selectedEvent?.criteria || []).map((criterion) => (
                  <ScoreInputCard
                    key={criterion.label}
                    criterion={criterion}
                    value={scores[criterion.label] ?? 0}
                    onChange={(value) => setScore(criterion.label, value)}
                  />
                ))}
              </div>

              {error && <p className="error">{error}</p>}
              {status && <p className="success">{status}</p>}

              <button type="submit" disabled={isCurrentContestantSubmitted || !selectedEventId || !contestantId}>
                {isCurrentContestantSubmitted ? 'Already Submitted For Contestant' : 'Submit Score'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'print' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
            <div className="section-head">
              <h3>Download Tally PDF</h3>
              <span className="muted">Preview and download tally report</span>
            </div>

            <p className="muted">
              Event: <strong>{selectedEvent?.name || '-'}</strong>
            </p>
            <p className="muted">The generated PDF includes all contestants for this event.</p>

            <button type="button" className="ghost-btn no-print" onClick={() => setPrintPreviewOpen(true)}>
              Preview Tally PDF
            </button>
          </div>
        </div>
      )}

      <PrintReportPreviewModal
        open={printPreviewOpen}
        title="Tally Report Preview"
        subtitle="Review before download"
        onClose={() => setPrintPreviewOpen(false)}
        fileName={tallyReportFileName}
        pdfDocument={tallyReportDocument}
        downloadLabel="Download Tally PDF"
        reportType="tally_report"
        eventId={selectedEventId}
      />
    </section>
  );
}
