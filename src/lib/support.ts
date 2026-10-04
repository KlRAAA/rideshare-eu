// Help & support: shared labels, limits and helpers for the Help pages and the
// admin inbox. Keep the values in sync with server/services/supportService.js.

export type SupportCategory = 'APP_PROBLEM' | 'ACCOUNT' | 'SAFETY' | 'FUEL_SHARE' | 'OTHER';
export type SupportStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: 'APP_PROBLEM', label: 'Problem with the app' },
  { value: 'ACCOUNT', label: 'Account or sign-in' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'FUEL_SHARE', label: 'Fuel share' },
  { value: 'OTHER', label: 'Other' },
];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  OPEN: 'Waiting for an admin',
  ANSWERED: 'Answered',
  CLOSED: 'Closed',
};

export const SUBJECT_MAX = 120;
export const BODY_MAX = 2000;

export interface SupportMessage {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
  authorName?: string | null;
}

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  relatedTripId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages?: SupportMessage[];
}

export interface SupportFormValues {
  category: string;
  subject: string;
  body: string;
}

export function categoryLabel(value: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// A user-facing problem with the form, or null when it can be sent.
export function supportFormError(v: SupportFormValues): string | null {
  if (!SUPPORT_CATEGORIES.some((c) => c.value === v.category)) return 'Choose what your request is about.';
  if (!v.subject.trim()) return 'Add a short subject.';
  if (v.subject.trim().length > SUBJECT_MAX) return `Keep the subject under ${SUBJECT_MAX} characters.`;
  if (!v.body.trim()) return 'Describe what happened.';
  if (v.body.trim().length > BODY_MAX) return `Keep the message under ${BODY_MAX} characters.`;
  return null;
}

// The campus security number, shown in the emergency box only when the school
// has given one. A wrong number in an emergency is worse than none.
export function campusSecurityPhone(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.NEXT_PUBLIC_CAMPUS_SECURITY_PHONE?.trim();
  return value ? value : null;
}
