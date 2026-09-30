'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function CancelTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    const reason = window.prompt('Why are you cancelling this trip? The host and passengers will see this.');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/trips/${tripId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      router.refresh();
    } catch {
      window.alert('Couldn’t cancel that trip. Refresh the page and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy}
      className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
    >
      Cancel trip
    </button>
  );
}
