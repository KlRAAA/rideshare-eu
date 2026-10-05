'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function PaperworkButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markReceived() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/data-requests/${requestId}/paperwork`, { method: 'PATCH' });
      router.refresh();
    } catch {
      setError('Couldn’t save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print">
      <button type="button" onClick={markReceived} disabled={busy} className="rsu-btn-secondary disabled:opacity-60">
        {busy ? 'Saving...' : 'Written request received'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
