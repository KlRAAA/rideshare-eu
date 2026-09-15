'use client';

import React, { useEffect, useRef, useState } from 'react';
import Card from './Card';
import Avatar from './Avatar';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDateTimeAgo } from '@/lib/format';
import { CHAT_POLL_INTERVAL_MS } from '@/lib/constants';

const MAX_MESSAGE_LENGTH = 2000; // mirrors messageController.js's MAX_MESSAGE_LENGTH

interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; fullName: string; avatarUrl?: string | null };
}

interface ChatCardProps {
  tripId: string;
  currentUserId: string;
}

// Trip group chat: one thread per trip, host + every APPROVED passenger.
// Short-polls GET /api/trips/:id/messages while mounted — same approach as
// the live-location pin, just on a tighter interval since a coordination
// message is more time-sensitive to see promptly. The parent only ever
// mounts this while the trip is active and the viewer is a participant (see
// TripDetailClient) — the server enforces the same window independently, so
// this never needs its own "closed" rendering; a call that somehow lands
// after the trip ended just surfaces the server's error like any other.
export default function ChatCard({ tripId, currentUserId }: ChatCardProps) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      apiFetch<{ messages: ChatMessage[] }>(`/api/trips/${tripId}/messages`)
        .then((data) => {
          if (cancelled) return;
          // Server returns newest-first (same convention as notifications);
          // a chat reads naturally oldest-at-top, newest-at-bottom.
          setMessages([...data.messages].reverse());
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : 'Could not load messages.');
        });
    };
    poll();
    const intervalId = setInterval(poll, CHAT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [tripId]);

  // Follow new messages — only when already scrolled near the bottom, so
  // reading older history during a poll tick doesn't get yanked away.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch<{ message: ChatMessage }>(`/api/trips/${tripId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setDraft('');
      // Refresh immediately rather than waiting for the next poll tick, so
      // sending a message shows up right away instead of up to ~7s later.
      const data = await apiFetch<{ messages: ChatMessage[] }>(`/api/trips/${tripId}/messages`);
      setMessages([...data.messages].reverse());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that message. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-bold text-gray-900 mb-3">Trip Chat</h3>

      <div ref={listRef} className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-3">
        {messages === null ? (
          <p className="text-xs text-gray-400">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-gray-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar name={m.sender.fullName} src={m.sender.avatarUrl} sizeClass="w-6 h-6" textClass="text-[10px]" />
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`rounded-lg px-3 py-1.5 text-xs break-words ${
                      isMe
                        ? 'bg-[color:var(--rsu-color-primary)] text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {!isMe && <div className="font-semibold text-[10px] mb-0.5 opacity-70">{m.sender.fullName}</div>}
                    {m.body}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">{formatDateTimeAgo(m.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Message the group…"
          disabled={sending}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]/30 disabled:opacity-60"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="rsu-btn-primary px-4 disabled:opacity-50">
          Send
        </button>
      </form>
    </Card>
  );
}
