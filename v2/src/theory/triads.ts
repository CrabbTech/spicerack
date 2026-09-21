// Triads on three strings (or under one hand on the keys): every chord
// reduced to three notes, in every inversion, and then the part that matters —
// a path through the progression where each triad sits a fret or two from the
// last. Root position everywhere means leaping around the neck; inversions
// mean barely moving. The solver makes that visible and countable.

import {
  LETTERS, NoteName, PitchClass, letterIndex, mod7, mod12, noteLabel, notePc, simplify, spellWithLetter,
} from './notes';
import { Chord, chordTones } from './chords';

export interface TriadTone {
  pc: PitchClass;
  /** semitones above the triad's lowest-degree tone (0 for the first) */
  offset: number;
  /** the chord degree this voice carries: 1, 3, 5 — or 7 in an upper-structure triad */
  degree: number;
  label: string;
}

export type TriadSource = 'base' | 'upper';

export interface TriadSpec {
  tones: TriadTone[];
  /** what the three notes spell on their own, e.g. "C" for the 3-5-7 of Am7 */
  name: string;
  source: TriadSource;
}

const SHAPE_NAME: Record<string, string> = { '4,3': '', '3,4': 'm', '3,3': '°', '4,4': '+', '5,2': 'sus4', '2,5': 'sus2' };

const show = (n: NoteName): string => noteLabel(simplify(n));

/**
 * The three notes to play for a chord. 'base' = root, 3rd (or sus note), 5th.
 * 'upper' = 3rd, 5th, 7th of a seventh chord — a different, simpler triad that
 * implies the full chord over the bass (falls back to 'base' when there is no 7th).
 */
export function triadSpec(chord: Chord, source: TriadSource = 'base'): TriadSpec {
  const spelled = chordTones(chord);
  const all = chord.quality.tones.map((t, i) => ({ degree: t.degree, semitones: t.semitones, name: spelled[i] }));
  const rootPc = notePc(chord.root);
  const find = (...degrees: number[]) => all.find((t) => degrees.includes(t.degree));

  const upper = [find(3), find(5), find(7)];
  let chosen: typeof all;
  let used: TriadSource = 'base';
  if (source === 'upper' && upper.every(Boolean)) {
    chosen = upper as typeof all;
    used = 'upper';
  }
  else {
    const third = find(3) ?? find(4, 2);
    // a voicing that leaves its 5th out (a 13th chord) still has one to play
    const fifth = find(5) ?? {
      degree: 5, semitones: 7,
      name: spellWithLetter(LETTERS[mod7(letterIndex(chord.root.letter) + 4)], mod12(rootPc + 7)),
    };
    chosen = [all[0], ...(third ? [third] : []), fifth];
    // a power chord fills out the way a player would: root, 5th, octave
    if (chosen.length < 3) chosen.push({ degree: 1, semitones: 12, name: chord.root });
    chosen.sort((a, b) => a.semitones - b.semitones);
  }
  const base = chosen[0].semitones;
  const tones: TriadTone[] = chosen.map((t) => ({
    pc: mod12(rootPc + t.semitones), offset: t.semitones - base, degree: t.degree, label: show(t.name),
  }));
  const gaps = `${tones[1].offset - tones[0].offset},${tones[2].offset - tones[1].offset}`;
  return { tones, name: `${tones[0].label}${SHAPE_NAME[gaps] ?? ''}`, source: used };
}

export interface TriadVoicing {
  /** low → high */
  midis: number[];
  /** the tone each voice carries, aligned with midis */
  tones: TriadTone[];
  /** 0 = the triad's own root on the bottom, 1 = first inversion, 2 = second */
  inversion: number;
  /** string instruments: which strings (low → high) and which frets */
  strings?: number[];
  frets?: number[];
}

/** The close-position stackings of a triad: each voice the nearest one above the last. */
function inversions(spec: TriadSpec): { order: TriadTone[]; steps: number[]; inversion: number }[] {
  return [0, 1, 2].map((k) => {
    const order = [...spec.tones.slice(k), ...spec.tones.slice(0, k)];
    const steps = [0];
    for (let i = 1; i < 3; i++) steps.push(steps[i - 1] + (mod12(order[i].offset - order[i - 1].offset) || 12));
    return { order, steps, inversion: k };
  });
}

