import React from 'react';
import { FaCalendarAlt, FaCar, FaClock, FaUsers, FaGasPump, FaRedo, FaVenus, FaUserFriends, FaShieldAlt } from 'react-icons/fa';
import Tip from '@/components/Tip';
import { carFact, priceFact, ruleFact, seatsFact, type Fact } from '@/lib/tripFacts';
import { ruleBadges } from '@/lib/riderRules';

type IconType = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

interface TripFactsProps {
  time?: string;
  date?: string;
  repeats?: string; // e.g. "Weekdays"; omitted for one-time trips
  seats?: { total: number; filled: number };
  fuelShare?: number | null;
  vehicle?: { make: string; model: string; color: string };
  className?: string;
}

function Item({ icon: Icon, fact }: { icon: IconType; fact: Fact }) {
  return (
    <li>
      <Tip label={fact.long}>
        <Icon className="h-3 w-3 text-gray-400" aria-hidden />
        <span>{fact.short}</span>
      </Tip>
    </li>
  );
}

// One row of compact trip facts, each with its full meaning in a tooltip (sub-project I).
export default function TripFacts({ time, date, repeats, seats, fuelShare, vehicle, className = '' }: TripFactsProps) {
  const price = priceFact(fuelShare);
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-600 ${className}`}>
      {time && <Item icon={FaClock} fact={{ short: time, long: `Leaves at ${time}` }} />}
      {date && <Item icon={FaCalendarAlt} fact={{ short: date, long: repeats ? `Starts ${date}` : `On ${date}` }} />}
      {repeats && <Item icon={FaRedo} fact={{ short: repeats, long: `Repeats: ${repeats.toLowerCase()}` }} />}
      {seats && <Item icon={FaUsers} fact={seatsFact(seats.total, seats.filled)} />}
      {price && <Item icon={FaGasPump} fact={price} />}
      {vehicle && <Item icon={FaCar} fact={carFact(vehicle)} />}
    </ul>
  );
}

const RULE_ICONS: Record<string, IconType> = { 'Women+ trip': FaVenus, 'Familiar riders only': FaUserFriends };

// The trip's rules as compact chips with tooltips; never a person's gender (Women+ spec §6).
export function RuleChips({ trip, className = '' }: { trip: { genderPreference: string; familiarRidersOnly?: boolean }; className?: string }) {
  const rules = ruleBadges(trip);
  if (rules.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {rules.map((label) => {
        const Icon = RULE_ICONS[label] ?? FaShieldAlt;
        const fact = ruleFact(label);
        return (
          <li key={label} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
            <Tip label={fact.long}>
              <Icon className="h-3 w-3" aria-hidden />
              <span>{fact.short}</span>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}
