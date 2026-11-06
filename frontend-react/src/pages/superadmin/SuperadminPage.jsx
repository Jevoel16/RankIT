import { CreateUserForm, PendingApprovals } from '../../components/AdminUsers';
import ConsoleLayout from '../../components/ConsoleLayout';
import AnalyticsPanel from './AnalyticsPanel';
import AuditTrailPanel from './AuditTrailPanel';
import UserDirectoryPanel from './UserDirectoryPanel';

export default function SuperadminPage() {
  return (
    <ConsoleLayout
      consoleId="superadmin"
      title="Superadmin Console"
      subtitle="Platform health, accounts and the audit trail."
      sections={[
        { id: 'analytics', label: 'Analytics', render: () => <AnalyticsPanel /> },
        {
          id: 'users',
          label: 'Users',
          subtabs: [
            { id: 'approval', label: 'Approvals', render: () => <PendingApprovals /> },
            { id: 'create', label: 'Create user', render: () => <CreateUserForm allowAdmin /> },
            { id: 'directory', label: 'Directory', render: () => <UserDirectoryPanel /> }
          ]
        },
        { id: 'audit', label: 'Audit trail', render: () => <AuditTrailPanel /> }
      ]}
    />
  );
}
