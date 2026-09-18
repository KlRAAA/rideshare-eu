import React from 'react';
import { FaBan } from 'react-icons/fa';
import { formatDate, formatTime, reportCategoryLabel } from '@/lib/format';
import type { SuspensionDetails } from '@/lib/session';

interface BannedScreenProps {
  suspension: SuspensionDetails;
  appealEmail: string;
}

// Rendered purely from the 403 ACCOUNT_SUSPENDED response body — no dedicated
// endpoint of its own. Reached from AuthLayout, so it replaces the entire
// authenticated app shell rather than being a route of its own.
export default function BannedScreen({ suspension, appealEmail }: BannedScreenProps) {
  const until = new Date(suspension.bannedUntil);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="rsu-card w-full max-w-md text-center">
        <FaBan className="w-10 h-10 mx-auto text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Account suspended</h1>
        <p className="text-sm text-gray-600 mt-3">
          Your account was automatically suspended following reports categorized as{' '}
          <span className="font-semibold text-gray-900">{reportCategoryLabel(suspension.banReason)}</span>.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          {suspension.permanent ? (
            'This suspension does not have an automatic end date.'
          ) : (
            <>
              This is temporary and lifts automatically on{' '}
              <span className="font-semibold text-gray-900">
                {formatDate(until)} at {formatTime(until)}
              </span>
              .
            </>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-4">
          This action was taken automatically based on report volume and category — it was not reviewed by a person.
        </p>
        <a href={`mailto:${appealEmail}`} className="rsu-btn-secondary w-full mt-5 inline-block">
          Request a review — {appealEmail}
        </a>
      </div>
    </div>
  );
}
