// Demo licks: a seeded phrase generator that plays each exercise the way a
// teacher would — landing on the target when the chord changes, moving by step
// in between, repeating a rhythm so it sounds like an idea, and leaving space.
// Pure data in, pure data out; the audio engine just schedules the result.

import { PitchClass, mod12 } from './notes';
import { LensId, SoloMap } from './solo';

export interface LeadNote {
  /** beats from the top of the loop */
  beat: number;
  dur: number;
  midi: number;
  vel: number;
}

export interface LickSegment {
  /** beats from the top of the loop */
  start: number;
  beats: number;
  map: SoloMap;
  lit: Set<PitchClass>;
  targets: Set<PitchClass>;
}

export interface LickOptions {
  lens: LensId;
  /** playable range on the instrument diagram, inclusive */
  lo: number;
  hi: number;
  seed: number;
  beatsPerBar: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** onsets within a 4-beat bar; every cell ends with room to breathe */
const MELODY_CELLS = [
  [0, 1, 1.5, 2.5],
  [0, 0.5, 1, 2],
  [0, 1.5, 2, 3],
  [0, 2, 2.5, 3],
  [0, 0.5, 1.5, 2.5],
  [0, 1, 2, 2.5],
];

/** the rhythm lesson: same pitch, a different placement idea every bar */
const RHYTHM_CELLS = [
  [0, 1, 2, 3],          // straight — the baseline
  [0, 1.5, 2.5],         // push the middle
  [0.5, 1.5, 2.5, 3.5],  // all upbeats
  [0, 0.5, 1],           // a burst, then silence
  [1, 2, 3.5],           // start late, pick up into the next bar
  [0, 2.5, 3, 3.5],      // one hit, then a run at the barline
];

const nearest = (pool: number[], to: number): number | undefined =>
  pool.reduce<number | undefined>((best, m) => (best === undefined || Math.abs(m - to) < Math.abs(best - to) ? m : best), undefined);

export function buildLick(segments: LickSegment[], opts: LickOptions): LeadNote[] {
  const rand = mulberry32(opts.seed);
  const out: LeadNote[] = [];
  const center = opts.lo + (opts.hi - opts.lo) * 0.6;
  const range: number[] = [];
  for (let m = opts.lo; m <= opts.hi; m++) range.push(m);

  // two rhythm cells arranged A A B A: repetition is what makes notes a motif
  const cellA = MELODY_CELLS[Math.floor(rand() * MELODY_CELLS.length)];
  let cellB = MELODY_CELLS[Math.floor(rand() * MELODY_CELLS.length)];
  if (cellB === cellA) cellB = MELODY_CELLS[(MELODY_CELLS.indexOf(cellA) + 1) % MELODY_CELLS.length];

  let prev: number | undefined;
  segments.forEach((seg, segIdx) => {
    const cands = range.filter((m) => seg.lit.has(mod12(m)));
    if (!cands.length) return;
    const roleOf = (m: number) => seg.map.byPc.get(mod12(m));
    const strong = cands.filter((m) => roleOf(m)?.chordDegree !== undefined);
    const stable = cands.filter((m) => { const r = roleOf(m)?.role; return r !== 'avoid' && r !== 'rub'; });
    const targetPool = cands.filter((m) => seg.targets.has(mod12(m)));
    const chordTargets = targetPool.filter((m) => roleOf(m)?.chordDegree !== undefined);
    const landOn = chordTargets.length ? chordTargets : targetPool.length ? targetPool : strong.length ? strong : cands;

    const nextSeg = segments[(segIdx + 1) % segments.length];
    const nextTargets = range.filter((m) => nextSeg.targets.has(mod12(m)));

    for (let b0 = 0; b0 < seg.beats - 1e-6; b0 += opts.beatsPerBar) {
      const span = Math.min(opts.beatsPerBar, seg.beats - b0);
      const barIdx = Math.round((seg.start + b0) / opts.beatsPerBar);
      const firstBar = b0 === 0;
      const lastBar = b0 + opts.beatsPerBar >= seg.beats - 1e-6;

      if (opts.lens === 'three' && barIdx % 2 === 1) continue; // the silent bar is the student's

      let onsets: number[];
      if (opts.lens === 'roots') onsets = firstBar ? [0] : [0, 2.5];
      else if (opts.lens === 'guide') onsets = [0];
      else if (opts.lens === 'rhythm') onsets = RHYTHM_CELLS[barIdx % RHYTHM_CELLS.length];
      else onsets = barIdx % 4 === 2 ? cellB : cellA;
      onsets = onsets.filter((o) => o < span - 1e-6);

      onsets.forEach((onset, k) => {
        const isLast = k === onsets.length - 1;
        const onBeat = Math.abs(onset % 2) < 1e-6;
        let midi: number;

        if (firstBar && k === 0) {
          midi = nearest(landOn, prev ?? center)!;
        }
        else if (opts.lens === 'rhythm' || opts.lens === 'roots') {
          // octave displacement is the only pitch freedom here
          const same = cands.filter((m) => mod12(m) === mod12(prev ?? cands[0]));
          midi = opts.lens === 'roots' && same.length > 1 && rand() < 0.5
            ? same[Math.floor(rand() * same.length)]
            : nearest(same.length ? same : cands, prev ?? center)!;
        }
        else if (isLast && lastBar && nextTargets.length && opts.lens !== 'guide') {
          // set up the next chord: finish a step away from where it wants you
          const goal = nearest(nextTargets, prev ?? center)!;
          const approach = stable.filter((m) => m !== goal && Math.abs(m - goal) <= 2);
          midi = nearest(approach.length ? approach : stable.length ? stable : cands, prev ?? center)!;
        }
        else {
          const pool = onBeat && strong.length ? strong : isLast && stable.length ? stable : cands;
          const from = prev ?? center;
          // drift back toward the middle of the range when the line wanders off
          const pull = from > center + 5 ? -1 : from < center - 5 ? 1 : 0;
          const dir = rand() < 0.5 + 0.3 * pull ? 1 : -1;
          const ahead = pool.filter((m) => (dir === 1 ? m > from : m < from));
          const ordered = dir === 1 ? ahead : [...ahead].reverse();
          const skip = rand() < 0.25 ? 1 : 0;
          midi = ordered[Math.min(skip, ordered.length - 1)] ?? nearest(pool, from)!;
        }

        const until = (onsets[k + 1] ?? span) - onset;
        const long = opts.lens === 'guide' || opts.lens === 'roots';
        const dur = long ? Math.max(0.5, until - 0.5) : Math.min(until * 0.92, isLast ? 1.5 : 1);
        out.push({
          beat: seg.start + b0 + onset,
          dur,
          midi,
          vel: onset === 0 ? 0.95 : onBeat ? 0.85 : 0.74,
        });
        prev = midi;
      });
    }
  });
  return out;
}
