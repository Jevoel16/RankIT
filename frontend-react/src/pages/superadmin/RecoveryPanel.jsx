import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecoveryAccounts, promoteToAdmin, resetAdminPassword } from '../../api';
import { PasswordModal } from '../../components/AdminUsers';
import { Button, DataTable, FormField, Skeleton, useToast } from '../../components/ui';
import { ROLE_LABELS, accountStatus } from '../../utils/roles';

// Superadmin's only job: get an admin back in. Promote someone to admin, or reset an admin's password.
export default function RecoveryPanel() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [resetting, setResetting] = useState(null);

  const load = useCallback(
    () =>
      fetchRecoveryAccounts()
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

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    // Admins first, then everyone else who could be promoted.
    return (users || [])
      .filter((user) => !keyword || user.username.toLowerCase().includes(keyword))
      .sort((a, b) => (a.role === 'admin') === (b.role === 'admin') ? 0 : a.role === 'admin' ? -1 : 1);
  }, [users, search]);

  const promote = async (user) => {
    if (!window.confirm(`Make ${user.username} an admin?`)) return;
    setBusyId(user._id);
    try {
      await promoteToAdmin(user._id);
      toast.success(`${user.username} is now an admin.`);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId('');
    }
  };

  if (!users) return <Skeleton lines={6} />;

  return (
    <div className="form-stack">
      <div className="filter-bar">
        <FormField label="Search">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Username" />
        </FormField>
      </div>

      <DataTable
        caption="Accounts"
        rows={rows}
        pageSize={15}
        emptyTitle="No accounts yet"
        emptyMessage="People appear here after they sign in with Google or GitHub."
        columns={[
          { key: 'username', header: 'Username', render: (user) => <strong>{user.username}</strong> },
          { key: 'role', header: 'Role', render: (user) => ROLE_LABELS[user.role] || user.role },
          {
            key: 'status',
            header: 'Status',
            render: (user) => (
              <span className={`status-badge status-badge--${accountStatus(user)}`}>{accountStatus(user)}</span>
            )
          },
          {
            key: 'actions',
            header: 'Recovery',
            align: 'right',
            render: (user) =>
              user.role === 'admin' ? (
                <Button size="sm" variant="secondary" disabled={Boolean(busyId)} onClick={() => setResetting(user)}>
                  Reset password
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busyId === user._id}
                  disabled={Boolean(busyId) || !user.hasPassword}
                  title={user.hasPassword ? undefined : 'They must finish setting a password first.'}
                  onClick={() => promote(user)}
                >
                  Make admin
                </Button>
              )
          }
        ]}
      />

      <PasswordModal
        user={resetting}
        onClose={() => setResetting(null)}
        description="The admin is signed out everywhere and re-enabled if they were disabled. Share the password privately."
        onSave={async (password) => {
          try {
            await resetAdminPassword(resetting._id, password);
            toast.success(`Password reset for ${resetting.username}.`);
            await load();
          } catch (error) {
            toast.error(error.message);
            throw error;
          }
        }}
      />
    </div>
  );
}
