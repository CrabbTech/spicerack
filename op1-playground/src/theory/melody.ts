// Melody autocomplete: a seeded, per-bar generator that hangs a singable line
// on the user's chords — chord tones on the strong beats, scale steps between,
// register + contour + density knobs, deterministic for a given seed so a
// "reroll bar 3" only re-rolls bar 3.

import { Note } from 'tonal';
import { ChordInfo, KeySig, scaleChromas } from './harmony';
import { OP1_BASE_MIDI, OP1_TOP_MIDI } from '../op1/op1';
import { mixSeeds, mulberry32, pickWeighted, Rng } from '../lib/rng';

export type Density = 'sparse' | 'flowing' | 'busy';
export type Contour = 'arch' | 'rise' | 'fall' | 'wave' | 'valley';
export type Register = 'high' | 'mid' | 'wide';

export interface MelodyParams {
  density: Density;
  contour: Contour;
  register: Register;
  /** 0..1 — how much the offbeats get the good notes */
  syncopation: number;
  seed: number;
  /** per-bar reroll seeds; missing entries default to the bar index */
  barSeeds: number[];
}

export const DEFAULT_MELODY_PARAMS: MelodyParams = {
  density: 'flowing', contour: 'arch', register: 'high', syncopation: 0.35, seed: 1, barSeeds: [],
};

export interface MelodyNote {
  /** absolute start in beats from the top of the progression */
  start: number;
  /** length in beats */
  dur: number;
  /** midi at octave shift 0 — always inside the OP-1 window */
  midi: number;
  slotIdx: number;
  kind: 'chord' | 'step';
}

export interface Segment {
  slotIdx: number;
  startBeat: number;
  beats: number; // 4 for a full bar, 2 for a half-bar slot
  chromas: number[]; // chord tones, root first
  rootChroma: number;
}

const REGISTERS: Record<Register, { lo: number; hi: number; spread: number }> = {
  high: { lo: OP1_BASE_MIDI + 12, hi: OP1_TOP_MIDI, spread: 5 },
  mid: { lo: OP1_BASE_MIDI + 5, hi: OP1_TOP_MIDI - 4, spread: 6 },
  wide: { lo: OP1_BASE_MIDI, hi: OP1_TOP_MIDI, spread: 9 },
};

const DENSITY_COUNT: Record<Density, [number, number]> = {
  sparse: [2, 3], flowing: [4, 5], busy: [6, 7],
};

function contourOffset(contour: Contour, t: number, spread: number): number {
  switch (contour) {
    case 'arch': return Math.sin(Math.PI * t) * spread;
    case 'valley': return -Math.sin(Math.PI * t) * spread;
    case 'rise': return (t - 0.5) * 2 * spread;
    case 'fall': return (0.5 - t) * 2 * spread;
    case 'wave': return Math.sin(2 * Math.PI * t * 2) * spread;
  }
}

/** Place a chroma in the octave nearest `near`, clamped to [lo, hi]. */
function chromaNear(chroma: number, near: number, lo: number, hi: number): number {
  let m = near + (((chroma - near) % 12) + 18) % 12 - 6;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

export function segmentsOf(slots: { chord: ChordInfo; bars: number }[]): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  slots.forEach((slot, slotIdx) => {
    const chromas = slot.chord.notes
      .map((n) => Note.chroma(n))
      .filter((c): c is number => c !== undefined && c !== null);
    const rootChroma = chromas[0] ?? 0;
    let remaining = slot.bars * 4;
    while (remaining > 0) {
      const beats = Math.min(4, remaining);
      out.push({ slotIdx, startBeat: cursor, beats, chromas, rootChroma });
      cursor += beats;
      remaining -= beats;
    }
  });
  return out;
}

/** Pick eighth-note onsets for one segment. Beat 0 always sounds. */
function pickOnsets(rng: Rng, beats: number, density: Density, syncopation: number): number[] {
  const positions = beats * 2; // eighth grid
  const [lo, hi] = DENSITY_COUNT[density];
  const scale = beats / 4;
  const count = Math.max(1, Math.min(positions, Math.round((lo + rng() * (hi - lo + 1)) * scale)));
  const chosen = new Set<number>([0]);
  const pool: [number, number][] = [];
  for (let p = 1; p < positions; p++) {
    const onBeat = p % 2 === 0;
    pool.push([p, onBeat ? 1 : 0.3 + syncopation]);
  }
  while (chosen.size < count && pool.length) {
    const p = pickWeighted(rng, pool.filter(([pos]) => !chosen.has(pos)));
    chosen.add(p);
  }
  return [...chosen].sort((a, b) => a - b);
}

export function generateMelody(
  slots: { chord: ChordInfo; bars: number }[],
  key: KeySig,
  params: MelodyParams,
): MelodyNote[] {
  const segments = segmentsOf(slots);
  if (!segments.length) return [];
  const totalBeats = segments.reduce((sum, s) => sum + s.beats, 0);
  const reg = REGISTERS[params.register];
  const center = (reg.lo + reg.hi) / 2;
  const inScale = scaleChromas(key);
  const tonicChroma = inScale[0];

  const notes: MelodyNote[] = [];
  let prev = Math.round(center);

  segments.forEach((seg, segIdx) => {
    const rng = mulberry32(mixSeeds(params.seed, params.barSeeds[segIdx] ?? segIdx));
    const onsets = pickOnsets(rng, seg.beats, params.density, params.syncopation);
    const pool = [...new Set([...inScale, ...seg.chromas])];

    onsets.forEach((pos, i) => {
      const startBeat = seg.startBeat + pos / 2;
      const nextPos = onsets[i + 1] ?? seg.beats * 2;
      const dur = Math.max(0.5, ((nextPos - pos) / 2) * 0.92);
      const t = startBeat / Math.max(1, totalBeats - 1);
      const target = center + contourOffset(params.contour, t, reg.spread);
      const strong = pos === 0 || pos === 4;
      const useChordTone = strong || rng() < 0.22;

      const chromas = useChordTone ? seg.chromas : pool;
      let best = prev;
      let bestScore = Infinity;
      for (const chroma of chromas) {
        const m = chromaNear(chroma, prev, reg.lo, reg.hi);
        const leap = Math.abs(m - prev);
        let score = leap * (useChordTone ? 0.55 : 1.0) + Math.abs(m - target) * 0.45 + rng() * 1.3;
        if (!useChordTone && leap > 4) score += 3; // steps, not jumps, between chord tones
        if (leap === 0 && !strong) score += 1.2; // discourage repeated notes off the beat
        if (pos === 0 && chroma === seg.rootChroma) score -= 0.4;
        if (score < bestScore) { bestScore = score; best = m; }
      }
      prev = best;
      notes.push({
        start: startBeat, dur, midi: best, slotIdx: seg.slotIdx,
        kind: useChordTone ? 'chord' : 'step',
      });
    });
  });

  // land the line: last note resolves to the nearest tonic-chord tone and rings
  const last = notes[notes.length - 1];
  if (last) {
    const lastSeg = segments[segments.length - 1];
    const restingChromas = lastSeg.chromas.includes(tonicChroma) ? [tonicChroma, ...lastSeg.chromas] : lastSeg.chromas;
    last.midi = chromaNear(restingChromas[0], last.midi, reg.lo, reg.hi);
    last.kind = 'chord';
    last.dur = Math.max(last.dur, Math.min(2, totalBeats - last.start));
  }
  return notes;
}
