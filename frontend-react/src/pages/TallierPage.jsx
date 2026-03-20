import { useEffect, useMemo, useState } from 'react';
import { fetchContestants, fetchEvents, submitTally } from '../api';
import { useAuth } from '../hooks/useAuth';
import ScoreInputCard from '../components/ScoreInputCard';

export default function TallierPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [contestantId, setContestantId] = useState('');
  const [scores, setScores] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onPrint = () => {
    window.print();
  };

  useEffect(() => {
    async function loadEvents() {
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

    loadEvents();
  }, [token]);

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId]
  );

  useEffect(() => {
    const fresh = {};
    (selectedEvent?.criteria || []).forEach((criterion) => {
      fresh[criterion.label] = 0;
    });
    setScores(fresh);
    setSubmitted(false);
    setStatus('');
  }, [selectedEventId, selectedEvent]);

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
        setContestantId((prev) => (data.some((item) => item._id === prev) ? prev : data[0]?._id || ''));
      } catch (err) {
        setContestants([]);
        setContestantId('');
        setError(err.message);
      }
    }

    loadContestants();
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

      setSubmitted(true);
      setStatus('Score submitted successfully. Submit is now locked to prevent duplicate entry.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel">
      <h2>Tallier Scoring Form</h2>
      <p className="muted">Criteria are fetched from event configuration and rendered dynamically.</p>
      <form onSubmit={onSubmit} className="stack">
        <label htmlFor="event-select">Event</label>
        <select
          id="event-select"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
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

        <button type="submit" disabled={submitted || !selectedEventId || !contestantId}>
          {submitted ? 'Already Submitted' : 'Submit Score'}
        </button>
        <button type="button" className="ghost-btn no-print" onClick={onPrint}>
          Print Tally PDF
        </button>
      </form>

      <section className="print-only print-report">
        <h2>Tally Report</h2>
        <p>Event: {selectedEvent?.name || '-'}</p>
        <p>
          Contestant: {selectedContestant?.contestantNumber ? `#${selectedContestant.contestantNumber} - ` : ''}
          {selectedContestant?.name || '-'}
        </p>
        <p>Printed: {new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Score</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {scoreRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.value}</td>
                <td>{row.maxScore}</td>
              </tr>
            ))}
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>{totalScore}</strong></td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>
  );
}
