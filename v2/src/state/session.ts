// Resume where you left off: the whole song — every section's chords and
// melody, the key, the workspace — is written to localStorage as it changes
// and picked up again on the next launch (unless a deep link says otherwise).

import { SavedSection } from '../ui/LibraryModal';
import { storageKey } from './storage';

export interface SavedSession {
  tonicIdx: number;
  genreId: string;
  mode: string;
  instrument: string;
  octaveShift: number;
  bpm: number | null;
  view: string;
  scaleIdx: number;
  activeSection: number;
  arrangement: number[];
  sections: SavedSection[];
}

const KEY = storageKey('session');

export function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  }
  catch {
    // storage full or unavailable — resuming is a nicety, never a blocker
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSession;
    return Array.isArray(s.sections) && s.sections.length && s.sections.every((sec) => Array.isArray(sec.slots) && sec.slots.length >= 2) ? s : null;
  }
  catch {
    return null;
  }
}
