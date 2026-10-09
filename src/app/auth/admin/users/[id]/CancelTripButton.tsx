'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAppDialog } from '@/components/AppDialog';

export default function CancelTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { ask, dialog } = useAppDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    const reason = await ask({
      title: 'Cancel this trip?',
      message: 'The host and passengers will see your reason.',
      label: 'Reason',
      maxLength: 500,
      required: true,
      confirmLabel: 'Cancel trip',
      cancelLabel: 'Keep trip',
      danger: true,
    });
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/trips/${tripId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      router.refresh();
    } catch {
      setError('Couldn’t cancel that trip. Refresh the page and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end">
      <button type="button" onClick={cancel} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60">
        Cancel trip
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
      {dialog}
    </span>
  );
}
