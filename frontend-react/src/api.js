// Defaults to same-origin /api: the Vite dev proxy and the Vercel rewrite both forward it
// to the API, which keeps the session cookie first-party.
function resolveApiBase() {
  const configured = import.meta.env?.VITE_API_URL;
  return (configured || '/api').replace(/\/$/, '');
}

const API_BASE = resolveApiBase();

export const UNAUTHORIZED_EVENT = 'rankit:unauthorized';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'X-Requested-With': 'RankIT', ...(options.headers || {}) }
  });

  // An expired or revoked session anywhere in the app sends the user back to sign in.
  if (response.status === 401 && !path.startsWith('/users/login') && !path.startsWith('/users/me')) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }
  } else {
    rawText = await response.text();
  }

  if (!response.ok) {
    const details = Array.isArray(payload?.details) ? ` ${payload.details.join(' ')}` : '';
    const fallback = rawText
      ? `HTTP ${response.status} ${response.statusText}: ${rawText.slice(0, 180)}`
      : `HTTP ${response.status} ${response.statusText}`;

    throw new Error((payload?.message || fallback || 'Request failed.') + details);
  }

  return payload ?? rawText;
}

export function fetchCurrentUser() {
  return request('/users/me');
}

export function logout() {
  return request('/users/logout', { method: 'POST' });
}

export function login(username, password) {
  return request('/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}

export function register(body) {
  return request('/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function fetchPendingUsers() {
  return request('/users/pending');
}

export function updateUserApproval(userId, decision) {
  return request(`/users/${userId}/approval`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision })
  });
}

export function adminCreateUser(body) {
  return request('/users/admin-create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function fetchUsers() {
  return request('/users');
}

export function fetchEvents() {
  return request('/events');
}

export function fetchContestants(eventId) {
  return request(`/contestants?eventId=${encodeURIComponent(eventId)}`);
}

export function fileContestantGrievance(contestantId, body) {
  return request(`/contestants/${contestantId}/deduct`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function createContestant(body) {
  return request('/contestants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function updateContestant(contestantId, body) {
  return request(`/contestants/${encodeURIComponent(contestantId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function bulkCreateContestants(body) {
  return request('/contestants/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function createEvent(body) {
  return request('/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function fetchEventUnlockStatus(eventId) {
  return request(`/events/${eventId}/unlock-status`);
}

export function patchEventStatus(eventId, eventStatus) {
  return request(`/events/${eventId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ eventStatus })
  });
}

export function fetchMasterEventResults(eventId) {
  return request(`/scores/master/${eventId}`);
}

export function recordOfflineScore(body) {
  return request('/scores/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function fetchEventScores(eventId) {
  return request(`/scores/event/${eventId}`);
}

export function generateSportsTop4Pairings(eventId) {
  return request(`/scores/sports/${encodeURIComponent(eventId)}/top4-pairings`, {
    method: 'POST'
  });
}

export function fetchAuditLogs() {
  return request('/audits');
}

export function fetchAnalyticsOverview() {
  return request('/analytics/overview');
}

export function fetchPublicLeaderboard(category = '', eventId = '') {
  const params = new URLSearchParams();

  if (category) {
    params.set('category', category);
  }

  if (eventId) {
    params.set('eventId', eventId);
  }

  const query = params.toString();
  return request(`/public/leaderboard${query ? `?${query}` : ''}`);
}

export function fetchPublicOverallLeaderboard() {
  return request('/public/overall-leaderboard');
}

export function fetchPublicCategoryRankings(categoryName) {
  return request(`/public/rankings/category/${encodeURIComponent(categoryName)}`);
}

export function fetchCategoryRankings(categoryName) {
  return request(`/rankings/category/${encodeURIComponent(categoryName)}`);
}

export function fetchOverallRankings() {
  return request('/rankings/overall');
}

export async function fetchAdminBackup() {
  const response = await fetch(`${API_BASE}/admin/backup`, { credentials: 'include' });

  if (!response.ok) {
    const fallback = `HTTP ${response.status} ${response.statusText}`;
    throw new Error(fallback);
  }

  return response.blob();
}

export function fetchApprovedUsersByRole(role) {
  const params = new URLSearchParams();
  params.set('role', role);

  return request(`/assignments/users?${params.toString()}`);
}

export function assignEventTabulator(eventId, tabulatorId) {
  return request(`/assignments/events/${eventId}/tabulator`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tabulatorId })
  });
}

export function logPdfDownload(reportType, eventId) {
  return request('/admin/log-pdf-download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reportType, eventId })
  });
}

export function fetchCommunityAccess() {
  return request('/admin/community-access');
}

export function updateCommunityAccess(body) {
  return request('/admin/community-access', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function updateCommunityEventAccess(eventId, body) {
  return request(`/admin/community-access/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}
