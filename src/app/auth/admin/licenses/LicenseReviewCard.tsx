'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Select from '@/components/Select';
import { API_BASE, apiFetch, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/admin';
import LicenseChecks from './LicenseChecks';
import { LICENSE_TYPE_OPTIONS, REJECT_REASON_OPTIONS, longDate, type LicenseType, type RejectReason } from '@/lib/license';

export interface PendingLicense {
  id: string;
  licenseType: LicenseType;
  licenseNumber: string | null;
  expiresOn: string;
  submittedAt: string;
  checks?: import('@/lib/license').LicenseCheckResults | null;
  user: { id: string; fullName: string; universityId: string };
}

const typeLabel = (t: LicenseType) => LICENSE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
const ERRORS: Record<string, string> = {
  ALREADY_DECIDED: 'Another admin already decided this one.',
  CANNOT_TARGET_SELF: 'You can’t review your own license.',
  NOTE_REQUIRED: 'Write a note when the reason is Other.',
  NOTE_TOO_LONG: 'Keep the note under 300 characters.',
};

export default function LicenseReviewCard({ license }: { license: PendingLicense }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason>('UNREADABLE');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      const body = action === 'reject' ? { reason, ...(note.trim() && { note: note.trim() }) } : {};
      await apiFetch(`/api/admin/licenses/${license.id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'That didn’t work. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rsu-card grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Served only to admins, only while under review, never cached. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${API_BASE}/api/admin/licenses/${license.id}/photo`}
        alt={`Driver's license submitted by ${license.user.fullName}`}
        className="w-full rounded-xl border border-gray-200 bg-gray-100 object-contain max-h-80"
      />
      <div className="space-y-3 min-w-0">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-gray-500">Account</dt>
          <dd className="font-semibold text-gray-900">{license.user.fullName}</dd>
          <dt className="text-gray-500">University ID</dt>
          <dd>{license.user.universityId}</dd>
          <dt className="text-gray-500">Number</dt>
          <dd className="font-mono">{license.licenseNumber ?? '—'}</dd>
          <dt className="text-gray-500">Type</dt>
          <dd>{typeLabel(license.licenseType)}</dd>
          <dt className="text-gray-500">Expires</dt>
          <dd>{longDate(license.expiresOn)}</dd>
          <dt className="text-gray-500">Sent</dt>
          <dd>{formatDateTime(license.submittedAt)}</dd>
        </dl>
        <LicenseChecks checks={license.checks} />
        {rejecting ? (
          <div className="space-y-2">
            <label htmlFor={`reason-${license.id}`} className="block text-xs font-semibold text-gray-700">
              Reason
            </label>
            <Select
              id={`reason-${license.id}`}
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
            <label htmlFor={`note-${license.id}`} className="block text-xs font-semibold text-gray-700">
              Note to the driver {reason === 'OTHER' ? '(required)' : '(optional)'}
            </label>
            <textarea
              id={`note-${license.id}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm"
            />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => decide('reject')} className="rsu-btn-danger-solid px-4 py-2 text-sm disabled:opacity-60">
                Reject
              </button>
              <button type="button" disabled={busy} onClick={() => setRejecting(false)} className="rsu-btn-secondary px-4 py-2 text-sm">
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => decide('approve')} className="rsu-btn-primary px-4 py-2 text-sm disabled:opacity-60">
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="rsu-btn-danger px-4 py-2 text-sm">
              Reject…
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
