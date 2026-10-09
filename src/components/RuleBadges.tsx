import React from 'react';
import { RuleChips } from '@/components/TripFacts';

interface RuleBadgesProps {
  trip: { genderPreference: string; familiarRidersOnly?: boolean };
  className?: string;
}

// The trip's rules ("Women+", "Familiar"), each explained in a tooltip
// (sub-project I); never a person's gender (Women+ spec §6).
export default function RuleBadges({ trip, className = '' }: RuleBadgesProps) {
  return <RuleChips trip={trip} className={className} />;
}
