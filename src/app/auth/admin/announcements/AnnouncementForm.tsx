'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

const TITLE_MAX = 100;
const BODY_MAX = 1000;
const INPUT =
  'w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]';
const LABEL = 'block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1';

const FIELD_ERRORS: Record<string, string> = {
  title: `Add a title under ${TITLE_MAX} characters.`,
  body: `Add a message under ${BODY_MAX} characters.`,
  endsAt: 'The end time must be in the future.',
};

// The datetime-local value is Philippine time; send it as an explicit +08:00 instant.
function phLocalToIso(value: string): string | null {
  return value ? new Date(`${value}:00+08:00`).toISOString() : null;
}

export default function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(FIELD_ERRORS.title);
    if (!body.trim()) return setError(FIELD_ERRORS.body);
    setError(null);
    setConfirming(true);
  }

  async function post() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, body, endsAt: phLocalToIso(endsAt) }),
      });
      setTitle('');
      setBody('');
      setEndsAt('');
      setConfirming(false);
      setSent(true);
      router.refresh();
    } catch (err) {
      setConfirming(false);
      setError(
        err instanceof ApiError && err.code === 'INVALID_ANNOUNCEMENT'
          ? FIELD_ERRORS[String(err.body?.field)] ?? 'Check the form.'
          : 'Couldn’t post the announcement. Try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Send this to all users?</p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="font-semibold text-gray-900 break-words">{title.trim()}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{body.trim()}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={post} disabled={busy} className="rsu-btn-primary flex-1 disabled:opacity-60">
            {busy ? 'Sending…' : 'Send to all users'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rsu-btn-secondary">
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} className="mt-4 space-y-3" noValidate>
      <div>
        <label htmlFor="announcement-title" className={LABEL}>
          Title
        </label>
        <input
          id="announcement-title"
          type="text"
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSent(false);
          }}
          placeholder="e.g., No classes tomorrow"
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="announcement-body" className={LABEL}>
          Message
        </label>
        <textarea
          id="announcement-body"
          rows={3}
          maxLength={BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g., Classes are suspended due to Typhoon Signal No. 2. Please don't post rides for tomorrow."
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="announcement-ends" className={LABEL}>
          Show until (optional, Philippine time)
        </label>
        <input
          id="announcement-ends"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className={INPUT}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && <p className="text-sm text-green-700">Posted. Everyone has been notified.</p>}
      <button type="submit" className="rsu-btn-primary w-full">
        Review and send
      </button>
    </form>
  );
}
