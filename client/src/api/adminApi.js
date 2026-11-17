const API_BASE = import.meta.env.VITE_API_BASE_URL || '/admin';

export async function adminRequest(path, apiKey, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
  if (response.status === 401) {
    const error = new Error('Admin key was rejected. Sign in again with a valid key.');
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error || message; } catch { /* response may be empty */ }
    throw new Error(message);
  }
  return response.json();
}

export function getOverview(key) { return adminRequest('/overview', key); }
export function getRides(key, filters = {}) {
  const query = new URLSearchParams(filters);
  return adminRequest(`/rides?${query}`, key);
}
export function getDrivers(key) { return adminRequest('/drivers', key); }
export function getEvents(key) { return adminRequest('/events?limit=100', key); }
export function getHealth(key) { return adminRequest('/health', key); }
