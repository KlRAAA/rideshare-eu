'use client';

import React, { useEffect, useState } from 'react';
import { FaTimes, FaFlag } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';
import { formatDate, reportCategoryLabel } from '@/lib/format';

interface ReportHistoryEntry {
  id: string;
  category: string;
  createdAt: string;
  type: 'user' | 'trip';
  reportedUserName: string | null;
  trip: { originAddress: string; destinationAddress: string } | null;
}

interface ReportHistoryModalProps {
  onClose: () => void;
}

// Self-service history of reports THIS user has filed — GET /api/reports/mine.
// Deliberately shows no status/outcome: nothing here is human-reviewed, so
// there's no legitimate "did it work" for a filer to check, same reasoning
// the ban email and suspended screen already follow for the other direction.
export default function ReportHistoryModal({ onClose }: ReportHistoryModalProps) {
  const [reports, setReports] = useState<ReportHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ reports: ReportHistoryEntry[] }>('/api/reports/mine')
      .then((data) => {
        if (!cancelled) setReports(data.reports);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your report history. Try again in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rsu-card w-full max-w-sm max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Report History</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Reports you've filed. Privacy protected — no outcome is shown.</p>

        <div className="overflow-y-auto -mx-1 px-1">
          {error && <p className="text-xs text-red-600 text-center py-6">{error}</p>}

          {!error && reports === null && <p className="text-sm text-gray-400 text-center py-6">Loading...</p>}

          {!error && reports && reports.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <FaFlag className="rsu-empty-icon mb-4" />
              <p className="text-gray-600 font-medium text-sm">You haven't filed any reports</p>
            </div>
          )}

          {!error && reports && reports.length > 0 && (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="p-2 rounded-lg border bg-gray-50 border-gray-100 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-800">{reportCategoryLabel(r.category)}</span>
                    <span className="text-[11px] text-gray-400 shrink-0" suppressHydrationWarning>
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  {r.trip && (
                    <p className="text-xs text-gray-600">
                      {r.trip.originAddress} → {r.trip.destinationAddress}
                    </p>
                  )}
                  {r.reportedUserName && <p className="text-[11px] text-gray-500">Reported: {r.reportedUserName}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
