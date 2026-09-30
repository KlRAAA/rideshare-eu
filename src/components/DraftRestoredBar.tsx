'use client';

import { FaHistory } from 'react-icons/fa';

export default function DraftRestoredBar({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 px-3 py-2 mb-4 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-700"
    >
      <span className="flex items-center gap-2">
        <FaHistory className="w-3.5 h-3.5 text-gray-400" aria-hidden />
        We restored what you were typing.
      </span>
      <button type="button" onClick={onDiscard} className="font-semibold text-[color:var(--rsu-color-primary)] hover:underline">
        Start over
      </button>
    </div>
  );
}
