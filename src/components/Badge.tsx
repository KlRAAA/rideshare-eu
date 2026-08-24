import React from 'react';

type Tone = 'success' | 'warning' | 'neutral' | 'primary' | 'info';

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'rsu-badge-success',
  warning: 'rsu-badge-warning',
  neutral: 'rsu-badge-neutral',
  primary: 'rsu-badge-primary',
  info: 'rsu-badge-info',
};

export default function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return <span className={`rsu-badge ${TONE_CLASS[tone]} ${className}`}>{children}</span>;
}
