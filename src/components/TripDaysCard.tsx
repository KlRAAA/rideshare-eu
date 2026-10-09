'use client';

import React, { useState } from 'react';
import { useAppDialog } from './AppDialog';
import { useRouter } from 'next/navigation';
import { FaCalendarCheck } from 'react-icons/fa';
import Card from '@/components/Card';
import { apiFetch, ApiError } from '@/lib/api';
import { clockLabel } from '@/lib/tripRun';
import { dayErrorMessage, dayLabel, dayStatusLabel, type DayStatus, type TripDay } from '@/lib/tripDays';

interface TripDaysCardProps {
  tripId: string;
  recurring: boolean;
  days: TripDay[];
}

const BADGE: Record<string, string> = {
  CONFIRMED: 'rsu-badge rsu-badge-success',
  SKIPPED: 'rsu-badge rsu-badge-warning',
  none: 'rsu-badge rsu-badge-neutral',
};
const badgeClass = (status: DayStatus) => BADGE[status ?? 'none'] ?? 'rsu-badge rsu-badge-info';
const MAX_REASON = 200;

// The driver's coming trip days: confirm each one, or skip a day of a
// recurring trip (sub-project D). The server checks every rule.
export default function TripDaysCard({ tripId, recurring, days }: TripDaysCardProps) {
  const router = useRouter();
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useAppDialog();

  if (days.length === 0) return null;

  async function act(date: string, action: 'confirm' | 'skip' | 'unskip') {
    let body: Record<string, string> = {};
    if (action === 'skip') {
      const reason = await ask({
        title: `Skip ${dayLabel(date)}?`,
        message: 'Your riders are told you won’t drive that day.',
        label: 'Reason (optional)',
        maxLength: MAX_REASON,
        confirmLabel: 'Skip this day',
        cancelLabel: 'Keep it',
      });
      if (reason === null) return;
      if (reason.trim()) body = { reason: reason.trim().slice(0, MAX_REASON) };
    }
    setBusyDate(date);
    setError(null);
    try {
      const path = `/api/trips/${tripId}/days/${date}/${action === 'confirm' ? 'confirm' : 'skip'}`;
      await apiFetch(path, { method: action === 'unskip' ? 'DELETE' : 'POST', body: JSON.stringify(body) });
    } catch (err) {
      setError(err instanceof ApiError ? dayErrorMessage(err.code) : 'Couldn’t reach the server. Try again in a moment.');
    } finally {
      setBusyDate(null);
      router.refresh();
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <FaCalendarCheck className="w-4 h-4 text-blue-600" aria-hidden />
        {recurring ? 'Next 7 days' : 'Your trip day'}
      </h2>
      <p className="text-xs text-gray-500">
        {recurring
          ? 'Confirm the days you’re driving. Skip a day you can’t make; your riders are told right away.'
          : 'Confirm you’re driving so your riders know. If you can’t make it, cancel the trip.'}
      </p>
      <ul className="divide-y divide-gray-100">
        {days.map((d) => {
          const busy = busyDate === d.date;
          return (
            <li key={d.date} className="flex items-center gap-3 py-2">
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-semibold text-gray-900">
                  {dayLabel(d.date)} · {clockLabel(d.departure)}
                </span>
                <span className={badgeClass(d.status)}>{dayStatusLabel(d.status)}</span>
              </span>
              <span className="ml-auto flex shrink-0 gap-2">
                {d.status === null && (
                  <button type="button" disabled={busy} onClick={() => act(d.date, 'confirm')} className="rsu-btn-primary px-3 py-1 text-xs disabled:opacity-60">
                    Confirm
                  </button>
                )}
                {recurring && (d.status === null || d.status === 'CONFIRMED') && (
                  <button type="button" disabled={busy} onClick={() => act(d.date, 'skip')} className="rsu-btn-secondary px-3 py-1 text-xs disabled:opacity-60">
                    Skip
                  </button>
                )}
                {d.status === 'SKIPPED' && (
                  <button type="button" disabled={busy} onClick={() => act(d.date, 'unskip')} className="rsu-btn-secondary px-3 py-1 text-xs disabled:opacity-60">
                    Undo skip
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {dialog}
    </Card>
  );
}
