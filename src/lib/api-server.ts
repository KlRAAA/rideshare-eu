import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch as baseApiFetch } from './api';

const SESSION_COOKIE = 'rsu_session';

// Server-side (RSC / route handlers) apiFetch. The browser cookie jar isn't in
// play during server rendering, so `credentials: 'include'` on the base fetch
// does nothing here — instead read the incoming request's `rsu_session` cookie
// and forward the JWT to Express as a Bearer token, which the auth middleware
// also accepts.
//
// Server Components import `apiFetch` from here; client components keep importing
// it from `./api`. `ApiError` and the cookie helpers still come from `./api`.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return baseApiFetch<T>(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
