import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { apiFetch } from '@/lib/api-server';
import { ApiError } from '@/lib/api';
import { categoryLabel, SUPPORT_STATUS_LABELS, type SupportTicket } from '@/lib/support';
import HelpShell from '../../HelpShell';
import StatusPill from '../StatusPill';
import TicketThread from './TicketThread';

export const metadata = { title: 'Request | RideShareEU' };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  let ticket: SupportTicket;
  try {
    ({ ticket } = await apiFetch<{ ticket: SupportTicket }>(`/api/support/${encodeURIComponent(id)}`));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <HelpShell signedIn>
      <Link href="/help/requests" className="text-sm text-gray-500 hover:text-gray-700">
        ← My requests
      </Link>
      <div className="mt-2 mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 break-words">{ticket.subject}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{categoryLabel(ticket.category)}</p>
        </div>
        <StatusPill status={ticket.status} label={SUPPORT_STATUS_LABELS[ticket.status]} />
      </div>
      <TicketThread ticket={ticket} />
    </HelpShell>
  );
}
