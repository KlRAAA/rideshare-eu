const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.message || data.error || 'Request failed', data.error);
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
