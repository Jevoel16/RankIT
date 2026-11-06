import { useCallback, useEffect, useState } from 'react';
import { bulkCreateContestants, createContestant, fetchContestants, updateContestant } from '../api';
import useEvents from '../hooks/useEvents';
import usePersistentState from '../hooks/usePersistentState';
import { useAuth } from '../hooks/useAuth';
import { Button, DataTable, EmptyState, FormField, useToast } from './ui';

const nextNumber = (contestants) =>
  contestants.reduce((max, item) => Math.max(max, Number(item.contestantNumber || 0)), 0) + 1;

export default function AdminContestants() {
  const toast = useToast();
  const { user } = useAuth();
  const { events } = useEvents({ onError: toast.error });
  const [eventId, setEventId] = usePersistentState(`rankit_ui_contestants_event_${user?.id || 'anon'}`, '');
  const [contestants, setContestants] = useState([]);
  const [mode, setMode] = useState('single');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const validEventId = events.some((event) => event._id === eventId) ? eventId : '';

  const load = useCallback(
    async (id) => {
      if (!id) {
        setContestants([]);
        return;
      }
      try {
        setContestants((await fetchContestants(id)) || []);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [toast]
  );

  useEffect(() => {
    load(validEventId);
    setEditing(null);
  }, [validEventId, load]);

  const run = async (action, message) => {
    setSaving(true);
    try {
      await action();
      toast.success(message);
      await load(validEventId);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addSingle = async (event) => {
    event.preventDefault();
    const ok = await run(
      () =>
        createContestant({
          eventId: validEventId,
          name: name.trim(),
          contestantNumber: number ? Number(number) : nextNumber(contestants)
        }),
      `Added ${name.trim()}.`
    );
    if (ok) {
      setName('');
      setNumber('');
    }
  };

  const addBulk = async (event) => {
    event.preventDefault();
    const start = nextNumber(contestants);
    const rows = bulkNames
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({ name: line, contestantNumber: start + index }));
    if (rows.length === 0) return;
    const ok = await run(
      () => bulkCreateContestants({ eventId: validEventId, contestants: rows }),
      `Added ${rows.length} contestants.`
    );
    if (ok) setBulkNames('');
  };

  const saveEdit = async () => {
    const ok = await run(
      () =>
        updateContestant(editing.id, {
          name: editing.name.trim(),
          contestantNumber: editing.number === '' ? null : Number(editing.number)
        }),
      'Contestant updated.'
    );
    if (ok) setEditing(null);
  };

  const isEditing = (row) => editing?.id === row._id;

  return (
    <div className="form-stack">
      <FormField label="Event">
        <select value={validEventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Select an event</option>
          {events.map((event) => (
            <option key={event._id} value={event._id}>
              {event.name}
            </option>
          ))}
        </select>
      </FormField>

      {!validEventId ? (
        <EmptyState title="Choose an event">Pick an event to add or edit its contestants.</EmptyState>
      ) : (
        <>
          <div className="card-block">
            <div className="segmented" role="group" aria-label="Add contestants">
              <button type="button" aria-pressed={mode === 'single'} onClick={() => setMode('single')}>
                One at a time
              </button>
              <button type="button" aria-pressed={mode === 'bulk'} onClick={() => setMode('bulk')}>
                Paste a list
              </button>
            </div>

            {mode === 'single' ? (
              <form className="inline-form" onSubmit={addSingle}>
                <FormField label="Name" required>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </FormField>
                <FormField label="Number" hint={`Next free: ${nextNumber(contestants)}`}>
                  <input type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} />
                </FormField>
                <Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
                  Add
                </Button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={addBulk}>
                <FormField label="Names" hint="One per line. Numbers continue from the highest existing one.">
                  <textarea
                    rows={6}
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder={'Alice\nBea\nCara'}
                  />
                </FormField>
                <div>
                  <Button type="submit" variant="primary" loading={saving} disabled={!bulkNames.trim()}>
                    Add all
                  </Button>
                </div>
              </form>
            )}
          </div>

          <DataTable
            caption="Contestants"
            rows={[...contestants].sort((a, b) => Number(a.contestantNumber || 0) - Number(b.contestantNumber || 0))}
            pageSize={15}
            emptyTitle="No contestants yet"
            emptyMessage="Add the first one above."
            columns={[
              {
                key: 'number',
                header: 'No.',
                render: (row) =>
                  isEditing(row) ? (
                    <input
                      aria-label="Contestant number"
                      className="input-narrow"
                      type="number"
                      min={1}
                      value={editing.number}
                      onChange={(e) => setEditing((prev) => ({ ...prev, number: e.target.value }))}
                    />
                  ) : (
                    row.contestantNumber || '-'
                  )
              },
              {
                key: 'name',
                header: 'Name',
                render: (row) =>
                  isEditing(row) ? (
                    <input
                      aria-label="Contestant name"
                      value={editing.name}
                      onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  ) : (
                    <strong>{row.name}</strong>
                  )
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (row) =>
                  isEditing(row) ? (
                    <span className="button-row">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={saving}
                        disabled={!editing.name.trim()}
                        onClick={saveEdit}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(editing)}
                      onClick={() =>
                        setEditing({ id: row._id, name: row.name || '', number: String(row.contestantNumber ?? '') })
                      }
                    >
                      Edit
                    </Button>
                  )
              }
            ]}
          />
        </>
      )}
    </div>
  );
}
