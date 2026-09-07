'use client';

import React from 'react';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';

interface ConfirmStructuralEditModalProps {
  changeSummary: string; // e.g. "the route and the seat count"
  approvedCount: number;
  fuelShareWouldChange: { from: number; to: number } | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmStructuralEditModal({
  changeSummary,
  approvedCount,
  fuelShareWouldChange,
  loading,
  onConfirm,
  onClose,
}: ConfirmStructuralEditModalProps) {
  const passengers = `${approvedCount} confirmed passenger${approvedCount === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rsu-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Save this change?</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          This trip has {passengers}. Changing {changeSummary} will notify {approvedCount === 1 ? 'them' : 'them all'}.
        </p>

        {fuelShareWouldChange && (
          <div className="mb-4 flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <FaExclamationTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              This would normally set the fuel share to ₱{fuelShareWouldChange.to.toFixed(2)} per seat, but it stays
              locked at <span className="font-semibold">₱{fuelShareWouldChange.from.toFixed(2)}</span> — your matched
              passengers keep that price, and new riders will still see it.
            </p>
          </div>
        )}

        <div className="flex flex-row items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rsu-btn-secondary px-4 py-2.5 whitespace-nowrap">
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rsu-btn-primary px-4 py-2.5 whitespace-nowrap disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save & Notify'}
          </button>
        </div>
      </div>
    </div>
  );
}
