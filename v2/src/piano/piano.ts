// Standard piano keys: a 25-key right-hand window (C4–C6 at octave shift 0)
// voiced by the same window fitter the OP-1 uses, plus a left-hand root down
// in the C2 octave so chords land like a pianist plays them.

import { mod12, notePc, PitchClass } from '../theory/notes';
import { Chord } from '../theory/chords';
import { Op1Voicing, windowChordVoicing, windowScaleKeys } from '../op1/op1';

/** midi of the leftmost key at octave shift 0 */
export const PIANO_BASE_MIDI = 60; // C4
export const PIANO_KEY_COUNT = 25; // C4 .. C6 inclusive

export interface PianoVoicing extends Op1Voicing {
  /** left-hand root in the C2 octave (before octave shift) */
  lhMidi: number;
}

export function pianoChordVoicing(chord: Chord): PianoVoicing {
  const rh = windowChordVoicing(chord, PIANO_BASE_MIDI, PIANO_KEY_COUNT);
  // the left hand plays the sounding bass (slash chords keep their pedal)
  const lhMidi = 36 + mod12(notePc(chord.bass ?? chord.root)); // C2..B2
  return { ...rh, lhMidi };
}

export const pianoScaleKeys = (tonicPc: PitchClass, pcs: PitchClass[]): { index: number; isRoot: boolean }[] =>
  windowScaleKeys(tonicPc, pcs, PIANO_BASE_MIDI, PIANO_KEY_COUNT);

export const midiToPianoIndex = (midi: number): number => midi - PIANO_BASE_MIDI;

/** Range label like "C4 – C6" for a given octave shift. */
export const pianoRangeLabel = (octaveShift: number): string =>
  `C${4 + octaveShift} – C${6 + octaveShift}`;

// --- geometry for the keyboard SVG ------------------------------------------

export interface PianoKeyGeom {
  /** chromatic index from the leftmost key, 0..24 */
  index: number;
  color: 'white' | 'black';
  /** x position measured in white-key widths */
  x: number;
}

export const PIANO_LAYOUT: PianoKeyGeom[] = (() => {
  const BLACK = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A# (relative to C)
  const out: PianoKeyGeom[] = [];
  let whiteX = 0;
  for (let i = 0; i < PIANO_KEY_COUNT; i++) {
    if (BLACK.has(mod12(i))) {
      out.push({ index: i, color: 'black', x: whiteX - 0.5 });
    }
    else {
      out.push({ index: i, color: 'white', x: whiteX });
      whiteX += 1;
    }
  }
  return out;
})();

export const PIANO_WHITE_COUNT = PIANO_LAYOUT.filter((k) => k.color === 'white').length; // 15
