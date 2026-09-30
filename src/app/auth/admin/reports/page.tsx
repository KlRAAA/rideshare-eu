import Link from 'next/link';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import ReportCard, { type AdminReport } from './ReportCard';

const STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const { status: requested, cursor } = await searchParams;
  const status = STATUSES.some((s) => s.value === requested) ? requested! : 'OPEN';
  const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  const { reports, nextCursor } = await adminFetch<{ reports: AdminReport[]; nextCursor: string | null }>(
    `/api/admin/reports?status=${status}${cursorQuery}`
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Report status">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/auth/admin/reports?status=${s.value}`}
            role="tab"
            aria-selected={status === s.value}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              status === s.value
                ? 'bg-[color:var(--rsu-color-primary)] text-white border-transparent'
                : 'border-gray-300 text-gray-600'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <p className="rsu-card text-sm text-gray-500">No {status.toLowerCase()} reports.</p>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} />)
      )}
      <div className="flex gap-4 text-xs font-semibold">
        {cursor && (
          <Link href={`/auth/admin/reports?status=${status}`} className="text-[color:var(--rsu-color-primary)] hover:underline">
            ← Newest
          </Link>
        )}
        {nextCursor && (
          <Link
            href={`/auth/admin/reports?status=${status}&cursor=${nextCursor}`}
            className="text-[color:var(--rsu-color-primary)] hover:underline"
          >
            Older reports →
          </Link>
        )}
      </div>
    </div>
  );
}
