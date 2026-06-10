// Guitar chord grips. Movable shapes are written as fret offsets relative to
// the root fret on the shape's root string; open grips are absolute. Every
// shape is validated against its chord formula by guitar.test.ts.

import { QualityId } from '../theory/chords';

/** standard tuning, low E first */
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
export const OPEN_PC = [4, 9, 2, 7, 11, 4];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export type Fret = number | 'x';

export interface MovableShape {
  quality: QualityId;
  /** string index carrying the root: 0 = low E, 1 = A, 2 = D */
  rootString: 0 | 1 | 2;
  /** offsets from root fret per string, low E first; 'x' = muted */
  offsets: Fret[];
  label: string;
}

const M = (quality: QualityId, rootString: 0 | 1 | 2, offsets: Fret[], label: string): MovableShape =>
  ({ quality, rootString, offsets, label });

export const MOVABLE_SHAPES: MovableShape[] = [
  // --- root on the 6th string (E shapes) ---
  M('maj', 0, [0, 2, 2, 1, 0, 0], 'E shape'),
  M('min', 0, [0, 2, 2, 0, 0, 0], 'Em shape'),
  M('pow', 0, [0, 2, 2, 'x', 'x', 'x'], 'root-6 power'),
  M('dom7', 0, [0, 2, 0, 1, 0, 0], 'E7 shape'),
  M('maj7', 0, [0, 'x', 1, 1, 0, 'x'], 'root-6 maj7'),
  M('m7', 0, [0, 'x', 0, 0, 0, 'x'], 'root-6 m7'),
  M('m7', 0, [0, 2, 0, 0, 0, 0], 'Em7 barre'),
  M('m9', 0, [0, 'x', 0, 0, 0, 2], 'root-6 m9'),
  M('m11', 0, [0, 0, 0, 0, 'x', 'x'], 'root-6 m11'),
  M('m7b5', 0, [0, 'x', 0, 0, -1, 'x'], 'root-6 ø7'),
  M('sus4', 0, [0, 2, 2, 2, 0, 0], 'root-6 sus4'),
  M('dom7sus4', 0, [0, 2, 0, 2, 0, 0], 'root-6 7sus4'),
  M('dom13', 0, [0, 'x', 0, 1, 2, 2], 'root-6 13'),
  M('maj7s11', 0, [0, 'x', 1, 1, -1, 'x'], 'root-6 maj7♯11'),
  M('add9', 0, [0, 2, 2, 1, 0, 2], 'root-6 add9'),

  // --- root on the 5th string (A shapes) ---
  M('maj', 1, ['x', 0, 2, 2, 2, 0], 'A shape'),
  M('min', 1, ['x', 0, 2, 2, 1, 0], 'Am shape'),
  M('pow', 1, ['x', 0, 2, 2, 'x', 'x'], 'root-5 power'),
  M('dom7', 1, ['x', 0, 2, 0, 2, 0], 'A7 shape'),
  M('maj7', 1, ['x', 0, 2, 1, 2, 0], 'root-5 maj7'),
  M('m7', 1, ['x', 0, 2, 0, 1, 0], 'root-5 m7'),
  M('mMaj7', 1, ['x', 0, 2, 1, 1, 0], 'root-5 m(maj7)'),
  M('dom9', 1, ['x', 0, -1, 0, 0, 0], 'funk 9 grip'),
  M('maj9', 1, ['x', 0, -1, 1, 0, 'x'], 'root-5 maj9'),
  M('m9', 1, ['x', 0, -2, 0, 0, 0], 'root-5 m9'),
  M('m11', 1, ['x', 0, 0, 0, 1, 0], 'root-5 m11'),
  M('six', 1, ['x', 0, 2, 2, 2, 2], 'root-5 6'),
  M('m6', 1, ['x', 0, 2, 2, 1, 2], 'root-5 m6'),
  M('sus2', 1, ['x', 0, 2, 2, 0, 0], 'root-5 sus2'),
  M('sus4', 1, ['x', 0, 2, 2, 3, 0], 'root-5 sus4'),
  M('dom7sus4', 1, ['x', 0, 2, 0, 3, 0], 'root-5 7sus4'),
  M('add9', 1, ['x', 0, 2, 4, 2, 0], 'root-5 add9'),
  M('dim', 1, ['x', 0, 1, 2, 1, 'x'], 'root-5 dim'),
  M('dim7', 1, ['x', 0, 1, -1, 1, 'x'], 'root-5 dim7'),
  M('m7b5', 1, ['x', 0, 1, 0, 1, 'x'], 'root-5 ø7'),
  M('aug', 1, ['x', 0, 3, 2, 2, 'x'], 'root-5 aug'),
  M('dom7s9', 1, ['x', 0, -1, 0, 1, 'x'], 'Hendrix grip'),
  M('dom7b9', 1, ['x', 0, -1, 0, -1, 'x'], 'root-5 7♭9'),
  M('dom13', 1, ['x', 0, -1, 0, 0, 2], 'root-5 13'),

  // --- root on the 4th string (D shapes) ---
  M('maj', 2, ['x', 'x', 0, 2, 3, 2], 'D shape'),
  M('min', 2, ['x', 'x', 0, 2, 3, 1], 'Dm shape'),
  M('pow', 2, ['x', 'x', 0, 2, 3, 'x'], 'root-4 power'),
  M('dom7', 2, ['x', 'x', 0, 2, 1, 2], 'D7 shape'),
  M('maj7', 2, ['x', 'x', 0, 2, 2, 2], 'root-4 maj7'),
  M('m7', 2, ['x', 'x', 0, 2, 1, 1], 'root-4 m7'),
  M('six', 2, ['x', 'x', 0, 2, 0, 2], 'root-4 6'),
  M('dim7', 2, ['x', 'x', 0, 1, 0, 1], 'root-4 dim7'),
  M('sus2', 2, ['x', 'x', 0, 2, 3, 0], 'root-4 sus2'),
  M('sus4', 2, ['x', 'x', 0, 2, 3, 3], 'root-4 sus4'),
];

