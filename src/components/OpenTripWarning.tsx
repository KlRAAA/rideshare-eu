import React from 'react';

interface OpenTripWarningProps {
  onCancel: () => void;
  onContinue: () => void;
}

// Shown before a rider who chose Women+ trips requests a trip that is open to
// everyone (Women+ spec §7). Worded around the trip, never other riders.
export default function OpenTripWarning({ onCancel, onContinue }: OpenTripWarningProps) {
  return (
    <div role="alertdialog" aria-labelledby="open-trip-warning-title" aria-describedby="open-trip-warning-body">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p id="open-trip-warning-title" className="font-semibold text-amber-900">
          This trip is open to everyone.
        </p>
        <p id="open-trip-warning-body" className="mt-1 text-sm text-amber-900">
          You chose Women+ trips only. Other riders on this trip could be any gender.
        </p>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onCancel} className="rsu-btn-secondary flex-1">
          Cancel
        </button>
        <button type="button" onClick={onContinue} className="rsu-btn-primary flex-1">
          Request anyway
        </button>
      </div>
    </div>
  );
}
