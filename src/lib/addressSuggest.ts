// Shared by the address field (AddressInput) and its tests.

export interface PlaceSuggestion {
  label: string; // full text that goes into the field
  primary: string; // e.g. "Puregold"
  secondary: string; // e.g. "Doña Aurora Boulevard, Ilayang Iyam, Lucena"
  lat: number;
  lng: number;
}

export const MIN_SUGGEST_LENGTH = 3;
export const SUGGEST_DELAY_MS = 300;

// Arrow keys move through the list and wrap at either end; -1 means nothing
// is highlighted (the text the user typed stays as it is).
export function moveHighlight(current: number, key: 'ArrowDown' | 'ArrowUp', count: number): number {
  if (count === 0) return -1;
  if (key === 'ArrowDown') return current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}

// What a screen reader hears when the list changes.
export function suggestionAnnouncement(count: number): string {
  if (count === 0) return 'No matching places. Keep typing, or set the spot on the map.';
  return `${count} ${count === 1 ? 'suggestion' : 'suggestions'}. Use the up and down arrows to choose, then press Enter.`;
}
