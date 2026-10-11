'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiFetch, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/admin';
import { longDate, type LicenseCheckResults } from '@/lib/license';
import LicenseChecks from './LicenseChecks';
import RevokeLicense from './RevokeLicense';
import { ClosedLicense, useReveal } from './Reveal';

export interface AutoApproved {
  id: string;
  licenseNumber: string | null;
  expiresOn: string;
  decidedAt: string;
  photoKeepUntil: string;
  checks: LicenseCheckResults | null;
  user: { id: string; fullName: string; universityId: string };
}

const ERRORS: Record<string, string> = {
  ALREADY_CHECKED: 'Another admin already checked this one.',
  CANNOT_TARGET_SELF: 'You can’t check your own license.',
};

// One automatic approval: closed by default; "Looks right" deletes the photo now.
export default function AutoApprovedCard({ license: l }: { license: AutoApproved }) {
  const router = useRouter();
  const [open, setOpen] = useReveal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function looksRight() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/licenses/${l.id}/spot-checked`, { method: 'POST', body: '{}' });
      router.refresh();
    } catch (err) {
      setError((err instanceof ApiError && err.code && ERRORS[err.code]) || 'That didn’t work. Refresh and try again.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <ClosedLicense
        name={l.user.fullName}
        meta={`Approved ${formatDateTime(l.decidedAt)}`}
        action="Check"
        onOpen={() => setOpen(true)}
      />
    );
  }
  return (
    <div className="rsu-card grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${API_BASE}/api/admin/licenses/${l.id}/photo`}
        alt={`Driver's license approved for ${l.user.fullName}`}
        className="w-full rounded-xl border border-gray-200 bg-gray-100 object-contain max-h-64"
      />
      <div className="space-y-2 min-w-0 text-sm">
        <p className="font-semibold text-gray-900">{l.user.fullName}</p>
        <p className="text-gray-600">
          {l.user.universityId} · <span className="font-mono">{l.licenseNumber ?? '—'}</span> · expires {longDate(l.expiresOn)}
        </p>
        <p className="text-xs text-gray-500">
          Approved {formatDateTime(l.decidedAt)} · photo kept until {formatDateTime(l.photoKeepUntil)}
        </p>
        <LicenseChecks checks={l.checks} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={looksRight} className="rsu-btn-primary px-3 py-1.5 text-xs disabled:opacity-60">
            Looks right
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rsu-btn-secondary px-3 py-1.5 text-xs">
            Hide
          </button>
        </div>
        <RevokeLicense licenseId={l.id} />
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
