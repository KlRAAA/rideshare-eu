import Link from 'next/link';
import { redirect } from 'next/navigation';
import Card from '@/components/Card';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { formatDateTimeAgo } from '@/lib/format';
import { categoryLabel, SUPPORT_STATUS_LABELS, type SupportTicket } from '@/lib/support';
import HelpShell from '../HelpShell';
import StatusPill from './StatusPill';

export const metadata = { title: 'My requests | RideShareEU' };

export default async function MyRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { tickets } = await apiFetch<{ tickets: SupportTicket[] }>('/api/support');

  return (
    <HelpShell signedIn>
      <Link href="/help" className="text-sm text-gray-500 hover:text-gray-700">
        ← Help
      </Link>
      <div className="mt-2 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">What you&apos;ve sent to the admins and their replies</p>
      </div>
      {tickets.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">
            You haven&apos;t contacted an admin yet.{' '}
            <Link href="/help" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
              Contact admin
            </Link>
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/help/requests/${t.id}`} className="block rsu-card hover:border-gray-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {categoryLabel(t.category)} · updated {formatDateTimeAgo(t.updatedAt)}
                    </p>
                  </div>
                  <StatusPill status={t.status} label={SUPPORT_STATUS_LABELS[t.status]} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HelpShell>
  );
}
