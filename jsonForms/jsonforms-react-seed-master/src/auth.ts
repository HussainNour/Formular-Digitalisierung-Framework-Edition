// src/auth.ts
export const TOKEN_KEY = 'mgr_token';

export const getToken = (): string => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// JWT Payload dekodieren, um exp zu lesen
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const isTokenExpired = (): boolean => {
  const t = getToken();
  if (!t) return true;
  const payload = decodeJwtPayload(t);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= payload.exp;
};

/** fetchAuth – schickt Token mit, behandelt 401/403 und abgelaufene Token */
export async function fetchAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  if (isTokenExpired()) {
    clearToken();
    const to = '/login?msg=session_expired';
    if (window.location.pathname !== to) window.location.href = to;
    return new Response(null, { status: 401, statusText: 'Token expired' }) as any;
  }

  const headers = { ...(init.headers || {}), ...authHeaders() };
  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    const to = '/login?msg=auth_required';
    if (window.location.pathname !== to) window.location.href = to;
  }

  return res;
}
