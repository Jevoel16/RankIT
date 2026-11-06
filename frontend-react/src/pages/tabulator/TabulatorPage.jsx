import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConsoleLayout from '../../components/ConsoleLayout';
import MasterReportPreviewModal from '../../components/MasterReportPreviewModal';
import { Button, DataTable, EmptyState, FormField, Skeleton, useToast } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import useEventScores from '../../hooks/useEventScores';
import useEvents from '../../hooks/useEvents';
import useMasterReport from '../../hooks/useMasterReport';
import usePersistentState from '../../hooks/usePersistentState';
import { isSportsEvent } from '../../utils/events';
import CriteriaScoreForm from './CriteriaScoreForm';
import SportsMatchForm from './SportsMatchForm';

const formatScore = (value) => (typeof value === 'number' ? value.toFixed(2) : value || '-');
const formatTime = (value) => (value ? new Date(value).toLocaleString() : '-');

function RecordedScores({ records, sports }) {
  const columns = sports
    ? [
        {
          key: 'stage',
          header: 'Stage',
          render: (row) => (row.stage ? `${String(row.stage).toUpperCase()} #${row.matchNumber || 1}` : '-')
        },
        { key: 'contestantName', header: 'Team' },
        { key: 'total', header: 'Points', align: 'right', render: (row) => formatScore(row.totalScore) },
        { key: 'winnerName', header: 'Winner', render: (row) => row.winnerName || '-' },
        { key: 'time', header: 'Recorded', hideOnMobile: true, render: (row) => formatTime(row.submittedAt) }
      ]
    : [
        { key: 'contestantName', header: 'Contestant' },
        { key: 'judge', header: 'Judge', render: (row) => row.physicalJudgeName || '-' },
        { key: 'total', header: 'Total', align: 'right', render: (row) => formatScore(row.totalScore) },
        { key: 'time', header: 'Recorded', hideOnMobile: true, render: (row) => formatTime(row.submittedAt) }
      ];

  return (
    <DataTable
      caption="Recorded score sheets"
      rows={records}
      pageSize={15}
      emptyTitle="Nothing recorded yet"
      emptyMessage="Saved score sheets appear here."
      columns={columns}
    />
  );
}

export default function TabulatorPage() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { eventId: routeEventId } = useParams();
  const { events, loading: eventsLoading } = useEvents({ onError: toast.error });
  const [storedEventId, setStoredEventId] = usePersistentState(`rankit_ui_tabulator_event_${user?.id || 'anon'}`, '');

  const preferred = routeEventId || storedEventId;
  const eventId = events.some((event) => event._id === preferred) ? preferred : events[0]?._id || '';
  const event = useMemo(() => events.find((item) => item._id === eventId) || null, [events, eventId]);
  const scores = useEventScores(eventId, { onError: toast.error });
  const report = useMasterReport();
  const sports = isSportsEvent(event);

  // A deep link (/tabulate/:eventId) becomes the remembered selection.
  useEffect(() => {
    if (routeEventId) setStoredEventId(routeEventId);
  }, [routeEventId, setStoredEventId]);

  const selectEvent = (id) => {
    setStoredEventId(id);
    if (routeEventId) navigate('/tabulator', { replace: true });
  };

  const eventPicker = (
    <FormField label="Event" className="toolbar-field">
      <select value={eventId} onChange={(e) => selectEvent(e.target.value)} disabled={events.length === 0}>
        {events.length === 0 && <option value="">No assigned events</option>}
        {events.map((item) => (
          <option key={item._id} value={item._id}>
            {item.name}
          </option>
        ))}
      </select>
    </FormField>
  );

  const guard = (content) => {
    if (eventsLoading) return <Skeleton lines={6} />;
    if (!event) {
      return (
        <EmptyState title="No event assigned">
          An admin needs to assign you to an event before you can score.
        </EmptyState>
      );
    }
    return content();
  };

  return (
    <>
      <ConsoleLayout
        consoleId="tabulator"
        title="Tabulation"
        subtitle={event ? `${event.name} · ${event.category}` : 'Record judges’ scores as they come in.'}
        toolbar={eventPicker}
        sections={[
          {
            id: 'scores',
            label: 'Record scores',
            render: () =>
              guard(() =>
                sports ? (
                  <SportsMatchForm
                    key={event._id}
                    event={event}
                    contestants={scores.contestants}
                    sports={scores.sports}
                    onRecorded={scores.reload}
                  />
                ) : (
                  <CriteriaScoreForm
                    key={event._id}
                    event={event}
                    contestants={scores.contestants}
                    onRecorded={scores.reload}
                  />
                )
              )
          },
          {
            id: 'history',
            label: 'Recorded',
            badge: scores.records.length || null,
            render: () => guard(() => <RecordedScores records={scores.records} sports={sports} />)
          },
          {
            id: 'reports',
            label: 'Reports',
            render: () =>
              guard(() => (
                <div className="form-stack">
                  <p className="muted">
                    Preview and download the master report for <strong>{event.name}</strong>.
                  </p>
                  <div>
                    <Button
                      variant="primary"
                      loading={report.loading}
                      onClick={() => report.generate(event._id).catch((error) => toast.error(error.message))}
                    >
                      Preview master report
                    </Button>
                  </div>
                </div>
              ))
          }
        ]}
      />
      <MasterReportPreviewModal
        open={report.open}
        reportData={report.data}
        viewerRole="tabulator"
        preferredTab="main"
        onClose={report.close}
      />
    </>
  );
}
