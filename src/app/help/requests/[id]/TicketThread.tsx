'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDateTimeAgo } from '@/lib/format';
import { BODY_MAX, type SupportTicket } from '@/lib/support';

// The conversation on one of your requests, with a reply box and Close.
export default function TicketThread({ ticket }: { ticket: SupportTicket }) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = ticket.status === 'CLOSED';

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) {
      setError('Write a reply first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/support/${ticket.id}/messages`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'TICKET_CLOSED' ? 'This request is closed.' : 'Couldn’t send. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/support/${ticket.id}/close`, { method: 'PATCH' });
      router.refresh();
    } catch {
      setError('Couldn’t close the request. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <ol className="space-y-3" aria-label="Conversation">
          {(ticket.messages ?? []).map((m) => (
            <li key={m.id} className={`flex ${m.fromAdmin ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.fromAdmin ? 'bg-gray-100 text-gray-900' : 'bg-[color:var(--rsu-color-primary)] text-white'
                }`}
              >
                {m.fromAdmin && <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Admin</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.fromAdmin ? 'text-gray-400' : 'text-white/80'}`}>
                  {formatDateTimeAgo(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {closed ? (
        <p className="text-sm text-gray-500">This request is closed. Contact admin again from the Help page if you need more help.</p>
      ) : (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="ticket-reply" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Reply
          </label>
          <textarea
            id="ticket-reply"
            rows={3}
            maxLength={BODY_MAX}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rsu-btn-primary flex-1 disabled:opacity-60">
              Send reply
            </button>
            <button type="button" onClick={close} disabled={busy} className="rsu-btn-secondary disabled:opacity-60">
              Close request
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
