// Labels and checks for the superadmin's data requests. The server is the real
// check (server/services/dataRequestValidation.js); this explains problems
// before submitting.
export type DataRequestBasis = 'WARRANT' | 'COURT_ORDER' | 'SUBPOENA' | 'EMERGENCY';

export const BASIS_OPTIONS: { value: DataRequestBasis; label: string }[] = [
  { value: 'WARRANT', label: 'Warrant to Disclose Computer Data' },
  { value: 'COURT_ORDER', label: 'Court order' },
  { value: 'SUBPOENA', label: 'Subpoena' },
  { value: 'EMERGENCY', label: 'Emergency (risk to life)' },
];

export const RELEASE_FOOTER = 'Confidential: released under RA 10173';
export const AUDIT_NOTE = 'This is recorded permanently in the audit log.';

export function basisLabel(b: string): string {
  return BASIS_OPTIONS.find((o) => o.value === b)?.label ?? b;
}

// Chat messages and support requests need a warrant or court order that names them.
export function allowsContent(b: string): boolean {
  return b === 'WARRANT' || b === 'COURT_ORDER';
}

export interface DataRequestFormValues {
  subjectUserId: string;
  agency: string;
  officerName: string;
  officerContact: string;
  referenceNumber: string;
  legalBasis: string;
  fromDate: string;
  toDate: string;
  includeChats: boolean;
  includeSupport: boolean;
  verificationNote: string;
  password: string;
}

const REQUIRED: [keyof DataRequestFormValues, string][] = [
  ['subjectUserId', 'Choose the person the request is about.'],
  ['agency', 'Add the requesting agency.'],
  ['officerName', 'Add the requesting officer.'],
  ['officerContact', 'Add how to contact the officer.'],
  ['referenceNumber', 'Add the case, blotter or docket number.'],
  ['verificationNote', 'Say how you checked the request is genuine.'],
];

export function dataRequestFormError(v: DataRequestFormValues): string | null {
  for (const [field, message] of REQUIRED) {
    if (!String(v[field]).trim()) return message;
  }
  if (!BASIS_OPTIONS.some((o) => o.value === v.legalBasis)) return 'Choose the legal basis.';
  if (v.legalBasis !== 'EMERGENCY') {
    if (!v.fromDate || !v.toDate) return 'Choose the date range named in the request.';
    if (v.toDate < v.fromDate) return 'The end date must be on or after the start date.';
  }
  if ((v.includeChats || v.includeSupport) && !allowsContent(v.legalBasis)) {
    return 'Chat messages and support requests need a warrant or court order that names them.';
  }
  if (!v.password) return 'Enter your password to release records.';
  return null;
}

export function paperworkStatus(
  r: { paperworkDueAt: string | null; paperworkReceivedAt: string | null },
  now: number = Date.now()
): 'overdue' | 'due' | 'received' | null {
  if (!r.paperworkDueAt) return null;
  if (r.paperworkReceivedAt) return 'received';
  return Date.parse(r.paperworkDueAt) < now ? 'overdue' : 'due';
}

export function tripRoleLabel(role: 'DRIVER' | 'PASSENGER'): string {
  return role === 'DRIVER' ? 'Driver' : 'Passenger';
}

// A trip in a release (server/services/dataRequestService.js).
export interface ReleaseTrip {
  departureTime: string;
  recurrenceType: 'ONE_TIME' | 'DAILY' | 'WEEKDAYS' | 'CUSTOM';
  customDays: number[];
  origin: string | null;
  destination: string | null;
  meetingPoint: string | null;
  status: string;
  subjectRole: 'DRIVER' | 'PASSENGER';
  subjectRequestStatus: string | null;
  driver: string | null;
  coRiders: string[];
  car: { make: string; model: string; color: string; plate: string | null } | null;
  messages: { sender: string | null; body: string; sentAt: string }[] | null;
}

export interface Release {
  generatedAt: string;
  request: {
    id: string;
    agency: string;
    officerName: string;
    referenceNumber: string;
    legalBasis: DataRequestBasis;
    fromDate: string | null;
    toDate: string | null;
    includeChats: boolean;
    includeSupport: boolean;
  };
  subject: { name: string | null; universityId: string | null; role: string | null; deleted: boolean };
  trips: ReleaseTrip[];
  supportRequests:
    | { subject: string; category: string; status: string; createdAt: string; messages: { from: string; body: string; sentAt: string }[] }[]
    | null;
}

export interface DataRequestRow {
  id: string;
  createdAt: string;
  agency: string;
  referenceNumber: string;
  legalBasis: DataRequestBasis;
  subjectName: string | null;
  paperworkDueAt: string | null;
  paperworkReceivedAt: string | null;
  overdue: boolean;
}
