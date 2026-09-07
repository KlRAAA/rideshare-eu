// Thesis §5.1.4: departure times are stored/computed in UTC (see
// matchController.js's use of getUTCHours/getUTCMinutes) but displayed in
// Philippine Standard Time (UTC+8). Every user-facing formatter below must
// pass timeZone: 'Asia/Manila' — never format a raw Date without it, or the
// UI will show whatever timezone the rendering machine happens to be in.
const DISPLAY_TIMEZONE = 'Asia/Manila';

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DISPLAY_TIMEZONE,
  });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIMEZONE,
  });
}

export function formatDateTimeAgo(date: Date | string): string {
  const then = new Date(date).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

const PH_OFFSET_MINUTES = 8 * 60;

// Converts an "HH:MM" typed into a <input type="time"> — meant as Philippine
// local time — into the same UTC-shifted "minutes since midnight" that
// matchController.search derives from a stored trip's departureTime via
// getUTCHours()/getUTCMinutes(). A trip stored for 7:00 AM PH always reads
// back as UTC-hour 23 (of the previous date) — a constant shift, since PH
// has no DST — so both sides must apply the same shift or comparisons like
// "does this search time match that trip's time" silently compare the wrong
// numbers. Bug found and fixed by actually running a search end-to-end,
// not by reading the code — worth being paranoid about elsewhere too.
export function phTimeToUtcMinutes(hh: number, mm: number): number {
  return (hh * 60 + mm - PH_OFFSET_MINUTES + 1440) % 1440;
}

// "Today"/"now" in Philippine time, formatted for direct use as an
// <input type="date"/"time"> min attribute — deliberately not the browser's
// local date/time, for the same reason phTimeToUtcMinutes exists above.
export function getPhTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function getPhNowTimeString(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

// A stored UTC instant expressed as the "YYYY-MM-DD" / "HH:MM" a Philippine user
// would read on a clock — for seeding <input type="date"/"time"> when editing a
// trip. Same PH anchoring as getPhToday/NowString above.
export function phInputDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

export function phInputTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function recurrenceLabel(type: string): string {
  switch (type) {
    case 'DAILY':
      return 'daily';
    case 'WEEKDAYS':
      return 'weekdays';
    case 'CUSTOM':
      return 'custom days';
    default:
      return 'one-time';
  }
}
