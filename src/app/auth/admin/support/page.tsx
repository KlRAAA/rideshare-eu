import Link from 'next/link';
import { adminFetch } from '@/app/auth/admin/adminFetch';
import { waitingLabel } from '@/lib/admin';
import { categoryLabel, type SupportCategory, type SupportStatus } from '@/lib/support';

interface InboxTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  updatedAt: string;
  user: { id: string; fullName: string | null };
  messageCount: number;
}

const STATUSES: { value: SupportStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ANSWERED', label: 'Answered' },
  { value: 'CLOSED', label: 'Closed' },
];

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: requested } = await searchParams;
  const status = STATUSES.some((s) => s.value === requested) ? (requested as SupportStatus) : 'OPEN';
  const { tickets } = await adminFetch<{ tickets: InboxTicket[] }>(`/api/admin/support?status=${status}`);

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Request status">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/auth/admin/support?status=${s.value}`}
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
      {status === 'OPEN' && <p className="text-xs text-gray-500">Safety concerns are listed first, then whoever has waited longest.</p>}
      {tickets.length === 0 ? (
        <p className="rsu-card text-sm text-gray-500">No {status.toLowerCase()} requests.</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/auth/admin/support/${t.id}`} className="block rsu-card hover:border-gray-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.user.fullName ?? 'Deleted user'} · {categoryLabel(t.category)} · {t.messageCount} message
                      {t.messageCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {t.category === 'SAFETY' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        Safety
                      </span>
                    )}
                    {status === 'OPEN' && <span className="text-[11px] text-gray-500">{waitingLabel(t.updatedAt)}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
