'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

interface TipProps {
  // The full meaning: the tooltip text, also read by screen readers.
  label: string;
  children: React.ReactNode;
  // 'button' (default): the trigger is a small button that toggles on tap.
  // 'wrap': wraps an element that's already interactive (a link or button);
  // the tooltip shows on hover and keyboard focus only.
  mode?: 'button' | 'wrap';
  // Where the bubble opens; 'bottom' for things along the top edge (the header).
  side?: 'top' | 'bottom';
  className?: string;
}

// An icon or short value whose meaning shows in a tooltip (sub-project I):
// hover or focus on a computer, tap on a phone; Escape or a tap elsewhere closes it.
export default function Tip({ label, children, mode = 'button', side = 'top', className = '' }: TipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  // Hover only for a real mouse: a tap also fires pointerenter, which would
  // open and the click would then close it again.
  const hover = {
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(true),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  const bubble = (
    <span
      role="tooltip"
      id={id}
      className={
        open
          ? `pointer-events-none absolute left-1/2 z-40 w-max max-w-[14rem] -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium leading-snug text-white shadow-lg ${
              side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`
          : 'sr-only'
      }
    >
      {label}
    </span>
  );

  if (mode === 'wrap') {
    return (
      <span ref={ref} className={`relative inline-flex ${className}`} aria-describedby={id} {...hover}>
        {children}
        {bubble}
      </span>
    );
  }
  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        {...hover}
        className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rsu-color-primary)]"
      >
        {children}
      </button>
      {bubble}
    </span>
  );
}
