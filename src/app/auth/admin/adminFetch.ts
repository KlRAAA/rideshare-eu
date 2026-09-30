import 'server-only';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';

// Next renders a layout and its page in parallel, so an admin page's data
// fetch still runs for a non-admin even though the layout 404s. Turning the
// API's 403 into the same 404 keeps that from surfacing as a server error.
export async function adminFetch<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }
}
