import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';

// Next renders a layout and its page in parallel, so an admin page's data
// fetch still runs for a visitor the layouts are already turning away. Answer
// the way they do instead of throwing (a thrown error is reported to Sentry as
// a crash): signed out (401) → sign-in, signed in but not an admin (403) → 404.
export async function adminFetch<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }
}
