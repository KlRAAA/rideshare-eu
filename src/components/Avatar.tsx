'use client';

import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  // Tailwind size utilities for the circle, e.g. "w-10 h-10".
  sizeClass?: string;
  // Text size for the initials fallback, e.g. "text-sm".
  textClass?: string;
  className?: string;
}

// One user avatar everywhere: the uploaded photo when there is one, otherwise
// the first initial in a neutral circle. Falls back to initials if the image
// fails to load (deleted file, etc.) rather than showing a broken-image icon.
export default function Avatar({ name, src, sizeClass = 'w-10 h-10', textClass = 'text-sm', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden border border-gray-200 bg-gray-100 text-gray-700 flex items-center justify-center font-bold shrink-0 ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={textClass}>{initial}</span>
      )}
    </div>
  );
}
