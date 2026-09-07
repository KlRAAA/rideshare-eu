'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';

interface BackButtonProps {
  // Where to go when there's no in-app history to return to (opened from a
  // bookmark, a pasted link, a notification email). Each drill-in page passes
  // its own parent, not one generic destination.
  fallback: string;
  label?: string;
  className?: string;
}

export default function BackButton({ fallback, label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    const cameFromOutside =
      !document.referrer || new URL(document.referrer).origin !== window.location.origin;

    // Only entry (or [external, here]) with no same-origin referrer → back()
    // would strand the user or leave the app. Go to the parent instead.
    if (window.history.length <= 2 && cameFromOutside) {
      router.replace(fallback);
      return;
    }

    const before = window.location.href;
    router.back();
    // bfcache / blocked-navigation guard: if nothing moved, fall back.
    window.setTimeout(() => {
      if (window.location.href === before) router.replace(fallback);
    }, 400);
  }, [router, fallback]);

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[color:var(--rsu-color-primary)] transition-colors ${className}`}
    >
      <FaArrowLeft className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
