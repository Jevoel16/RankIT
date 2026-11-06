// "tallier" is the legacy name for tabulator accounts; normalize it in one place.
export const normalizeRole = (role) => (role === 'tallier' ? 'tabulator' : role);

const HOME_BY_ROLE = {
  tabulator: '/tabulator',
  grievance: '/grievance',
  admin: '/admin',
  superadmin: '/superadmin'
};

export const homePathForRole = (role) => HOME_BY_ROLE[normalizeRole(role)] || '/';

// Staff destinations per role. Superadmin can also open the admin console.
export const navLinksForRole = (role) => {
  const normalized = normalizeRole(role);
  const links = {
    tabulator: [{ to: '/tabulator', label: 'Tabulation', match: ['/tabulator', '/tabulate/'] }],
    grievance: [{ to: '/grievance', label: 'Grievances' }],
    admin: [{ to: '/admin', label: 'Event Configuration' }],
    superadmin: [
      { to: '/superadmin', label: 'Superadmin Console' },
      { to: '/admin', label: 'Event Configuration' }
    ]
  };
  return [{ to: '/', label: 'Live Rankings', exact: true }, ...(links[normalized] || [])];
};

export const ROLE_LABELS = {
  tabulator: 'Tabulator',
  grievance: 'Grievance',
  admin: 'Admin',
  superadmin: 'Superadmin'
};
