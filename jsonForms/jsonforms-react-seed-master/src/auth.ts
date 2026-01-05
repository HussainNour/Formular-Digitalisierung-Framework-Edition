// src/auth.ts

export const TOKEN_KEY = 'mgr_token';

export const getToken = (): string => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

export const authHeaders = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// JWT Payload dekodieren, um exp zu lesen
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64Url -> Base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');

    // Padding ergänzen (wichtig, sonst kann atob je nach Länge fehlschlagen)
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    const json = atob(padded);
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

/**
 * fetchAuth – schickt Token mit, behandelt 401/403 und abgelaufene Token.
 * - Robust gegen init.headers als Headers / Object / [][]
 * - Fängt Netzwerkfehler ab und loggt hilfreiche Diagnoseinfos
 */
export async function fetchAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  // Token prüfen bevor wir überhaupt versuchen zu callen
  if (isTokenExpired()) {
    clearToken();
    const to = '/login?msg=session_expired';
    if (window.location.pathname !== to) window.location.href = to;
    return new Response(null, { status: 401, statusText: 'Token expired' });
  }

  // Header robust mergen: init.headers kann Headers | Record<string,string> | [string,string][]
  const headers = new Headers(init.headers);

  // Auth Header setzen
  const auth = authHeaders();
  for (const [k, v] of Object.entries(auth)) {
    headers.set(k, v);
  }

  // Optional: Standard-Accept setzen (falls gewünscht)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  try {
    const res = await fetch(input, { ...init, headers });

    // Auth-Fehler behandeln
    if (res.status === 401 || res.status === 403) {
      clearToken();
      const to = '/login?msg=auth_required';
      if (window.location.pathname !== to) window.location.href = to;
    }

    return res;
  } catch (err) {
    // Wichtig: Hier landet man z.B. bei CORS, DNS/Connection refused, invalid header, etc.
    // Detailliertes Logging hilft massiv beim Container/Windows-Podman-Debugging
    console.error('fetchAuth failed', {
      input: typeof input === 'string' ? input : input?.toString?.(),
      init: {
        ...init,
        headers: undefined, // Headers sind nicht serialisierbar; separat ausgeben
      },
      mergedHeaders: Array.from(headers.entries()),
      error: err,
    });

    throw err;
  }
}
