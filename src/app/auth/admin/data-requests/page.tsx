import Link from 'next/link';
import { notFound } from 'next/navigation';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { getCurrentUser } from '@/lib/session';
import { formatDateTime } from '@/lib/admin';
import { basisLabel, paperworkStatus, type DataRequestRow } from '@/lib/dataRequests';

export const metadata = { title: 'Data requests | RideShareEU' };

function PaperworkBadge({ row }: { row: DataRequestRow }) {
  const status = paperworkStatus(row);
  if (status === 'overdue') return <Badge tone="warning">Paperwork overdue</Badge>;
  if (status === 'due') return <Badge tone="info">Paperwork due {formatDateTime(row.paperworkDueAt!)}</Badge>;
  if (status === 'received') return <Badge tone="success">Paperwork received</Badge>;
  return null;
}

export default async function DataRequestsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) notFound();
  const { requests } = await adminFetch<{ requests: DataRequestRow[] }>('/api/admin/data-requests');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Data requests</h2>
          <p className="text-sm text-gray-500">Only you can see this page. Every release is recorded in the audit log.</p>
        </div>
        <Link href="/auth/admin/data-requests/new" className="rsu-btn-primary shrink-0">
          New request
        </Link>
      </div>
      {requests.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">No data requests yet.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/auth/admin/data-requests/${r.id}`} className="block rsu-card hover:border-gray-300">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {r.referenceNumber} · {r.agency}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      About {r.subjectName ?? 'a deleted user'} · {basisLabel(r.legalBasis)} · {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <PaperworkBadge row={r} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
