'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { apiFetch, ApiError } from '@/lib/api';
import { reportCategoryLabel } from '@/lib/format';
import { BAN_DURATION_OPTIONS, formatDateTime } from '@/lib/admin';
import { WARNING_REASONS } from '@/lib/warnings';

interface Person {
  id: string;
  fullName: string;
  email: string;
  trustScore: number;
}

export interface AdminReport {
  id: string;
  category: string;
  description: string | null;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  createdAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reporter: Person;
  reportedUser: Person | null;
  reviewedBy: { id: string; fullName: string } | null;
  trip: { id: string; destinationAddress: string; departureTime: string } | null;
}

const ERRORS: Record<string, string> = {
  NOTE_REQUIRED: 'Write a short note explaining the decision.',
  NOTE_TOO_LONG: 'Keep the note under 500 characters.',
  REPORT_ALREADY_RESOLVED: 'Another admin already resolved this report. Refresh the list.',
  TARGET_IS_ADMIN: 'This user is an admin. Remove their admin role before banning them.',
  CANNOT_TARGET_SELF: 'This report is about you, so another admin has to decide it.',
  INVALID_REASON: 'Choose the reason for the warning.',
};

// The "Action" menu: nothing, an official warning, or a ban of some length.
const WARN = 'WARN';

export default function ReportCard({ report }: { report: AdminReport }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [banDuration, setBanDuration] = useState('');
  const [warnReason, setWarnReason] = useState('');
  const warning = banDuration === WARN;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(status: 'REVIEWED' | 'DISMISSED') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/reports/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          note,
          ...(status === 'REVIEWED' && warning ? { warn: { reason: warnReason } } : {}),
          ...(status === 'REVIEWED' && banDuration && !warning ? { ban: { duration: banDuration } } : {}),
        }),
      });
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'Couldn’t save that decision. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">{reportCategoryLabel(report.category)}</Badge>
        <span className="text-xs text-gray-400">{formatDateTime(report.createdAt)}</span>
      </div>
      <p className="text-sm text-gray-800 mt-2">
        <span className="font-semibold">{report.reporter.fullName}</span> reported{' '}
        {report.reportedUser ? (
          <Link
            href={`/auth/admin/users/${report.reportedUser.id}`}
            className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline"
          >
            {report.reportedUser.fullName}
          </Link>
        ) : (
          'a user'
        )}
      </p>
      {report.trip && (
        <p className="text-xs text-gray-500 mt-0.5">
          Trip to {report.trip.destinationAddress} · {formatDateTime(report.trip.departureTime)}
        </p>
      )}
      {report.description && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">“{report.description}”</p>}

      {report.status === 'OPEN' ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`note-${report.id}`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Decision note
          </label>
          <textarea
            id={`note-${report.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
          />
          <label htmlFor={`ban-${report.id}`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Action on the reported user (optional)
          </label>
          <select
            id={`ban-${report.id}`}
            value={banDuration}
            onChange={(e) => setBanDuration(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
          >
            <option value="">No action</option>
            <option value={WARN}>Send an official warning</option>
            {BAN_DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {warning && (
            <select
              id={`warn-reason-${report.id}`}
              aria-label="Reason for the warning"
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
            >
              <option value="">Choose the reason for the warning</option>
              {WARNING_REASONS.filter((r) => r.value !== 'OTHER').map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => resolve('REVIEWED')}
              className="rsu-btn-primary flex-1 disabled:opacity-60"
            >
              {warning ? 'Review and warn' : banDuration ? 'Review and ban' : 'Mark reviewed'}
            </button>
            <button
              type="button"
              disabled={busy || Boolean(banDuration)}
              onClick={() => resolve('DISMISSED')}
              className="rsu-btn-secondary flex-1 disabled:opacity-60"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-3">
          {report.status === 'REVIEWED' ? 'Reviewed' : 'Dismissed'} by {report.reviewedBy?.fullName ?? 'an admin'}
          {report.reviewedAt ? ` · ${formatDateTime(report.reviewedAt)}` : ''}
          {report.reviewNote ? ` — “${report.reviewNote}”` : ''}
        </p>
      )}
    </Card>
  );
}
