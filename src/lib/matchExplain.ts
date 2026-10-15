// Plain-words explanations for a Find a Ride result (demo feedback): how far
// the trip's time is from the rider's, and what the match percentage is made
// of. The weights mirror server/config/psgaConfig.js (route 0.5, time 0.3,
// seats and rules 0.2).

export interface MatchParts {
  score: number;
  routeOverlap: number; // 0–1: share of the rider's way along the driver's route
  scheduleAlignment: number; // 0–1: 1 at the rider's time, 0 at the edge of their window
  preferenceMatch: boolean;
}

export interface MatchReason {
  label: string;
  detail: string;
}

const PH_OFFSET_MINUTES = 8 * 60;

// Minutes after midnight, Philippine time.
function phMinutes(iso: string): number {
  const d = new Date(iso);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + PH_OFFSET_MINUTES) % 1440;
}

function hhmmMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// "Leaves 9 min after your 6:15 AM", "Leaves 1 h before your 6:15 AM", "Leaves at your time, 6:15 AM".
export function timeGapLabel(searchTime: string, departureIso: string): string {
  const mine = hhmmMinutes(searchTime);
  const gap = phMinutes(departureIso) - mine;
  if (gap === 0) return `Leaves at your time, ${clock(mine)}`;
  return `Leaves ${duration(Math.abs(gap))} ${gap > 0 ? 'after' : 'before'} your ${clock(mine)}`;
}

export function matchPercent(parts: MatchParts): number {
  return Math.round(parts.score * 100);
}

// The three parts of the score, in the order of their weight.
export function matchReasons(parts: MatchParts, searchTime: string, departureIso: string, flexWindowMinutes: number): MatchReason[] {
  const gap = timeGapLabel(searchTime, departureIso);
  const time =
    parts.scheduleAlignment >= 1
      ? `${gap}: full marks.`
      : parts.scheduleAlignment <= 0
        ? `${gap}: outside your ±${flexWindowMinutes} min window, no marks.`
        : `${gap}. Full marks at your exact time, none at ±${flexWindowMinutes} min.`;
  return [
    { label: 'Route, half the score', detail: `${Math.round(parts.routeOverlap * 100)}% of your way is along the driver’s route.` },
    { label: 'Time, 30%', detail: time },
    {
      label: 'Seats and rules, 20%',
      detail: parts.preferenceMatch ? 'There’s a free seat and you meet the trip’s rules.' : 'No free seat, or you don’t meet the trip’s rules.',
    },
  ];
}
