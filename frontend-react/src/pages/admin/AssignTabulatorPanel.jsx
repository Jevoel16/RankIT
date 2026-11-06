import { useEffect, useState } from 'react';
import { assignEventTabulator, fetchApprovedUsersByRole } from '../../api';
import { Button, DataTable, useToast } from '../../components/ui';

const currentTabulatorId = (event) => event.tabulatorId?._id || event.tabulatorId || '';

export default function AssignTabulatorPanel({ events, onAssigned }) {
  const toast = useToast();
  const [tabulators, setTabulators] = useState([]);
  const [draft, setDraft] = useState({});
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    fetchApprovedUsersByRole('tabulator')
      .then((data) => setTabulators(data || []))
      .catch((error) => toast.error(error.message));
  }, [toast]);

  const valueFor = (event) => draft[event._id] ?? currentTabulatorId(event);

  const save = async (event) => {
    const tabulatorId = valueFor(event);
    if (!tabulatorId) {
      toast.error('Choose a tabulator first.');
      return;
    }
    setSavingId(event._id);
    try {
      await assignEventTabulator(event._id, tabulatorId);
      toast.success(`Tabulator assigned to ${event.name}.`);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[event._id];
        return next;
      });
      onAssigned?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingId('');
    }
  };

  return (
    <DataTable
      caption="Tabulator assignments"
      rows={events}
      emptyTitle="No events yet"
      emptyMessage="Create an event first, then assign its tabulator here."
      columns={[
        { key: 'name', header: 'Event', render: (event) => <strong>{event.name}</strong> },
        {
          key: 'tabulator',
          header: 'Tabulator',
          render: (event) => (
            <select
              aria-label={`Tabulator for ${event.name}`}
              value={valueFor(event)}
              onChange={(e) => setDraft((prev) => ({ ...prev, [event._id]: e.target.value }))}
            >
              <option value="">Select tabulator</option>
              {tabulators.map((tabulator) => (
                <option key={tabulator._id} value={tabulator._id}>
                  {tabulator.username}
                </option>
              ))}
            </select>
          )
        },
        {
          key: 'action',
          header: 'Action',
          align: 'right',
          render: (event) => (
            <Button
              size="sm"
              loading={savingId === event._id}
              disabled={valueFor(event) === currentTabulatorId(event)}
              onClick={() => save(event)}
            >
              Save
            </Button>
          )
        }
      ]}
    />
  );
}
