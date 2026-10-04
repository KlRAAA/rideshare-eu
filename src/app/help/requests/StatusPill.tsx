import type { SupportStatus } from '@/lib/support';

const STYLE: Record<SupportStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-800 border-amber-200',
  ANSWERED: 'bg-green-50 text-green-800 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function StatusPill({ status, label }: { status: SupportStatus; label: string }) {
  return (
    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STYLE[status]}`}>{label}</span>
  );
}
