import AdminContestants from '../../components/AdminContestants';
import { CreateUserForm, PendingApprovals } from '../../components/AdminUsers';
import ConsoleLayout from '../../components/ConsoleLayout';
import { useToast } from '../../components/ui';
import useEvents from '../../hooks/useEvents';
import AssignTabulatorPanel from './AssignTabulatorPanel';
import CreateEventPanel from './CreateEventPanel';
import { BackupPanel, CommunityAccessPanel, MasterReportPanel } from './SettingsPanels';

export default function AdminPage() {
  const toast = useToast();
  const { events, reload } = useEvents({ onError: toast.error });

  return (
    <ConsoleLayout
      consoleId="admin"
      title="Event Configuration"
      subtitle="Set up events, people and what the public sees."
      sections={[
        {
          id: 'events',
          label: 'Events',
          subtabs: [
            { id: 'create', label: 'Create event', render: () => <CreateEventPanel onCreated={reload} /> },
            {
              id: 'assign',
              label: 'Assign tabulator',
              render: () => <AssignTabulatorPanel events={events} onAssigned={reload} />
            },
            { id: 'contestants', label: 'Contestants', render: () => <AdminContestants /> }
          ]
        },
        {
          id: 'users',
          label: 'Users',
          subtabs: [
            {
              id: 'approval',
              label: 'Approvals',
              render: () => <PendingApprovals />
            },
            {
              id: 'create',
              label: 'Create user',
              render: () => <CreateUserForm />
            }
          ]
        },
        {
          id: 'settings',
          label: 'Settings',
          subtabs: [
            { id: 'community', label: 'Public page', render: () => <CommunityAccessPanel /> },
            { id: 'report', label: 'Master report', render: () => <MasterReportPanel events={events} /> },
            { id: 'backup', label: 'Backup', render: () => <BackupPanel /> }
          ]
        }
      ]}
    />
  );
}
