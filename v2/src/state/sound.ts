// Sound settings: which input the ears open, which MIDI port to listen to,
// and — in a browser — which microphone. Kept between launches.

import { storageKey } from './storage';

export interface SoundSettings {
  /** desktop: the interface, by name; null is the system default */
  deviceId: string | null;
  /** 0-based input on that device; -1 mixes every input down */
  channel: number;
  /** desktop: the MIDI port, by name; null is the first one there is */
  midiPort: string | null;
  /** browser: getUserMedia's deviceId; null is whatever the browser prefers */
  micId: string | null;
}

const KEY = storageKey('sound');
export const DEFAULT_SOUND: SoundSettings = { deviceId: null, channel: 0, midiPort: null, micId: null };

export function loadSound(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SOUND, ...(JSON.parse(raw) as Partial<SoundSettings>) } : DEFAULT_SOUND;
  }
  catch {
    return DEFAULT_SOUND;
  }
}

export function saveSound(s: SoundSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  catch {
    // storage unavailable — the choice lasts the session
  }
}

/** The label for an input channel choice. */
export const channelLabel = (channel: number): string => (channel < 0 ? 'Mix' : `${channel + 1}`);
