'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { dayLabel } from '@/lib/tripDays';

// Home's shortcut for the driver's daily job: confirm the next trip day
// (the same call as the trip page's "Next trip day" card).
export default function ConfirmDayButton({ tripId, date }: { tripId: string; date: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/days/${date}/confirm`, { method: 'POST', body: '{}' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'DAY_SKIPPED' ? 'You skipped this day. Undo it on the trip page.' : 'Couldn’t confirm. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={confirm} disabled={busy} className="rsu-btn-primary w-full disabled:opacity-60">
        {busy ? 'Confirming…' : `Confirm ${dayLabel(date)}`}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
