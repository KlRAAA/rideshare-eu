'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { BODY_MAX } from '@/lib/support';

const ERRORS: Record<string, string> = {
  TICKET_CLOSED: 'This request was closed in the meantime.',
  CANNOT_TARGET_SELF: 'Another admin needs to handle your own request.',
  INVALID_MESSAGE: 'Write a reply first.',
};

export default function AdminTicketReply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReply('');
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) {
      setError(ERRORS.INVALID_MESSAGE);
      return;
    }
    run(() => apiFetch(`/api/admin/support/${ticketId}/messages`, { method: 'POST', body: JSON.stringify({ body: reply }) }));
  }

  return (
    <form onSubmit={send} className="space-y-2">
      <label htmlFor="admin-reply" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Reply to the user
      </label>
      <textarea
        id="admin-reply"
        rows={4}
        maxLength={BODY_MAX}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
      />
      <p className="text-[11px] text-gray-400">The user gets a notification. Your reply is recorded in the activity log.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rsu-btn-primary flex-1 disabled:opacity-60">
          Send reply
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => apiFetch(`/api/admin/support/${ticketId}/close`, { method: 'PATCH' }))}
          className="rsu-btn-secondary disabled:opacity-60"
        >
          Close request
        </button>
      </div>
    </form>
  );
}
