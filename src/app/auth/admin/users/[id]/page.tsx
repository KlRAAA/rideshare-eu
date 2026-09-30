import { notFound } from 'next/navigation';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import { getSessionUserId } from '@/lib/session';
import { reportCategoryLabel } from '@/lib/format';
import { formatDateTime, type AdminAction } from '@/lib/admin';
import UserActions from './UserActions';
import CancelTripButton from './CancelTripButton';

interface TripRow {
  id: string;
  destinationAddress: string;
  departureTime: string;
  status: string;
  filledSeats: number;
  totalSeats: number;
}

interface UserDetail {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    universityId: string;
    trustScore: number;
    tripCount: number;
    isAdmin: boolean;
    bannedUntil: string | null;
    banReason: string | null;
    createdAt: string;
  };
  hostedTrips: TripRow[];
  joinedMatches: { id: string; status: string; createdAt: string; trip: TripRow }[];
  ratings: { id: string; score: number; comment: string | null; createdAt: string }[];
  reportsFiledCount: number;
  reportsReceived: { id: string; category: string; status: string; description: string | null; createdAt: string }[];
  banHistory: AdminAction[];
}

function banHistoryLabel(a: AdminAction): string {
  if (a.action === 'UNBAN') return 'Ban lifted';
  const length = typeof a.details?.duration === 'string' ? ` (${a.details.duration})` : '';
  const reason = typeof a.details?.reason === 'string' ? ` for ${reportCategoryLabel(a.details.reason).toLowerCase()}` : '';
  return `Banned${length}${reason}`;
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: UserDetail;
  try {
    data = await apiFetch<UserDetail>(`/api/admin/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { user, hostedTrips, joinedMatches, ratings, reportsFiledCount, reportsReceived, banHistory } = data;
  const banned = user.bannedUntil != null && new Date(user.bannedUntil) > new Date();
  const isSelf = (await getSessionUserId()) === user.id;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">{user.fullName}</h2>
          {user.isAdmin && <Badge tone="primary">Admin</Badge>}
          {banned && <Badge tone="warning">Banned until {formatDateTime(user.bannedUntil!)}</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-2">
          <dt className="text-gray-500">Email</dt>
          <dd className="text-gray-900 break-all">{user.email}</dd>
          <dt className="text-gray-500">University ID</dt>
          <dd className="text-gray-900">{user.universityId}</dd>
          <dt className="text-gray-500">Role</dt>
          <dd className="text-gray-900">{user.role.toLowerCase()}</dd>
          <dt className="text-gray-500">Trust score</dt>
          <dd className="text-gray-900 tabular-nums">
            {user.trustScore.toFixed(2)} ({user.tripCount} rating{user.tripCount === 1 ? '' : 's'})
          </dd>
          <dt className="text-gray-500">Joined</dt>
          <dd className="text-gray-900">{formatDateTime(user.createdAt)}</dd>
          <dt className="text-gray-500">Reports filed</dt>
          <dd className="text-gray-900 tabular-nums">{reportsFiledCount}</dd>
        </dl>
        {isSelf ? (
          <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            This is your account. Another admin has to ban, unban or change your admin access.
          </p>
        ) : (
          <UserActions userId={user.id} isAdmin={user.isAdmin} isBanned={banned} />
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Trips hosted</h3>
        {hostedTrips.length === 0 ? (
          <p className="text-sm text-gray-500">None.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {hostedTrips.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800 min-w-0">
                  To {t.destinationAddress}
                  <span className="block text-xs text-gray-500">
                    {formatDateTime(t.departureTime)} · {t.status.toLowerCase()} · {t.filledSeats}/{t.totalSeats} seats
                  </span>
                </span>
                {(t.status === 'OPEN' || t.status === 'FULL') && <CancelTripButton tripId={t.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Rides joined</h3>
        {joinedMatches.length === 0 ? (
          <p className="text-sm text-gray-500">None.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {joinedMatches.map((m) => (
              <li key={m.id} className="py-2 text-sm text-gray-800">
                To {m.trip.destinationAddress}
                <span className="block text-xs text-gray-500">
                  {formatDateTime(m.trip.departureTime)} · request {m.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Reports against this user</h3>
        {reportsReceived.length === 0 ? (
          <p className="text-sm text-gray-500">None.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reportsReceived.map((r) => (
              <li key={r.id} className="py-2 text-sm text-gray-800">
                {reportCategoryLabel(r.category)} · {r.status.toLowerCase()}
                {r.description && <span className="block text-xs text-gray-500">“{r.description}”</span>}
                <span className="block text-xs text-gray-400">{formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Ratings received</h3>
        {ratings.length === 0 ? (
          <p className="text-sm text-gray-500">None.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ratings.map((r) => (
              <li key={r.id} className="py-2 text-sm text-gray-800">
                <span aria-label={`${r.score} out of 5`}>
                  {'★'.repeat(r.score)}
                  {'☆'.repeat(5 - r.score)}
                </span>
                {r.comment && <span className="block text-xs text-gray-500">“{r.comment}”</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Ban history</h3>
        {banHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Never banned.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {banHistory.map((a) => (
              <li key={a.id} className="py-2 text-sm text-gray-800">
                {banHistoryLabel(a)} · {a.actorId ? 'by an admin' : 'by the automatic strike ladder'}
                <span className="block text-xs text-gray-400">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
