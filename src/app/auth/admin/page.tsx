import Link from 'next/link';
import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { describeAction, formatDateTime, queueTone, waitingLabel, type AdminAction, type AdminCounts } from '@/lib/admin';

interface Overview {
  counts: AdminCounts;
  queues: {
    openReports: number;
    highAlertReports: number;
    oldestReportAt: string | null;
    openTickets: number;
    safetyTickets: number;
    oldestTicketAt: string | null;
  };
  today: { ridesToday: number; ridesAvg7d: number; newUsers24h: number; activeBans: number };
  security: {
    counts: Record<string, number>;
    flaggedAccounts: { userId: string; fullName: string | null; count: number }[];
  };
  watchlistCount: number;
  overdueDataPaperwork: number | null;
  errorsUrl: string | null;
  recentActions: AdminAction[];
}

const SECURITY_ROWS: { key: string; label: string }[] = [
  { key: 'LOGIN_FAILED', label: 'Failed sign-ins' },
  { key: 'OTP_LOCKED', label: 'Code lockouts' },
  { key: 'RATE_LIMITED', label: 'Rate-limit hits' },
  { key: 'ACCESS_DENIED', label: 'Denied access attempts' },
];

const LINK = 'font-semibold text-[color:var(--rsu-color-primary)] hover:underline';
// Small group labels, not headings: the global h2 rule would enlarge them.
const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2';

const TONE_CLASS = {
  danger: { card: 'border-red-200 bg-red-50', text: 'text-red-600' },
  warning: { card: 'border-amber-200 bg-amber-50', text: 'text-amber-800' },
  clear: { card: 'border-gray-200 bg-white', text: 'text-gray-900' },
};

const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

// One work queue: a big count coloured by urgency, what it is, and how long it's waited.
function ActionCard({
  href,
  count,
  urgent,
  noun,
  detail,
}: {
  href: string;
  count: number;
  urgent: number;
  noun: string;
  detail: string;
}) {
  const tone = TONE_CLASS[queueTone(count, urgent)];
  return (
    <Link href={href} className={`block rounded-xl border p-3 sm:p-4 hover:shadow-sm transition-shadow ${tone.card}`}>
      <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${tone.text}`}>{count}</p>
      <p className={`text-xs sm:text-sm font-semibold leading-snug ${tone.text}`}>{count === 0 ? `No ${noun}s waiting` : plural(count, noun)}</p>
      <p className="hidden sm:block text-xs text-gray-500 mt-0.5">{count === 0 ? 'All clear' : detail}</p>
    </Link>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{value}</p>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const data = await adminFetch<Overview>('/api/admin/overview');
  const { counts, queues, today, security, watchlistCount, overdueDataPaperwork, errorsUrl, recentActions } = data;
  const reportDetail = [
    queues.highAlertReports > 0 ? `${queues.highAlertReports} harassment or safety` : null,
    queues.oldestReportAt ? `oldest ${waitingLabel(queues.oldestReportAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const ticketDetail = [
    queues.safetyTickets > 0 ? `${queues.safetyTickets} safety` : null,
    queues.oldestTicketAt ? `oldest ${waitingLabel(queues.oldestTicketAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-6">
      {overdueDataPaperwork != null && overdueDataPaperwork > 0 && (
        <Link
          href="/auth/admin/data-requests"
          className="block rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600"
        >
          {overdueDataPaperwork} emergency {plural(overdueDataPaperwork, 'release')} still waiting for the written request
        </Link>
      )}

      <section>
        <p className={SECTION_LABEL}>Needs your action</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <ActionCard
            href="/auth/admin/reports"
            count={queues.openReports}
            urgent={queues.highAlertReports}
            noun="open report"
            detail={reportDetail}
          />
          <ActionCard
            href="/auth/admin/support"
            count={queues.openTickets}
            urgent={queues.safetyTickets}
            noun="support request"
            detail={ticketDetail}
          />
          <ActionCard
            href="/auth/admin/watchlist"
            count={watchlistCount}
            urgent={0}
            noun="flagged user"
            detail="Cancellations or reports in the last 30 days"
          />
        </div>
      </section>

      <section>
        <p className={SECTION_LABEL}>Platform today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Rides today" value={today.ridesToday} note={`7-day average ${today.ridesAvg7d}`} />
          <Stat label="Open trips" value={counts.openTrips} />
          <Stat label="New sign-ups" value={today.newUsers24h} note="last 24 hours" />
          <Stat label="Active bans" value={today.activeBans} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <h2 className="text-sm font-bold text-gray-900">Security, last 24 hours</h2>
          <dl className="mt-2 divide-y divide-[color:var(--color-border)] text-sm">
            {SECURITY_ROWS.map((r) => (
              <div key={r.key} className="flex justify-between py-1.5">
                <dt className="text-gray-600">{r.label}</dt>
                <dd className="font-semibold tabular-nums text-gray-900">{security.counts[r.key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {security.flaggedAccounts.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">5 or more failed sign-ins</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {security.flaggedAccounts.map((a) => (
                  <li key={a.userId}>
                    <Link href={`/auth/admin/users/${a.userId}`} className={LINK}>
                      {a.fullName ?? 'Unknown account'}
                    </Link>{' '}
                    <span className="text-xs text-amber-800">· {a.count} failed</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {errorsUrl && (
            <a href={errorsUrl} target="_blank" rel="noopener noreferrer" className={`inline-block mt-3 text-xs ${LINK}`}>
              Open crash and error reports →
            </a>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-gray-900 mb-1">Recent activity</h2>
          {recentActions.length === 0 ? (
            <p className="text-sm text-gray-500">No admin actions yet.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {recentActions.slice(0, 6).map((a) => (
                <li key={a.id} className="py-2">
                  <p className="text-sm text-gray-800">{describeAction(a)}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/auth/admin/activity" className={`inline-block mt-2 text-xs ${LINK}`}>
            View full activity log
          </Link>
        </Card>
      </div>

      <section>
        <p className={SECTION_LABEL}>All time</p>
        <p className="text-sm text-gray-600">
          {counts.users} users · {counts.completedTrips} completed trips · {counts.pendingRequests} pending ride requests ·{' '}
          {counts.admins} {plural(counts.admins, 'admin')}
        </p>
      </section>
    </div>
  );
}
