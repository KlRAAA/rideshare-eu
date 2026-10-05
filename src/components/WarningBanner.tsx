'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaExclamationTriangle } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/admin';
import type { ActiveWarning } from '@/lib/warnings';

// An official warning stays on the dashboard until the user taps "I understand"
// (spec W3). It names the reason and the admin's note, never who reported it.
export default function WarningBanner() {
  const [warnings, setWarnings] = useState<ActiveWarning[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ warnings: ActiveWarning[] }>('/api/warnings/active')
      .then((r) => !cancelled && setWarnings(r.warnings))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const warning = warnings[0];
  if (!warning) return null;

  async function acknowledge() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/warnings/${warning.id}/acknowledge`, { method: 'PATCH' });
      setWarnings((list) => list.slice(1));
    } catch {
      setError('Couldn’t save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <FaExclamationTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-600">Official warning from RideShareEU</p>
          <p className="text-sm text-gray-800 mt-0.5">{warning.reasonLabel}.</p>
          {warning.note && <p className="text-sm text-gray-700 mt-1">Note from the admin: {warning.note}</p>}
          <p className="text-xs text-gray-500 mt-1">
            {formatDateTime(warning.createdAt)} · Your account is still active. Repeated issues can lead to a suspension.
            If you think this is a mistake,{' '}
            <Link href="/help" className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
              contact us through Help
            </Link>
            .
          </p>
          <button type="button" onClick={acknowledge} disabled={busy} className="rsu-btn-primary mt-3 px-4 disabled:opacity-60">
            {busy ? 'Saving...' : 'I understand'}
          </button>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          {warnings.length > 1 && <p className="text-xs text-gray-500 mt-1">{warnings.length - 1} more after this one.</p>}
        </div>
      </div>
    </div>
  );
}
