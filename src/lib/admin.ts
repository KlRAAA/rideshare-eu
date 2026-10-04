import { FUEL_TYPE_SHORT_LABELS, isFuelType } from './fuelTypes';

export interface AdminAction {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action:
    | 'BAN'
    | 'UNBAN'
    | 'REPORT_REVIEWED'
    | 'REPORT_DISMISSED'
    | 'TRIP_CANCELLED'
    | 'FUEL_PRICE_SET'
    | 'PROMOTE'
    | 'DEMOTE'
    | 'SUPPORT_REPLIED'
    | 'SUPPORT_CLOSED'
    | 'ANNOUNCEMENT_POSTED';
  targetUserId: string | null;
  targetUserName: string | null;
  targetTripId: string | null;
  targetReportId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminCounts {
  users: number;
  admins: number;
  openTrips: number;
  completedTrips: number;
  pendingRequests: number;
  openReports: number;
  activeBans: number;
}

const ACTION_LABELS: Record<AdminAction['action'], string> = {
  BAN: 'banned',
  UNBAN: 'lifted the ban on',
  REPORT_REVIEWED: 'reviewed a report on',
  REPORT_DISMISSED: 'dismissed a report on',
  TRIP_CANCELLED: 'cancelled a trip hosted by',
  FUEL_PRICE_SET: 'set the official fuel price',
  PROMOTE: 'made an admin:',
  DEMOTE: 'removed admin from',
  SUPPORT_REPLIED: 'replied to a support request from',
  SUPPORT_CLOSED: 'closed a support request from',
  ANNOUNCEMENT_POSTED: 'posted an announcement',
};

export function describeAction(a: AdminAction): string {
  const actor = a.actorName ?? (a.details?.automatic ? 'Automatic strike ladder' : a.details?.via ? 'Server command' : 'System');
  if (a.action === 'FUEL_PRICE_SET') {
    // Entries from before per-type prices have no fuelType.
    const fuelType = a.details?.fuelType;
    const type = isFuelType(fuelType) ? `${FUEL_TYPE_SHORT_LABELS[fuelType]} ` : 'fuel ';
    return `${actor} set the official ${type}price to ₱${Number(a.details?.to).toFixed(2)}/L`;
  }
  if (a.action === 'ANNOUNCEMENT_POSTED') {
    const title = typeof a.details?.title === 'string' ? `: "${a.details.title}"` : '';
    return `${actor} posted an announcement${title}`;
  }
  return `${actor} ${ACTION_LABELS[a.action]} ${a.targetUserName ?? 'a deleted user'}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

export const BAN_DURATION_OPTIONS = [
  { value: '24H', label: '24 hours' },
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: 'PERMANENT', label: 'Permanent' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'INAPPROPRIATE_BEHAVIOR', label: 'Inappropriate behavior' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'OTHER', label: 'Other' },
] as const;

const HOUR_MS = 60 * 60 * 1000;

// "waiting 5 hours", "waiting 2 days" — how long a report or request has sat in a queue.
export function waitingLabel(sinceIso: string, now: number = Date.now()): string {
  const hours = Math.floor((now - new Date(sinceIso).getTime()) / HOUR_MS);
  if (hours < 1) return 'waiting under an hour';
  if (hours < 24) return `waiting ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}
