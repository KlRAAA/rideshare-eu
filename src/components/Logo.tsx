import React from 'react';

interface LogoProps {
  // Pixel size of the square chip (width === height). 40 in the header,
  // 64 above the auth-page headings.
  size?: number;
  className?: string;
}

// Replaces the earlier raster logo.png, which turned out to be a white-
// background badge that read fine on a light header but sat as a jarring
// white square on the dark one. This is drawn entirely as SVG, so the chip
// itself uses --rsu-color-primary (the same token every button already
// pulls its color from) instead of a fixed white/whatever-the-source-image-
// was background — light and dark mode each already have their own value
// for that variable, so the chip is never independent of the theme, and
// there's no separate dark-mode asset to maintain.
//
// The mark: a simple car silhouette inside a map pin — a "pickup point"
// glyph, the same family of icon most rideshare apps use. Two flat shapes,
// no fine detail, so it stays legible at 40px instead of the previous
// artwork's multi-element illustration collapsing into noise at that size.
export default function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center shadow ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'var(--rsu-color-primary)',
        borderRadius: 'var(--rsu-radius-lg)',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2C7.58 2 4 5.58 4 10c0 5.25 6.4 11.4 7.3 12.3.4.4 1 .4 1.4 0C13.6 21.4 20 15.25 20 10c0-4.42-3.58-8-8-8z"
          fill="white"
        />
        <path
          d="M9.7 6.9h4.6l1.5 2h.8a1 1 0 0 1 1 .87l.2 1.7a1 1 0 0 1-1 1.13H7.2a1 1 0 0 1-1-1.13l.2-1.7a1 1 0 0 1 1-.87h.8l1.5-2z"
          fill="var(--rsu-color-primary)"
        />
        <circle cx="9.2" cy="12.5" r="1.05" fill="white" />
        <circle cx="14.8" cy="12.5" r="1.05" fill="white" />
      </svg>
    </div>
  );
}
