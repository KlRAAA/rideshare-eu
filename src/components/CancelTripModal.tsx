'use client';

import React, { useState } from 'react';
import { FaBan, FaTimes } from 'react-icons/fa';
import { apiFetch, ApiError } from '@/lib/api';

interface CancelTripModalProps {
  tripId: string;
  userId: string;
  role: 'host' | 'passenger';
  onClose: () => void;
  onCancelled: () => void;
}

export default function CancelTripModal({ tripId, userId, role, onClose, onCancelled }: CancelTripModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = role === 'host';

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/trips/${tripId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ userId, reason: isHost && reason ? reason : undefined }),
      });
      onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t cancel that trip. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rsu-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">{isHost ? 'Cancel this trip?' : 'Cancel your spot?'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {isHost
            ? 'Every approved and pending passenger will be notified, and this trip will no longer be joinable.'
            : 'The host will be notified. Your spot opens up for other riders.'}
        </p>

        {isHost && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Vehicle trouble, schedule conflict"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-300"
            />
            <p className="text-[11px] text-gray-400 mt-1">Shared with passengers in their cancellation notice.</p>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex flex-row items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rsu-btn-secondary px-4 py-2.5 whitespace-nowrap">
            {isHost ? 'Keep Trip' : 'Keep My Spot'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rsu-btn-danger-solid flex flex-row items-center gap-2 px-4 py-2.5 whitespace-nowrap disabled:opacity-60"
          >
            <FaBan className="w-3.5 h-3.5 shrink-0" />
            <span>{loading ? 'Cancelling...' : isHost ? 'Cancel Trip' : 'Cancel My Spot'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
