// Scales, modes and keys. A scale step carries both its diatonic degree
// (which fixes the letter it is spelled with) and its distance in semitones.

import {
  LETTERS, Letter, NoteName, PitchClass,
  letterIndex, mod7, mod12, notePc, spellWithLetter,
} from './notes';

export interface ScaleStep {
  /** written degree: 1..7 (9/11/13 never appear in scales) */
  degree: number;
  semitones: number;
}

export type ScaleId =
  | 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian'
  | 'harmonicMinor' | 'melodicMinor' | 'phrygianDominant'
  | 'majorPent' | 'minorPent' | 'blues';

export interface ScaleDef {
  id: ScaleId;
  name: string;
  steps: ScaleStep[];
  /** short formula shown in UI, e.g. "1 ♭3 4 5 ♭7" */
  formula: string;
}

const S = (degree: number, semitones: number): ScaleStep => ({ degree, semitones });

export const SCALES: Record<ScaleId, ScaleDef> = {
  major: {
    id: 'major', name: 'Major (Ionian)', formula: '1 2 3 4 5 6 7',
    steps: [S(1, 0), S(2, 2), S(3, 4), S(4, 5), S(5, 7), S(6, 9), S(7, 11)],
  },
  minor: {
    id: 'minor', name: 'Natural minor (Aeolian)', formula: '1 2 ♭3 4 5 ♭6 ♭7',
    steps: [S(1, 0), S(2, 2), S(3, 3), S(4, 5), S(5, 7), S(6, 8), S(7, 10)],
  },
  dorian: {
    id: 'dorian', name: 'Dorian', formula: '1 2 ♭3 4 5 6 ♭7',
    steps: [S(1, 0), S(2, 2), S(3, 3), S(4, 5), S(5, 7), S(6, 9), S(7, 10)],
  },
  phrygian: {
    id: 'phrygian', name: 'Phrygian', formula: '1 ♭2 ♭3 4 5 ♭6 ♭7',
    steps: [S(1, 0), S(2, 1), S(3, 3), S(4, 5), S(5, 7), S(6, 8), S(7, 10)],
  },
  lydian: {
    id: 'lydian', name: 'Lydian', formula: '1 2 3 ♯4 5 6 7',
    steps: [S(1, 0), S(2, 2), S(3, 4), S(4, 6), S(5, 7), S(6, 9), S(7, 11)],
  },
  mixolydian: {
    id: 'mixolydian', name: 'Mixolydian', formula: '1 2 3 4 5 6 ♭7',
    steps: [S(1, 0), S(2, 2), S(3, 4), S(4, 5), S(5, 7), S(6, 9), S(7, 10)],
  },
  harmonicMinor: {
    id: 'harmonicMinor', name: 'Harmonic minor', formula: '1 2 ♭3 4 5 ♭6 7',
    steps: [S(1, 0), S(2, 2), S(3, 3), S(4, 5), S(5, 7), S(6, 8), S(7, 11)],
  },
  melodicMinor: {
    id: 'melodicMinor', name: 'Melodic minor', formula: '1 2 ♭3 4 5 6 7',
    steps: [S(1, 0), S(2, 2), S(3, 3), S(4, 5), S(5, 7), S(6, 9), S(7, 11)],
  },
  phrygianDominant: {
    id: 'phrygianDominant', name: 'Phrygian dominant', formula: '1 ♭2 3 4 5 ♭6 ♭7',
    steps: [S(1, 0), S(2, 1), S(3, 4), S(4, 5), S(5, 7), S(6, 8), S(7, 10)],
  },
  majorPent: {
    id: 'majorPent', name: 'Major pentatonic', formula: '1 2 3 5 6',
    steps: [S(1, 0), S(2, 2), S(3, 4), S(5, 7), S(6, 9)],
  },
  minorPent: {
    id: 'minorPent', name: 'Minor pentatonic', formula: '1 ♭3 4 5 ♭7',
    steps: [S(1, 0), S(3, 3), S(4, 5), S(5, 7), S(7, 10)],
  },
  blues: {
    id: 'blues', name: 'Blues scale', formula: '1 ♭3 4 ♭5 5 ♭7',
    steps: [S(1, 0), S(3, 3), S(4, 5), S(5, 6), S(5, 7), S(7, 10)],
  },
};

/** Spell a scale from a tonic. Letters follow the written degrees. */
export function spellScale(tonic: NoteName, def: ScaleDef): NoteName[] {
  const tonicIdx = letterIndex(tonic.letter);
  const tonicPc = notePc(tonic);
  return def.steps.map((step) => {
    const letter: Letter = LETTERS[mod7(tonicIdx + step.degree - 1)];
    return spellWithLetter(letter, mod12(tonicPc + step.semitones));
  });
}

export function scalePcs(tonic: NoteName, def: ScaleDef): PitchClass[] {
  const tonicPc = notePc(tonic);
  return def.steps.map((s) => mod12(tonicPc + s.semitones));
}

// ---------------------------------------------------------------------------
// Keys (tonic + mode). Modes a progression can be written in.

export type ModeId = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian';

export interface Key {
  tonic: NoteName;
  mode: ModeId;
}

export const MODE_NAMES: Record<ModeId, string> = {
  major: 'Major', minor: 'Minor', dorian: 'Dorian',
  phrygian: 'Phrygian', lydian: 'Lydian', mixolydian: 'Mixolydian',
};

/** The 7 notes of the key's mode. */
export const keyScale = (key: Key): NoteName[] => spellScale(key.tonic, SCALES[key.mode]);

/** Major scale of the tonic — the reference grid roman numerals are measured against. */
export const tonicMajorScale = (tonic: NoteName): NoteName[] => spellScale(tonic, SCALES.major);

/** True when the key's mode has a minor third (i, dorian, phrygian...). */
export const isMinorish = (mode: ModeId): boolean =>
  mode === 'minor' || mode === 'dorian' || mode === 'phrygian';

/** Whether to prefer flat spellings for chromatic notes in this key. */
export function flatLeaning(key: Key): boolean {
  const sig = keyScale(key).reduce((acc, n) => acc + n.alter, 0);
  return sig < 0;
}

/** Tonic choices offered in the key picker. */
export const TONIC_CHOICES: NoteName[] = [
  { letter: 'C', alter: 0 },
  { letter: 'D', alter: -1 },
  { letter: 'D', alter: 0 },
  { letter: 'E', alter: -1 },
  { letter: 'E', alter: 0 },
  { letter: 'F', alter: 0 },
  { letter: 'F', alter: 1 },
  { letter: 'G', alter: 0 },
  { letter: 'A', alter: -1 },
  { letter: 'A', alter: 0 },
  { letter: 'B', alter: -1 },
  { letter: 'B', alter: 0 },
];
