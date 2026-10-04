// Who may join and who may host a trip (Women+ spec §5). Pure functions, so
// every entry point — search, show-all, join, approve, trip create/edit/detail,
// preferences — applies the same rule. Mirrored for the UI in
// src/lib/riderRules.ts.
const GENDERS = ['WOMAN', 'MAN', 'NON_BINARY', 'PREFER_NOT_TO_SAY'];
const WOMEN_PLUS_GENDERS = ['WOMAN', 'NON_BINARY'];
const GENDER_PREFERENCES = ['ANY', 'WOMEN_PLUS'];
const LEGACY_GENDERS = { FEMALE: 'WOMAN', MALE: 'MAN', UNSPECIFIED: 'PREFER_NOT_TO_SAY' };

function normalizeGender(value) {
  if (GENDERS.includes(value)) return value;
  return LEGACY_GENDERS[value] || 'PREFER_NOT_TO_SAY';
}

function isWomenPlusEligible(gender) {
  return WOMEN_PLUS_GENDERS.includes(normalizeGender(gender));
}

function canHostWomenPlus(host) {
  return Boolean(host) && isWomenPlusEligible(host.gender);
}

// Worded around the trip's rule, never another person's gender.
function joinBlockReason(trip, rider) {
  if (trip.genderPreference === 'WOMEN_PLUS' && !isWomenPlusEligible(rider.gender)) return 'TRIP_WOMEN_PLUS_ONLY';
  if (trip.familiarRidersOnly && !rider.familiarWithHost) return 'TRIP_FAMILIAR_RIDERS_ONLY';
  return null;
}

function canJoin(trip, rider) {
  return joinBlockReason(trip, rider) === null;
}

// A stored or submitted "Trips I see" value, made safe: anything unknown, and
// Women+ for someone who isn't eligible, reads as ANY.
function effectivePreference(pref, gender) {
  return pref === 'WOMEN_PLUS' && isWomenPlusEligible(gender) ? 'WOMEN_PLUS' : 'ANY';
}

module.exports = {
  GENDERS,
  GENDER_PREFERENCES,
  normalizeGender,
  isWomenPlusEligible,
  canHostWomenPlus,
  joinBlockReason,
  canJoin,
  effectivePreference,
};
