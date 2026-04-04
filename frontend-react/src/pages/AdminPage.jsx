import { useEffect, useState } from 'react';
import {
  assignEventTabulator,
  createEvent,
  fetchCommunityAccess,
  fetchAdminBackup,
  fetchApprovedUsersByRole,
  fetchEvents,
  fetchMasterEventResults,
  fetchOverallRankings,
  updateCommunityAccess,
  updateCommunityEventAccess,
  logPdfDownload
} from '../api';
import { useAuth } from '../hooks/useAuth';
import AdminUsers from '../components/AdminUsers';
import AdminContestants from '../components/AdminContestants';
import MasterReportPreviewModal from '../components/MasterReportPreviewModal';

const buildSportCriteria = (setCount) => {
  const parsedSetCount = Math.max(1, Number(setCount) || 1);

  return Array.from({ length: parsedSetCount }, (_, index) => {
    return {
      label: `Set ${index + 1}`,
      description: `Set ${index + 1}`,
      maxScore: 25,
      weight: Number((100 / parsedSetCount).toFixed(2))
    };
  });
};

const EVENT_CATEGORIES = ['Special Events Category', 'Literary Events Category', 'Sports Events Category'];

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
  const [category, setCategory] = useState(EVENT_CATEGORIES[0]);
  const [setCount, setSetCount] = useState(5);
  const [requiredJudgeCount, setRequiredJudgeCount] = useState(3);
  const [tabulators, setTabulators] = useState([]);
  const [eventTabulatorMap, setEventTabulatorMap] = useState({});
  const [communitySettings, setCommunitySettings] = useState({
    categoryRankingsEnabled: true,
    overallRankingsEnabled: true
  });
  const [communityEvents, setCommunityEvents] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communitySaving, setCommunitySaving] = useState(false);
  const [criteria, setCriteria] = useState([
    { label: 'Beauty', weight: 50, maxScore: 50 },
    { label: 'Wit', weight: 50, maxScore: 50 }
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [activeTab, userSubtab, eventSubtab, settingsSubtab]);

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

  const loadCommunityAccessSettings = async () => {
    setCommunityLoading(true);
    try {
      const data = await fetchCommunityAccess(token);
      setCommunitySettings({
        categoryRankingsEnabled: Boolean(data?.settings?.categoryRankingsEnabled),
        overallRankingsEnabled: Boolean(data?.settings?.overallRankingsEnabled)
      });
      setCommunityEvents(Array.isArray(data?.events) ? data.events : []);
    } finally {
      setCommunityLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadEvents(), loadApprovedTabulators(), loadCommunityAccessSettings()]);
      } catch (err) {
        setError(err.message);
      }
    }

    init();
  }, [token]);

  const isSetBasedCategory = category === 'Sports Events Category';

  const addCriterion = () => {
    if (isSetBasedCategory) {
      return;
    }

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

  const sportCriteria = isSetBasedCategory ? buildSportCriteria(setCount) : criteria;
  const totalWeight = sportCriteria.reduce((sum, item) => sum + Number(item.weight || 0), 0);

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

    const resolvedCriteria = isSetBasedCategory
      ? sportCriteria
      : cleanedCriteria;

    const resolvedCategory = category.trim();

    if (resolvedCriteria.length === 0) {
      setError('Add at least one valid criterion before saving the event.');
      return;
    }

    if (!resolvedCategory) {
      setError('Event category is required.');
      return;
    }

    try {
      const resolvedRequiredJudges = isSetBasedCategory ? 1 : requiredJudgeCount;

      await createEvent(
        {
          name: name.trim(),
          category: resolvedCategory,
          scoringMode: isSetBasedCategory ? 'sets' : 'criteria',
          setCount: isSetBasedCategory ? setCount : null,
          requiredTalliers: resolvedRequiredJudges,
          criteria: resolvedCriteria
        },
        token
      );

      setSuccess('Event configuration saved.');
      setName('');
      setCategory(EVENT_CATEGORIES[0]);
      setSetCount(5);
      setRequiredJudgeCount(3);
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
      const [reportData, overallData] = await Promise.all([
        fetchMasterEventResults(masterReportEventId, token),
        fetchOverallRankings(token)
      ]);

      setReportPreviewData({
        ...reportData,
        weightedRankings: overallData?.rankings || [],
        weightedPointsByRank: overallData?.weightedPointsByRank || {}
      });
      setPreviewOpen(true);
      setSuccess('Master report preview ready.');
    } catch (err) {
      setError(err.message);
    } finally {
      setMasterReportLoading(false);
    }
  };

  const onToggleCommunityRankingAccess = async (key) => {
    setError('');
    setSuccess('');
    setCommunitySaving(true);

    try {
      const nextValue = !communitySettings[key];
      const payload = { [key]: nextValue };
      const result = await updateCommunityAccess(payload, token);
      setCommunitySettings((prev) => ({
        ...prev,
        categoryRankingsEnabled: Boolean(result?.settings?.categoryRankingsEnabled ?? prev.categoryRankingsEnabled),
        overallRankingsEnabled: Boolean(result?.settings?.overallRankingsEnabled ?? prev.overallRankingsEnabled)
      }));
      setSuccess('Community ranking access updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCommunitySaving(false);
    }
  };

  const onUpdateCommunityEvent = async (eventId, updates) => {
    setError('');
    setSuccess('');
    setCommunitySaving(true);

    try {
      const result = await updateCommunityEventAccess(eventId, updates, token);
      const updatedEvent = result?.event;
      setCommunityEvents((prev) =>
        prev.map((item) =>
          item._id === eventId
            ? {
                ...item,
                ...updatedEvent
              }
            : item
        )
      );
      setSuccess('Community event access updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCommunitySaving(false);
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
          <div className="sub-tabs event-config-subtabs" role="tablist" aria-label="Event Configuration Actions">
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
            <div className="panel stack create-event-panel">
              <div className="section-head">
                <h3>{isSetBasedCategory ? 'Create Sports Event' : 'Create Event'}</h3>
              </div>

              <div className="status-kpi">
                <div className="kpi-chip">
                  <strong>{isSetBasedCategory ? 'Sets' : 'Criteria Rows'}</strong>
                  {sportCriteria.length}
                </div>
                {!isSetBasedCategory ? (
                  <div className="kpi-chip">
                    <strong>Total Weight</strong>
                    {totalWeight}%
                  </div>
                ) : null}
                {!isSetBasedCategory && (
                  <div className="kpi-chip">
                    <strong>Number of Judges</strong>
                    {requiredJudgeCount}
                  </div>
                )}
              </div>

              <form onSubmit={onCreateEvent} className="stack create-event-form">
                {!isSetBasedCategory ? (
                  <div className="create-event-grid">
                    <div className="create-event-left criteria-box stack">
                      <div className="create-event-field">
                        <label htmlFor="event-name">Event Name</label>
                        <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} required />
                      </div>

                      <div className="create-event-field">
                        <label htmlFor="event-category">Category</label>
                        <select
                          id="event-category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          required
                        >
                          {EVENT_CATEGORIES.map((categoryOption) => (
                            <option key={categoryOption} value={categoryOption}>
                              {categoryOption}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="create-event-field">
                        <label htmlFor="required-judges">Number of Judges</label>
                        <input
                          id="required-judges"
                          type="number"
                          min={1}
                          value={requiredJudgeCount}
                          onChange={(e) => setRequiredJudgeCount(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="create-event-right">
                      <div className="criteria-box">
                        <div className="criteria-header">
                          <strong>Criteria</strong>
                          <span className={totalWeight === 100 ? 'success-inline' : 'warn-inline'}>
                            Total Weight: {totalWeight}%
                          </span>
                        </div>
                        {criteria.map((criterion, index) => (
                          <div className="criteria-row create-event-criteria-row" key={index}>
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
                    </div>
                  </div>
                ) : (
                  <>
                    <label htmlFor="event-name">Event Name</label>
                    <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} required />

                    <label htmlFor="event-category">Category</label>
                    <select
                      id="event-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      {EVENT_CATEGORIES.map((categoryOption) => (
                        <option key={categoryOption} value={categoryOption}>
                          {categoryOption}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="set-count">Number of Sets</label>
                    <input
                      id="set-count"
                      type="number"
                      min={1}
                      max={7}
                      value={setCount}
                      onChange={(e) => setSetCount(Number(e.target.value))}
                      required
                    />
                  </>
                )}

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
              </div>
              {events.length === 0 && <p className="muted">No events available yet.</p>}
              {events.length > 0 && (
                <div className="table-wrap assign-tabulator-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Tabulator</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event._id}>
                          <td><strong>{event.name}</strong></td>
                          <td>
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
                          </td>
                          <td>
                            <button type="button" className="ghost-btn" onClick={() => onAssignEventTabulator(event._id)}>
                              Save Assignment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            <button
              type="button"
              className={`subtab-btn ${settingsSubtab === 'community-access' ? 'active' : ''}`}
              onClick={() => setSettingsSubtab('community-access')}
            >
              Community Access
            </button>
          </div>

          {settingsSubtab === 'system-backup' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>System Backup</h3>
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

          {settingsSubtab === 'community-access' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>Community Access</h3>
              </div>

              <div className="status-kpi">
                <div className="kpi-chip">
                  <strong>Category Rankings</strong>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={communitySaving}
                    onClick={() => onToggleCommunityRankingAccess('categoryRankingsEnabled')}
                  >
                    {communitySettings.categoryRankingsEnabled ? 'Open' : 'Locked'}
                  </button>
                </div>
                <div className="kpi-chip">
                  <strong>Overall Rankings</strong>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={communitySaving}
                    onClick={() => onToggleCommunityRankingAccess('overallRankingsEnabled')}
                  >
                    {communitySettings.overallRankingsEnabled ? 'Open' : 'Locked'}
                  </button>
                </div>
              </div>

              {communityLoading ? (
                <p className="muted">Loading community access settings...</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Category</th>
                        <th>Community Visibility</th>
                        <th>Community Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communityEvents.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.category}</td>
                          <td>
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={communitySaving}
                              onClick={() =>
                                onUpdateCommunityEvent(item._id, { communityVisible: !item.communityVisible })
                              }
                            >
                              {item.communityVisible ? 'Visible' : 'Hidden'}
                            </button>
                          </td>
                          <td>
                            <select
                              value={item.eventStatus}
                              disabled={communitySaving}
                              onChange={(e) =>
                                onUpdateCommunityEvent(item._id, { eventStatus: e.target.value })
                              }
                            >
                              <option value="live">In-progress</option>
                              <option value="finalized">Ended</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
        viewerRole="admin"
        preferredTab="main"
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}
