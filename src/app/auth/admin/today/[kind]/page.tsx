import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import Badge from '@/components/Badge';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { formatDateTime } from '@/lib/admin';
import { clockLabel } from '@/lib/tripRun';
import { tripRoute, tripWhen } from '@/lib/tripLine';
import { tripStatusBadge } from '@/lib/statusBadge';

interface TripRow {
  id: string;
  hostId: string;
  hostName: string;
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  recurrenceType: string;
  status: string;
  filledSeats: number;
  totalSeats: number;
  riders?: { id: string; fullName: string }[];
}
interface UserRow {
  id: string;
  fullName: string;
  role: string;
  createdAt: string;
  bannedUntil: string | null;
  banReason: string | null;
}
type ListData = { kind: string; total: number; trips?: TripRow[]; users?: UserRow[]; ridersShown?: boolean };

const TITLES: Record<string, string> = {
  'rides-today': 'Rides today',
  'open-trips': 'Open trips',
  signups: 'New sign-ups, last 24 hours',
  'active-bans': 'Active bans',
};
const LIST = 'divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white';
const LINK = 'font-semibold text-[color:var(--rsu-color-primary)] hover:underline';

// What's behind each "Platform today" tile on the overview.
export default async function AdminTodayListPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!TITLES[kind]) notFound();
  const data = await adminFetch<ListData>(`/api/admin/overview/${kind}`);
  const rows = data.trips ?? data.users ?? [];

  return (
    <div className="space-y-3">
      <Link href="/auth/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <FaArrowLeft className="h-3 w-3" aria-hidden /> Overview
      </Link>
      <h2 className="text-lg font-bold text-gray-900">
        {TITLES[kind]} <span className="font-normal text-gray-500">({data.total})</span>
      </h2>
      {data.trips && !data.ridersShown && (
        <p className="text-xs text-gray-500">Who rides each trip is shown to the superadmin only.</p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Nothing here right now.</p>
      ) : data.trips ? (
        <ul className={LIST}>
          {data.trips.map((t) => {
            const badge = tripStatusBadge(t.status);
            return (
              <li key={t.id} className="space-y-1 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm">
                    <span className="font-semibold tabular-nums text-gray-900">{clockLabel(t.departureTime)}</span>{' '}
                    <span className="text-gray-900">{tripRoute(t)}</span>
                  </p>
                  <Badge tone={badge.tone} className="shrink-0">
                    {badge.label}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600">
                  {tripWhen(t)} · Driver{' '}
                  <Link href={`/auth/admin/users/${t.hostId}`} className={LINK}>
                    {t.hostName}
                  </Link>{' '}
                  · {t.filledSeats} of {t.totalSeats} seats taken
                </p>
                {t.riders && t.riders.length > 0 && (
                  <p className="text-xs text-gray-600">
                    Riders:{' '}
                    {t.riders.map((r, i) => (
                      <span key={r.id}>
                        {i > 0 && ', '}
                        <Link href={`/auth/admin/users/${r.id}`} className={LINK}>
                          {r.fullName}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className={LIST}>
          {data.users!.map((u) => (
            <li key={u.id}>
              <Link href={`/auth/admin/users/${u.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{u.fullName}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {kind === 'active-bans' && u.bannedUntil
                      ? `Until ${formatDateTime(u.bannedUntil)}${u.banReason ? ` · ${u.banReason.toLowerCase().replace(/_/g, ' ')}` : ''}`
                      : `Joined ${formatDateTime(u.createdAt)}`}
                  </span>
                </span>
                <Badge tone={kind === 'active-bans' ? 'danger' : 'neutral'} className="shrink-0">
                  {kind === 'active-bans' ? 'Banned' : u.role.toLowerCase()}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.total > rows.length && <p className="text-xs text-gray-500">Showing the first {rows.length}.</p>}
    </div>
  );
}
