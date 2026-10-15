'use client';

import React, { useState } from 'react';
import { FaDirections } from 'react-icons/fa';
import type { LatLng } from '@/lib/directions';
import { googleMapsUrl, wazeUrl } from '@/lib/navigation';

// Hands the drive to Google Maps or Waze for spoken directions. The trip page
// stops sending the position while it's in the background, so riders then see
// "paused" until the driver comes back.
export default function NavigateMenu({ to, via }: { to: LatLng; via: LatLng | null }) {
  const [open, setOpen] = useState(false);
  const next = via ?? to;
  return (
    <div className="space-y-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rsu-btn-secondary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
        <FaDirections className="h-4 w-4" aria-hidden />
        Navigate
      </button>
      {open && (
        <div className="rsu-card space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <a href={googleMapsUrl(to, via)} target="_blank" rel="noopener noreferrer" className="rsu-btn-primary px-3 py-2 text-center text-sm">
              Google Maps
            </a>
            <a href={wazeUrl(next)} target="_blank" rel="noopener noreferrer" className="rsu-btn-primary px-3 py-2 text-center text-sm">
              Waze
            </a>
          </div>
          <p className="text-xs text-gray-500">Riders see your car only while this page is open.</p>
        </div>
      )}
    </div>
  );
}
