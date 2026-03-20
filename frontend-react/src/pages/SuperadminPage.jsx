import { useEffect, useMemo, useState } from 'react';
import { fetchAnalyticsOverview, fetchAuditLogs, fetchUsers } from '../api';
import { useAuth } from '../hooks/useAuth';
import AdminUsers from '../components/AdminUsers';

function RoleTable({ title, rows }) {
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
            {rows.map((user) => (
              <tr key={user._id || user.id}>
                <td>{user.username}</td>
                <td>{user.isApproved ? 'Yes' : 'No'}</td>
                <td>{user.approvalStatus || (user.isApproved ? 'approved' : 'pending')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        <p className="muted">No event tally data available yet.</p>
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
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const [userSubtab, setUserSubtab] = useState('approval');
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [error, setError] = useState('');

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

  const groupedUsers = useMemo(
    () => ({
      admin: allUsers.filter((user) => user.role === 'admin'),
      tallier: allUsers.filter((user) => user.role === 'tallier'),
      tabulator: allUsers.filter((user) => user.role === 'tabulator')
    }),
    [allUsers]
  );

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

          <RoleDistributionGraph rows={analytics?.usersByRole} />
          <EventSubmissionsGraph rows={analytics?.talliesByEvent} />
          <EventAverageLineGraph rows={analytics?.talliesByEvent} />
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
              className={`subtab-btn ${userSubtab === 'admins' ? 'active' : ''}`}
              onClick={() => setUserSubtab('admins')}
            >
              Admin Users
            </button>
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'talliers' ? 'active' : ''}`}
              onClick={() => setUserSubtab('talliers')}
            >
              Tallier Users
            </button>
            <button
              type="button"
              className={`subtab-btn ${userSubtab === 'tabulators' ? 'active' : ''}`}
              onClick={() => setUserSubtab('tabulators')}
            >
              Tabulator Users
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
          {userSubtab === 'admins' && <RoleTable title="Admin Users" rows={groupedUsers.admin} />}
          {userSubtab === 'talliers' && <RoleTable title="Tallier Users" rows={groupedUsers.tallier} />}
          {userSubtab === 'tabulators' && (
            <RoleTable title="Tabulator Users" rows={groupedUsers.tabulator} />
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="panel stack">
          <div className="section-head">
            <h2>Audit Trail</h2>
            <span className="muted">Superadmin Access</span>
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
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.actorId?.username || 'System'}</td>
                    <td>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
