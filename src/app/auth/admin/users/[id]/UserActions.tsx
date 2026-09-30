'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { BAN_DURATION_OPTIONS, CATEGORY_OPTIONS } from '@/lib/admin';

const ERRORS: Record<string, string> = {
  CANNOT_TARGET_SELF: 'You can’t do that to your own account.',
  TARGET_IS_ADMIN: 'Remove this user’s admin role before banning them.',
  NOTE_TOO_LONG: 'Keep the note under 500 characters.',
};

const FIELD = 'mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm';

export default function UserActions({ userId, isAdmin, isBanned }: { userId: string; isAdmin: boolean; isBanned: boolean }) {
  const router = useRouter();
  const [duration, setDuration] = useState('24H');
  const [reason, setReason] = useState('OTHER');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, confirmText: string, body?: object) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${userId}/${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) });
      setNote('');
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'That didn’t go through. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
      {!isBanned && !isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs font-semibold text-gray-700">
            Ban length
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className={FIELD}>
              {BAN_DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={FIELD} />
          </label>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {isBanned && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run('unban', 'Lift this ban now?', { note })}
            className="rsu-btn-secondary disabled:opacity-60"
          >
            Unban
          </button>
        )}
        {!isBanned && !isAdmin && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run('ban', 'Ban this user? They lose access right away and get an email.', { duration, reason, note })}
            className="rsu-btn-primary disabled:opacity-60"
          >
            Ban user
          </button>
        )}
        {isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run('demote', 'Remove admin access from this user?')}
            className="rsu-btn-secondary disabled:opacity-60"
          >
            Remove admin
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run('promote', 'Give this user full admin access?')}
            className="rsu-btn-secondary disabled:opacity-60"
          >
            Make admin
          </button>
        )}
      </div>
    </div>
  );
}
