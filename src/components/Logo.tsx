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
// The mark ("Pin car", docs/brand/logo): a map pin laid on its side is the car body; its
// point is the nose, its hole is the rear window, and two wheels sit below. This is the
// small-size cut (bigger window and wheels) because the chip is only 24-40 px. The window
// is a real hole, so the chip colour shows through in both themes.
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
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 256 256" aria-hidden="true">
        <g transform="translate(-6.58 -26.91) scale(1.1137)" fill="white">
          <path
            fillRule="evenodd"
            d="M219.7 158 L127.8 66.2 A62 62 0 0 0 44.8 158 Z M52 108 a28 28 0 1 0 56 0 a28 28 0 1 0 -56 0 Z"
          />
          <circle cx="86" cy="196" r="25" />
          <circle cx="167.7" cy="196" r="25" />
        </g>
      </svg>
    </div>
  );
}
