// Which notifications get a pop-up, sound and vibration (sub-project F).
// Mirrors server/services/pushService.js LOUD_TYPES.
export const LOUD_TYPES = new Set([
  'MATCH_REQUEST',
  'APPROVAL',
  'CANCELLATION',
  'TRIP_STARTED',
  'MESSAGE',
  'CONFIRM_REQUEST',
  'DRIVER_UNCONFIRMED',
  'DRIVER_LATE',
  'DRIVER_NO_SHOW',
  'TRIP_SKIPPED',
  'LICENSE_APPROVED',
  'LICENSE_REJECTED',
  'DRIVER_ARRIVING',
]);

export function isLoud(type: string): boolean {
  return LOUD_TYPES.has(type);
}

interface FeedNote {
  type: string;
  relatedTripId: string | null;
}

// Loud, except a chat message about the trip whose page is already open.
export function shouldPopUp(n: FeedNote, pathname: string): boolean {
  if (!isLoud(n.type)) return false;
  return !(n.type === 'MESSAGE' && n.relatedTripId && pathname === `/auth/trips/${n.relatedTripId}`);
}

// iPhone Safari allows Web Push only for a site added to the Home Screen.
export function isIosSafari(userAgent: string, standalone: boolean): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) && !standalone;
}

const SOUND_KEY = 'rsu.sound';

// Per device; on unless turned off. Storage can be blocked (private mode).
export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* not saved; stays on */
  }
}