/** Three adjacent strings, low to high: guitar has four such sets, bass two. */
export function stringSets(stringCount: number): number[][] {
  return Array.from({ length: Math.max(0, stringCount - 2) }, (_, s) => [s, s + 1, s + 2]);
}

/** Every playable close-voiced shape of the triad on one string set, low neck → high neck. */
export function stringTriads(spec: TriadSpec, set: number[], openMidi: number[], maxFret: number): TriadVoicing[] {
  const out: TriadVoicing[] = [];
  for (const inv of inversions(spec)) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const low = openMidi[set[0]] + fret;
      if (mod12(low) !== inv.order[0].pc) continue;
      const midis = inv.steps.map((s) => low + s);
      const frets = midis.map((m, i) => m - openMidi[set[i]]);
      if (frets.some((f) => f < 0 || f > maxFret)) continue;
      const fretted = frets.filter((f) => f > 0);
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      // a comfortable hand: four frets, and open strings only down by the nut
      if (span > 4 || (fretted.length < 3 && Math.max(...frets) > 4)) continue;
      out.push({ midis, tones: inv.order, inversion: inv.inversion, strings: set, frets });
    }
  }
  return out.sort((a, b) => a.midis[0] - b.midis[0]);
}

/** Every close-voiced inversion that fits inside a keyboard window. */
export function keyboardTriads(spec: TriadSpec, baseMidi: number, keyCount: number): TriadVoicing[] {
  const out: TriadVoicing[] = [];
  const top = baseMidi + keyCount - 1;
  for (const inv of inversions(spec)) {
    for (let low = baseMidi; low <= top; low++) {
      if (mod12(low) !== inv.order[0].pc) continue;
      const midis = inv.steps.map((s) => low + s);
      if (midis[2] <= top) out.push({ midis, tones: inv.order, inversion: inv.inversion });
    }
  }
  return out.sort((a, b) => a.midis[0] - b.midis[0]);
}

// --- the path -----------------------------------------------------------------

export type PathMode = 'close' | 'climb' | 'descend' | 'root';

export const PATH_MODES: { id: PathMode; icon: string; name: string; blurb: string }[] = [
  { id: 'close', icon: '🤏', name: 'Stay close', blurb: 'the smallest total movement — each voice goes to the nearest note of the next chord' },
  { id: 'climb', icon: '↗', name: 'Climb', blurb: 'the top voice rises with every chord: comping that builds' },
  { id: 'descend', icon: '↘', name: 'Descend', blurb: 'the top voice falls with every chord: comping that settles' },
  { id: 'root', icon: '🧱', name: 'Root position', blurb: 'the same shape everywhere — what most people play, and the baseline to beat' },
];

/** Semitones the three voices travel between two voicings (on one string set: frets). */
export const voiceTravel = (a: TriadVoicing, b: TriadVoicing): number =>
  a.midis.reduce((sum, m, i) => sum + Math.abs(b.midis[i] - m), 0);

function stepCost(a: TriadVoicing, b: TriadVoicing, mode: PathMode): number {
  const travel = voiceTravel(a, b);
  if (mode === 'close' || mode === 'root') return travel;
  const rise = (b.midis[2] - a.midis[2]) * (mode === 'climb' ? 1 : -1);
  if (rise > 0) return travel * 0.25 + Math.max(0, rise - 5) * 2;
  // standing still is worse than a clean reset to the other end of the neck
  return rise === 0 ? 7 : 9 + travel * 0.05;
}

/**
 * One voicing per chord. `pins` fixes a chord to a chosen candidate and the
 * rest of the path re-routes around it. Returns an index into each chord's
 * candidate list (-1 where a chord has no playable shape).
 */
