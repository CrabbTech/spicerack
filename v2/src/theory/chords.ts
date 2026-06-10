// Chord qualities and chord objects. A quality's tones carry the written
// degree (1, 3, 5, 7, 9...) so chord tones get spelled with correct letters.

import {
  LETTERS, NoteName, PitchClass,
  letterIndex, mod7, mod12, notePc, noteLabel, simplify, spellWithLetter,
} from './notes';

export type QualityId =
  | 'maj' | 'min' | 'pow' | 'dim' | 'aug' | 'sus2' | 'sus4'
  | 'six' | 'm6' | 'dom7' | 'maj7' | 'm7' | 'mMaj7' | 'dim7' | 'm7b5'
  | 'dom9' | 'maj9' | 'm9' | 'add9' | 'm11' | 'dom13'
  | 'dom7sus4' | 'dom7s9' | 'dom7b9' | 'maj7s11';

export interface ChordTone {
  /** written degree: 1,2,3,4,5,6,7,9,11,13 */
  degree: number;
  semitones: number;
}

export interface ChordQuality {
  id: QualityId;
  /** suffix after the root in the chord symbol, e.g. "m7" */
  symbol: string;
  name: string;
  tones: ChordTone[];
}

const T = (degree: number, semitones: number): ChordTone => ({ degree, semitones });

const Q = (id: QualityId, symbol: string, name: string, tones: ChordTone[]): ChordQuality =>
  ({ id, symbol, name, tones });

export const QUALITIES: Record<QualityId, ChordQuality> = {
  maj: Q('maj', '', 'major', [T(1, 0), T(3, 4), T(5, 7)]),
  min: Q('min', 'm', 'minor', [T(1, 0), T(3, 3), T(5, 7)]),
  pow: Q('pow', '5', 'power chord', [T(1, 0), T(5, 7)]),
  dim: Q('dim', 'dim', 'diminished', [T(1, 0), T(3, 3), T(5, 6)]),
  aug: Q('aug', 'aug', 'augmented', [T(1, 0), T(3, 4), T(5, 8)]),
  sus2: Q('sus2', 'sus2', 'suspended 2nd', [T(1, 0), T(2, 2), T(5, 7)]),
  sus4: Q('sus4', 'sus4', 'suspended 4th', [T(1, 0), T(4, 5), T(5, 7)]),
  six: Q('six', '6', 'major sixth', [T(1, 0), T(3, 4), T(5, 7), T(6, 9)]),
  m6: Q('m6', 'm6', 'minor sixth', [T(1, 0), T(3, 3), T(5, 7), T(6, 9)]),
  dom7: Q('dom7', '7', 'dominant seventh', [T(1, 0), T(3, 4), T(5, 7), T(7, 10)]),
  maj7: Q('maj7', 'maj7', 'major seventh', [T(1, 0), T(3, 4), T(5, 7), T(7, 11)]),
  m7: Q('m7', 'm7', 'minor seventh', [T(1, 0), T(3, 3), T(5, 7), T(7, 10)]),
  mMaj7: Q('mMaj7', 'm(maj7)', 'minor-major seventh', [T(1, 0), T(3, 3), T(5, 7), T(7, 11)]),
  dim7: Q('dim7', 'dim7', 'diminished seventh', [T(1, 0), T(3, 3), T(5, 6), T(7, 9)]),
  m7b5: Q('m7b5', 'm7♭5', 'half-diminished', [T(1, 0), T(3, 3), T(5, 6), T(7, 10)]),
  dom9: Q('dom9', '9', 'dominant ninth', [T(1, 0), T(3, 4), T(5, 7), T(7, 10), T(9, 14)]),
  maj9: Q('maj9', 'maj9', 'major ninth', [T(1, 0), T(3, 4), T(5, 7), T(7, 11), T(9, 14)]),
  m9: Q('m9', 'm9', 'minor ninth', [T(1, 0), T(3, 3), T(5, 7), T(7, 10), T(9, 14)]),
  add9: Q('add9', 'add9', 'added ninth', [T(1, 0), T(3, 4), T(5, 7), T(9, 14)]),
  m11: Q('m11', 'm11', 'minor eleventh', [T(1, 0), T(3, 3), T(5, 7), T(7, 10), T(11, 17)]),
  dom13: Q('dom13', '13', 'dominant thirteenth', [T(1, 0), T(3, 4), T(7, 10), T(9, 14), T(13, 21)]),
  dom7sus4: Q('dom7sus4', '7sus4', 'suspended dominant', [T(1, 0), T(4, 5), T(5, 7), T(7, 10)]),
  dom7s9: Q('dom7s9', '7♯9', 'dominant sharp-nine', [T(1, 0), T(3, 4), T(5, 7), T(7, 10), T(9, 15)]),
  dom7b9: Q('dom7b9', '7♭9', 'dominant flat-nine', [T(1, 0), T(3, 4), T(5, 7), T(7, 10), T(9, 13)]),
  maj7s11: Q('maj7s11', 'maj7♯11', 'major seven sharp-eleven', [T(1, 0), T(3, 4), T(5, 7), T(7, 11), T(11, 18)]),
};

export const isDominantFamily = (q: QualityId): boolean =>
  q === 'dom7' || q === 'dom9' || q === 'dom13' || q === 'dom7sus4' ||
  q === 'dom7s9' || q === 'dom7b9';

/** Harmonic function, used for color coding and teaching copy. */
export type FuncTag = 'tonic' | 'subdominant' | 'dominant' | 'borrowed' | 'secondary';

export interface Chord {
  root: NoteName;
  quality: ChordQuality;
  /** the roman numeral this chord was written as, e.g. "V7/vi" */
  numeral: string;
  func: FuncTag;
  /** for secondary chords: the numeral of the chord it points at, e.g. "vi" */
  secondaryOf?: string;
  /** slash-chord bass, when forced (pedal point spice) */
  bass?: NoteName;
}

/** Spelled chord tones (root first). */
export function chordTones(chord: Chord): NoteName[] {
  const rootIdx = letterIndex(chord.root.letter);
  const rootPc = notePc(chord.root);
  return chord.quality.tones.map((t) =>
    spellWithLetter(LETTERS[mod7(rootIdx + t.degree - 1)], mod12(rootPc + t.semitones)),
  );
}

/** Chord tone pitch classes (root first, deduped). */
export function chordPcs(chord: Chord): PitchClass[] {
  const seen = new Set<PitchClass>();
  const out: PitchClass[] = [];
  for (const t of chord.quality.tones) {
    const pc = mod12(notePc(chord.root) + t.semitones);
    if (!seen.has(pc)) { seen.add(pc); out.push(pc); }
  }
  return out;
}

export function chordSymbol(chord: Chord): string {
  const base = noteLabel(simplify(chord.root)) + chord.quality.symbol;
  return chord.bass ? `${base}/${noteLabel(simplify(chord.bass))}` : base;
}

/** Human note list, e.g. "C–E–G–B♭" (display-simplified). */
export function chordToneLabels(chord: Chord): string[] {
  return chordTones(chord).map((n) => noteLabel(simplify(n)));
}
