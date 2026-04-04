import { useEffect, useState } from 'react';
import { bulkCreateContestants, createContestant, fetchContestants, fetchEvents } from '../api';
import usePagination from '../hooks/usePagination';
import TablePager from './TablePager';

export default function AdminContestants({ token }) {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [name, setName] = useState('');
  const [contestantNumber, setContestantNumber] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [contestants, setContestants] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const contestantsPagination = usePagination(contestants, 10);

  const loadContestants = async (selectedEventId) => {
    if (!selectedEventId) {
      setContestants([]);
      return;
    }

    const data = await fetchContestants(selectedEventId, token);
    setContestants(data);
  };

  useEffect(() => {
    async function init() {
      try {
        const data = await fetchEvents(token);
        setEvents(data);
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, []);

  const onSingleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await createContestant(
        {
          eventId,
          name: name.trim(),
          contestantNumber: contestantNumber ? Number(contestantNumber) : undefined
        },
        token
      );
      setSuccess('Contestant created.');
      setName('');
      setContestantNumber('');
      await loadContestants(eventId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onBulkCreate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const nextBaseNumber = contestants.reduce((max, item) => {
        const value = Number(item.contestantNumber || 0);
        return value > max ? value : max;
      }, 0);

      const rows = bulkNames
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
          name: line,
          contestantNumber: nextBaseNumber + index + 1
        }));

      await bulkCreateContestants({ eventId, contestants: rows }, token);
      setSuccess('Bulk contestants created.');
      setBulkNames('');
      await loadContestants(eventId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onEventChange = async (value) => {
    setEventId(value);
    setError('');
    setSuccess('');
    try {
      await loadContestants(value);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel stack">
      <div className="section-head">
        <h2>Contestants</h2>
      </div>

      <label htmlFor="contestant-event">Event</label>
      <select id="contestant-event" value={eventId} onChange={(e) => onEventChange(e.target.value)}>
        <option value="">Select event</option>
        {events.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name}
          </option>
        ))}
      </select>

      <div className="split-form">
        <form className="stack" onSubmit={onSingleCreate}>
          <strong>Add Single Contestant</strong>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contestant name"
            required
            disabled={!eventId}
          />
          <input
            type="number"
            min={1}
            value={contestantNumber}
            onChange={(e) => setContestantNumber(e.target.value)}
            placeholder="Contestant number (optional)"
            disabled={!eventId}
          />
          <button type="submit" disabled={loading || !eventId}>Create Contestant</button>
        </form>

        <form className="stack" onSubmit={onBulkCreate}>
          <strong>Bulk Add Contestants</strong>
          <textarea
            className="bulk-area"
            value={bulkNames}
            onChange={(e) => setBulkNames(e.target.value)}
            placeholder={"One name per line\nAlice\nBea\nCara"}
            required
            disabled={!eventId}
          />
          <button type="submit" disabled={loading || !eventId}>Bulk Create</button>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {contestants.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  {eventId ? 'No contestants for this event yet.' : 'Select an event to view contestants.'}
                </td>
              </tr>
            )}
            {contestantsPagination.paginatedItems.map((item) => (
              <tr key={item._id}>
                <td>{item.contestantNumber || '-'}</td>
                <td>{item.name}</td>
                <td>{item._id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        page={contestantsPagination.page}
        totalPages={contestantsPagination.totalPages}
        totalItems={contestantsPagination.totalItems}
        canPrev={contestantsPagination.canPrev}
        canNext={contestantsPagination.canNext}
        onPrev={contestantsPagination.goPrev}
        onNext={contestantsPagination.goNext}
      />

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  );
}
