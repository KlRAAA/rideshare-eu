import { useCallback, useEffect, useRef, useState } from 'react';
import { browserDraftStore, clearDraft, loadDraft, saveDraft } from './formDraft';

const SAVE_DELAY_MS = 400;

interface Options<T> {
  // Called once on mount with the saved draft, if any.
  onRestore: (draft: Partial<T>) => void;
  omit?: readonly string[];
  enabled?: boolean;
}

// Autosaves `values` under `key` once the user has touched the form, restores
// them on the next mount, and exposes `clear` (after a successful submit) and
// `discard` (the user's "start over").
//
// Saving waits for markDirty() because forms also fill themselves in (default
// car, official fuel price); saving those would turn an untouched form into a
// "restored draft" on the next visit.
export function useFormDraft<T extends object>(key: string, values: T, { onRestore, omit = [], enabled = true }: Options<T>) {
  const [restored, setRestored] = useState(false);
  const dirty = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    if (!enabled) return;
    const store = browserDraftStore();
    const draft = store ? loadDraft<T>(store, key) : null;
    if (draft && Object.keys(draft).length > 0) {
      onRestoreRef.current(draft);
      setRestored(true);
    }
  }, [key, enabled]);

  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (!enabled || !dirty.current) return;
    const store = browserDraftStore();
    if (!store) return;
    const t = setTimeout(() => saveDraft(store, key, JSON.parse(serialized), omit), SAVE_DELAY_MS);
    return () => clearTimeout(t);
    // omit is a static list per form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, key, enabled]);

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);

  const clear = useCallback(() => {
    dirty.current = false;
    const store = browserDraftStore();
    if (store) clearDraft(store, key);
  }, [key]);

  const discard = useCallback(() => {
    clear();
    window.location.reload();
  }, [clear]);

  return { restored, markDirty, clear, discard };
}
