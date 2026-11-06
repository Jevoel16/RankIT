import { useCallback, useEffect, useState } from 'react';
import { adminCreateUser, fetchPendingUsers, updateUserApproval } from '../api';
import { ROLE_LABELS } from '../utils/roles';
import { Button, DataTable, FormField, Skeleton, useToast } from './ui';

export function PendingApprovals({ onChanged }) {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(
    () =>
      fetchPendingUsers()
        .then((data) => setUsers(data || []))
        .catch((error) => {
          setUsers([]);
          toast.error(error.message);
        }),
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (user, decision) => {
    setBusyId(user._id);
    try {
      await updateUserApproval(user._id, decision);
      toast.success(`${user.username} ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId('');
    }
  };

  if (!users) return <Skeleton lines={4} />;

  return (
    <DataTable
      caption="Accounts waiting for approval"
      rows={users}
      emptyTitle="No pending accounts"
      emptyMessage="New sign-ups you can approve will appear here."
      columns={[
        { key: 'username', header: 'Username', render: (user) => <strong>{user.username}</strong> },
        { key: 'role', header: 'Role', render: (user) => ROLE_LABELS[user.role] || user.role },
        {
          key: 'actions',
          header: 'Decision',
          align: 'right',
          render: (user) => (
            <span className="button-row">
              <Button
                size="sm"
                variant="primary"
                loading={busyId === user._id}
                disabled={Boolean(busyId)}
                onClick={() => decide(user, 'approve')}
              >
                Approve
              </Button>
              <Button size="sm" variant="ghost" disabled={Boolean(busyId)} onClick={() => decide(user, 'reject')}>
                Reject
              </Button>
            </span>
          )
        }
      ]}
    />
  );
}

export function CreateUserForm({ allowAdmin = false, onCreated }) {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('tabulator');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await adminCreateUser({ username: username.trim(), password, role });
      toast.success(`Created ${created?.username || username}. They can sign in now.`);
      setUsername('');
      setPassword('');
      setRole('tabulator');
      onCreated?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-stack form-narrow" onSubmit={onSubmit}>
      <FormField label="Username" hint="The role is added automatically, e.g. maria@tabulator.rankit." required>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" maxLength={64} />
      </FormField>
      <FormField label="Temporary password" hint="At least 8 characters. Share it privately." required>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
        />
      </FormField>
      <FormField label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="tabulator">Tabulator</option>
          <option value="grievance">Grievance</option>
          {allowAdmin && <option value="admin">Admin</option>}
        </select>
      </FormField>
      <div>
        <Button type="submit" variant="primary" loading={saving} disabled={!username.trim() || password.length < 8}>
          Create approved user
        </Button>
      </div>
    </form>
  );
}
