// The transcribed-score schema. A screenshot of sheet music becomes one of
// these objects (see docs/adding-a-song.md); everything downstream — OP-1 key
// tags, voicings, the printed tab, playback, MIDI — is compiled from it.
//
// Design rule: a Score records what the PAGE says (chord symbols, written
// pitches, repeats), never OP-1 specifics. The compiler owns the hardware.

import { KeySig } from '../theory/harmony';

/** Current schema version; bumped only on a breaking shape change. */
export const SCORE_SCHEMA = 1;

/** One written note. `beat` is 0-based inside its bar, `dur` is in beats. */
export interface NoteEvent {
  beat: number;
  dur: number;
  /** scientific pitch as written, e.g. 'Db3', 'Bbb2', 'F#5' */
  note: string;
  /** grace/ghost notes render dimmer and export quieter */
  ghost?: boolean;
}

/**
 * Named accompaniment patterns, used when the page has a figure you can hear
 * but the screenshot is too coarse to read note-for-note. Rendered from the
 * bar's own chord tones — see figures.ts.
 */
export type FigureId =
  | 'up-down-8ths'
  | 'arp-up-8ths'
  | 'arp-down-8ths'
  | 'root-fifth-quarters'
  | 'root-8ths'
  | 'held';

export interface Bar {
  /** chord token: a symbol ('Bbm7/Db') or a numeral ('vi7', 'V7/vi') */
  chord: string;
  /**
   * The note printed lowest, when the page dictates it: a slash chord's bass
   * comes from the symbol, but a root-position chord in a walking bass line is
   * worth pinning too. Omit to let the voicing fitter choose the inversion.
   */
  bass?: string;
  /** beats in this bar; defaults to the score's meter */
  beats?: number;
  /** volta bracket: 1 = first ending, 2 = second… */
  ending?: number;
  /** printed above the bar, e.g. 'to Coda', 'rit.' */
  mark?: string;
  /** the written top line for this bar (empty/absent = rests) */
  melody?: NoteEvent[];
  /** the written lower part for this bar */
  left?: NoteEvent[];
  /** stand-in pattern for an unread lower part; ignored when `left` is set */
  figure?: FigureId;
}

export interface Section {
  id: string;
  /** as printed on the page: 'INTRO', 'VERSE 1', 'CHORUS' */
  name: string;
  /** total times through, counting the first (repeat sign → 2) */
  repeat?: number;
  /** force a hardware octave shift instead of letting the compiler choose */
  octaveShift?: number;
  /** default figure for bars that set neither `left` nor `figure` */
  figure?: FigureId;
  /** performance note printed under the section heading */
  note?: string;
  bars: Bar[];
}

export interface Score {
  schema?: number;
  id: string;
  title: string;
  artist?: string;
  /** where the transcription came from, e.g. 'screenshot, 2026-08-30' */
  source?: string;
  key: KeySig;
  bpm: number;
  /** tempo/feel words off the page, e.g. 'Laid-back' */
  feel?: string;
  /** [beats per bar, beat unit]; only 4/4-style beat units are printed */
  meter?: [number, number];
  /** hardware octave shift for the whole song, unless a section overrides */
  octaveShift?: number;
  /**
   * The source screenshot, shown above the keyboard in the app: a path under
   * public/ ('scores/my-song.png') for committed songs, or a data: URL for
   * imported ones. Optional — the tab works without it.
   */
  image?: string;
  /** honest notes about what is transcribed vs. guessed — printed on the tab */
  caveats?: string[];
  sections: Section[];
}

export const DEFAULT_METER: [number, number] = [4, 4];

export const barBeats = (bar: Bar, score: Score): number =>
  bar.beats ?? (score.meter ?? DEFAULT_METER)[0];

export const sectionPasses = (section: Section): number =>
  Math.max(1, Math.round(section.repeat ?? 1));
