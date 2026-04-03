import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAnalyticsOverview, fetchAuditLogs, fetchUsers } from '../api';
import { useAuth } from '../hooks/useAuth';
import AdminUsers from '../components/AdminUsers';
import PrintReportPreviewModal from '../components/PrintReportPreviewModal';
import AuditTrailPDF from '../components/AuditTrailPDF';
import UsersDirectoryPDF from '../components/UsersDirectoryPDF';
import usePagination from '../hooks/usePagination';
import TablePager from '../components/TablePager';

function RoleTable({ title, rows }) {
  const roleRowsPagination = usePagination(rows || [], 10);

  return (
    <div className="panel">
      <div className="section-head">
        <h3>{title}</h3>
        <span className="muted">Oversight</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Approved</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">No users in this role.</td>
              </tr>
            )}
            {roleRowsPagination.paginatedItems.map((user) => (
              <tr key={user._id || user.id}>
                <td>{user.username}</td>
                <td>{user.isApproved ? 'Yes' : 'No'}</td>
                <td>{user.approvalStatus || (user.isApproved ? 'approved' : 'pending')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        page={roleRowsPagination.page}
        totalPages={roleRowsPagination.totalPages}
        totalItems={roleRowsPagination.totalItems}
        canPrev={roleRowsPagination.canPrev}
        canNext={roleRowsPagination.canNext}
        onPrev={roleRowsPagination.goPrev}
        onNext={roleRowsPagination.goNext}
      />
    </div>
  );
}

function RoleDistributionGraph({ rows }) {
  const safeRows = rows || [];
  const maxCount = Math.max(...safeRows.map((row) => row.count || 0), 1);

  return (
    <div className="panel">
      <div className="section-head">
        <h3>Users By Role</h3>
        <span className="muted">Horizontal Bar Graph</span>
      </div>
      {safeRows.length === 0 ? (
        <p className="muted">No role data available yet.</p>
      ) : (
        <div className="graph-stack">
          {safeRows.map((row) => {
            const widthPercent = Math.round(((row.count || 0) / maxCount) * 100);
            return (
              <div key={row.role} className="hbar-row">
                <div className="hbar-label">{row.role}</div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${widthPercent}%` }} />
                </div>
                <div className="hbar-value">{row.count}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventSubmissionsGraph({ rows }) {
  const safeRows = rows || [];
  const maxSubmissions = Math.max(...safeRows.map((row) => row.submissions || 0), 1);

  return (
    <div className="panel">
      <div className="section-head">
        <h3>Event Submissions</h3>
        <span className="muted">Vertical Bar Graph</span>
      </div>
      {safeRows.length === 0 ? (
        <p className="muted">No event submission data available yet.</p>
      ) : (
        <div className="vbar-chart-wrap">
          <div className="vbar-chart">
            {safeRows.map((row) => {
              const heightPercent = Math.max(6, Math.round(((row.submissions || 0) / maxSubmissions) * 100));
              return (
                <div className="vbar-col" key={row.eventId}>
                  <div className="vbar-value">{row.submissions}</div>
                  <div className="vbar-track">
                    <div className="vbar-fill" style={{ height: `${heightPercent}%` }} />
                  </div>
                  <div className="vbar-label" title={row.eventName}>{row.eventName}</div>
                  <div className="vbar-sub">Avg {row.averageScore}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EventAverageLineGraph({ rows }) {
  const safeRows = rows || [];

  if (safeRows.length === 0) {
    return (
      <div className="panel">
        <div className="section-head">
          <h3>Average Score Trend</h3>
          <span className="muted">Line Graph</span>
        </div>
        <p className="muted">No average score data available yet.</p>
      </div>
    );
  }

  const chartWidth = Math.max(420, safeRows.length * 90);
  const chartHeight = 220;
  const padding = 28;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;
  const values = safeRows.map((row) => Number(row.averageScore || 0));
  const maxValue = Math.max(...values, 1);

  const points = safeRows.map((row, index) => {
    const x = padding + (safeRows.length === 1 ? innerWidth / 2 : (index / (safeRows.length - 1)) * innerWidth);
    const y = padding + (1 - Number(row.averageScore || 0) / maxValue) * innerHeight;
    return {
      x,
      y,
      label: row.eventName,
      value: Number(row.averageScore || 0)
    };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="panel">
      <div className="section-head">
        <h3>Average Score Trend</h3>
        <span className="muted">Line Graph</span>
      </div>
      <div className="line-chart-wrap">
        <svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            className="line-axis"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            className="line-axis"
          />
          <polyline points={polylinePoints} className="line-path" />
          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="4" className="line-point" />
              <text x={point.x} y={chartHeight - 8} textAnchor="middle" className="line-x-label">
                {point.label.length > 12 ? `${point.label.slice(0, 12)}...` : point.label}
              </text>
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="line-value-label">
                {point.value}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function SuperadminPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const [analyticsSubtab, setAnalyticsSubtab] = useState('users-by-role');
  const [userSubtab, setUserSubtab] = useState('approval');
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('all');
  const [usersStatusFilter, setUsersStatusFilter] = useState('all');
  const [usersPreviewOpen, setUsersPreviewOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [auditFromDate, setAuditFromDate] = useState('');
  const [auditToDate, setAuditToDate] = useState('');
  const [auditUser, setAuditUser] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditPreviewOpen, setAuditPreviewOpen] = useState(false);
  const [error, setError] = useState('');

  const hasHydratedRef = useRef(false);

  const actorKey = useMemo(
    () => user?.id || user?._id || user?.username || 'superadmin',
    [user]
  );

  const stateStorageKey = useMemo(() => `rankit_superadmin_state_${actorKey}`, [actorKey]);
  const actionsStorageKey = useMemo(() => `rankit_superadmin_actions_${actorKey}`, [actorKey]);

  const recordUserAction = (actionType, value) => {
    try {
      const saved = localStorage.getItem(actionsStorageKey);
      const history = saved ? JSON.parse(saved) : [];
      history.push({
        actionType,
        value,
        timestamp: new Date().toISOString()
      });
      const bounded = history.slice(-300);
      localStorage.setItem(actionsStorageKey, JSON.stringify(bounded));
    } catch (_error) {
      // Ignore storage failures.
    }
  };

  const refreshAuditLogs = async () => {
    try {
      const auditData = await fetchAuditLogs(token);
      setLogs(auditData);
    } catch (err) {
      // Keep existing logs on refresh failures.
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [analyticsData, auditData, usersData] = await Promise.all([
          fetchAnalyticsOverview(token),
          fetchAuditLogs(token),
          fetchUsers(token)
        ]);
        setAnalytics(analyticsData);
        setLogs(auditData);
        setAllUsers(usersData);
      } catch (err) {
        setError(err.message);
      }
    }

    loadData();
  }, [token]);

  useEffect(() => {
    if (activeTab !== 'audit') {
      return undefined;
    }

    refreshAuditLogs();
    return undefined;
  }, [activeTab, token]);

  useEffect(() => {
    if (!stateStorageKey) {
      return;
    }

    try {
      const saved = localStorage.getItem(stateStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setActiveTab(parsed.activeTab || 'analytics');
        setAnalyticsSubtab(parsed.analyticsSubtab || 'users-by-role');
        setUserSubtab(parsed.userSubtab || 'approval');
        setUsersSearch(parsed.usersSearch || '');
        setUsersRoleFilter(parsed.usersRoleFilter || 'all');
        setUsersStatusFilter(parsed.usersStatusFilter || 'all');
        setAuditFromDate(parsed.auditFromDate || '');
        setAuditToDate(parsed.auditToDate || '');
        setAuditUser(parsed.auditUser || '');
        setAuditAction(parsed.auditAction || '');
      }
    } catch (_error) {
      // Ignore malformed storage.
    } finally {
      hasHydratedRef.current = true;
    }
  }, [stateStorageKey]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    try {
      localStorage.setItem(
        stateStorageKey,
        JSON.stringify({
          activeTab,
          analyticsSubtab,
          userSubtab,
          usersSearch,
          usersRoleFilter,
          usersStatusFilter,
          auditFromDate,
          auditToDate,
          auditUser,
          auditAction
        })
      );
    } catch (_error) {
      // Ignore storage failures.
    }
  }, [
    stateStorageKey,
    activeTab,
    analyticsSubtab,
    userSubtab,
    usersSearch,
    usersRoleFilter,
    usersStatusFilter,
    auditFromDate,
    auditToDate,
    auditUser,
    auditAction
  ]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    recordUserAction('active_tab_changed', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    recordUserAction('analytics_subtab_changed', analyticsSubtab);
  }, [analyticsSubtab]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    recordUserAction('user_subtab_changed', userSubtab);
  }, [userSubtab]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    recordUserAction('users_filter_updated', {
      search: usersSearch,
      role: usersRoleFilter,
      status: usersStatusFilter
    });
  }, [usersSearch, usersRoleFilter, usersStatusFilter]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    recordUserAction('audit_filter_updated', {
      from: auditFromDate,
      to: auditToDate,
      user: auditUser,
      action: auditAction
    });
  }, [auditFromDate, auditToDate, auditUser, auditAction]);

  const groupedUsers = useMemo(
    () => ({
      admin: allUsers.filter((user) => user.role === 'admin'),
      tabulator: allUsers.filter((user) => user.role === 'tabulator'),
      grievance: allUsers.filter((user) => user.role === 'grievance')
    }),
    [allUsers]
  );

  const filteredUsersRows = useMemo(() => {
    const keyword = usersSearch.trim().toLowerCase();
    return (allUsers || []).filter((user) => {
      const username = String(user.username || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      const approval = user.approvalStatus || (user.isApproved ? 'approved' : 'pending');

      if (keyword && !username.includes(keyword)) {
        return false;
      }

      if (usersRoleFilter !== 'all' && role !== usersRoleFilter) {
        return false;
      }

      if (usersStatusFilter !== 'all' && approval !== usersStatusFilter) {
        return false;
      }

      return true;
    });
  }, [allUsers, usersSearch, usersRoleFilter, usersStatusFilter]);

  const usersPreviewFileName = useMemo(() => {
    const datePart = new Date().toISOString().slice(0, 10);
    return `users_directory_${datePart}.pdf`;
  }, []);

  const usersSummary = useMemo(
    () => ({
      role: 'All Users',
      search: usersSearch.trim() || 'Any',
      roleFilter: usersRoleFilter === 'all' ? 'Any' : usersRoleFilter,
      status: usersStatusFilter === 'all' ? 'Any' : usersStatusFilter
    }),
    [usersSearch, usersRoleFilter, usersStatusFilter]
  );

  const usersPreviewDocument = useMemo(
    () => <UsersDirectoryPDF title="All Users Directory" users={filteredUsersRows} summary={usersSummary} generatedAt={new Date()} />,
    [filteredUsersRows, usersSummary]
  );

  const usersDirectoryPagination = usePagination(filteredUsersRows, 10);

  const auditUsers = useMemo(
    () => [...new Set((logs || []).map((item) => item?.actorId?.username || 'System'))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const auditActions = useMemo(
    () => [...new Set((logs || []).map((item) => item?.action).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const fromDate = auditFromDate ? new Date(`${auditFromDate}T00:00:00`) : null;
    const toDate = auditToDate ? new Date(`${auditToDate}T23:59:59.999`) : null;

    return (logs || []).filter((log) => {
      const createdAt = new Date(log.createdAt);
      const username = log?.actorId?.username || 'System';

      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
      if (auditUser && username !== auditUser) return false;
      if (auditAction && log.action !== auditAction) return false;
      return true;
    });
  }, [logs, auditFromDate, auditToDate, auditUser, auditAction]);

  const auditPagination = usePagination(filteredLogs, 10);

  const openAuditPreview = () => {
    setError('');
    setAuditPreviewOpen(true);
  };

  const auditSummary = useMemo(
    () => ({
      from: auditFromDate || 'Any',
      to: auditToDate || 'Any',
      user: auditUser || 'Any',
      action: auditAction || 'Any'
    }),
    [auditAction, auditFromDate, auditToDate, auditUser]
  );

  const auditPreviewDocument = useMemo(
    () => <AuditTrailPDF logs={filteredLogs} summary={auditSummary} generatedAt={new Date()} />,
    [filteredLogs, auditSummary]
  );

  const auditPreviewFileName = useMemo(() => {
    const datePart = new Date().toISOString().slice(0, 10);
    return `filtered_audit_trail_${datePart}.pdf`;
  }, []);

  return (
    <section className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="Superadmin Functions">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Oversight
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Trail
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="panel stack">
          <div className="section-head">
            <h2>Platform Analytics</h2>
            <span className="muted">System Overview</span>
          </div>

          <div className="status-kpi">
            <div className="kpi-chip"><strong>Total Users</strong>{analytics?.totals?.users ?? 0}</div>
            <div className="kpi-chip"><strong>Approved</strong>{analytics?.totals?.approvedUsers ?? 0}</div>
            <div className="kpi-chip"><strong>Pending</strong>{analytics?.totals?.pendingUsers ?? 0}</div>
            <div className="kpi-chip"><strong>Events</strong>{analytics?.totals?.events ?? 0}</div>
            <div className="kpi-chip"><strong>Contestants</strong>{analytics?.totals?.contestants ?? 0}</div>
            <div className="kpi-chip"><strong>Tallies</strong>{analytics?.totals?.tallies ?? 0}</div>
          </div>

          <div className="sub-tabs" role="tablist" aria-label="Analytics Visualizations">
            <button
              type="button"
              className={`subtab-btn ${analyticsSubtab === 'users-by-role' ? 'active' : ''}`}
              onClick={() => setAnalyticsSubtab('users-by-role')}
            >
              Users By Role
            </button>
            <button
              type="button"
              className={`subtab-btn ${analyticsSubtab === 'event-submissions' ? 'active' : ''}`}
              onClick={() => setAnalyticsSubtab('event-submissions')}
            >
              Event Submissions
            </button>
            <button
              type="button"
              className={`subtab-btn ${analyticsSubtab === 'average-score-trend' ? 'active' : ''}`}
              onClick={() => setAnalyticsSubtab('average-score-trend')}
            >
              Average Score Trend
            </button>
          </div>

          {analyticsSubtab === 'users-by-role' && (
            <RoleDistributionGraph rows={analytics?.usersByRole} />
          )}
          {analyticsSubtab === 'event-submissions' && (
            <EventSubmissionsGraph rows={analytics?.talliesByEvent} />
          )}
          {analyticsSubtab === 'average-score-trend' && (
            <EventAverageLineGraph rows={analytics?.talliesByEvent} />
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="panel stack">
          <div className="section-head">
            <h2>User Oversight</h2>
            <span className="muted">Role-Based Management</span>
          </div>

          <div className="sub-tabs" role="tablist" aria-label="User Oversight Features">
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'approval' ? 'active' : ''}`}
              onClick={() => setUserSubtab('approval')}
            >
              Approval
            </button>
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'create' ? 'active' : ''}`}
              onClick={() => setUserSubtab('create')}
            >
              Create
            </button>
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'users' ? 'active' : ''}`}
              onClick={() => setUserSubtab('users')}
            >
              Users
            </button>
          </div>

          {userSubtab === 'approval' && (
            <AdminUsers
              token={token}
              allowAdmin
              showApproval
              showCreate={false}
              showDirectory={false}
            />
          )}
          {userSubtab === 'create' && (
            <AdminUsers
              token={token}
              allowAdmin
              showApproval={false}
              showCreate
              showDirectory={false}
            />
          )}
          {userSubtab === 'users' && (
            <div className="panel stack">
              <div className="section-head">
                <h3>Users Directory</h3>
                <span className="muted">All-users listing and export</span>
              </div>

              <p className="muted">Shows all users with role, approval, and status details.</p>

              <div className="user-filter-row">
                <div>
                  <label htmlFor="users-search">Filter Username</label>
                  <input
                    id="users-search"
                    type="text"
                    placeholder="Search username"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="users-role-filter">Role</label>
                  <select
                    id="users-role-filter"
                    value={usersRoleFilter}
                    onChange={(e) => setUsersRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value="superadmin">superadmin</option>
                    <option value="admin">admin</option>
                    <option value="tabulator">tabulator</option>
                    <option value="grievance">grievance</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="users-status">Approval Status</label>
                  <select
                    id="users-status"
                    value={usersStatusFilter}
                    onChange={(e) => setUsersStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="approved">approved</option>
                    <option value="pending">pending</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              </div>

              <div className="action-cell">
                <button type="button" className="ghost-btn" onClick={() => setUsersPreviewOpen(true)}>
                  Preview Users PDF
                </button>
              </div>

              <div className="panel">
                <div className="section-head">
                  <h3>All Users</h3>
                  <span className="muted">Filtered Directory</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Approved</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsersRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted">No users match the selected filters.</td>
                        </tr>
                      )}
                      {usersDirectoryPagination.paginatedItems.map((user) => (
                        <tr key={user._id || user.id}>
                          <td>{user.username}</td>
                          <td>{user.role}</td>
                          <td>{user.isApproved ? 'Yes' : 'No'}</td>
                          <td>{user.approvalStatus || (user.isApproved ? 'approved' : 'pending')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  page={usersDirectoryPagination.page}
                  totalPages={usersDirectoryPagination.totalPages}
                  totalItems={usersDirectoryPagination.totalItems}
                  canPrev={usersDirectoryPagination.canPrev}
                  canNext={usersDirectoryPagination.canNext}
                  onPrev={usersDirectoryPagination.goPrev}
                  onNext={usersDirectoryPagination.goNext}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="panel stack">
          <div className="section-head">
            <h2>Audit Trail</h2>
            <span className="muted">Superadmin Access</span>
          </div>

          <div className="audit-filter-row">
            <div>
              <label htmlFor="audit-from-date">From Date</label>
              <input
                id="audit-from-date"
                type="date"
                value={auditFromDate}
                onChange={(e) => setAuditFromDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-to-date">To Date</label>
              <input
                id="audit-to-date"
                type="date"
                value={auditToDate}
                onChange={(e) => setAuditToDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="audit-user">User</label>
              <select id="audit-user" value={auditUser} onChange={(e) => setAuditUser(e.target.value)}>
                <option value="">All Users</option>
                {auditUsers.map((username) => (
                  <option key={username} value={username}>{username}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-action">Action</label>
              <select id="audit-action" value={auditAction} onChange={(e) => setAuditAction(e.target.value)}>
                <option value="">All Actions</option>
                {auditActions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="action-cell">
            <button type="button" className="ghost-btn" onClick={openAuditPreview}>
              Preview Audit Trail
            </button>
          </div>

          <div className="table-wrap tall-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">No audit logs match the selected filters.</td>
                  </tr>
                )}
                {auditPagination.paginatedItems.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.actorId?.username || 'System'}</td>
                    <td>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={auditPagination.page}
            totalPages={auditPagination.totalPages}
            totalItems={auditPagination.totalItems}
            canPrev={auditPagination.canPrev}
            canNext={auditPagination.canNext}
            onPrev={auditPagination.goPrev}
            onNext={auditPagination.goNext}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <PrintReportPreviewModal
        open={auditPreviewOpen}
        title="Audit Trail Preview"
        subtitle="Review before download or print"
        onClose={() => setAuditPreviewOpen(false)}
        fileName={auditPreviewFileName}
        pdfDocument={auditPreviewDocument}
        downloadLabel="Download Audit Trail PDF"
        reportType="audit_trail"
        onDownloadLogged={refreshAuditLogs}
      />

      <PrintReportPreviewModal
        open={usersPreviewOpen}
        title="All Users PDF Preview"
        subtitle="Review before download or print"
        onClose={() => setUsersPreviewOpen(false)}
        fileName={usersPreviewFileName}
        pdfDocument={usersPreviewDocument}
        downloadLabel="Download Users Directory PDF"
        reportType="users_directory"
        onDownloadLogged={refreshAuditLogs}
      />
    </section>
  );
}
