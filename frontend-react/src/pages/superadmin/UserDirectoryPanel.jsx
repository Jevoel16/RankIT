import { useEffect, useMemo, useState } from 'react';
import { fetchUsers } from '../../api';
import PrintReportPreviewModal from '../../components/PrintReportPreviewModal';
import UsersDirectoryPDF from '../../components/UsersDirectoryPDF';
import { Button, DataTable, FormField, Skeleton, useToast } from '../../components/ui';
import { todayStamp } from '../../utils/browser';
import { ROLE_LABELS } from '../../utils/roles';

const statusOf = (user) => user.approvalStatus || (user.isApproved ? 'approved' : 'pending');

export default function UserDirectoryPanel() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchUsers()
      .then((data) => setUsers(data || []))
      .catch((error) => {
        setUsers([]);
        toast.error(error.message);
      });
  }, [toast]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (users || []).filter(
      (user) =>
        (!keyword || String(user.username).toLowerCase().includes(keyword)) &&
        (role === 'all' || user.role === role) &&
        (status === 'all' || statusOf(user) === status)
    );
  }, [users, search, role, status]);

  const pdf = useMemo(
    () => (
      <UsersDirectoryPDF
        title="All Users Directory"
        users={rows}
        summary={{
          role: 'All Users',
          search: search.trim() || 'Any',
          roleFilter: role === 'all' ? 'Any' : role,
          status: status === 'all' ? 'Any' : status
        }}
        generatedAt={new Date()}
      />
    ),
    [rows, search, role, status]
  );

  if (!users) return <Skeleton lines={6} />;

  return (
    <div className="form-stack">
      <div className="filter-bar">
        <FormField label="Search">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Username" />
        </FormField>
        <FormField label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </FormField>
        <Button className="filter-bar__action" onClick={() => setPreviewOpen(true)} disabled={rows.length === 0}>
          Export PDF
        </Button>
      </div>

      <DataTable
        caption="User directory"
        rows={rows}
        pageSize={15}
        emptyTitle="No users match these filters"
        columns={[
          { key: 'username', header: 'Username', render: (user) => <strong>{user.username}</strong> },
          { key: 'role', header: 'Role', render: (user) => ROLE_LABELS[user.role] || user.role },
          {
            key: 'status',
            header: 'Status',
            render: (user) => <span className={`status-badge status-badge--${statusOf(user)}`}>{statusOf(user)}</span>
          }
        ]}
      />

      <PrintReportPreviewModal
        open={previewOpen}
        title="Users directory"
        subtitle="Review before download or print"
        onClose={() => setPreviewOpen(false)}
        fileName={`users_directory_${todayStamp()}.pdf`}
        pdfDocument={pdf}
        downloadLabel="Download PDF"
        reportType="users_directory"
      />
    </div>
  );
}
