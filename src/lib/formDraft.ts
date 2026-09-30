// Autosaved form drafts, so an accidental "back" or reload doesn't wipe a
// half-filled form. Kept in sessionStorage by the caller: per tab and gone
// when the tab closes, which suits shared phones.

export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'rsu-draft:';
const VERSION = 1;
export const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// Never written to storage, whatever a form passes in.
const SECRET_FIELD = /password|otp|ticket|token/i;

export function saveDraft<T extends object>(
  store: DraftStore,
  key: string,
  data: T,
  omit: readonly string[] = [],
  now: number = Date.now()
): void {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([field]) => !omit.includes(field) && !SECRET_FIELD.test(field))
  );
  try {
    store.setItem(PREFIX + key, JSON.stringify({ v: VERSION, savedAt: now, data: clean }));
  } catch {
    /* storage full or blocked: drafts are a convenience, never an error */
  }
}

export function loadDraft<T extends object>(store: DraftStore, key: string, now: number = Date.now()): Partial<T> | null {
  let raw: string | null;
  try {
    raw = store.getItem(PREFIX + key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const fresh = parsed?.v === VERSION && typeof parsed.savedAt === 'number' && now - parsed.savedAt <= DRAFT_MAX_AGE_MS;
    if (fresh && parsed.data && typeof parsed.data === 'object') return parsed.data as Partial<T>;
  } catch {
    /* fall through to discard */
  }
  clearDraft(store, key);
  return null;
}

export function clearDraft(store: DraftStore, key: string): void {
  try {
    store.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

// sessionStorage, or null where it's unavailable (SSR, blocked site data).
export function browserDraftStore(): DraftStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
