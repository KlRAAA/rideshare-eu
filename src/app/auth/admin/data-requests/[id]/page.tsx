import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { getCurrentUser } from '@/lib/session';
import { formatDateTime } from '@/lib/admin';
import { paperworkStatus, type Release } from '@/lib/dataRequests';
import ReleaseView from '@/components/ReleaseView';
import PrintButton from '../PrintButton';
import PaperworkButton from './PaperworkButton';

export const metadata = { title: 'Records release | RideShareEU' };

interface OpenedRequest {
  request: { id: string; paperworkDueAt: string | null; paperworkReceivedAt: string | null };
  release: Release;
}

// Opening this page rebuilds the release and records the opening (spec D10).
export default async function DataRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) notFound();
  const { id } = await params;
  const { request, release } = await adminFetch<OpenedRequest>(`/api/admin/data-requests/${id}`);
  const status = paperworkStatus(request);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <Link href="/auth/admin/data-requests" className="text-sm text-gray-500 hover:text-gray-700">
          ← Data requests
        </Link>
        <PrintButton />
      </div>
      {(status === 'due' || status === 'overdue') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 no-print">
          <p className={`text-sm ${status === 'overdue' ? 'text-red-700 font-semibold' : 'text-amber-900'}`}>
            {status === 'overdue' ? 'The written request is overdue. It was due by ' : 'The written request is due by '}
            {formatDateTime(request.paperworkDueAt!)}.
          </p>
          <div className="mt-2">
            <PaperworkButton requestId={request.id} />
          </div>
        </div>
      )}
      <ReleaseView release={release} />
    </div>
  );
}
