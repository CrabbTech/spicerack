// localStorage, under the app's own name — and a one-time carry-over from the
// name it had before, so a rename never costs anyone their song, their
// progress or their library.

import { BRAND } from '../brand';

export const storageKey = (name: string): string => `${BRAND.storagePrefix}.${name}`;

const NAMES = ['session', 'progress', 'library', 'customGenres', 'licks', 'practice', 'labels', 'lefty', 'journal'];

/** Copy every old key that has no new counterpart yet. Runs before anything reads storage. */
export function migrateStorage(): void {
  try {
    for (const name of NAMES) {
      const to = storageKey(name);
      if (localStorage.getItem(to) !== null) continue;
      const old = localStorage.getItem(`${BRAND.legacyStoragePrefix}.${name}`);
      if (old !== null) localStorage.setItem(to, old);
    }
  }
  catch {
    // storage unavailable — nothing to carry over
  }
}
