'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { useAppDialog } from '@/components/AppDialog';

// "Check DOE now": reads the newest weekly file right away instead of waiting
// for the 10 AM / 3 PM run.
export function CheckDoeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setNote(null);
    try {
      const res = await apiFetch<{ alreadyHandled: boolean }>('/api/admin/fuel-price/doe/check', { method: 'POST' });
      setNote(res.alreadyHandled ? 'No new file since the last check.' : null);
      router.refresh();
    } catch (err) {
      setNote(err instanceof ApiError && err.code === 'DOE_UNREACHABLE' ? 'Couldn’t reach the DOE site. Try again later.' : 'Couldn’t check. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={check} disabled={busy} className="rsu-btn-secondary px-3 py-2 text-sm disabled:opacity-60">
        {busy ? 'Checking the DOE…' : 'Check DOE now'}
      </button>
      {note && (
        <p role="status" className="text-xs text-gray-600">
          {note}
        </p>
      )}
    </div>
  );
}

// A held file: apply its prices, or keep the current ones.
export function HeldDoeActions({ importId }: { importId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useAppDialog();

  async function decide(action: 'apply' | 'dismiss') {
    const ok = await confirm(
      action === 'apply'
        ? { title: 'Apply the DOE prices?', message: 'They become the official caps for everyone.', confirmLabel: 'Apply' }
        : { title: 'Keep the current prices?', message: 'This DOE file won’t be used.', confirmLabel: 'Keep current' }
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/fuel-price/doe/${importId}/${action}`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'NOT_HELD' ? 'Another admin already decided. Refresh the page.' : 'Couldn’t save. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => decide('apply')} disabled={busy} className="rsu-btn-primary px-3 py-2 text-sm disabled:opacity-60">
          Apply DOE prices
        </button>
        <button type="button" onClick={() => decide('dismiss')} disabled={busy} className="rsu-btn-secondary px-3 py-2 text-sm disabled:opacity-60">
          Keep current prices
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {dialog}
    </div>
  );
}
