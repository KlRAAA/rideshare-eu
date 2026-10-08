'use client';

import React from 'react';
import { FaExchangeAlt } from 'react-icons/fa';
import type { AppMode } from '@/lib/modeNav';
import ModeSwitchButton from './ModeSwitchButton';

// Shown on Find a Ride in Driver mode and on Post a Trip in Passenger mode
// (sub-project C): each page belongs to one mode.
export default function WrongModeNotice({ need }: { need: AppMode }) {
  const text = need === 'PASSENGER' ? 'Finding a ride is in Passenger mode.' : 'Posting a trip is in Driver mode.';
  return (
    <div className="rsu-card flex flex-col items-center text-center gap-3 py-8">
      <FaExchangeAlt className="w-6 h-6 text-gray-400" aria-hidden />
      <p className="text-sm font-medium text-gray-800">{text}</p>
      <ModeSwitchButton />
    </div>
  );
}
