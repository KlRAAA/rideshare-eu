'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';

// A fully custom-rendered dropdown (unlike Select.tsx, which restyles the
// closed-state of a native <select> but leaves the open option list as
// OS-drawn chrome that no CSS can theme). Use this where the open list's
// own hover/selected colors genuinely need to be on-brand.
interface ListboxOption<T extends string | number> {
  value: T;
  label: string;
}

interface ListboxProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: ListboxOption<T>[];
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Listbox<T extends string | number>({
  value,
  onChange,
  options,
  className = '',
  wrapperClassName = '',
  disabled = false,
  ariaLabel,
}: ListboxProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${wrapperClassName}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`w-full flex items-center justify-between text-left outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)] focus:border-[color:var(--rsu-color-primary)] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <span>{selected?.label ?? ''}</span>
        <FaChevronDown className={`w-3 h-3 text-gray-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  isSelected
                    ? 'bg-[color:var(--rsu-color-primary)] text-white'
                    : 'text-gray-700 hover:bg-[color:var(--rsu-color-primary)]/10'
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
