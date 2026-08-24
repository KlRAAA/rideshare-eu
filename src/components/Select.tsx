'use client';

import React from 'react';
import { FaChevronDown } from 'react-icons/fa';

// Restyles the closed-state control only (appearance-none, maroon focus
// ring, custom chevron). The open option list is OS-drawn chrome that no
// CSS in any browser can theme — not something this wrapper can fix.
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export default function Select({ className = '', wrapperClassName = '', children, ...props }: SelectProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`appearance-none outline-none focus:ring-2 focus:ring-[color:var(--rsu-color-primary)] focus:border-[color:var(--rsu-color-primary)] ${className}`}
      >
        {children}
      </select>
      <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
    </div>
  );
}
