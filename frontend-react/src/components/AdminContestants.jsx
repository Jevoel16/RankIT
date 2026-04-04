import { useEffect, useMemo, useRef, useState } from 'react';
import { bulkCreateContestants, createContestant, fetchContestants, fetchEvents, updateContestant } from '../api';
import usePagination from '../hooks/usePagination';
import TablePager from './TablePager';

export default function AdminContestants({ token, actorKey = 'admin' }) {
  const [contestantsSubtab, setContestantsSubtab] = useState('add');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [name, setName] = useState('');
  const [contestantNumber, setContestantNumber] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [editContestantId, setEditContestantId] = useState('');
  const [editName, setEditName] = useState('');
  const [editContestantNumber, setEditContestantNumber] = useState('');
  const [contestants, setContestants] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [storageReady, setStorageReady] = useState(false);
  const preferredEventIdRef = useRef('');
  const storageActorKey = useMemo(() => actorKey || 'admin', [actorKey]);
  const stateStorageKey = useMemo(
    () => `rankit_admin_contestants_state_${storageActorKey}`,
    [storageActorKey]
  );
  const actionsStorageKey = useMemo(
    () => `rankit_admin_contestants_actions_${storageActorKey}`,
    [storageActorKey]
  );

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
        setContestantsSubtab(parsed.contestantsSubtab || 'add');
        preferredEventIdRef.current = parsed.eventId || '';
        setEventId(parsed.eventId || '');
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
          contestantsSubtab,
          eventId
        })
      );
    } catch (_error) {
      // Ignore storage failures.
    }
  }, [storageReady, stateStorageKey, contestantsSubtab, eventId]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }
    recordUserAction('contestants_subtab_changed', contestantsSubtab);
  }, [storageReady, contestantsSubtab]);

  useEffect(() => {
    if (!storageReady || !eventId) {
      return;
    }
    recordUserAction('contestants_event_selected', eventId);
  }, [storageReady, eventId]);

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
        const preferredEventId = preferredEventIdRef.current;
        const resolvedEventId = (data || []).some((item) => item._id === preferredEventId)
          ? preferredEventId
          : '';
        if (resolvedEventId) {
          setEventId(resolvedEventId);
          await loadContestants(resolvedEventId);
        }
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
      recordUserAction('contestant_created', { eventId, name: name.trim() });
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
      recordUserAction('bulk_contestants_created', { eventId, count: rows.length });
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
    setEditContestantId('');
    setEditName('');
    setEditContestantNumber('');
    setError('');
    setSuccess('');
    try {
      await loadContestants(value);
    } catch (err) {
      setError(err.message);
    }
  };

  const onStartEdit = (contestant) => {
    setEditContestantId(contestant._id);
    setEditName(contestant.name || '');
    setEditContestantNumber(contestant.contestantNumber ? String(contestant.contestantNumber) : '');
    setError('');
    setSuccess('');
  };

  const onCancelEdit = () => {
    setEditContestantId('');
    setEditName('');
    setEditContestantNumber('');
  };

  const onUpdateContestant = async (contestantId) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await updateContestant(
        contestantId,
        {
          name: editName.trim(),
          contestantNumber: editContestantNumber === '' ? null : Number(editContestantNumber)
        },
        token
      );

      setSuccess('Contestant updated.');
      recordUserAction('contestant_updated', { eventId, contestantId });
      onCancelEdit();
      await loadContestants(eventId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel stack">
      <div className="sub-tabs contestant-sub-subtabs" role="tablist" aria-label="Contestant Actions">
            <button
              type="button"
              className={`subtab-btn ${contestantsSubtab === 'add' ? 'active' : ''}`}
              onClick={() => setContestantsSubtab('add')}
            >
              Add Contestants
            </button>
            <button
              type="button"
              className={`subtab-btn ${contestantsSubtab === 'update' ? 'active' : ''}`}
              onClick={() => setContestantsSubtab('update')}
            >
              Update Contestants
            </button>
          
          </div>
        <div className="contestants-subtab-bubble stack">
    
        <label htmlFor="contestant-event">Event</label>
        <select id="contestant-event" value={eventId} onChange={(e) => onEventChange(e.target.value)}>
          <option value="">Select event</option>
          {events.map((event) => (
            <option key={event._id} value={event._id}>
              {event.name}
            </option>
          ))}
        </select>
        
          {contestantsSubtab === 'add' && (
            <>
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
            </>
          )}

          {contestantsSubtab === 'update' && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contestants.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          {eventId ? 'No contestants for this event yet.' : 'Select an event to view contestants.'}
                        </td>
                      </tr>
                    )}
                    {contestantsPagination.paginatedItems.map((item) => {
                      const isEditing = editContestantId === item._id;

                      return (
                        <tr key={item._id}>
                          <td>
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                value={editContestantNumber}
                                onChange={(e) => setEditContestantNumber(e.target.value)}
                                placeholder="No."
                                disabled={loading}
                              />
                            ) : (
                              item.contestantNumber || '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Contestant name"
                                disabled={loading}
                              />
                            ) : (
                              item.name
                            )}
                          </td>
                          <td>{item._id}</td>
                          <td className="action-cell">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  onClick={() => onUpdateContestant(item._id)}
                                  disabled={loading || !editName.trim()}
                                >
                                  Save
                                </button>
                                <button type="button" className="ghost-btn" onClick={onCancelEdit} disabled={loading}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => onStartEdit(item)}
                                disabled={!eventId || loading}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <TablePager
            page={contestantsPagination.page}
            totalPages={contestantsPagination.totalPages}
            totalItems={contestantsPagination.totalItems}
            canPrev={contestantsPagination.canPrev}
            canNext={contestantsPagination.canNext}
            onPrev={contestantsPagination.goPrev}
            onNext={contestantsPagination.goNext}
          />
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  );
}
