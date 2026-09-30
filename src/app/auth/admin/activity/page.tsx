import Link from 'next/link';
import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { describeAction, formatDateTime, type AdminAction } from '@/lib/admin';

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { actions, nextCursor } = await adminFetch<{ actions: AdminAction[]; nextCursor: string | null }>(
    `/api/admin/actions${query}`
  );

  return (
    <Card>
      <h2 className="text-sm font-bold text-gray-900 mb-3">Activity log</h2>
      {actions.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing recorded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {actions.map((a) => (
            <li key={a.id} className="py-2">
              <p className="text-sm text-gray-800">{describeAction(a)}</p>
              {typeof a.details?.note === 'string' && <p className="text-xs text-gray-500 mt-0.5">“{a.details.note}”</p>}
              {a.action === 'TRIP_CANCELLED' && typeof a.details?.reason === 'string' && (
                <p className="text-xs text-gray-500 mt-0.5">Reason: {a.details.reason}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-4 mt-3 text-xs font-semibold">
        {cursor && (
          <Link href="/auth/admin/activity" className="text-[color:var(--rsu-color-primary)] hover:underline">
            ← Newest
          </Link>
        )}
        {nextCursor && (
          <Link href={`/auth/admin/activity?cursor=${nextCursor}`} className="text-[color:var(--rsu-color-primary)] hover:underline">
            Older →
          </Link>
        )}
      </div>
    </Card>
  );
}
