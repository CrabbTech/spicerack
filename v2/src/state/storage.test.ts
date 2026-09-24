import { beforeEach, describe, expect, it } from 'vitest';
import { migrateStorage, storageKey } from './storage';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('storage under the app name', () => {
  beforeEach(() => { (globalThis as { localStorage: Storage }).localStorage = fakeStorage(); });

  it('keys carry the name', () => {
    expect(storageKey('session')).toBe('quire.session');
  });

  it('carries the old name’s keys over once, never overwriting', () => {
    localStorage.setItem('spicerack2.session', '{"a":1}');
    localStorage.setItem('spicerack2.progress', 'old');
    localStorage.setItem('quire.progress', 'new');
    migrateStorage();
    expect(localStorage.getItem('quire.session')).toBe('{"a":1}');
    expect(localStorage.getItem('quire.progress')).toBe('new');
    // the old copy stays, so an older build still finds its data
    expect(localStorage.getItem('spicerack2.session')).toBe('{"a":1}');
  });

  it('is a no-op without storage', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => migrateStorage()).not.toThrow();
  });
});
