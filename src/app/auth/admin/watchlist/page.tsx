import Link from 'next/link';
import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';

interface FlaggedUser {
  userId: string;
  fullName: string;
  reasons: string[];
}

export default async function AdminWatchlistPage() {
  const { users } = await adminFetch<{ users: FlaggedUser[] }>('/api/admin/watchlist');

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Users with repeated cancellations or reports in the last 30 days. Open a user to see their trips, reports and
        ratings before deciding anything.
      </p>
      {users.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">No one needs a closer look right now.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.userId} className="rsu-card">
              <Link
                href={`/auth/admin/users/${u.userId}`}
                className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
              >
                {u.fullName}
              </Link>
              <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
                {u.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-gray-400">Flags only. Nothing here happens automatically.</p>
    </div>
  );
}
