'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function EndAnnouncementButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function end() {
    setBusy(true);
    setFailed(false);
    try {
      await apiFetch(`/api/admin/announcements/${id}/end`, { method: 'PATCH' });
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={end}
        disabled={busy}
        className="text-xs font-semibold text-[color:var(--rsu-color-primary)] hover:underline disabled:opacity-60"
      >
        {busy ? 'Ending…' : 'End now'}
      </button>
      {failed && <p className="text-[11px] text-red-600">Couldn’t end it. Try again.</p>}
    </div>
  );
}
