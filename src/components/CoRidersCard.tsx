import React from 'react';
import Link from 'next/link';
import Card from './Card';
import Badge from './Badge';
import Avatar from './Avatar';
import { matchStatusBadge } from '@/lib/statusBadge';

export interface CoRiderMatch {
  id: string;
  passengerId: string;
  status: string;
  message?: string | null;
  ratedByMe?: boolean;
  unratedOccurrenceDate?: string | null;
  passenger: { fullName: string; avatarUrl?: string | null };
}

interface CoRidersCardProps {
  matches: CoRiderMatch[];
  title: string;
  emptyLabel?: string;
  // When false, the roster is collapsed to a headcount — a passenger browsing a
  // ride they haven't joined sees how full it is, not who's on it.
  showNames?: boolean;
  // Host-only Accept / Decline / Rate controls, rendered on the right of each row.
  renderActions?: (m: CoRiderMatch) => React.ReactNode;
  // Match id to ring — set when the host arrives from a join-request notification.
  highlightId?: string | null;
}

export default function CoRidersCard({
  matches,
  title,
  emptyLabel = 'No co-riders yet.',
  showNames = true,
  renderActions,
  highlightId = null,
}: CoRidersCardProps) {
  return (
    <Card>
      <h3 className="text-sm font-bold text-gray-900 mb-3">{title}</h3>

      {matches.length === 0 ? (
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      ) : !showNames ? (
        <p className="text-xs text-gray-500">
          {matches.length} rider{matches.length === 1 ? '' : 's'} confirmed so far
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const mStatus = matchStatusBadge(m.status);
            const highlighted = m.id === highlightId;
            const actions = renderActions?.(m) ?? null;
            return (
              <li
                key={m.id}
                id={`request-${m.id}`}
                className={`p-2 rounded-lg border space-y-1.5 ${
                  highlighted
                    ? 'bg-[color:var(--rsu-color-primary)]/5 border-[color:var(--rsu-color-primary)]/30 ring-2 ring-[color:var(--rsu-color-primary)]/40'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/auth/users/${m.passengerId}`}
                    className="flex items-center gap-3 min-w-0 hover:underline"
                  >
                    <Avatar name={m.passenger.fullName} src={m.passenger.avatarUrl} sizeClass="w-6 h-6" textClass="text-[10px]" />
                    <span className="text-xs font-medium text-gray-800 truncate">{m.passenger.fullName}</span>
                  </Link>
                  <Badge tone={mStatus.tone} className="shrink-0">
                    {mStatus.label}
                  </Badge>
                </div>
                {m.message && (
                  <p className="text-xs text-gray-500 pl-9 italic">“{m.message}”</p>
                )}
                {/* Actions get their own full-width row instead of squeezing in
                    next to the badge — Approve/Decline need real tap targets,
                    which don't fit inline at narrow widths without crowding
                    the name or wrapping awkwardly. flex-col (not row) so a
                    caller can stack a button row with, e.g., an error message
                    underneath; items-start keeps a lone action (like "Rate")
                    at its natural width instead of stretching it. */}
                {actions && <div className="flex flex-col items-start gap-1.5 pl-9">{actions}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
