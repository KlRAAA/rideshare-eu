export interface NotificationRef {
  type: string;
  relatedTripId: string | null;
  relatedMatchId: string | null;
}

// Notification types that have a meaningful place to send the user. Anything not
// listed here (REMINDER today, plus any type added later without a destination)
// renders as an inert card rather than routing somewhere wrong.
const ROUTABLE_TYPES = new Set(['MATCH_REQUEST', 'APPROVAL', 'CANCELLATION', 'RATING_PROMPT', 'TRIP_UPDATED', 'MESSAGE', 'TRIP_STARTED',
  'CONFIRM_REQUEST', 'DRIVER_UNCONFIRMED', 'DRIVER_LATE', 'DRIVER_NO_SHOW', 'TRIP_SKIPPED']);

// Where clicking a notification navigates. Returns null when the notification
// isn't actionable — callers should render those non-clickable.
//
// Every routable type currently lands on the same trip detail page; the type is
// still the switch so a future type that needs a different destination is a
// one-line change here, not a new handler at the call site.
export function notificationHref(n: NotificationRef): string | null {
  // An admin replied to one of the user's Help requests.
  if (n.type === 'SUPPORT_REPLY') return '/help/requests';
  // An official warning: the dashboard shows it until the user acknowledges it.
  if (n.type === 'WARNING') return '/auth/dashboard';
  // Driver's license decisions and reminders (sub-project E).
  if (n.type.startsWith('LICENSE_')) return '/auth/license';
  if (!n.relatedTripId || !ROUTABLE_TYPES.has(n.type)) return null;
  const base = `/auth/trips/${n.relatedTripId}`;
  return n.relatedMatchId ? `${base}?requestId=${n.relatedMatchId}` : base;
}
