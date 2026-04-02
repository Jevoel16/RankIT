import { useEffect, useState } from 'react';
import {
  assignEventTabulator,
  createEvent,
  fetchAdminBackup,
  fetchApprovedUsersByRole,
  fetchEvents,
  fetchMasterEventResults,
  logPdfDownload
} from '../api';
import { useAuth } from '../hooks/useAuth';
import AdminUsers from '../components/AdminUsers';
import AdminContestants from '../components/AdminContestants';
import MasterReportPreviewModal from '../components/MasterReportPreviewModal';

export default function AdminPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [userSubtab, setUserSubtab] = useState('approval');
  const [eventSubtab, setEventSubtab] = useState('create-event');
  const [settingsSubtab, setSettingsSubtab] = useState('system-backup');
  const [events, setEvents] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [masterReportLoading, setMasterReportLoading] = useState(false);
  const [masterReportEventId, setMasterReportEventId] = useState('');
  const [reportPreviewData, setReportPreviewData] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [requiredTalliers, setRequiredTalliers] = useState(3);
  const [tabulators, setTabulators] = useState([]);
  const [eventTabulatorMap, setEventTabulatorMap] = useState({});
  const [criteria, setCriteria] = useState([
    { label: 'Beauty', weight: 50, maxScore: 50 },
    { label: 'Wit', weight: 50, maxScore: 50 }
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadEvents = async () => {
    const data = await fetchEvents(token);
    setEvents(data);
    setMasterReportEventId((prev) => {
      if (prev && data.some((event) => event._id === prev)) {
        return prev;
      }
      return data[0]?._id || '';
    });
    setEventTabulatorMap((prev) => {
      const next = { ...prev };
      data.forEach((event) => {
        if (!Object.prototype.hasOwnProperty.call(next, event._id)) {
          const eventTabulator = event.tabulatorId?._id || event.tabulatorId || '';
          next[event._id] = eventTabulator;
        }
      });
      return next;
    });
  };

  const loadApprovedTabulators = async () => {
    const data = await fetchApprovedUsersByRole('tabulator', token);
    setTabulators(data || []);
  };

  useEffect(() => {
    async function init() {
      try {
        await loadEvents();
        await loadApprovedTabulators();
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, [token]);

  const addCriterion = () => {
    setCriteria((prev) => [...prev, { label: '', weight: 0, maxScore: 10 }]);
  };

  const updateCriterion = (index, key, value) => {
    setCriteria((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: key === 'label' ? value : Number(value)
            }
          : item
      )
    );
  };

  const totalWeight = criteria.reduce((sum, item) => sum + Number(item.weight || 0), 0);

  const onCreateEvent = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const cleanedCriteria = criteria
      .map((item) => ({
        label: String(item.label || '').trim(),
        weight: Number(item.weight || 0),
        maxScore: Number(item.maxScore || 10)
      }))
      .filter((item) => item.label && item.weight > 0);

    if (cleanedCriteria.length === 0) {
      setError('Add at least one valid criterion before saving the event.');
      return;
    }

    try {
      await createEvent(
        {
          name: name.trim(),
          category: category.trim(),
          requiredTalliers,
          criteria: cleanedCriteria
        },
        token
      );

      setSuccess('Event configuration saved.');
      setName('');
      setCategory('');
      setRequiredTalliers(3);
      setCriteria([
        { label: 'Beauty', weight: 50, maxScore: 50 },
        { label: 'Wit', weight: 50, maxScore: 50 }
      ]);
      await loadEvents();
    } catch (err) {
      setError(err.message);
    }
  };

  const onAssignEventTabulator = async (eventId) => {
    const tabulatorId = eventTabulatorMap[eventId];
    if (!tabulatorId) {
      setError('Select a tabulator before saving assignment.');
      return;
    }

    setError('');
    setSuccess('');

    try {
      await assignEventTabulator(eventId, tabulatorId, token);
      setSuccess('Tabulator assignment updated.');
      await loadEvents();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDownloadBackup = async () => {
    setBackupLoading(true);
    setError('');
    setSuccess('');

    try {
      const blob = await fetchAdminBackup(token);
      
      // Log the backup download
      try {
        await logPdfDownload('system_backup', null, token);
      } catch (logErr) {
        console.error('Failed to log backup download:', logErr);
      }
      
      const today = new Date().toISOString().slice(0, 10);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `rankit_backup_${today}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setSuccess('System backup download started.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const onGenerateMasterReport = async () => {
    if (!masterReportEventId) {
      setError('Select an event before generating the master report.');
      return;
    }

    setMasterReportLoading(true);
    setError('');
    setSuccess('');

    try {
      const reportData = await fetchMasterEventResults(masterReportEventId, token);
      setReportPreviewData(reportData);
      setPreviewOpen(true);
      setSuccess('Master report preview ready.');
    } catch (err) {
      setError(err.message);
    } finally {
      setMasterReportLoading(false);
    }
  };

  return (
    <section className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="Admin Functions">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Configuration
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Event Configuration
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Admin Settings
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
          <div className="sub-tabs" role="tablist" aria-label="Admin User Actions">
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'approval' ? 'active' : ''}`}
              onClick={() => setUserSubtab('approval')}
            >
              User Approval
            </button>
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'create' ? 'active' : ''}`}
              onClick={() => setUserSubtab('create')}
            >
              Manual Create User
            </button>
          </div>

          {userSubtab === 'approval' && (
            <AdminUsers
              token={token}
              showApproval
              showCreate={false}
              showDirectory={false}
            />
          )}

          {userSubtab === 'create' && (
            <AdminUsers
              token={token}
              showApproval={false}
              showCreate
              showDirectory={false}
            />
          )}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="tab-content-shell">
          <div className="panel tab-content-panel">
          <div className="sub-tabs" role="tablist" aria-label="Event Configuration Actions">
            <button
              type="button"
              className={`subtab-btn ${eventSubtab === 'create-event' ? 'active' : ''}`}
              onClick={() => setEventSubtab('create-event')}
            >
              Create Event
            </button>
            <button
              type="button"
              className={`subtab-btn ${eventSubtab === 'assign-tabulator' ? 'active' : ''}`}
              onClick={() => setEventSubtab('assign-tabulator')}
            >
              Assign Tabulator
            </button>
            <button
              type="button"
              className={`subtab-btn ${eventSubtab === 'contestants' ? 'active' : ''}`}
              onClick={() => setEventSubtab('contestants')}
            >
              Contestants
            </button>
          </div>

          {eventSubtab === 'create-event' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>Create Event</h3>
                <span className="muted">Dynamic Criteria Builder</span>
              </div>
              <p className="muted">Admin can define dynamic criteria and weights.</p>

              <div className="status-kpi">
                <div className="kpi-chip">
                  <strong>Criteria Rows</strong>
                  {criteria.length}
                </div>
                <div className="kpi-chip">
                  <strong>Total Weight</strong>
                  {totalWeight}%
                </div>
                <div className="kpi-chip">
                  <strong>Required Talliers</strong>
                  {requiredTalliers}
                </div>
              </div>

              <form onSubmit={onCreateEvent} className="stack">
                <label htmlFor="event-name">Event Name</label>
                <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} required />

                <label htmlFor="event-category">Category</label>
                <input id="event-category" value={category} onChange={(e) => setCategory(e.target.value)} required />

                <label htmlFor="required-talliers">Required Talliers</label>
                <input
                  id="required-talliers"
                  type="number"
                  min={1}
                  value={requiredTalliers}
                  onChange={(e) => setRequiredTalliers(Number(e.target.value))}
                />

                <div className="criteria-box">
                  <div className="criteria-header">
                    <strong>Criteria</strong>
                    <span className={totalWeight === 100 ? 'success-inline' : 'warn-inline'}>
                      Total Weight: {totalWeight}%
                    </span>
                  </div>
                  {criteria.map((criterion, index) => (
                    <div className="criteria-row" key={index}>
                      <input
                        value={criterion.label}
                        onChange={(e) => updateCriterion(index, 'label', e.target.value)}
                        placeholder="Label"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={criterion.weight}
                        onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
                        placeholder="Weight"
                      />
                      <input
                        type="number"
                        min={1}
                        value={criterion.maxScore}
                        onChange={(e) => updateCriterion(index, 'maxScore', e.target.value)}
                        placeholder="Max"
                      />
                    </div>
                  ))}
                  <button type="button" className="ghost-btn" onClick={addCriterion}>
                    Add Criterion
                  </button>
                </div>

                {error && <p className="error">{error}</p>}
                {success && <p className="success">{success}</p>}

                <button type="submit" disabled={totalWeight !== 100}>
                  Save Event
                </button>
              </form>
            </div>
          )}

          {eventSubtab === 'assign-tabulator' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>Assign Tabulator</h3>
                <span className="muted">Set event ownership for tabulators</span>
              </div>
              <p className="muted">Set event ownership for tabulators.</p>
              {events.length === 0 && <p className="muted">No events available yet.</p>}
              {events.map((event) => (
                <div key={event._id} className="criteria-row">
                  <strong>{event.name}</strong>
                  <select
                    value={eventTabulatorMap[event._id] || ''}
                    onChange={(e) =>
                      setEventTabulatorMap((prev) => ({
                        ...prev,
                        [event._id]: e.target.value
                      }))
                    }
                  >
                    <option value="">Select tabulator</option>
                    {tabulators.map((tabulator) => (
                      <option key={tabulator._id} value={tabulator._id}>
                        {tabulator.username}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="ghost-btn" onClick={() => onAssignEventTabulator(event._id)}>
                    Save Assignment
                  </button>
                </div>
              ))}
              {error && <p className="error">{error}</p>}
              {success && <p className="success">{success}</p>}
            </div>
          )}

          {eventSubtab === 'contestants' && (
            <AdminContestants token={token} />
          )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="tab-content-shell">
          <div className="panel stack tab-content-panel">
          <div className="section-head">
            <h2>Admin Settings</h2>
            <span className="muted">System maintenance</span>
          </div>

          <div className="sub-tabs" role="tablist" aria-label="Admin Settings Actions">
            <button
              type="button"
              className={`subtab-btn ${settingsSubtab === 'system-backup' ? 'active' : ''}`}
              onClick={() => setSettingsSubtab('system-backup')}
            >
              System Backup
            </button>
            <button
              type="button"
              className={`subtab-btn ${settingsSubtab === 'master-report' ? 'active' : ''}`}
              onClick={() => setSettingsSubtab('master-report')}
            >
              Master Event Report
            </button>
          </div>

          {settingsSubtab === 'system-backup' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>System Backup</h3>
                <span className="muted">Export platform data</span>
              </div>
              <p className="muted">Download a full JSON backup of events, contestants, scores, and users.</p>
              <button type="button" onClick={onDownloadBackup} disabled={backupLoading}>
                {backupLoading ? 'Preparing Backup...' : 'Download System Backup'}
              </button>
            </div>
          )}

          {settingsSubtab === 'master-report' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>Master Event Report</h3>
                <span className="muted">All contestants by criteria with totals</span>
              </div>
              <label htmlFor="master-report-event">Event</label>
              <select
                id="master-report-event"
                value={masterReportEventId}
                onChange={(e) => setMasterReportEventId(e.target.value)}
              >
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <button type="button" className="ghost-btn" onClick={onGenerateMasterReport} disabled={masterReportLoading || !masterReportEventId}>
                {masterReportLoading ? 'Preparing Master Report...' : 'Preview Master Report'}
              </button>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          </div>
        </div>
      )}

      <MasterReportPreviewModal
        open={previewOpen}
        reportData={reportPreviewData}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}
