import Link from 'next/link';
import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { describeAction, formatDateTime, waitingLabel, type AdminAction, type AdminCounts } from '@/lib/admin';

interface Overview {
  counts: AdminCounts;
  queues: {
    openReports: number;
    oldestReportAt: string | null;
    openTickets: number;
    safetyTickets: number;
    oldestTicketAt: string | null;
  };
  today: { ridesToday: number; newUsers24h: number; activeBans: number };
  security: {
    counts: Record<string, number>;
    flaggedAccounts: { userId: string; fullName: string | null; count: number }[];
  };
  watchlistCount: number;
  errorsUrl: string | null;
  recentActions: AdminAction[];
}

const TILES: { key: keyof AdminCounts; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'openTrips', label: 'Open trips' },
  { key: 'completedTrips', label: 'Completed trips' },
  { key: 'pendingRequests', label: 'Pending requests' },
  { key: 'openReports', label: 'Open reports' },
  { key: 'activeBans', label: 'Active bans' },
  { key: 'admins', label: 'Admins' },
];

const SECURITY_ROWS: { key: string; label: string }[] = [
  { key: 'LOGIN_FAILED', label: 'Failed sign-ins' },
  { key: 'OTP_LOCKED', label: 'Code lockouts' },
  { key: 'RATE_LIMITED', label: 'Rate-limit hits' },
  { key: 'ACCESS_DENIED', label: 'Denied access attempts' },
];

const LINK = 'font-semibold text-[color:var(--rsu-color-primary)] hover:underline';

function QueueLine({ href, count, noun, oldest, extra }: { href: string; count: number; noun: string; oldest: string | null; extra?: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
      <Link href={href} className={LINK}>
        {count} open {noun}
        {count === 1 ? '' : 's'}
      </Link>
      <span className="text-xs text-gray-500">
        {extra ? `${extra} · ` : ''}
        {count > 0 && oldest ? `oldest ${waitingLabel(oldest)}` : 'nothing waiting'}
      </span>
    </li>
  );
}

export default async function AdminOverviewPage() {
  const data = await adminFetch<Overview>('/api/admin/overview');
  const { counts, queues, today, security, watchlistCount, errorsUrl, recentActions } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-bold text-gray-900">Needs attention</h2>
          <ul className="divide-y divide-gray-100 mt-1 text-sm">
            <QueueLine href="/auth/admin/reports" count={queues.openReports} noun="report" oldest={queues.oldestReportAt} />
            <QueueLine
              href="/auth/admin/support"
              count={queues.openTickets}
              noun="support request"
              oldest={queues.oldestTicketAt}
              extra={queues.safetyTickets > 0 ? `${queues.safetyTickets} safety` : undefined}
            />
            <li className="flex items-baseline justify-between gap-3 py-2">
              <Link href="/auth/admin/watchlist" className={LINK}>
                Watch list
              </Link>
              <span className="text-xs text-gray-500">
                {watchlistCount === 0 ? 'no one flagged' : `${watchlistCount} user${watchlistCount === 1 ? '' : 's'} flagged`}
              </span>
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-gray-900">Today</h2>
          <dl className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: 'Rides today', value: today.ridesToday },
              { label: 'New sign-ups (24 h)', value: today.newUsers24h },
              { label: 'Active bans', value: today.activeBans },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</dt>
                <dd className="text-2xl font-extrabold text-gray-900 tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-gray-900">Security (last 24 hours)</h2>
          <dl className="mt-2 divide-y divide-gray-100 text-sm">
            {SECURITY_ROWS.map((r) => (
              <div key={r.key} className="flex justify-between py-1.5">
                <dt className="text-gray-600">{r.label}</dt>
                <dd className="font-semibold tabular-nums text-gray-900">{security.counts[r.key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {security.flaggedAccounts.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Accounts with 5 or more failed sign-ins</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {security.flaggedAccounts.map((a) => (
                  <li key={a.userId}>
                    <Link href={`/auth/admin/users/${a.userId}`} className={LINK}>
                      {a.fullName ?? 'Unknown account'}
                    </Link>{' '}
                    <span className="text-xs text-amber-900">· {a.count} failed</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {errorsUrl && (
          <Card>
            <h2 className="text-sm font-bold text-gray-900">System</h2>
            <a href={errorsUrl} target="_blank" rel="noopener noreferrer" className={`inline-block mt-2 text-sm ${LINK}`}>
              Open error reports →
            </a>
            <p className="text-[11px] text-gray-400 mt-1">Crashes and server errors reported by the app</p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TILES.map((t) => (
          <Card key={t.key} className="!p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums mt-1">{counts[t.key]}</p>
          </Card>
        ))}
      </div>

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
        <Link href="/auth/admin/activity" className={`inline-block mt-3 text-xs ${LINK}`}>
          View full activity log
        </Link>
      </Card>
    </div>
  );
}
