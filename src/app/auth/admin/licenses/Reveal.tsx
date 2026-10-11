'use client';

import React, { useEffect, useState } from 'react';

// License photos and numbers stay closed until an admin opens one, and close
// again when the admin leaves the tab, so they aren't on screen by default.
export function useReveal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const hide = () => document.visibilityState === 'hidden' && setOpen(false);
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [open]);
  return [open, setOpen] as const;
}

interface ClosedLicenseProps {
  name: string;
  meta: string;
  action: string;
  onOpen: () => void;
}

export function ClosedLicense({ name, meta, action, onOpen }: ClosedLicenseProps) {
  return (
    <div className="rsu-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500">{meta}</p>
      </div>
      <button type="button" onClick={onOpen} className="rsu-btn-primary px-3 py-1.5 text-xs shrink-0">
        {action}
      </button>
    </div>
  );
}
