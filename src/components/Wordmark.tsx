import React from 'react';

interface WordmarkProps {
  // Rendered height in pixels; the width follows the 1266 × 192 artwork.
  height?: number;
  className?: string;
}

// The RideShareEU name as custom monoline lettering, drawn from the same circles and
// straight strokes as the Pin car mark (docs/brand/logo/build_wordmark.py). It uses
// currentColor, so it follows the surrounding text colour in light and dark mode.
export default function Wordmark({ height = 18, className = '' }: WordmarkProps) {
  return (
    <svg
      viewBox="0 34 1266 192"
      height={height}
      width={(height * 1266) / 192}
      role="img"
      aria-label="RideShareEU"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round">
        <path transform="translate(24.0 0)" d="M0 200 V60 H42 A42 42 0 0 1 42 144 H0" />
        <path transform="translate(24.0 0)" d="M40 144 L96 200" />
        <path transform="translate(162.0 0)" d="M0 200 V110" />
        <path transform="translate(200.0 0)" d="M90 60 V200" />
        <path transform="translate(200.0 0)" d="M45 155 m-45 0 a45 45 0 1 0 90 0 a45 45 0 1 0 -90 0" />
        <path transform="translate(328.0 0)" d="M0 155 H90 A45 45 0 1 0 76.8 186.8" />
        <path transform="translate(456.0 0)" d="M68.3 77.5 A35 35 0 1 0 38.0 130.0 A35 35 0 1 1 7.7 182.5" />
        <path transform="translate(572.0 0)" d="M0 60 V200" />
        <path transform="translate(572.0 0)" d="M0 155 A45 45 0 0 1 90 155 V200" />
        <path transform="translate(700.0 0)" d="M90 110 V200" />
        <path transform="translate(700.0 0)" d="M45 155 m-45 0 a45 45 0 1 0 90 0 a45 45 0 1 0 -90 0" />
        <path transform="translate(828.0 0)" d="M0 200 V110" />
        <path transform="translate(828.0 0)" d="M0 155 A45 45 0 0 1 45 110 H52" />
        <path transform="translate(910.0 0)" d="M0 155 H90 A45 45 0 1 0 76.8 186.8" />
        <path transform="translate(1040.0 0)" d="M70 60 H0 V200 H70" />
        <path transform="translate(1040.0 0)" d="M0 130 H58" />
        <path transform="translate(1152.0 0)" d="M0 60 V155 A45 45 0 0 0 90 155 V60" />
      </g>
      <circle cx="162.0" cy="74" r="13" fill="currentColor" />
    </svg>
  );
}
