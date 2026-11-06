import ConsoleLayout from '../../components/ConsoleLayout';
import RecoveryPanel from './RecoveryPanel';

export default function SuperadminPage() {
  return (
    <ConsoleLayout
      consoleId="superadmin"
      title="Admin Recovery"
      subtitle="Make someone an admin or reset an admin's password. Everything else is done by admins."
      sections={[{ id: 'recovery', label: 'Recovery', render: () => <RecoveryPanel /> }]}
    />
  );
}
