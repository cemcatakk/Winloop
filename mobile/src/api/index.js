/**
 * Central API client. All config (base URL, auth, headers) in one place.
 * Use api.get(), api.post() for all backend calls.
 */

import { API_BASE_URL } from '../config/api';
import { store } from '../store';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function getAuthToken() {
  const state = store.getState();
  const token = state.auth?.token ?? null;
  return token != null ? String(token) : null;
}

function buildHeaders(extra = {}, useAuth = true) {
  const headers = { ...DEFAULT_HEADERS, ...extra };
  if (useAuth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path - e.g. 'auth/login', 'morning/today' (no leading slash)
 * @param {object} [options] - { body, headers, useAuth }
 * @returns {Promise<{ data: any, ok: boolean, status: number }>}
 */
export async function request(method, path, options = {}) {
  const { body, headers: extraHeaders = {}, useAuth = true } = options;
  const url = path.startsWith('http') ? path : `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers = buildHeaders(extraHeaders, useAuth);

  const config = { method, headers };
  if (body != null && method !== 'GET') {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));

  return { data, ok: res.ok, status: res.status };
}

export function get(path, options = {}) {
  return request('GET', path, options);
}

export function post(path, body, options = {}) {
  return request('POST', path, { ...options, body });
}

export function put(path, body, options = {}) {
  return request('PUT', path, { ...options, body });
}

export function patch(path, body, options = {}) {
  return request('PATCH', path, { ...options, body });
}

export function del(path, options = {}) {
  return request('DELETE', path, options);
}

export { getAuthToken, API_BASE_URL };
