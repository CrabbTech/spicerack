// CAGED, used the way it helps someone who already owns the chord shapes: not
// as five new things to memorise, but as the answer to "which grip I already
// know lives in this part of the neck?" — and then, the point of it all, what
// each finger of that grip is: root, 3rd, 5th.

import { PitchClass, mod12 } from '../theory/notes';
import { Chord, chordSymbol } from '../theory/chords';
import { chordIntervalLabels } from '../theory/solo';
import { OPEN_MIDI, OPEN_PC, STRING_NAMES } from './shapes';
import { GuitarVoicing, chordVoicings } from './voicing';

export type CagedForm = 'C' | 'A' | 'G' | 'E' | 'D';

export interface CagedSpot {
  form: CagedForm;
  rootString: number;
  rootFret: number;
}

/**
 * Which of the five forms a chord takes inside a fret window. The forms are
 * told apart by where the lowest root sits: 6th string (E under the first
 * finger, G under the fourth), 5th string (A / C the same way), or 4th (D).
 */
export function cagedForm(rootPc: PitchClass, window: { lo: number; hi: number }, openPcs: number[] = OPEN_PC): CagedSpot | undefined {
  const forms: [CagedForm, CagedForm][] = [['E', 'G'], ['A', 'C'], ['D', 'D']];
  for (let s = 0; s < 3; s++) {
    for (let fret = Math.max(0, window.lo); fret <= window.hi; fret++) {
      if (mod12(openPcs[s] + fret) !== mod12(rootPc)) continue;
      // a 4th-string root on the far side of the box belongs to the E form an octave up — keep looking
      if (s === 2 && fret - window.lo > 2) continue;
      return { form: forms[s][fret - window.lo <= 2 ? 0 : 1], rootString: s, rootFret: fret };
    }
  }
  return undefined;
}

export interface GripTone {
  string: number;
  fret: number;
  midi: number;
  /** R, 3, ♭3, 5, ♭7… */
  interval: string;
}

export interface KnownGrip {
  voicing: GuitarVoicing;
  tones: GripTone[];
}

/** The fullest grip from the shape library that sits inside (or a fret either side of) the window. */
export function gripInPosition(chord: Chord, window: { lo: number; hi: number }): KnownGrip | undefined {
  const labels = chordIntervalLabels(chord);
  const fits = chordVoicings(chord).filter((v) => v.frets.every((f) => f === 'x' || (f === 0 ? window.lo <= 1 : f >= window.lo - 1 && f <= window.hi + 1)));
  const best = fits.sort((a, b) => b.midis.length - a.midis.length)[0];
  if (!best) return undefined;
  const tones: GripTone[] = [];
  best.frets.forEach((f, string) => {
    if (f === 'x') return;
    const midi = OPEN_MIDI[string] + f;
    tones.push({ string, fret: f, midi, interval: labels.get(mod12(midi)) ?? '?' });
  });
  return { voicing: best, tones };
}

/** "Here D is the A-shape…" — the sentence that ties the position to a grip the player owns. */
export function cagedText(chord: Chord, spot: CagedSpot | undefined, grip: KnownGrip | undefined): string {
  const sym = chordSymbol(chord);
  if (!spot) return `No root of ${sym} on the three low strings inside this box — slide one position along and it appears.`;
  const minor = chord.quality.tones.some((t) => t.degree === 3 && t.semitones === 3);
  const form = `${spot.form}${minor ? 'm' : ''}-shape`;
  const where = `root on the ${STRING_NAMES[spot.rootString]} string, fret ${spot.rootFret}`;
  if (!grip) return `Here ${sym} is the ${form} (${where}). The map's bright dots are that shape, pulled apart into single notes.`;
  const spelled = grip.tones.map((t) => t.interval).join(' ');
  return `Here ${sym} is the ${form} you already play (${where}). Low string to high, your fingers are holding ${spelled} — the ringed dots.`;
}
