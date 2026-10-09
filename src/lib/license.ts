// Driver's license screens (sub-project E). Mirrors server/services/licenseService.js.

export type LicenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LicenseType = 'NON_PROFESSIONAL' | 'PROFESSIONAL' | 'STUDENT_PERMIT';
export type RejectReason = 'UNREADABLE' | 'DETAILS_MISMATCH' | 'EXPIRED' | 'STUDENT_PERMIT' | 'NOT_A_LICENSE' | 'NAME_MISMATCH' | 'OTHER';
export type LicenseReason = 'LICENSE_REQUIRED' | 'LICENSE_PENDING' | 'LICENSE_REJECTED' | 'LICENSE_EXPIRED' | null;

export interface LicenseInfo {
  id: string;
  status: LicenseStatus;
  licenseType: LicenseType;
  numberLast4: string;
  expiresOn: string;
  submittedAt: string;
  decidedAt: string | null;
  rejectReason: RejectReason | null;
  rejectNote: string | null;
  // The automatic check: null until it has run.
  checkedAt?: string | null;
  autoApproved?: boolean;
}

export interface MyLicense {
  license: LicenseInfo | null;
  verified: boolean;
  canPost: boolean;
  reason: LicenseReason;
}

export const LICENSE_TYPE_OPTIONS: { value: LicenseType; label: string }[] = [
  { value: 'NON_PROFESSIONAL', label: 'Non-professional' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'STUDENT_PERMIT', label: 'Student permit' },
];

const REASON_TEXT: Record<RejectReason, string> = {
  UNREADABLE: 'The photo is blurry or unreadable',
  DETAILS_MISMATCH: 'The number or expiry date you typed doesn’t match the photo',
  EXPIRED: 'The license has expired',
  STUDENT_PERMIT: 'A student permit doesn’t allow carrying passengers',
  NOT_A_LICENSE: 'The photo isn’t a driver’s license',
  NAME_MISMATCH: 'The name on the license doesn’t match your account',
  OTHER: 'See the note from the administrator',
};

export const REJECT_REASON_OPTIONS = (Object.keys(REASON_TEXT) as RejectReason[]).map((value) => ({
  value,
  label: value === 'OTHER' ? 'Other (write a note)' : REASON_TEXT[value],
}));

export function rejectReasonLabel(reason: RejectReason): string {
  return REASON_TEXT[reason];
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

export interface LicenseStatusText {
  title: string;
  detail: string;
  tone: 'ok' | 'neutral' | 'warn' | 'bad';
}

export function licenseStatusText(my: MyLicense): LicenseStatusText {
  const l = my.license;
  if (my.verified && l) {
    const approved = l.status === 'APPROVED' ? l : null;
    const detail = approved
      ? `Valid until ${longDate(approved.expiresOn)} · ending ${approved.numberLast4}`
      : 'You can post trips while your renewal is checked.';
    return { title: 'License approved', detail, tone: 'ok' };
  }
  switch (my.reason) {
    case 'LICENSE_PENDING':
      return l && !l.checkedAt
        ? { title: 'Checking your license…', detail: 'This usually takes a few seconds. You can leave this page; you’ll get a notification.', tone: 'warn' }
        : { title: 'Your license is under review', detail: 'An admin checks it, usually within a day. You’ll get a notification.', tone: 'warn' };
    case 'LICENSE_REJECTED':
      return {
        title: 'Your license wasn’t approved',
        detail: l?.rejectReason ? `${REASON_TEXT[l.rejectReason]}.${l.rejectNote ? ` ${l.rejectNote}` : ''}` : 'Upload it again.',
        tone: 'bad',
      };
    case 'LICENSE_EXPIRED':
      return { title: 'Your license has expired', detail: 'Upload your renewed license to post trips again.', tone: 'bad' };
    default:
      return {
        title: 'Upload your driver’s license',
        detail: 'An admin checks it before you can post trips. Riders can still join you on trips you already posted.',
        tone: 'neutral',
      };
  }
}

const FIELD_HELP: Record<string, string> = {
  licenseNumber: 'Check the license number: 5–20 letters, digits or dashes.',
  licenseType: 'Choose the license type.',
  expiresOn: 'Check the expiry date.',
};

const ERRORS: Record<string, string> = {
  LICENSE_PENDING: 'Your license is already under review.',
  LICENSE_EXPIRED: 'That license has expired. Upload your renewed one.',
  INVALID_IMAGE: 'Take a photo of the front of your license.',
  FILE_TOO_LARGE: 'That photo is over 5 MB. Try a smaller one.',
};

export function licenseErrorMessage(code: string | undefined, field?: string): string {
  if (code === 'INVALID_LICENSE' && field && FIELD_HELP[field]) return FIELD_HELP[field];
  return (code && ERRORS[code]) || 'That didn’t work. Try again in a moment.';
}

// The five automatic checks, in the order an admin reads them.
export interface LicenseCheckResults {
  isLicense?: boolean;
  nameMatch?: boolean;
  numberMatch?: boolean;
  expiryMatch?: boolean;
  notStudentPermit?: boolean;
  unreadable?: boolean;
  passed?: boolean;
}

const CHECK_LABELS: [keyof LicenseCheckResults, string][] = [
  ['isLicense', 'Looks like an LTO driver’s license'],
  ['nameMatch', 'Name matches the account'],
  ['numberMatch', 'License number matches'],
  ['expiryMatch', 'Expiry date matches'],
  ['notStudentPermit', 'Not a student permit'],
];

export function checkRows(checks: LicenseCheckResults | null | undefined): { label: string; ok: boolean }[] | null {
  if (!checks) return null;
  if (checks.unreadable) return [{ label: 'The photo couldn’t be read', ok: false }];
  return CHECK_LABELS.map(([key, label]) => ({ label, ok: checks[key] === true }));
}
