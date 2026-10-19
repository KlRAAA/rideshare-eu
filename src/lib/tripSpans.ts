// My Trips / My Rides: how far back the Past and Cancelled tabs reach.

export type Span = '7d' | '30d' | 'all';

export const SPANS: { value: Span; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const DAYS: Record<Exclude<Span, 'all'>, number> = { '7d': 7, '30d': 30 };

// Whether a trip that last happened at `iso` falls inside the span.
export function withinSpan(iso: string, span: Span, now: Date = new Date()): boolean {
  if (span === 'all') return true;
  return now.getTime() - new Date(iso).getTime() <= DAYS[span] * 24 * 60 * 60 * 1000;
}

// Newest first: the trip you just finished sits at the top.
export function newestFirst<T extends { lastActiveAt: string }>(trips: T[]): T[] {
  return [...trips].sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
}
