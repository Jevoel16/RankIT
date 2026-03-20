const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
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

export function fetchPendingUsers(token) {
  return request('/users/pending', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function updateUserApproval(userId, decision, token) {
  return request(`/users/${userId}/approval`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ decision })
  });
}

export function adminCreateUser(body, token) {
  return request('/users/admin-create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function fetchUsers(token) {
  return request('/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function fetchEvents(token) {
  return request('/events', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function fetchContestants(eventId, token) {
  return request(`/contestants?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function createContestant(body, token) {
  return request('/contestants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function bulkCreateContestants(body, token) {
  return request('/contestants/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function createEvent(body, token) {
  return request('/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function fetchEventUnlockStatus(eventId, token) {
  return request(`/events/${eventId}/unlock-status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function fetchEventTallies(eventId, token) {
  return request(`/tallies/event/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function submitTally(body, token) {
  return request('/tallies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function fetchAuditLogs(token) {
  return request('/audits', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function fetchAnalyticsOverview(token) {
  return request('/analytics/overview', {
    headers: { Authorization: `Bearer ${token}` }
  });
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
