'use client';

import React, { useState } from 'react';
import { FaStar, FaTimes } from 'react-icons/fa';
import { apiFetch } from '@/lib/api';

interface RatingModalProps {
  matchId: string;
  raterId: string;
  rateeId: string;
  rateeName: string;
  // Required for a recurring trip's standing match (which occurrence this
  // rating is for); omitted for a ONE_TIME trip, where the server derives it
  // from the trip's own departure date instead.
  occurrenceDate?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RatingModal({ matchId, raterId, rateeId, rateeName, occurrenceDate, onClose, onSubmitted }: RatingModalProps) {
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (score === 0) {
      setError('Pick a star rating before submitting.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/matches/${matchId}/ratings`, {
        method: 'POST',
        body: JSON.stringify({ raterId, rateeId, score, comment: comment || undefined, anonymous, occurrenceDate }),
      });
      onSubmitted();
    } catch {
      setError('Couldn’t submit that rating. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rsu-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Rate {rateeName}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">How was your trip together?</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                onMouseEnter={() => setHoverScore(n)}
                onMouseLeave={() => setHoverScore(0)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className="p-1"
              >
                <FaStar
                  className={`w-7 h-7 ${(hoverScore || score) >= n ? 'text-amber-400' : 'text-gray-200'}`}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment"
            rows={3}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)]"
          />

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="w-5 h-5 accent-[color:var(--rsu-color-primary)]"
            />
            Post this review anonymously
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="rsu-btn-primary w-full disabled:opacity-60">
            {loading ? 'Submitting...' : 'Submit Rating'}
          </button>
        </form>
      </div>
    </div>
  );
}
