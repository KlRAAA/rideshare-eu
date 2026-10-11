'use client';

import React from 'react';
import { FaArrowLeft, FaArrowRight, FaArrowUp, FaFlagCheckered, FaRedo, FaUndo } from 'react-icons/fa';
import { arrowFor, distanceLabel, type Arrow, type NavStep } from '@/lib/navigation';

const ICON: Record<Arrow, { Icon: React.ComponentType<{ className?: string }>; turn?: string }> = {
  left: { Icon: FaArrowLeft },
  right: { Icon: FaArrowRight },
  'slight-left': { Icon: FaArrowUp, turn: '-rotate-45' },
  'slight-right': { Icon: FaArrowUp, turn: 'rotate-45' },
  'sharp-left': { Icon: FaArrowLeft, turn: '-rotate-45' },
  'sharp-right': { Icon: FaArrowRight, turn: 'rotate-45' },
  straight: { Icon: FaArrowUp },
  uturn: { Icon: FaUndo },
  roundabout: { Icon: FaRedo },
  arrive: { Icon: FaFlagCheckered },
};

// The driver's next turn, in app colors, above the live map (live trip map).
export default function NavBanner({ next }: { next: { step: NavStep; meters: number } | null }) {
  if (!next) return null;
  const { Icon, turn } = ICON[arrowFor(next.step.type, next.step.modifier)];
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-[color:var(--rsu-color-primary)] px-4 py-3 text-white shadow-md">
      <Icon className={`h-7 w-7 shrink-0 ${turn ?? ''}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-xl font-extrabold tabular-nums leading-tight">{distanceLabel(next.meters)}</p>
        <p className="truncate text-sm font-semibold opacity-90">{next.step.name || next.step.instruction}</p>
      </div>
    </div>
  );
}
