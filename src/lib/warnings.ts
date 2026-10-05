// Official warnings (docs/superpowers/specs/2026-10-06-user-warnings-design.md). The server
// writes the full sentence the warned user sees; these are the admin-facing labels.
export type WarningReason = 'SMOKING' | 'UNSAFE_DRIVING' | 'LATE_OR_NO_SHOW' | 'DISRESPECTFUL' | 'OTHER';

export const WARNING_REASONS: { value: WarningReason; label: string }[] = [
  { value: 'SMOKING', label: 'Smoking in the car' },
  { value: 'UNSAFE_DRIVING', label: 'Unsafe driving' },
  { value: 'LATE_OR_NO_SHOW', label: 'Late or no-show' },
  { value: 'DISRESPECTFUL', label: 'Disrespectful behaviour' },
  { value: 'OTHER', label: 'Other (note required)' },
];

export const WARNING_NOTE_MAX = 500;

export function warningReasonLabel(reason: string): string {
  return WARNING_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function warningFormError(reason: string, note: string): string | null {
  if (!WARNING_REASONS.some((r) => r.value === reason)) return 'Choose a reason.';
  if (reason === 'OTHER' && !note.trim()) return 'Add a note explaining the warning.';
  if (note.trim().length > WARNING_NOTE_MAX) return 'Keep the note under 500 characters.';
  return null;
}

// What the warned user sees (GET /api/warnings/active).
export interface ActiveWarning {
  id: string;
  reason: WarningReason;
  reasonLabel: string;
  note: string | null;
  createdAt: string;
}

// The admin user page's history (GET /api/admin/users/:id).
export interface AdminWarning {
  id: string;
  reason: WarningReason;
  note: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  issuedByName: string | null;
}
