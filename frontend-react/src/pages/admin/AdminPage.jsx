import AdminContestants from '../../components/AdminContestants';
import { NewSignups, PeoplePanel } from '../../components/AdminUsers';
import ConsoleLayout from '../../components/ConsoleLayout';
import { useToast } from '../../components/ui';
import useEvents from '../../hooks/useEvents';
import AnalyticsPanel from './AnalyticsPanel';
import AssignTabulatorPanel from './AssignTabulatorPanel';
import AuditTrailPanel from './AuditTrailPanel';
import CreateEventPanel from './CreateEventPanel';
import { BackupPanel, CommunityAccessPanel, MasterReportPanel } from './SettingsPanels';
import UserDirectoryPanel from './UserDirectoryPanel';

export default function AdminPage() {
  const toast = useToast();
  const { events, reload } = useEvents({ onError: toast.error });

  return (
    <ConsoleLayout
      consoleId="admin"
      title="Event Configuration"
      subtitle="Set up events, assign roles and choose what the public sees."
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
            { id: 'signups', label: 'New sign-ups', render: () => <NewSignups /> },
            { id: 'people', label: 'People', render: () => <PeoplePanel /> },
            { id: 'directory', label: 'Directory', render: () => <UserDirectoryPanel /> }
          ]
        },
        { id: 'analytics', label: 'Analytics', render: () => <AnalyticsPanel /> },
        { id: 'audit', label: 'Audit trail', render: () => <AuditTrailPanel /> },
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
