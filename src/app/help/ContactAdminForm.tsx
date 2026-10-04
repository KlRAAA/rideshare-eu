'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Select from '@/components/Select';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { BODY_MAX, SUBJECT_MAX, SUPPORT_CATEGORIES, supportFormError, type SupportTicket } from '@/lib/support';

interface TripOption {
  id: string;
  label: string;
}

interface MineTrip {
  id: string;
  destinationAddress: string;
  departureTime: string;
}

const LABEL = 'block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1';
const INPUT =
  'w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]';

const FIELD_MESSAGES: Record<string, string> = {
  category: 'Choose what your request is about.',
  subject: `Add a subject under ${SUBJECT_MAX} characters.`,
  body: `Describe what happened in under ${BODY_MAX} characters.`,
  relatedTripId: 'That trip can’t be attached.',
};

export default function ContactAdminForm() {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tripId, setTripId] = useState('');
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SupportTicket | null>(null);

  // Your own trips (hosted and joined) to optionally attach for context.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ hosted: MineTrip[]; joined: MineTrip[] }>('/api/trips/mine')
      .then(({ hosted, joined }) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const options = [...hosted, ...joined]
          .filter((t) => !seen.has(t.id) && seen.add(t.id))
          .sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime())
          .slice(0, 20)
          .map((t) => ({ id: t.id, label: `${formatDate(t.departureTime)} · to ${t.destinationAddress}` }));
        setTrips(options);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = supportFormError({ category, subject, body });
    if (problem) {
      setError(problem);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { ticket } = await apiFetch<{ ticket: SupportTicket }>('/api/support', {
        method: 'POST',
        body: JSON.stringify({ category, subject, body, relatedTripId: tripId || null }),
      });
      setSent(ticket);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOO_MANY_TICKETS') {
        setError('You have several open requests. Wait for a reply or close one first.');
      } else if (err instanceof ApiError && err.code === 'INVALID_TICKET') {
        setError(FIELD_MESSAGES[String(err.body?.field)] ?? 'Check the form and try again.');
      } else {
        setError('Couldn’t send your request. Try again in a moment.');
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Sent. You&apos;ll get a notification when an admin replies.{' '}
        <Link href={`/help/requests/${sent.id}`} className="font-semibold underline">
          View your request
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
      <div>
        <label htmlFor="support-category" className={LABEL}>
          What is it about?
        </label>
        <Select id="support-category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${INPUT} pr-9`}>
          <option value="">Choose one</option>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="support-subject" className={LABEL}>
          Subject
        </label>
        <input
          id="support-subject"
          type="text"
          maxLength={SUBJECT_MAX}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g., The map doesn't load on my phone"
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="support-body" className={LABEL}>
          Message
        </label>
        <textarea
          id="support-body"
          rows={5}
          maxLength={BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, and when?"
          className={INPUT}
        />
        <p className="text-[11px] text-gray-400 mt-1 text-right tabular-nums">
          {body.length}/{BODY_MAX}
        </p>
      </div>
      {trips.length > 0 && (
        <div>
          <label htmlFor="support-trip" className={LABEL}>
            Related trip (optional)
          </label>
          <Select id="support-trip" value={tripId} onChange={(e) => setTripId(e.target.value)} className={`${INPUT} pr-9`}>
            <option value="">None</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={sending} className="rsu-btn-primary w-full disabled:opacity-60">
        {sending ? 'Sending…' : 'Send to admins'}
      </button>
    </form>
  );
}
