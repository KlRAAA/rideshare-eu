'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { WARNING_NOTE_MAX, WARNING_REASONS, warningFormError } from '@/lib/warnings';

interface WarnUserFormProps {
  userId: string;
  userName: string;
  // A warning from a support request or a report is linked to it (spec W1, W7).
  ticketId?: string;
  reportId?: string;
}

const ERRORS: Record<string, string> = {
  CANNOT_TARGET_SELF: 'You can’t warn your own account.',
  WARNING_TARGET_MISMATCH: 'This person isn’t the driver of the linked trip.',
  NOTE_REQUIRED: 'Add a note explaining the warning.',
  NOTE_TOO_LONG: 'Keep the note under 500 characters.',
  USER_NOT_FOUND: 'This account no longer exists.',
};

const FIELD = 'mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm';

// An official warning: the user gets a notification, an email and a dashboard
// banner. They never see who reported them.
export default function WarnUserForm({ userId, userName, ticketId, reportId }: WarnUserFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const problem = warningFormError(reason, note);
    if (problem) return setError(problem);
    if (!window.confirm(`Send an official warning to ${userName}? They’ll get a notification and an email.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${userId}/warnings`, {
        method: 'POST',
        body: JSON.stringify({ reason, note: note.trim() || undefined, ticketId, reportId }),
      });
      setSent(true);
      setReason('');
      setNote('');
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'Couldn’t send the warning. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-gray-700" htmlFor={`warn-reason-${userId}`}>
          Reason
          <select
            id={`warn-reason-${userId}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSent(false);
            }}
            className={FIELD}
          >
            <option value="">Choose a reason</option>
            {WARNING_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-700" htmlFor={`warn-note-${userId}`}>
          Note to the user (they’ll see this)
          <input
            id={`warn-note-${userId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={WARNING_NOTE_MAX}
            className={FIELD}
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {sent && <p className="text-xs text-green-700">Warning sent.</p>}
      <button type="submit" disabled={busy} className="rsu-btn-secondary disabled:opacity-60">
        {busy ? 'Sending...' : 'Send warning'}
      </button>
    </form>
  );
}
