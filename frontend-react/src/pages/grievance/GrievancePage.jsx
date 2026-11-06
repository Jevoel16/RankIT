import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchContestants, fetchEventScores, fileContestantGrievance } from '../../api';
import ConsoleLayout from '../../components/ConsoleLayout';
import MasterReportPreviewModal from '../../components/MasterReportPreviewModal';
import { Button, DataTable, EmptyState, FormField, Modal, useToast } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import useEvents from '../../hooks/useEvents';
import useMasterReport from '../../hooks/useMasterReport';
import usePersistentState from '../../hooks/usePersistentState';

// Deductions apply to judged (non-sports) events only.
const SPECIAL_CATEGORY = 'Special Events Category';

// The scores API returns averageScore already net of deductions.
const netScore = (row) => Number(row.averageScore || 0);
const rawScore = (row) => Math.round((netScore(row) + Number(row.deductionPoints || 0)) * 100) / 100;

function DeductionDialog({ contestant, onClose, onFiled }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [points, setPoints] = useState('1');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await fileContestantGrievance(contestant.id, { reason: reason.trim(), deductionPoints: Number(points) });
      toast.success(`Deducted ${points} point(s) from ${contestant.name}.`);
      onFiled();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="File a deduction"
      description={`Contestant: ${contestant.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="deduction-form"
            variant="danger"
            loading={saving}
            disabled={!reason.trim() || !(Number(points) > 0)}
          >
            Apply deduction
          </Button>
        </>
      }
    >
      <form id="deduction-form" className="form-stack" onSubmit={submit}>
        <FormField label="Reason" hint="Recorded in the deduction notes and audit trail." required>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </FormField>
        <FormField label="Points to deduct" required>
          <input type="number" min={0.01} step={0.01} value={points} onChange={(e) => setPoints(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}

export default function GrievancePage() {
  const toast = useToast();
  const { user } = useAuth();
  const { events: allEvents, loading } = useEvents({ onError: toast.error });
  const events = useMemo(() => allEvents.filter((event) => event.category === SPECIAL_CATEGORY), [allEvents]);
  const [storedEventId, setEventId] = usePersistentState(`rankit_ui_grievance_event_${user?.id || 'anon'}`, '');
  const eventId = events.some((event) => event._id === storedEventId) ? storedEventId : events[0]?._id || '';
  const [rankings, setRankings] = useState([]);
  const [contestants, setContestants] = useState([]);
  const [target, setTarget] = useState(null);
  const report = useMasterReport();

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [scores, people] = await Promise.all([fetchEventScores(eventId), fetchContestants(eventId)]);
      setRankings(scores?.rankings || []);
      setContestants(people || []);
    } catch (error) {
      toast.error(error.message);
    }
  }, [eventId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (row) =>
    row.contestantName || contestants.find((item) => item._id === row.contestantId)?.name || 'Contestant';

  const eventPicker = (
    <FormField label="Event" className="toolbar-field">
      <select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={events.length === 0}>
        {events.length === 0 && <option value="">No judged events</option>}
        {events.map((event) => (
          <option key={event._id} value={event._id}>
            {event.name}
          </option>
        ))}
      </select>
    </FormField>
  );

  const noEvents = !loading && events.length === 0 && (
    <EmptyState title="No judged events yet">Deductions apply to special events once an admin creates them.</EmptyState>
  );

  return (
    <>
      <ConsoleLayout
        consoleId="grievance"
        title="Grievances"
        subtitle="Apply rule-based deductions and print the notes."
        toolbar={eventPicker}
        sections={[
          {
            id: 'deductions',
            label: 'Deductions',
            render: () =>
              noEvents || (
                <DataTable
                  caption="Current standings"
                  rows={rankings}
                  rowKey={(row) => row.contestantId}
                  pageSize={15}
                  emptyTitle="No scores yet"
                  emptyMessage="Standings appear once the tabulator records scores."
                  columns={[
                    { key: 'rank', header: 'Rank', render: (row) => <strong>#{rankings.indexOf(row) + 1}</strong> },
                    { key: 'name', header: 'Contestant', render: nameOf },
                    {
                      key: 'raw',
                      header: 'Raw avg',
                      align: 'right',
                      render: rawScore
                    },
                    {
                      key: 'deductions',
                      header: 'Deductions',
                      align: 'right',
                      render: (row) =>
                        row.deductionPoints ? <span className="text-danger">-{row.deductionPoints}</span> : 0
                    },
                    {
                      key: 'final',
                      header: 'Final',
                      align: 'right',
                      render: (row) => <strong>{netScore(row)}</strong>
                    },
                    {
                      key: 'action',
                      header: 'Action',
                      align: 'right',
                      render: (row) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTarget({ id: row.contestantId, name: nameOf(row) })}
                        >
                          Deduct
                        </Button>
                      )
                    }
                  ]}
                />
              )
          },
          {
            id: 'notes',
            label: 'Deduction notes',
            render: () =>
              noEvents || (
                <div className="form-stack">
                  <p className="muted">Preview and download the deduction notes for the selected event.</p>
                  <div>
                    <Button
                      variant="primary"
                      loading={report.loading}
                      disabled={!eventId}
                      onClick={() => report.generate(eventId).catch((error) => toast.error(error.message))}
                    >
                      Preview deduction notes
                    </Button>
                  </div>
                </div>
              )
          }
        ]}
      />

      {target && (
        <DeductionDialog
          contestant={target}
          onClose={() => setTarget(null)}
          onFiled={() => {
            setTarget(null);
            load();
          }}
        />
      )}

      <MasterReportPreviewModal
        open={report.open}
        reportData={report.data}
        onClose={report.close}
        viewerRole="grievance"
        preferredTab="deduction"
      />
    </>
  );
}
