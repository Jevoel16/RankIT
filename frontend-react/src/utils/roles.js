// "tallier" is the legacy name for tabulator accounts; normalize it in one place.
export const normalizeRole = (role) => (role === 'tallier' ? 'tabulator' : role);

const HOME_BY_ROLE = {
  tabulator: '/tabulator',
  grievance: '/grievance',
  admin: '/admin',
  superadmin: '/superadmin'
};

export const ASSIGNABLE_ROLES = ['tabulator', 'grievance', 'admin'];

export const homePathForRole = (role) => HOME_BY_ROLE[normalizeRole(role)] || '/';

// Staff destinations per role. Superadmin only recovers admin accounts.
export const navLinksForRole = (role) => {
  const normalized = normalizeRole(role);
  const links = {
    tabulator: [{ to: '/tabulator', label: 'Tabulation', match: ['/tabulator', '/tabulate/'] }],
    grievance: [{ to: '/grievance', label: 'Grievances' }],
    admin: [{ to: '/admin', label: 'Event Configuration' }],
    superadmin: [{ to: '/superadmin', label: 'Admin Recovery' }]
  };
  return [{ to: '/', label: 'Live Rankings', exact: true }, ...(links[normalized] || [])];
};

export const ROLE_LABELS = {
  pending: 'No role yet',
  tabulator: 'Tabulator',
  grievance: 'Grievance',
  admin: 'Admin',
  superadmin: 'Superadmin'
};

// active | pending (waiting for a role) | disabled
export const accountStatus = (user) => {
  if (user?.disabled) return 'disabled';
  if (user?.role === 'pending') return 'pending';
  return 'active';
};
