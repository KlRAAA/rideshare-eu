import Link from 'next/link';
import Card from '@/components/Card';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { formatDateTime } from '@/lib/admin';
import { formatDateTimeAgo } from '@/lib/format';
import { categoryLabel, SUPPORT_STATUS_LABELS, type SupportMessage, type SupportTicket } from '@/lib/support';
import AdminTicketReply from './AdminTicketReply';
import WarnUserForm from '../../WarnUserForm';

interface AdminTicket extends SupportTicket {
  user: { id: string; fullName: string | null; email: string };
  messages: SupportMessage[];
  relatedTrip: {
    id: string;
    destinationAddress: string;
    departureTime: string;
    status: string;
    hostId: string;
    hostName: string | null;
  } | null;
}

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ticket } = await adminFetch<{ ticket: AdminTicket }>(`/api/admin/support/${encodeURIComponent(id)}`);

  return (
    <div className="space-y-4">
      <Link href="/auth/admin/support" className="text-sm text-gray-500 hover:text-gray-700">
        ← Support
      </Link>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 break-words">{ticket.subject}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {categoryLabel(ticket.category)} · {SUPPORT_STATUS_LABELS[ticket.status]} · opened {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          {ticket.category === 'SAFETY' && (
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              Safety
            </span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-gray-500">From</dt>
            <dd>
              <Link href={`/auth/admin/users/${ticket.user.id}`} className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                {ticket.user.fullName ?? 'Deleted user'}
              </Link>
            </dd>
          </div>
          {ticket.relatedTrip && (
            <div>
              <dt className="text-xs text-gray-500">Related trip</dt>
              <dd>
                <Link href={`/auth/trips/${ticket.relatedTrip.id}`} className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
                  To {ticket.relatedTrip.destinationAddress}
                </Link>
                <span className="text-xs text-gray-500"> · {formatDateTime(ticket.relatedTrip.departureTime)}</span>
              </dd>
            </div>
          )}
        </dl>
        {ticket.relatedTrip && ticket.relatedTrip.hostId !== ticket.user.id && (
          <div className="mt-4 border-t border-[color:var(--color-border)] pt-3">
            <p className="text-sm font-semibold text-gray-900">Warn the driver</p>
            <p className="text-xs text-gray-500 mb-2">
              {ticket.relatedTrip.hostName ?? 'The driver'} drove this trip. They won’t see who contacted us.
            </p>
            <WarnUserForm
              userId={ticket.relatedTrip.hostId}
              userName={ticket.relatedTrip.hostName ?? 'the driver'}
              ticketId={ticket.id}
            />
          </div>
        )}
      </Card>

      <Card>
        <ol className="space-y-3" aria-label="Conversation">
          {ticket.messages.map((m) => (
            <li key={m.id} className={`flex ${m.fromAdmin ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.fromAdmin ? 'bg-[color:var(--rsu-color-primary)] text-white' : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className={`text-[11px] font-semibold mb-0.5 ${m.fromAdmin ? 'text-white/80' : 'text-gray-500'}`}>
                  {m.fromAdmin ? `${m.authorName ?? 'Admin'} (admin)` : m.authorName ?? 'User'}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.fromAdmin ? 'text-white/80' : 'text-gray-400'}`}>{formatDateTimeAgo(m.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {ticket.status === 'CLOSED' ? (
        <p className="text-sm text-gray-500">This request is closed.</p>
      ) : (
        <AdminTicketReply ticketId={ticket.id} />
      )}
    </div>
  );
}
