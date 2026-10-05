// UI mirror of server/services/riderRules.js. The server enforces every rule;
// this only decides what to show.
export type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
export type GenderPreference = 'ANY' | 'WOMEN_PLUS';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export const GENDER_HELP = 'Used only for Women+ trips. Never shown to other users. You can change it anytime.';

export const WHO_CAN_JOIN_OPTIONS: { value: GenderPreference; label: string }[] = [
  { value: 'ANY', label: 'Anyone' },
  { value: 'WOMEN_PLUS', label: 'Women+ only (women and non-binary riders)' },
];

export const TRIPS_I_SEE_OPTIONS: { value: GenderPreference; label: string }[] = [
  { value: 'ANY', label: 'All trips' },
  { value: 'WOMEN_PLUS', label: 'Women+ trips only' },
];

const WOMEN_PLUS: readonly string[] = ['WOMAN', 'NON_BINARY'];

export function isGender(v: unknown): v is Gender {
  return GENDER_OPTIONS.some((o) => o.value === v);
}

export function isWomenPlusEligible(g: string | null | undefined): boolean {
  return g != null && WOMEN_PLUS.includes(g);
}

export function whoCanJoinLabel(pref: string): string {
  return pref === 'WOMEN_PLUS' ? 'Women+ only' : 'Anyone';
}

// The join warning (Women+ spec §7): only a rider who chose Women+ trips,
// joining a trip that is open to everyone.
export function needsOpenTripWarning(tripPref: string, riderPref: string): boolean {
  return riderPref === 'WOMEN_PLUS' && tripPref !== 'WOMEN_PLUS';
}

// The trip's rules, never a person's gender.
export function ruleBadges(trip: { genderPreference: string; familiarRidersOnly?: boolean }): string[] {
  const badges: string[] = [];
  if (trip.genderPreference === 'WOMEN_PLUS') badges.push('Women+ trip');
  if (trip.familiarRidersOnly) badges.push('Familiar riders only');
  return badges;
}

export function genderChangeMessage(error: string, body: { pendingCount?: number }): string | null {
  if (error === 'HOSTING_WOMEN_PLUS_TRIPS') return "You're hosting Women+ trips. Finish or cancel them first.";
  if (error === 'CONFIRM_WITHDRAW_PENDING') {
    const n = body.pendingCount ?? 0;
    return n === 1
      ? 'Changing this will withdraw your 1 pending request on a Women+ trip. Continue?'
      : `Changing this will withdraw your ${n} pending requests on Women+ trips. Continue?`;
  }
  return null;
}
