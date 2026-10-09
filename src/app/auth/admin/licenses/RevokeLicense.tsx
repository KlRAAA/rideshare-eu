'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import { apiFetch, ApiError } from '@/lib/api';
import { REJECT_REASON_OPTIONS, type RejectReason } from '@/lib/license';

const ERRORS: Record<string, string> = {
  NOT_APPROVED: 'This license isn’t approved any more.',
  CANNOT_TARGET_SELF: 'You can’t revoke your own license.',
  NOTE_REQUIRED: 'Write a note when the reason is Other.',
};

// Withdraws an approval after a spot-check; the driver must upload again.
export default function RevokeLicense({ licenseId }: { licenseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<RejectReason>('NOT_A_LICENSE');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/licenses/${licenseId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason, ...(note.trim() && { note: note.trim() }) }),
      });
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'That didn’t work. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rsu-btn-danger px-3 py-1.5 text-xs">
        Revoke…
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <label htmlFor={`revoke-${licenseId}`} className="block text-xs font-semibold text-gray-700">
        Why is this approval withdrawn?
      </label>
      <Select
        id={`revoke-${licenseId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value as RejectReason)}
        className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
      >
        {REJECT_REASON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <textarea
        aria-label="Note to the driver"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={reason === 'OTHER' ? 'Note (required)' : 'Note (optional)'}
        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
      />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={revoke} className="rsu-btn-danger-solid px-3 py-1.5 text-xs disabled:opacity-60">
          Revoke approval
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rsu-btn-secondary px-3 py-1.5 text-xs">
          Back
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
