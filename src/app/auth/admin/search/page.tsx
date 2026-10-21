import Link from 'next/link';
import Badge from '@/components/Badge';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { formatDateTime } from '@/lib/admin';
import { reportCategoryLabel } from '@/lib/format';
import { tripRoute } from '@/lib/tripLine';

interface SearchResults {
  users: { id: string; fullName: string; role: string; banned: boolean }[];
  trips: { id: string; hostId: string; hostName: string; originAddress: string; destinationAddress: string; departureTime: string; status: string }[];
  reports: { id: string; category: string; status: string; createdAt: string; reporterName: string; reportedName: string | null }[];
  tickets: { id: string; subject: string; status: string; updatedAt: string; userName: string }[];
  licenses: { id: string; submittedAt: string; userName: string }[];
}

const ROW = 'flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50';

function Group({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  if (empty) return null;
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">{children}</ul>
    </section>
  );
}

// Results for the search box in the admin bar, grouped by kind, each linking
// to the page an admin already uses for it.
export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  if (query.length < 2) {
    return <p className="text-sm text-gray-500">Type at least 2 letters in the search box above: a name, email, place, report or request.</p>;
  }
  const r = await adminFetch<SearchResults>(`/api/admin/search?q=${encodeURIComponent(query)}`);
  const total = r.users.length + r.trips.length + r.reports.length + r.tickets.length + r.licenses.length;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        {total === 0 ? (
          <>Nothing matches “{query}”.</>
        ) : (
          <>
            Results for <strong className="text-gray-900">“{query}”</strong> (up to 5 of each kind)
          </>
        )}
      </p>

      <Group title="Users" empty={r.users.length === 0}>
        {r.users.map((u) => (
          <li key={u.id}>
            <Link href={`/auth/admin/users/${u.id}`} className={ROW}>
              <span className="truncate text-sm font-semibold text-gray-900">{u.fullName}</span>
              <span className="flex shrink-0 gap-1">
                {u.banned && <Badge tone="danger">Banned</Badge>}
                <Badge tone="neutral">{u.role.toLowerCase()}</Badge>
              </span>
            </Link>
          </li>
        ))}
      </Group>

      <Group title="Open trips" empty={r.trips.length === 0}>
        {r.trips.map((t) => (
          <li key={t.id}>
            <Link href={`/auth/admin/users/${t.hostId}`} className={ROW}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">{tripRoute(t)}</span>
                <span className="block truncate text-xs text-gray-500">
                  {t.hostName} · {formatDateTime(t.departureTime)}
                </span>
              </span>
              {t.status === 'FULL' && <Badge tone="neutral">Full</Badge>}
            </Link>
          </li>
        ))}
      </Group>

      <Group title="Reports" empty={r.reports.length === 0}>
        {r.reports.map((rep) => (
          <li key={rep.id}>
            <Link href="/auth/admin/reports" className={ROW}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {rep.reporterName} reported {rep.reportedName ?? 'a user'}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {reportCategoryLabel(rep.category)} · {formatDateTime(rep.createdAt)}
                </span>
              </span>
              <Badge tone={rep.status === 'OPEN' ? 'warning' : 'neutral'}>{rep.status === 'OPEN' ? 'Open' : rep.status.toLowerCase()}</Badge>
            </Link>
          </li>
        ))}
      </Group>

      <Group title="Support requests" empty={r.tickets.length === 0}>
        {r.tickets.map((t) => (
          <li key={t.id}>
            <Link href={`/auth/admin/support/${t.id}`} className={ROW}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">{t.subject}</span>
                <span className="block truncate text-xs text-gray-500">
                  {t.userName} · {formatDateTime(t.updatedAt)}
                </span>
              </span>
              <Badge tone={t.status === 'OPEN' ? 'warning' : 'neutral'}>{t.status.toLowerCase()}</Badge>
            </Link>
          </li>
        ))}
      </Group>

      <Group title="Licenses waiting for review" empty={r.licenses.length === 0}>
        {r.licenses.map((l) => (
          <li key={l.id}>
            <Link href="/auth/admin/licenses" className={ROW}>
              <span className="truncate text-sm font-semibold text-gray-900">{l.userName}</span>
              <span className="shrink-0 text-xs text-gray-500">Sent {formatDateTime(l.submittedAt)}</span>
            </Link>
          </li>
        ))}
      </Group>
    </div>
  );
}
