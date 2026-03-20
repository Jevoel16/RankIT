import { useEffect, useState } from 'react';
import { adminCreateUser, fetchPendingUsers, fetchUsers, updateUserApproval } from '../api';

export default function AdminUsers({
  token,
  allowAdmin = false,
  allowSuperadmin = false,
  showApproval = true,
  showCreate = true,
  showDirectory = true
}) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('tallier');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    try {
      const [pending, all] = await Promise.all([fetchPendingUsers(token), fetchUsers(token)]);
      setPendingUsers(pending);
      setAllUsers(all);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onDecision = async (userId, decision) => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await updateUserApproval(userId, decision, token);
      setSuccess(`User ${decision}d successfully.`);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onCreate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await adminCreateUser({ username, password, role }, token);
      setSuccess('User created and approved successfully.');
      setUsername('');
      setPassword('');
      setRole('tallier');
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel stack">
      {showApproval && (
        <>
          <div className="section-head">
            <h2>User Approval</h2>
            <span className="muted">IAM Queue</span>
          </div>
          <p className="muted">Pending accounts stay locked until an Admin approves them.</p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No pending users.</td>
                  </tr>
                )}
                {pendingUsers.map((user) => (
                  <tr key={user._id}>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>{user.approvalStatus}</td>
                    <td className="action-cell">
                      <button
                        type="button"
                        onClick={() => onDecision(user._id, 'approve')}
                        disabled={loading}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => onDecision(user._id, 'reject')}
                        disabled={loading}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showCreate && (
        <>
          <div className="section-head">
            <h3>Manual Create User</h3>
            <span className="muted">Bypass Approval</span>
          </div>
          <form className="stack" onSubmit={onCreate}>
            <label htmlFor="admin-create-username">Username</label>
            <input
              id="admin-create-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />

            <label htmlFor="admin-create-password">Password</label>
            <input
              id="admin-create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <label htmlFor="admin-create-role">Role</label>
            <select id="admin-create-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="tallier">Tallier</option>
              <option value="tabulator">Tabulator</option>
              {allowAdmin && <option value="admin">Admin</option>}
              {allowSuperadmin && <option value="superadmin">Superadmin</option>}
            </select>

            <button type="submit" disabled={loading}>
              Create Approved User
            </button>
          </form>
        </>
      )}

      {showDirectory && (
        <>
          <div className="section-head">
            <h3>All Users</h3>
            <span className="muted">Directory</span>
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
                {allUsers.map((user) => (
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
        </>
      )}

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  );
}
