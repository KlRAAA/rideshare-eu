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
  checks?: LicenseCheckResults | null;
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
        : { title: 'Your license is under review', detail: `${checkProblem(l?.checks)} An admin will look, usually within a day. You’ll get a notification.`, tone: 'warn' };
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
        detail: 'Take a photo of it here. Most are checked automatically in seconds; unclear ones go to an admin. Trips you already posted keep running.',
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
  // Why the name didn't match: parts of the account name not found on the
  // photo, or an account name that's only a first name.
  nameMissing?: string[];
  nameTooShort?: boolean;
}

const CHECK_LABELS: [keyof LicenseCheckResults, string][] = [
  ['isLicense', 'Looks like an LTO driver’s license'],
  ['nameMatch', 'Name matches the account'],
  ['numberMatch', 'License number matches'],
  ['expiryMatch', 'Expiry date matches'],
  ['notStudentPermit', 'Not a student permit'],
];

const titleCase = (word: string) => word.charAt(0) + word.slice(1).toLowerCase();
const listWords = (words: string[]) => words.map((w) => `“${titleCase(w)}”`).join(' and ');

// Why the name check failed, in a few words, or null.
export function nameProblem(checks: LicenseCheckResults | null | undefined): string | null {
  if (checks?.nameTooShort) return 'the account name is only a first name';
  if (checks?.nameMissing?.length) return `${listWords(checks.nameMissing)} from the account name isn’t on the photo`;
  return null;
}

// The driver's view of a check that didn't pass, as one sentence.
export function checkProblem(checks: LicenseCheckResults | null | undefined): string {
  if (checks?.nameTooShort) return 'Your account name is only a first name, so the automatic check can’t match it to the license.';
  if (checks?.nameMissing?.length) return `The automatic check couldn’t find ${listWords(checks.nameMissing)} from your account name on the photo.`;
  if (checks?.unreadable) return 'The automatic check couldn’t read the photo.';
  return 'The automatic check couldn’t confirm it.';
}

export function checkRows(checks: LicenseCheckResults | null | undefined): { label: string; ok: boolean; note?: string }[] | null {
  if (!checks) return null;
  if (checks.unreadable) return [{ label: 'The photo couldn’t be read', ok: false }];
  return CHECK_LABELS.map(([key, label]) => {
    const ok = checks[key] === true;
    const note = key === 'nameMatch' && !ok ? nameProblem(checks) : null;
    return note ? { label, ok, note } : { label, ok };
  });
}
