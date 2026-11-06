import { useEffect, useState } from 'react';
import {
  fetchAdminBackup,
  fetchCommunityAccess,
  logPdfDownload,
  updateCommunityAccess,
  updateCommunityEventAccess
} from '../../api';
import MasterReportPreviewModal from '../../components/MasterReportPreviewModal';
import { Button, DataTable, FormField, Skeleton, useToast } from '../../components/ui';
import useMasterReport from '../../hooks/useMasterReport';
import { downloadBlob, todayStamp } from '../../utils/browser';

export function BackupPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const blob = await fetchAdminBackup();
      // Logging is best-effort; the download still proceeds if it fails.
      logPdfDownload('system_backup', null).catch(() => {});
      downloadBlob(blob, `rankit_backup_${todayStamp()}.json`);
      toast.success('Backup downloaded.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-stack">
      <p className="muted">
        Download a JSON snapshot of events, contestants, scores, users (without passwords), audit logs and computed
        rankings. Take one before every event day.
      </p>
      <div>
        <Button variant="primary" loading={loading} onClick={download}>
          Download system backup
        </Button>
      </div>
    </div>
  );
}

export function MasterReportPanel({ events }) {
  const toast = useToast();
  const report = useMasterReport({ withRankings: true });
  const [eventId, setEventId] = useState('');
  const selected = eventId && events.some((event) => event._id === eventId) ? eventId : events[0]?._id || '';

  const preview = () => report.generate(selected).catch((error) => toast.error(error.message));

  return (
    <div className="form-stack">
      <FormField label="Event">
        <select value={selected} onChange={(e) => setEventId(e.target.value)} disabled={events.length === 0}>
          {events.map((event) => (
            <option key={event._id} value={event._id}>
              {event.name}
            </option>
          ))}
        </select>
      </FormField>
      <div>
        <Button variant="primary" loading={report.loading} disabled={!selected} onClick={preview}>
          Preview master report
        </Button>
      </div>
      <MasterReportPreviewModal
        open={report.open}
        reportData={report.data}
        viewerRole="admin"
        preferredTab="main"
        categoryRankings={report.categoryRankings}
        onClose={report.close}
      />
    </div>
  );
}

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ui-switch ${checked ? 'is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch__thumb" aria-hidden="true" />
    </button>
  );
}

export function CommunityAccessPanel() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCommunityAccess()
      .then((data) => {
        setSettings({
          categoryRankingsEnabled: Boolean(data?.settings?.categoryRankingsEnabled),
          overallRankingsEnabled: Boolean(data?.settings?.overallRankingsEnabled)
        });
        setEvents(Array.isArray(data?.events) ? data.events : []);
      })
      .catch((error) => toast.error(error.message));
  }, [toast]);

  const toggleRanking = async (key, value) => {
    setSaving(true);
    try {
      const result = await updateCommunityAccess({ [key]: value });
      setSettings((prev) => ({ ...prev, ...result?.settings }));
      toast.success('Public ranking access updated.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateEvent = async (eventId, updates) => {
    setSaving(true);
    try {
      const result = await updateCommunityEventAccess(eventId, updates);
      setEvents((prev) => prev.map((item) => (item._id === eventId ? { ...item, ...result?.event } : item)));
      toast.success('Event visibility updated.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <Skeleton lines={4} />;

  return (
    <div className="form-stack">
      <div className="toggle-list">
        <div className="toggle-row">
          <div>
            <strong>Category rankings</strong>
            <p className="muted">Show weighted standings per category on the public page.</p>
          </div>
          <Switch
            label="Category rankings visible"
            checked={settings.categoryRankingsEnabled}
            disabled={saving}
            onChange={(value) => toggleRanking('categoryRankingsEnabled', value)}
          />
        </div>
        <div className="toggle-row">
          <div>
            <strong>Overall rankings</strong>
            <p className="muted">Show the overall weighted leaderboard on the public page.</p>
          </div>
          <Switch
            label="Overall rankings visible"
            checked={settings.overallRankingsEnabled}
            disabled={saving}
            onChange={(value) => toggleRanking('overallRankingsEnabled', value)}
          />
        </div>
      </div>

      <DataTable
        caption="Public visibility per event"
        rows={events}
        emptyTitle="No events yet"
        columns={[
          { key: 'name', header: 'Event', render: (item) => <strong>{item.name}</strong> },
          { key: 'category', header: 'Category', hideOnMobile: true },
          {
            key: 'visible',
            header: 'Public',
            render: (item) => (
              <Switch
                label={`${item.name} visible to the public`}
                checked={Boolean(item.communityVisible)}
                disabled={saving}
                onChange={(value) => updateEvent(item._id, { communityVisible: value })}
              />
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (item) => (
              <select
                aria-label={`${item.name} status`}
                value={item.eventStatus === 'finalized' ? 'finalized' : 'live'}
                disabled={saving}
                onChange={(e) => updateEvent(item._id, { eventStatus: e.target.value })}
              >
                <option value="live">In progress</option>
                <option value="finalized">Ended</option>
              </select>
            )
          }
        ]}
      />
    </div>
  );
}
