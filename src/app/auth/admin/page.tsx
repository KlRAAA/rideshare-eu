import Link from 'next/link';
import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { describeAction, formatDateTime, type AdminAction, type AdminCounts } from '@/lib/admin';

const TILES: { key: keyof AdminCounts; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'openTrips', label: 'Open trips' },
  { key: 'completedTrips', label: 'Completed trips' },
  { key: 'pendingRequests', label: 'Pending requests' },
  { key: 'openReports', label: 'Open reports' },
  { key: 'activeBans', label: 'Active bans' },
  { key: 'admins', label: 'Admins' },
];

export default async function AdminOverviewPage() {
  const { counts, recentActions } = await adminFetch<{ counts: AdminCounts; recentActions: AdminAction[] }>('/api/admin/overview');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TILES.map((t) => (
          <Card key={t.key} className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums mt-1">{counts[t.key]}</p>
          </Card>
        ))}
      </div>

      {counts.openReports > 0 && (
        <Link
          href="/auth/admin/reports"
          className="block rsu-card !p-4 text-sm font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
        >
          {counts.openReports} open report{counts.openReports === 1 ? '' : 's'} waiting for review →
        </Link>
      )}

      <Card>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Recent admin activity</h2>
        {recentActions.length === 0 ? (
          <p className="text-sm text-gray-500">No admin actions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentActions.map((a) => (
              <li key={a.id} className="py-2 flex flex-col md:flex-row md:justify-between gap-0.5">
                <span className="text-sm text-gray-800">{describeAction(a)}</span>
                <span className="text-xs text-gray-400 shrink-0">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/auth/admin/activity"
          className="inline-block mt-3 text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
        >
          View full activity log
        </Link>
      </Card>
    </div>
  );
}
