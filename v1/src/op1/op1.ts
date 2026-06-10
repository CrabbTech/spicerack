// The OP-1 Field musical keyboard: 24 keys spanning two octaves, leftmost key
// F4 by default (verified against TE's docs/forums), black-key groups 3-2-3-2.
// "Keyboard tab" = which of those 24 keys to press.

import { mod12, notePc, PitchClass } from '../theory/notes';
import { Chord } from '../theory/chords';

/** midi of the leftmost key at octave shift 0 */
export const OP1_BASE_MIDI = 65; // F4
export const OP1_KEY_COUNT = 24;

export interface Op1KeyGeom {
  /** chromatic index from the leftmost key, 0..23 */
  index: number;
  row: 'top' | 'bottom';
  /** x position measured in bottom-key widths */
  x: number;
}

/** Geometry of the 24 keys. Bottom row: F G A B C D E ×2; top row: 3-2-3-2. */
export const OP1_LAYOUT: Op1KeyGeom[] = (() => {
  const out: Op1KeyGeom[] = [];
  // semitone offsets within the F-rooted octave that are "black" keys
  const BLACK = new Set([1, 3, 5, 8, 10]); // F#, G#, A#, C#, D# (relative to F)
  let bottomX = 0;
  for (let i = 0; i < OP1_KEY_COUNT; i++) {
    if (BLACK.has(mod12(i))) {
      out.push({ index: i, row: 'top', x: bottomX - 0.5 });
    }
    else {
      out.push({ index: i, row: 'bottom', x: bottomX });
      bottomX += 1;
    }
  }
  return out;
})();

export const op1KeyPc = (index: number): PitchClass => mod12(OP1_BASE_MIDI + index);

export interface Op1Voicing {
  /** midis at octave shift 0, ascending — all within [65, 88] */
  midis: number[];
  inversion: number;
  label: string;
  /** chord-tone degrees dropped to make it fit one hand */
  omitted: number[];
}

const INVERSION_NAMES = ['root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];

/**
 * Fit a chord onto the 24-key window with ≤5 keys (one hand), preferring
 * root position, compact span and a centered hand.
 */
export function op1ChordVoicing(chord: Chord): Op1Voicing {
  const tones = chord.quality.tones;
  const rootPc = notePc(chord.root);
  const TOP = OP1_BASE_MIDI + OP1_KEY_COUNT - 1;
  // progressively drop the perfect 5th, then the 9th, until the chord fits
  const attempts: number[][] = [[], [5], [5, 9]];

  for (const drop of attempts) {
    const kept = tones.filter((t) =>
      !(drop.includes(5) && t.degree === 5 && t.semitones === 7) &&
      !(drop.includes(9) && t.degree === 9));
    if (kept.length < 2) continue;
    const pcs = kept.map((t) => mod12(rootPc + t.semitones));
    let best: Op1Voicing | undefined;
    let bestScore = Infinity;
    for (let k = 0; k < pcs.length; k++) {
      const order = [...pcs.slice(k), ...pcs.slice(0, k)];
      const midis: number[] = [];
      let prev = OP1_BASE_MIDI - 1;
      let ok = true;
      for (const pc of order) {
        let m = prev + 1;
        while (mod12(m) !== pc) m++;
        if (m > TOP) { ok = false; break; }
        midis.push(m);
        prev = m;
      }
      if (!ok) continue;
      const span = midis[midis.length - 1] - midis[0];
      const mean = midis.reduce((a, b) => a + b, 0) / midis.length;
      const score = span / 12 + Math.abs(mean - 76.5) / 8 + (k > 0 ? 0.25 + 0.05 * k : 0);
      if (score < bestScore) {
        bestScore = score;
        best = {
          midis,
          inversion: k,
          label: INVERSION_NAMES[k] ?? `${k}th inversion`,
          omitted: drop.filter((d) => tones.some((t) => t.degree === d && (d !== 5 || t.semitones === 7))),
        };
      }
    }
    if (best) return best;
  }
  // truly desperate: stack the first three tones from the window root upward
  const fallback = tones.slice(0, 3).map((t) => {
    let m = OP1_BASE_MIDI;
    while (mod12(m) !== mod12(rootPc + t.semitones)) m++;
    return m;
  }).sort((a, b) => a - b);
  return { midis: fallback, inversion: 0, label: 'compact', omitted: tones.slice(3).map((t) => t.degree) };
}

/** Key indices (0..23) a scale lights up; root keys flagged. */
export function op1ScaleKeys(tonicPc: PitchClass, pcs: PitchClass[]): { index: number; isRoot: boolean }[] {
  const set = new Set(pcs.map(mod12));
  const out: { index: number; isRoot: boolean }[] = [];
  for (let i = 0; i < OP1_KEY_COUNT; i++) {
    const pc = op1KeyPc(i);
    if (set.has(pc)) out.push({ index: i, isRoot: pc === mod12(tonicPc) });
  }
  return out;
}

export const midiToKeyIndex = (midi: number): number => midi - OP1_BASE_MIDI;

/** Range label like "F4 – E6" for a given octave shift. */
export function op1RangeLabel(octaveShift: number): string {
  const lo = OP1_BASE_MIDI + 12 * octaveShift;
  const name = (m: number) => `F${Math.floor(m / 12) - 1}`;
  const top = (m: number) => `E${Math.floor((m + 23) / 12) - 1}`;
  return `${name(lo)} – ${top(lo)}`;
}
