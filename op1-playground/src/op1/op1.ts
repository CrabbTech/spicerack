// The OP-1 Field musical keyboard: 24 keys spanning two octaves, leftmost key
// F4, black-key groups 3-2-3-2, hardware octave shift ±2. This module is pure
// hardware geometry plus the "which keys do I press" window fitter.

import { Note } from 'tonal';

export const OP1_BASE_MIDI = 65; // F4
export const OP1_KEY_COUNT = 24;
export const OP1_TOP_MIDI = OP1_BASE_MIDI + OP1_KEY_COUNT - 1; // E6

export interface Op1KeyGeom {
  /** chromatic index from the leftmost key, 0..23 */
  index: number;
  row: 'top' | 'bottom';
  /** x position measured in bottom-key widths */
  x: number;
}

/** Geometry of the 24 keys. Bottom row: F G A B C D E ×2; top row 3-2-3-2. */
export const OP1_LAYOUT: Op1KeyGeom[] = (() => {
  const out: Op1KeyGeom[] = [];
  const BLACK = new Set([1, 3, 5, 8, 10]); // F#, G#, A#, C#, D# relative to F
  let bottomX = 0;
  for (let i = 0; i < OP1_KEY_COUNT; i++) {
    if (BLACK.has(i % 12)) {
      out.push({ index: i, row: 'top', x: bottomX - 0.5 });
    }
    else {
      out.push({ index: i, row: 'bottom', x: bottomX });
      bottomX += 1;
    }
  }
  return out;
})();

const TOP_ORDER: Map<number, number> = new Map(
  OP1_LAYOUT.filter((k) => k.row === 'top')
    .sort((a, b) => a.x - b.x)
    .map((k, i) => [k.index, i + 1]),
);

/** Physical key tag: B1..B14 for bottom keys, T1..T10 for the raised row. */
export function keyTag(index: number): string {
  const geom = OP1_LAYOUT[index];
  if (!geom) return `K${index + 1}`;
  if (geom.row === 'bottom') return `B${Math.round(geom.x) + 1}`;
  return `T${TOP_ORDER.get(index) ?? index + 1}`;
}

export const midiToKeyIndex = (midi: number): number => midi - OP1_BASE_MIDI;

/** Range label like "F4 – E6" for a hardware octave shift. */
export function rangeLabel(octaveShift: number): string {
  const lo = OP1_BASE_MIDI + 12 * octaveShift;
  return `${Note.fromMidi(lo)} – ${Note.fromMidi(lo + OP1_KEY_COUNT - 1)}`;
}

// ---------------------------------------------------------------------------
// Window fitter: press a chord with one hand (≤5 keys) inside the 24-key window.

export interface Voicing {
  /** midis at octave shift 0, ascending — all within [65, 88] */
  midis: number[];
  inversion: number;
  label: string;
  /** interval names dropped to make it fit, e.g. "5P" */
  omitted: string[];
}

const INVERSION_NAMES = ['root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];

export interface FitOptions {
  /** previous voicing — when set with smooth, minimize hand movement */
  prev?: number[];
  smooth?: boolean;
  /** slash-chord bass: force the lowest key to this note when it is a chord tone */
  bass?: string;
}

/** Total movement between two voicings, pairing notes low-to-high. */
export function handDistance(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const from = a[Math.min(i, a.length - 1)];
    const to = b[Math.min(i, b.length - 1)];
    total += Math.abs(to - from);
  }
  return total;
}

/**
 * Fit a chord (tonal notes + intervals, root first) onto the window.
 * Big chords progressively drop the 5th, then the 11th, then the 9th.
 * Default scoring prefers root position, compact span, centered hand;
 * smooth mode instead chases minimal movement from the previous voicing.
 */
export function fitChord(notes: string[], intervals: string[], opts: FitOptions = {}): Voicing {
  const bassChroma = opts.bass ? Note.chroma(opts.bass) ?? undefined : undefined;
  const withBass = bassChroma === undefined ? undefined : searchVoicing(notes, intervals, opts, bassChroma);
  const best = withBass ?? searchVoicing(notes, intervals, opts, undefined);
  if (best) return best;

  // desperate fallback: first three tones stacked from the window floor
  const midis = notes.slice(0, 3).map((n) => {
    const chroma = Note.chroma(n) ?? 0;
    let m = OP1_BASE_MIDI;
    while (m % 12 !== chroma) m++;
    return m;
  }).sort((a, b) => a - b);
  return { midis, inversion: 0, label: 'compact', omitted: intervals.slice(3) };
}

/** One fitting pass; `bassChroma` restricts which tone may sit lowest. */
function searchVoicing(
  notes: string[], intervals: string[], opts: FitOptions, bassChroma: number | undefined,
): Voicing | undefined {
  const dropPlans: string[][] = [[], ['5P'], ['5P', '11P', '11A'], ['5P', '11P', '11A', '9M', '9m']];
  const center = OP1_BASE_MIDI + (OP1_KEY_COUNT - 1) / 2;

  for (const drop of dropPlans) {
    const kept: { chroma: number; interval: string }[] = [];
    notes.forEach((n, i) => {
      const interval = intervals[i] ?? '';
      if (drop.includes(interval)) return;
      const chroma = Note.chroma(n);
      if (chroma !== undefined && chroma !== null) kept.push({ chroma, interval });
    });
    if (kept.length < 2 || kept.length > 5) continue;

    let best: Voicing | undefined;
    let bestScore = Infinity;
    for (let k = 0; k < kept.length; k++) {
      const order = [...kept.slice(k), ...kept.slice(0, k)];
      if (bassChroma !== undefined && order[0].chroma !== bassChroma) continue;
      const midis: number[] = [];
      let prev = OP1_BASE_MIDI - 1;
      let ok = true;
      for (const tone of order) {
        let m = prev + 1;
        while (m % 12 !== tone.chroma) m++;
        if (m > OP1_TOP_MIDI) { ok = false; break; }
        midis.push(m);
        prev = m;
      }
      if (!ok) continue;
      const span = midis[midis.length - 1] - midis[0];
      const mean = midis.reduce((a, b) => a + b, 0) / midis.length;
      let score = span / 12 + Math.abs(mean - center) / 10;
      if (opts.smooth && opts.prev?.length) score += handDistance(opts.prev, midis) / 4 + k * 0.02;
      else score += k > 0 ? 0.25 + 0.05 * k : 0;
      if (score < bestScore) {
        bestScore = score;
        best = {
          midis,
          inversion: k,
          label: INVERSION_NAMES[k] ?? `${k}th inversion`,
          omitted: drop.filter((d) => intervals.includes(d)),
        };
      }
    }
    if (best) return best;
  }
  return undefined;
}

/** Key indices a set of pitch chromas lights up; root keys flagged. */
export function scaleKeyIndices(chromas: number[], rootChroma: number): { index: number; isRoot: boolean }[] {
  const set = new Set(chromas);
  const out: { index: number; isRoot: boolean }[] = [];
  for (let i = 0; i < OP1_KEY_COUNT; i++) {
    const pc = (OP1_BASE_MIDI + i) % 12;
    if (set.has(pc)) out.push({ index: i, isRoot: pc === rootChroma });
  }
  return out;
}
