import { describe, test, expect } from '@jest/globals';
import { saveDraft, loadDraft, clearDraft, DRAFT_MAX_AGE_MS, type DraftStore } from '../formDraft';

function memoryStore(): DraftStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => void raw.set(k, v),
    removeItem: (k) => void raw.delete(k),
  };
}

describe('form drafts', () => {
  test('saves and restores a draft', () => {
    const store = memoryStore();
    saveDraft(store, 'post-trip:new', { origin: 'Sariaya', seats: 2, pin: { lat: 13.9, lng: 121.5 } });
    expect(loadDraft(store, 'post-trip:new')).toEqual({ origin: 'Sariaya', seats: 2, pin: { lat: 13.9, lng: 121.5 } });
  });

  test('never stores passwords, codes or tickets, whatever the caller passes', () => {
    const store = memoryStore();
    saveDraft(store, 'register', {
      email: 'a@student.mseuf.edu.ph',
      password: 'secret123',
      confirmPassword: 'secret123',
      otp: '123456',
      verificationTicket: 'ticket',
    });
    const stored = [...store.raw.values()].join('');
    expect(stored).not.toMatch(/secret123|123456|ticket/);
    expect(loadDraft(store, 'register')).toEqual({ email: 'a@student.mseuf.edu.ph' });
  });

  test('drops fields the caller lists in omit', () => {
    const store = memoryStore();
    saveDraft(store, 'x', { keep: 1, drop: 2 }, ['drop']);
    expect(loadDraft(store, 'x')).toEqual({ keep: 1 });
  });

  test('an expired draft is discarded', () => {
    const store = memoryStore();
    saveDraft(store, 'x', { a: 1 }, [], Date.now() - DRAFT_MAX_AGE_MS - 1000);
    expect(loadDraft(store, 'x')).toBeNull();
    expect(store.raw.size).toBe(0);
  });

  test('corrupt or foreign data is discarded instead of throwing', () => {
    const store = memoryStore();
    store.setItem('rsu-draft:x', '{not json');
    expect(loadDraft(store, 'x')).toBeNull();
    store.setItem('rsu-draft:y', JSON.stringify({ v: 999, savedAt: Date.now(), data: { a: 1 } }));
    expect(loadDraft(store, 'y')).toBeNull();
  });

  test('clearDraft removes only that draft', () => {
    const store = memoryStore();
    saveDraft(store, 'a', { v: 1 });
    saveDraft(store, 'b', { v: 2 });
    clearDraft(store, 'a');
    expect(loadDraft(store, 'a')).toBeNull();
    expect(loadDraft(store, 'b')).toEqual({ v: 2 });
  });

  test('a storage that throws (private mode, quota) is tolerated', () => {
    const broken: DraftStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveDraft(broken, 'x', { a: 1 })).not.toThrow();
    expect(loadDraft(broken, 'x')).toBeNull();
    expect(() => clearDraft(broken, 'x')).not.toThrow();
  });
});
