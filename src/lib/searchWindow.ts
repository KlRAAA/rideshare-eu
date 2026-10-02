// How many minutes either side of the passenger's preferred time a ride may
// leave and still match (the PSGA's passenger flex window). Off uses the
// manuscript's default window, the same 15 minutes as psgaConfig's
// defaultFlexWindowMinutes; the Flexible Time toggle widens it. Never 0: a
// zero window only matched rides leaving at exactly the typed minute.
export const DEFAULT_FLEX_WINDOW_MINUTES = 15;
export const WIDE_FLEX_WINDOW_MINUTES = 30;

export function searchFlexWindow(flexible: boolean): number {
  return flexible ? WIDE_FLEX_WINDOW_MINUTES : DEFAULT_FLEX_WINDOW_MINUTES;
}
