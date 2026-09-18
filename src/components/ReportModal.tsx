'use client';

import React, { useState } from 'react';
import { FaTimes, FaFlag } from 'react-icons/fa';
import { apiFetch, ApiError } from '@/lib/api';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'INAPPROPRIATE_BEHAVIOR', label: 'Inappropriate behavior' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'OTHER', label: 'Other' },
];

const DESCRIPTION_MAX_LENGTH = 500;

interface ReportModalProps {
  reportedUserName: string;
  // Exactly one of these identifies what's being reported — the profile
  // "Report user" flow sends reportedUserId; the trip/match "Report an
  // issue" flow sends matchId, and the server derives the other party itself.
  reportedUserId?: string;
  matchId?: string;
  onClose: () => void;
}

export default function ReportModal({ reportedUserName, reportedUserId, matchId, onClose }: ReportModalProps) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setError('Please choose a reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ reportedUserId, matchId, category, description: description.trim() || undefined }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit that report. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rsu-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="text-center py-4">
            <FaFlag className="w-8 h-8 mx-auto text-[color:var(--rsu-color-primary)] mb-3" />
            <h2 className="text-lg font-bold text-gray-900">Report submitted — thank you.</h2>
            <p className="text-sm text-gray-500 mt-2">
              We won&apos;t share this with {reportedUserName} or let them know a report was filed.
            </p>
            <button type="button" onClick={onClose} className="rsu-btn-primary w-full mt-5">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Report {reportedUserName}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Your identity is never shared with the person you report.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="report-category" className="text-xs font-semibold text-gray-700">
                  Reason
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                >
                  <option value="">Select a reason</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-description" className="text-xs font-semibold text-gray-700">
                  Details (optional)
                </label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                  rows={3}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  placeholder="What happened?"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
                />
                <p className="text-[11px] text-gray-400 text-right mt-1">
                  {description.length}/{DESCRIPTION_MAX_LENGTH}
                </p>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button type="submit" disabled={submitting} className="rsu-btn-danger w-full disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