export function triadPath(
  candidates: TriadVoicing[][], mode: PathMode, anchor: number, pins: (number | undefined)[] = [], loop = true,
): number[] {
  const pools = candidates.map((list, i) => {
    const all = list.map((_, k) => k);
    if (pins[i] !== undefined && list[pins[i]!]) return [pins[i]!];
    const rooted = all.filter((k) => list[k].inversion === 0);
    return mode === 'root' && rooted.length ? rooted : all;
  });
  const live = pools.map((p, i) => (p.length ? i : -1)).filter((i) => i >= 0);
  if (!live.length) return candidates.map(() => -1);

  const center = (v: TriadVoicing) => (v.midis[0] + v.midis[2]) / 2;
  const home = mode === 'climb' ? anchor - 5 : mode === 'descend' ? anchor + 5 : anchor;
  const wrapWeight = loop && (mode === 'close' || mode === 'root') ? 1 : 0;

  let best: { cost: number; picks: number[] } | undefined;
  const first = live[0];
  for (const start of pools[first]) {
    // Viterbi from a fixed first shape, so the seam back to it can be priced in
    let layer = new Map<number, { cost: number; trail: number[] }>([
      [start, { cost: Math.abs(center(candidates[first][start]) - home) * 0.35, trail: [start] }],
    ]);
    for (let li = 1; li < live.length; li++) {
      const at = live[li];
      const prevAt = live[li - 1];
      const next = new Map<number, { cost: number; trail: number[] }>();
      for (const k of pools[at]) {
        let bestPrev: { cost: number; trail: number[] } | undefined;
        for (const [pk, state] of layer) {
          const cost = state.cost + stepCost(candidates[prevAt][pk], candidates[at][k], mode);
          if (!bestPrev || cost < bestPrev.cost) bestPrev = { cost, trail: state.trail };
        }
        if (bestPrev) next.set(k, { cost: bestPrev.cost, trail: [...bestPrev.trail, k] });
      }
      layer = next;
    }
    const lastAt = live[live.length - 1];
    for (const [k, state] of layer) {
      const seam = live.length > 1 ? wrapWeight * stepCost(candidates[lastAt][k], candidates[first][start], mode) : 0;
      if (!best || state.cost + seam < best.cost) best = { cost: state.cost + seam, picks: state.trail };
    }
  }
  const out = candidates.map(() => -1);
  live.forEach((at, li) => { out[at] = best!.picks[li]; });
  return out;
}

/** Total voice travel around the path (including the seam when it loops). */
export function pathTravel(chosen: (TriadVoicing | undefined)[], loop = true): number {
  const live = chosen.filter((v): v is TriadVoicing => !!v);
  let sum = 0;
  for (let i = 1; i < live.length; i++) sum += voiceTravel(live[i - 1], live[i]);
  if (loop && live.length > 2) sum += voiceTravel(live[live.length - 1], live[0]);
  return sum;
}

export interface TriadMove {
  voice: 'low' | 'middle' | 'top';
  from: string;
  to: string;
  /** signed semitones (frets, on a string) */
  semitones: number;
}

export function triadMoves(a: TriadVoicing, b: TriadVoicing): TriadMove[] {
  return (['low', 'middle', 'top'] as const).map((voice, i) => ({
    voice, from: a.tones[i].label, to: b.tones[i].label, semitones: b.midis[i] - a.midis[i],
  }));
}

const INVERSION = ['root position', '1st inversion', '2nd inversion'];
const ORDINAL: Record<number, string> = { 1: 'root', 3: '3rd', 4: '4th', 2: '2nd', 5: '5th', 7: '7th' };

export const inversionLabel = (v: TriadVoicing): string =>
  `${INVERSION[v.inversion] ?? 'inversion'} · ${ORDINAL[v.tones[2].degree] ?? v.tones[2].degree} on top`;

/** The change in words: what holds, what slides, and by how much. */
export function describeMove(a: TriadVoicing, b: TriadVoicing, unit: 'fret' | 'key'): string {
  const moves = triadMoves(a, b);
  const holds = moves.filter((m) => m.semitones === 0);
  const slides = moves.filter((m) => m.semitones !== 0);
  const amount = (m: TriadMove) => {
    const n = Math.abs(m.semitones);
    return `${n} ${unit}${n === 1 ? '' : 's'} ${m.semitones > 0 ? 'up' : 'down'}`;
  };
  if (!slides.length) return 'Nothing moves — both chords are the same three notes here.';
  const parts = slides.map((m) => `${m.from} → ${m.to} (${amount(m)})`);
  const held = holds.length ? ` ${holds.map((m) => m.from).join(' and ')} ${holds.length === 1 ? 'stays' : 'stay'} exactly where ${holds.length === 1 ? 'it is' : 'they are'}.` : '';
  const total = slides.reduce((s, m) => s + Math.abs(m.semitones), 0);
  const verdict = total <= 3 ? ' That is the whole chord change.' : total >= 9 ? ' A real jump — pin a closer shape if you want it smoother.' : '';
  return `${parts.join(', ')}.${held}${verdict}`;
}
