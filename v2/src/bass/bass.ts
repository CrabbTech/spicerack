// 4-string bass guitar (E1 A1 D2 G2): every chord becomes a root–fifth–octave
// box anchored on the lowest practical root, and the scale helpers are the
// guitar ones re-tuned. Shapes are validated by bass.test.ts.

import { mod12, notePc } from '../theory/notes';
import { Chord } from '../theory/chords';
import { Fret } from '../guitar/shapes';
import { FretboardNote, scaleBox, scaleFretboard } from '../guitar/voicing';

/** standard bass tuning, low E first */
export const BASS_OPEN_MIDI = [28, 33, 38, 43]; // E1 A1 D2 G2
export const BASS_OPEN_PC = [4, 9, 2, 7];
export const BASS_STRING_NAMES = ['E', 'A', 'D', 'G'];
export const BASS_MAX_FRET = 15;

export interface BassShape {
  /** one fret per string, low E first; 'x' = unused */
  frets: Fret[];
  /** root, fifth, octave — ascending, the notes a bassist leans on */
  midis: number[];
  label: string;
  rootString: number;
}

/**
 * Root–fifth–octave box for a chord. In fourths tuning the fifth sits two
 * frets up on the next string and the octave two frets up two strings over,
 * so the root only ever lands on the E or A string.
 */
export function bassShape(chord: Chord): BassShape {
  const rootPc = notePc(chord.bass ?? chord.root);
  // honor the chord's real fifth (dim/aug) unless we're on a slash bass
  const fifthTone = chord.bass ? undefined : chord.quality.tones.find((t) => t.degree === 5);
  const fifthSemis = fifthTone?.semitones ?? 7;
  const fe = mod12(rootPc - BASS_OPEN_PC[0]);
  const fa = mod12(rootPc - BASS_OPEN_PC[1]);
  const rootString = fa < fe ? 1 : 0;
  const f = rootString === 1 ? fa : fe;
  const fifthFret = f + (fifthSemis - 5);
  const frets: Fret[] = ['x', 'x', 'x', 'x'];
  frets[rootString] = f;
  frets[rootString + 1] = fifthFret;
  frets[rootString + 2] = f + 2;
  return {
    frets,
    midis: [
      BASS_OPEN_MIDI[rootString] + f,
      BASS_OPEN_MIDI[rootString + 1] + fifthFret,
      BASS_OPEN_MIDI[rootString + 2] + f + 2,
    ],
    rootString,
    label: f === 0 ? 'open position' : `${f}fr · root on ${BASS_STRING_NAMES[rootString]}`,
  };
}

export const bassScaleFretboard = (tonicPc: number, pcs: number[]): FretboardNote[] =>
  scaleFretboard(tonicPc, pcs, BASS_MAX_FRET, BASS_OPEN_PC);

export const bassScaleBox = (tonicPc: number, pcs: number[]): FretboardNote[] =>
  scaleBox(tonicPc, pcs, BASS_OPEN_PC);
