import { useEffect, useMemo, useState } from 'react';
import { fetchAnalyticsOverview, fetchUsers } from '../../api';
import { Skeleton, useToast } from '../../components/ui';
import { ROLE_LABELS } from '../../utils/roles';

const ROLE_ORDER = ['admin', 'tabulator', 'grievance', 'superadmin'];
const RADIUS = 66;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const isApproved = (user) => user.isApproved || user.approvalStatus === 'approved';
const isPending = (user) => user.approvalStatus === 'pending' || (!user.isApproved && !user.approvalStatus);

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <strong className="stat-tile__value">{value ?? 0}</strong>
    </div>
  );
}

function RoleDonut({ users }) {
  const [filter, setFilter] = useState('total');
  const filtered = useMemo(() => {
    if (filter === 'approved') return users.filter(isApproved);
    if (filter === 'pending') return users.filter(isPending);
    return users;
  }, [users, filter]);

  const segments = ROLE_ORDER.map((role, index) => ({
    role,
    value: filtered.filter((user) => user.role === role).length,
    color: `var(--chart-${index + 1})`
  }));
  const total = Math.max(filtered.length, 1);
  let offset = 0;

  return (
    <div className="card-block analytics-donut-card">
      <div className="card-block__head">
        <h3>Users by role</h3>
        <select aria-label="Which users to count" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="total">All users</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div className="donut-layout">
        <figure className="donut" aria-label={`${filtered.length} users`}>
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <circle cx="90" cy="90" r={RADIUS} className="donut__track" />
            {segments.map((segment) => {
              const dash = (segment.value / total) * CIRCUMFERENCE;
              const circle = (
                <circle
                  key={segment.role}
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  className="donut__segment"
                  style={{ stroke: segment.color }}
                  strokeDasharray={`${dash} ${Math.max(CIRCUMFERENCE - dash, 0)}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <figcaption className="donut__center">
            <strong>{filtered.length}</strong>
            <span>users</span>
          </figcaption>
        </figure>
        <ul className="donut-legend">
          {segments.map((segment) => (
            <li key={segment.role}>
              <span className="donut-legend__dot" style={{ background: segment.color }} aria-hidden="true" />
              <span>{ROLE_LABELS[segment.role]}</span>
              <strong>{segment.value}</strong>
              <span className="muted">{Math.round((segment.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AnalyticsPanel() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    Promise.all([fetchAnalyticsOverview(), fetchUsers()])
      .then(([analytics, userList]) => {
        setOverview(analytics);
        setUsers(userList || []);
      })
      .catch((error) => {
        setOverview({});
        toast.error(error.message);
      });
  }, [toast]);

  if (!overview) return <Skeleton lines={6} />;
  const totals = overview.totals || {};

  return (
    <div className="form-stack">
      <div className="stat-grid">
        <StatTile label="Users" value={totals.users} />
        <StatTile label="Approved" value={totals.approvedUsers} />
        <StatTile label="Pending" value={totals.pendingUsers} />
        <StatTile label="Events" value={totals.events} />
        <StatTile label="Contestants" value={totals.contestants} />
        <StatTile label="Score sheets" value={totals.tallies} />
      </div>
      <RoleDonut users={users} />
    </div>
  );
}
