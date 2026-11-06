import { useCallback, useEffect, useState } from 'react';
import { assignUserRole, deleteUser, fetchUsers, resetUserPassword, setUserDisabled } from '../api';
import { ASSIGNABLE_ROLES, ROLE_LABELS, accountStatus } from '../utils/roles';
import { useAuth } from '../hooks/useAuth';
import { Button, DataTable, FormField, Modal, Skeleton, useToast } from './ui';

const PROVIDER_LABELS = { google: 'Google', github: 'GitHub' };
const signInMethods = (user) => (user.providers || []).map((id) => PROVIDER_LABELS[id] || id).join(', ') || '—';

// Loads the user list once and exposes a reload; shared by both admin panels.
function useUserList() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const load = useCallback(
    () =>
      fetchUsers()
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
  return [users, load];
}

// Runs one action per row at a time and reports the result.
function useRowAction(reload) {
  const toast = useToast();
  const [busyId, setBusyId] = useState('');
  const run = async (user, action, successText) => {
    setBusyId(user._id);
    try {
      await action();
      toast.success(successText);
      await reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId('');
    }
  };
  return [busyId, run];
}

function RoleSelect({ value, onChange, label, disabled }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {value === 'pending' && <option value="pending">Choose a role…</option>}
      {ASSIGNABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

export function PasswordModal({ user, onClose, onSave, description }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setPassword(''), [user]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(password);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`Reset password for ${user?.username || ''}`}
      description={description || 'They will be signed out everywhere. Share the new password privately.'}
      size="sm"
    >
      <form className="form-stack" onSubmit={submit}>
        <FormField label="New password" hint="At least 8 characters." required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={saving} disabled={password.length < 8}>
          Set password
        </Button>
      </form>
    </Modal>
  );
}

// People who signed in with Google/GitHub and are waiting for a role.
export function NewSignups() {
  const [users, reload] = useUserList();
  const [busyId, run] = useRowAction(reload);
  const [choice, setChoice] = useState({});

  if (!users) return <Skeleton lines={4} />;
  const pending = users.filter((user) => user.role === 'pending' && !user.disabled);

  return (
    <DataTable
      caption="New sign-ups waiting for a role"
      rows={pending}
      emptyTitle="No new sign-ups"
      emptyMessage="People who sign in with Google or GitHub for the first time appear here."
      columns={[
        { key: 'username', header: 'Username', render: (user) => <strong>{user.username}</strong> },
        { key: 'providers', header: 'Signed up with', render: signInMethods },
        {
          key: 'password',
          header: 'Password',
          render: (user) => (user.hasPassword ? 'Set' : <span className="muted">Not set yet</span>)
        },
        {
          key: 'actions',
          header: 'Role',
          align: 'right',
          render: (user) => (
            <span className="button-row">
              <RoleSelect
                label={`Role for ${user.username}`}
                value={choice[user._id] || 'pending'}
                onChange={(role) => setChoice((prev) => ({ ...prev, [user._id]: role }))}
                disabled={Boolean(busyId)}
              />
              <Button
                size="sm"
                variant="primary"
                loading={busyId === user._id}
                disabled={Boolean(busyId) || !choice[user._id]}
                onClick={() =>
                  run(
                    user,
                    () => assignUserRole(user._id, choice[user._id]),
                    `${user.username} is now ${ROLE_LABELS[choice[user._id]]}.`
                  )
                }
              >
                Assign
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(busyId)}
                onClick={() => run(user, () => setUserDisabled(user._id, true), `${user.username} rejected.`)}
              >
                Reject
              </Button>
            </span>
          )
        }
      ]}
    />
  );
}

// Everyone with a role: change it, disable/enable, reset the password or delete.
// Admin accounts are read-only here; only the superadmin can recover them.
export function PeoplePanel() {
  const { user: me } = useAuth();
  const [users, reload] = useUserList();
  const [busyId, run] = useRowAction(reload);
  const [resetting, setResetting] = useState(null);
  const toast = useToast();

  if (!users) return <Skeleton lines={6} />;
  const people = users.filter((user) => user.role !== 'pending' || user.disabled);
  const locked = (user) => user.role === 'admin' || String(user._id) === String(me?.id);

  return (
    <>
      <DataTable
        caption="People"
        rows={people}
        pageSize={15}
        emptyTitle="No accounts yet"
        columns={[
          { key: 'username', header: 'Username', render: (user) => <strong>{user.username}</strong> },
          {
            key: 'role',
            header: 'Role',
            render: (user) =>
              locked(user) || user.role === 'pending' ? (
                ROLE_LABELS[user.role] || user.role
              ) : (
                <RoleSelect
                  label={`Role for ${user.username}`}
                  value={user.role}
                  disabled={Boolean(busyId)}
                  onChange={(role) =>
                    run(user, () => assignUserRole(user._id, role), `${user.username} is now ${ROLE_LABELS[role]}.`)
                  }
                />
              )
          },
          {
            key: 'status',
            header: 'Status',
            render: (user) => {
              const status = accountStatus(user);
              return <span className={`status-badge status-badge--${status}`}>{status}</span>;
            }
          },
          { key: 'providers', header: 'Linked', render: signInMethods },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (user) =>
              locked(user) ? (
                <span className="muted">{user.role === 'admin' ? 'Superadmin only' : 'You'}</span>
              ) : (
                <span className="button-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === user._id}
                    disabled={Boolean(busyId)}
                    onClick={() =>
                      run(
                        user,
                        () => setUserDisabled(user._id, !user.disabled),
                        `${user.username} ${user.disabled ? 'enabled' : 'disabled'}.`
                      )
                    }
                  >
                    {user.disabled ? 'Enable' : 'Disable'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={Boolean(busyId)} onClick={() => setResetting(user)}>
                    Reset password
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(busyId)}
                    onClick={() => {
                      if (window.confirm(`Delete ${user.username}? They can sign up again unless disabled instead.`)) {
                        run(user, () => deleteUser(user._id), `${user.username} deleted.`);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </span>
              )
          }
        ]}
      />
      <PasswordModal
        user={resetting}
        onClose={() => setResetting(null)}
        onSave={async (password) => {
          try {
            await resetUserPassword(resetting._id, password);
            toast.success(`Password reset for ${resetting.username}.`);
          } catch (error) {
            toast.error(error.message);
            throw error;
          }
        }}
      />
    </>
  );
}