export interface OpenGrip {
  rootPc: number;
  quality: QualityId;
  frets: Fret[];
}

const O = (rootPc: number, quality: QualityId, frets: Fret[]): OpenGrip => ({ rootPc, quality, frets });

export const OPEN_GRIPS: OpenGrip[] = [
  O(0, 'maj', ['x', 3, 2, 0, 1, 0]),   // C
  O(9, 'maj', ['x', 0, 2, 2, 2, 0]),   // A
  O(7, 'maj', [3, 2, 0, 0, 0, 3]),     // G
  O(4, 'maj', [0, 2, 2, 1, 0, 0]),     // E
  O(2, 'maj', ['x', 'x', 0, 2, 3, 2]), // D
  O(9, 'min', ['x', 0, 2, 2, 1, 0]),   // Am
  O(4, 'min', [0, 2, 2, 0, 0, 0]),     // Em
  O(2, 'min', ['x', 'x', 0, 2, 3, 1]), // Dm
  O(9, 'dom7', ['x', 0, 2, 0, 2, 0]),  // A7
  O(11, 'dom7', ['x', 2, 1, 2, 0, 2]), // B7
  O(0, 'dom7', ['x', 3, 2, 3, 1, 0]),  // C7
  O(2, 'dom7', ['x', 'x', 0, 2, 1, 2]),// D7
  O(4, 'dom7', [0, 2, 0, 1, 0, 0]),    // E7
  O(7, 'dom7', [3, 2, 0, 0, 0, 1]),    // G7
  O(0, 'maj7', ['x', 3, 2, 0, 0, 0]),  // Cmaj7
  O(9, 'maj7', ['x', 0, 2, 1, 2, 0]),  // Amaj7
  O(2, 'maj7', ['x', 'x', 0, 2, 2, 2]),// Dmaj7
  O(5, 'maj7', ['x', 'x', 3, 2, 1, 0]),// Fmaj7
  O(7, 'maj7', [3, 2, 0, 0, 0, 2]),    // Gmaj7
  O(4, 'maj7', [0, 2, 1, 1, 0, 0]),    // Emaj7
  O(9, 'm7', ['x', 0, 2, 0, 1, 0]),    // Am7
  O(4, 'm7', [0, 2, 0, 0, 0, 0]),      // Em7
  O(2, 'm7', ['x', 'x', 0, 2, 1, 1]),  // Dm7
  O(9, 'sus2', ['x', 0, 2, 2, 0, 0]),  // Asus2
  O(2, 'sus2', ['x', 'x', 0, 2, 3, 0]),// Dsus2
  O(9, 'sus4', ['x', 0, 2, 2, 3, 0]),  // Asus4
  O(2, 'sus4', ['x', 'x', 0, 2, 3, 3]),// Dsus4
  O(4, 'sus4', [0, 2, 2, 2, 0, 0]),    // Esus4
  O(9, 'dom7sus4', ['x', 0, 2, 0, 3, 0]), // A7sus4
  O(4, 'dom7sus4', [0, 2, 0, 2, 0, 0]),   // E7sus4
  O(2, 'dom7sus4', ['x', 'x', 0, 2, 1, 3]), // D7sus4
  O(0, 'add9', ['x', 3, 2, 0, 3, 0]),  // Cadd9
  O(4, 'add9', [0, 2, 2, 1, 0, 2]),    // Eadd9
];
