// Where the browser sends API calls. Locally that is the Express server on
// :4000. In production NEXT_PUBLIC_API_URL is left unset, so calls go to this
// site's own /api/* (keeping the session cookie first-party) and src/proxy.ts
// forwards them to the API on Railway.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

// Server rendering can't use a relative URL, so it calls the API directly
// (API_ORIGIN) with the same secret header the proxy adds. Both are server-only
// variables, so neither reaches the browser bundle.
function serverSide(): { base: string; headers: Record<string, string> } | null {
  if (typeof window !== 'undefined') return null;
  return {
    base: process.env.API_ORIGIN || API_BASE,
    headers: process.env.ORIGIN_SECRET ? { 'x-origin-secret': process.env.ORIGIN_SECRET } : {},
  };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  // The full parsed error body — some endpoints return extra context alongside
  // `error` (e.g. the trip-edit confirm gate returns approvedCount + fuel-share
  // delta). Undefined when the response wasn't JSON.
  body?: Record<string, unknown>;
  constructor(status: number, message: string, code?: string, body?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const server = serverSide();
  const res = await fetch(`${server?.base ?? API_BASE}${path}`, {
    ...options,
    // Send the httpOnly `rsu_session` cookie on cross-origin browser calls so
    // the Express auth middleware can verify the session. No-op server-side
    // (RSC calls forward the token as a Bearer header via lib/api-server.ts).
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...server?.headers, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.message || data.error || 'Request failed', data.error, data);
  }
  return data as T;
}

// The session cookie route (src/app/api/session/route.ts) lives on the
// Next.js app itself, not the Express API — it must stay same-origin
// (relative path, no API_BASE prefix) or the browser sends it to Express,
// where it doesn't exist (404). Use these instead of apiFetch for it.
export async function setSessionCookie(token: string): Promise<void> {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new ApiError(res.status, 'Failed to establish session');
}

export async function clearSessionCookie(): Promise<void> {
  await fetch('/api/session', { method: 'DELETE' });
}
