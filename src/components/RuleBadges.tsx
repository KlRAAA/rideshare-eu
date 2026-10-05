import React from 'react';
import Badge from '@/components/Badge';
import { ruleBadges } from '@/lib/riderRules';

interface RuleBadgesProps {
  trip: { genderPreference: string; familiarRidersOnly?: boolean };
  className?: string;
}

// The trip's rules ("Women+ trip", "Familiar riders only"), never a person's
// gender (Women+ spec §6).
export default function RuleBadges({ trip, className = '' }: RuleBadgesProps) {
  const badges = ruleBadges(trip);
  if (badges.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((label) => (
        <Badge key={label} tone="info">
          {label}
        </Badge>
      ))}
    </span>
  );
}
