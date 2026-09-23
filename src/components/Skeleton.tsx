import React from 'react';

type SkeletonShape = 'circle' | 'text' | 'rect';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  // circle: avatars. text: a line of copy (small radius). rect: everything
  // else standing in for a card, image, map, or button (larger radius by
  // default, matching --rsu-radius-lg the way real cards/buttons do).
  shape?: SkeletonShape;
  // Overrides the shape's default radius — e.g. var(--rsu-btn-radius) to
  // match a real button exactly, or 9999px is already circle's default.
  radius?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SHAPE_RADIUS: Record<SkeletonShape, string> = {
  circle: '9999px',
  text: '4px',
  rect: 'var(--rsu-radius-lg)',
};

// Base placeholder block for skeleton loading screens. Fill color comes from
// --color-border (already theme-aware — see globals.css's light/dark token
// blocks), never a hardcoded gray, so this looks right without any extra
// dark-mode handling here. The shimmer sweep itself lives in globals.css's
// .rsu-skeleton rule (keeps the keyframes/reduced-motion logic in one place
// alongside this app's other shared CSS, same convention as .rsu-card/
// .rsu-btn-*), this component just sizes and shapes the block.
export default function Skeleton({ width = '100%', height = '1rem', shape = 'rect', radius, className = '', style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rsu-skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius ?? SHAPE_RADIUS[shape],
        ...style,
      }}
    />
  );
}
