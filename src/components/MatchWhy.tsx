import React from 'react';
import { FaClock } from 'react-icons/fa';
import { matchPercent, matchReasons, timeGapLabel, type MatchParts } from '@/lib/matchExplain';

interface MatchWhyProps {
  match: MatchParts;
  departureTime: string;
  searchTime: string; // "HH:MM" the rider searched with
  flexWindowMinutes: number;
}

// Under a Find a Ride result: how far its time is from the rider's, and a
// native disclosure explaining the match percentage (demo feedback).
export default function MatchWhy({ match, departureTime, searchTime, flexWindowMinutes }: MatchWhyProps) {
  return (
    <div className="mb-2 space-y-1 text-xs">
      <p className="flex items-center gap-2 font-medium text-gray-700">
        <FaClock className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
        {timeGapLabel(searchTime, departureTime)}
      </p>
      <details>
        <summary className="cursor-pointer font-semibold text-[color:var(--rsu-color-primary)]">
          {matchPercent(match)}% match · How is this worked out?
        </summary>
        <dl className="mt-2 space-y-1.5 rounded-lg bg-gray-50 p-2.5">
          {matchReasons(match, searchTime, departureTime, flexWindowMinutes).map((r) => (
            <div key={r.label}>
              <dt className="font-semibold text-gray-800">{r.label}</dt>
              <dd className="text-gray-600">{r.detail}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
