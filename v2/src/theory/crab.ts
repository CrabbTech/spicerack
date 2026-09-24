// The crab canon: a melody met by itself walking backwards. In 1747 Bach handed
// Frederick the Great a canon that is a single line of music and its own
// accompaniment — a second player simply reads it from the end (canon
// cancrizans: the crab, because crabs walk sideways and the line walks
// backwards). Here the same trick runs over your chords: the mirror voice is
// computed, every place it disagrees with the harmony or with the forward voice
// is named the coach's way, and a solver nudges the line until it agrees with
// itself. Pure data in, pure data out; the engine plays both readings at once.

import { PitchClass, midiLabel, mod12 } from './notes';
import { chordSymbol } from './chords';
import { SoloNote } from './solo';
import { MelNote, MelodyContext, Observation, isStrong, roleAt, segmentAt, sortNotes } from './melody';
import { Slot, newSlot } from './progression';

export type CrabMode = 'crab' | 'table';

export interface CrabModeDef {
  id: CrabMode;
  icon: string;
  name: string;
  hint: string;
}

export const CRAB_MODES: CrabModeDef[] = [
  { id: 'crab', icon: '🦀', name: 'Crab', hint: 'the same notes read from the end — last note first' },
  { id: 'table', icon: '🪞', name: 'Table', hint: 'backwards and upside-down: the sheet as the player across the table sees it' },
];

// --- the mirror ----------------------------------------------------------------

export interface MirrorSpec {
  mode: CrabMode;
  /** beats in the loop — the mirror of beat b is beat total − b */
  total: number;
  /** every scale pitch around the range, low to high: the rungs the inversion climbs */
  ladder: number[];
  /** rung the table canon flips around */
  pivot: number;
  lo: number;
  hi: number;
}

function ladderOf(scalePcs: PitchClass[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo - 12; m <= hi + 12; m++) if (scalePcs.includes(mod12(m))) out.push(m);
  return out;
}

function rungOf(ladder: number[], midi: number): number {
  let best = 0;
  ladder.forEach((m, i) => { if (Math.abs(m - midi) < Math.abs(ladder[best] - midi)) best = i; });
  return best;
}

/** How to read a line from the end: the loop length, and (for the table canon) the axis the pitches flip around. */
export function mirrorSpec(
  ctx: Pick<MelodyContext, 'scalePcs' | 'lo' | 'hi' | 'totalBeats'>, notes: { midi: number }[], mode: CrabMode, total = ctx.totalBeats,
): MirrorSpec {
  const ladder = ladderOf(ctx.scalePcs, ctx.lo, ctx.hi);
  // flip around the middle of the line, so the upside-down copy lives in the same register
  const mean = notes.length ? notes.reduce((s, n) => s + n.midi, 0) / notes.length : (ctx.lo + ctx.hi) / 2;
  return { mode, total, ladder, pivot: rungOf(ladder, mean), lo: ctx.lo, hi: ctx.hi };
}

/** The pitch the second player sounds for this one: the same (crab), or its diatonic reflection (table). */
export function mirrorPitch(midi: number, spec: MirrorSpec): number {
  if (spec.mode === 'crab' || !spec.ladder.length) return midi;
  const rung = Math.max(0, Math.min(spec.ladder.length - 1, 2 * spec.pivot - rungOf(spec.ladder, midi)));
  let m = spec.ladder[rung];
  while (m > spec.hi) m -= 12;
  while (m < spec.lo) m += 12;
  return m;
}

/** When a note sounds for the player reading from the end. */
export const mirrorBeat = (n: { beat: number; dur: number }, total: number): number => total - n.beat - n.dur;

/** The line as the second player performs it. Notes keep everything but their place and (table) their pitch. */
export function mirrorLead<T extends { beat: number; dur: number; midi: number }>(notes: T[], spec: MirrorSpec): T[] {
  const out: T[] = [];
  for (const n of notes) {
    let beat = mirrorBeat(n, spec.total);
    let dur = n.dur;
    // a note that ran past the loop point starts the mirror already sounding — keep what's left of it
    if (beat < 0) { dur += beat; beat = 0; }
    if (dur <= 1e-6) continue;
    out.push({ ...n, beat, dur, midi: mirrorPitch(n.midi, spec) });
  }
  return out.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
}

// --- the harmony, read from either end ----------------------------------------------

/** A crab canon only fits by construction when the chord at t is the chord at total − t. */
export function harmonyIsPalindrome(ctx: Pick<MelodyContext, 'segments'>): boolean {
  const segs = ctx.segments;
  if (!segs.length) return false;
  return segs.every((s, i) => {
    const t = segs[segs.length - 1 - i];
    return Math.abs(s.beats - t.beats) < 1e-6 && chordSymbol(s.map.chord) === chordSymbol(t.map.chord);
  });
}

export const slotsArePalindrome = (slots: Pick<Slot, 'numeral' | 'bars'>[]): boolean =>
  slots.length > 0 && slots.every((s, i) => {
    const t = slots[slots.length - 1 - i];
    return s.numeral === t.numeral && s.bars === t.bars;
  });

/** I–IV–V becomes I–IV–V–IV–I: the last chord is the turning point, the rest comes back the way it went. */
export function mirrorSlots(slots: Slot[]): Slot[] {
  if (slots.length < 2 || slotsArePalindrome(slots)) return slots;
  const back = slots.slice(0, -1).reverse().map((s) =>
    newSlot(s.numeral, s.bars, { annotation: s.annotation, spiceId: s.spiceId, pedalBass: s.pedalBass }));
  return [...slots, ...back];
}

// --- the verdict -------------------------------------------------------------------

export interface CrabMiss {
  /** where in the loop the mirror note sounds */
  beat: number;
  bar: number;
  /** the pitch the second player sounds there */
  midi: number;
  /** the written note it came from */
  fromBar: number;
  fromMidi: number;
  id: number;
  /** the chord it lands over */
  chord: string;
  why: string;
  weight: number;
}

export interface CrabClash {
  beat: number;
  bar: number;
  forward: number;
  mirror: number;
  interval: string;
  strong: boolean;
  weight: number;
}

export interface CrabVerdict {
  icon: string;
  name: string;
  text: string;
}

export interface CrabReport {
  mode: CrabMode;
  mirror: MelNote[];
  /** 0..1 — how much of the backwards voice sits on friendly notes */
  fit: number;
  /** 0..1 — how much of the time the two voices sound together without grinding */
  agreement: number;
  /** fraction of the loop where both voices sound at once */
  together: number;
  /** 0..100 */
  score: number;
  verdict: CrabVerdict;
  palindrome: boolean;
  /** mirror notes that fight the chord they land on, worst first */
  misses: CrabMiss[];
  /** moments the two voices meet and grind, worst first */
  clashes: CrabClash[];
  observations: Observation[];
}

const ROLE_SCORE: Record<SoloNote['role'], number> = { root: 1, chord: 1, color: 0.72, avoid: 0.15, rub: 0.1 };
/** interval classes that grind between two voices: seconds, sevenths, the tritone */
const HARSH = new Set([1, 2, 6, 10, 11]);
const INTERVAL_NAMES = [
  'a unison', 'a half step', 'a whole step', 'a minor 3rd', 'a major 3rd', 'a 4th',
  'a tritone', 'a 5th', 'a minor 6th', 'a major 6th', 'a minor 7th', 'a major 7th',
];

const noteName = (ctx: MelodyContext, midi: number): string =>
  midiLabel(midi, ctx.preferFlat ? 'flat' : 'sharp').replace(/-?\d+$/, '');
const barOf = (ctx: MelodyContext, beat: number): number => Math.floor(beat / ctx.beatsPerBar + 1e-6);
const weightOf = (ctx: MelodyContext, beat: number, dur: number): number => dur * (isStrong(ctx, beat) ? 2 : 1);
const isSour = (role: SoloNote | undefined): boolean => !role || ROLE_SCORE[role.role] < 0.5;

/** The most recent attack still sounding at `t`. */
function soundingAt<T extends { beat: number; dur: number }>(notes: T[], t: number): T | undefined {
  let hit: T | undefined;
  for (const n of notes) if (n.beat <= t + 1e-6 && n.beat + n.dur > t + 1e-6) hit = n;
  return hit;
}

function whyOf(role: SoloNote | undefined, chord: string): string {
  if (!role) return `isn't in the chord or the scale`;
  if (role.role === 'avoid') return `sits a half step above one of its notes`;
  return `is the note ${chord} bends out of shape`;
}

export function verdictFor(score: number): CrabVerdict {
  if (score >= 90) return { icon: '🦀🦀🦀', name: 'Cancrizans', text: 'The line is its own accompaniment. Bach would nod.' };
  if (score >= 72) return { icon: '🦀🦀', name: 'Walks nicely', text: 'Backwards works, with a pinch or two along the way.' };
  if (score >= 50) return { icon: '🦀', name: 'Pinchy', text: 'Read from the end, the line keeps stepping on notes the chords don’t want.' };
  return { icon: '🫧', name: 'Lost at sea', text: 'Backwards, this line fights the chords most of the way. Nobody writes a crab canon by accident.' };
}

/** Candidate pitches around `midi`, nearest first: the note itself, then a half step either way, and so on. */
function around(midi: number, reach: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let d = 0; d <= reach; d++) {
    for (const m of d === 0 ? [midi] : [midi + d, midi - d]) if (m >= lo && m <= hi) out.push(m);
  }
  return out;
}

const okAt = (role: SoloNote | undefined, level: 'chord' | 'stable'): boolean =>
  level === 'chord' ? role?.chordDegree !== undefined : !!role && role.role !== 'avoid' && role.role !== 'rub';

/** Does `midi`, written at `n`'s place, work over its own chord AND over the chord its mirror lands on? */
function bothWays(ctx: MelodyContext, spec: MirrorSpec, n: { beat: number; dur: number }, midi: number, level: 'chord' | 'stable'): boolean {
  return okAt(roleAt(ctx, n.beat, midi), level)
    && okAt(roleAt(ctx, Math.max(0, mirrorBeat(n, spec.total)), mirrorPitch(midi, spec)), level);
}

/** The nearest pitch to a written note that is a chord tone in both directions (or, failing that, stable in both). */
export function agreeablePitch(ctx: MelodyContext, spec: MirrorSpec, n: { beat: number; dur: number; midi: number }, reach = 5): number | undefined {
  const cands = around(n.midi, reach, ctx.lo, ctx.hi);
  return cands.find((m) => bothWays(ctx, spec, n, m, 'chord')) ?? cands.find((m) => bothWays(ctx, spec, n, m, 'stable'));
}

export function analyzeCanon(notes: MelNote[], ctx: MelodyContext, mode: CrabMode): CrabReport {
  const sorted = sortNotes(notes);
  const spec = mirrorSpec(ctx, sorted, mode);
  const mirror = mirrorLead(sorted, spec);
  const palindrome = harmonyIsPalindrome(ctx);
  const observations: Observation[] = [];
  const byId = new Map(sorted.map((n) => [n.id, n] as const));

  // 1 — does the backwards voice land on friendly notes?
  let fitW = 0;
  let fitS = 0;
  const misses: CrabMiss[] = [];
  for (const m of mirror) {
    const role = roleAt(ctx, m.beat, m.midi);
    const s = role ? ROLE_SCORE[role.role] : 0;
    const w = weightOf(ctx, m.beat, m.dur);
    fitW += w;
    fitS += w * s;
    if (!isSour(role)) continue;
    const seg = segmentAt(ctx, m.beat);
    const from = byId.get(m.id)!;
    const chord = seg ? chordSymbol(seg.map.chord) : 'the chord';
    misses.push({
      beat: m.beat, bar: barOf(ctx, m.beat), midi: m.midi, fromBar: barOf(ctx, from.beat), fromMidi: from.midi, id: m.id,
      chord, why: whyOf(role, chord), weight: w,
    });
  }
  const fit = fitW ? fitS / fitW : 1;
  misses.sort((a, b) => b.weight - a.weight || a.beat - b.beat);

  // 2 — where both voices sound, do they agree?
  let togW = 0;
  let harshW = 0;
  let span = 0;
  const clashes: CrabClash[] = [];
  const seen = new Set<string>();
  for (let t = 0; t < ctx.totalBeats - 1e-6; t += 0.25) {
    const f = soundingAt(sorted, t);
    const m = soundingAt(mirror, t);
    if (!f || !m) continue;
    span += 0.25;
    const strong = isStrong(ctx, t);
    const w = strong ? 0.5 : 0.25;
    togW += w;
    const ic = mod12(Math.abs(f.midi - m.midi));
    if (!HARSH.has(ic)) continue;
    harshW += w;
    const key = `${f.id}:${m.id}`;
    if (seen.has(key)) continue; // one clash per meeting of two notes
    seen.add(key);
    clashes.push({ beat: t, bar: barOf(ctx, t), forward: f.midi, mirror: m.midi, interval: INTERVAL_NAMES[ic], strong, weight: w });
  }
  const agreement = togW ? 1 - harshW / togW : 1;
  const together = ctx.totalBeats ? span / ctx.totalBeats : 0;
  clashes.sort((a, b) => Number(b.strong) - Number(a.strong) || b.weight - a.weight || a.beat - b.beat);

  // a brief overlap shouldn't swing the whole mark: the voices have to meet for a quarter of the loop to count fully
  const wA = togW ? 0.4 * Math.min(1, together / 0.25) : 0;
  const score = sorted.length ? Math.round(100 * ((1 - wA) * fit + wA * agreement)) : 0;
  const report: CrabReport = {
    mode, mirror, fit, agreement, together, score, verdict: verdictFor(score), palindrome, misses, clashes, observations,
  };
  if (!sorted.length) return report;

  // 3 — say something specific
  if (palindrome) {
    observations.push({ kind: 'good', text: `The chords read the same from either end, so any note that fits going forward fits going back. All that’s left is where the two voices meet.` });
  }
  else if (misses.length) {
    const m = misses[0];
    const fwd = segmentAt(ctx, byId.get(m.id)!.beat);
    observations.push({
      kind: 'idea', bar: m.fromBar,
      text: `The harmony isn’t a palindrome: bar ${m.fromBar + 1} read backwards lands in bar ${m.bar + 1}, over ${m.chord}${fwd ? ` instead of ${chordSymbol(fwd.map.chord)}` : ''}. Mirror the chords and the crab always finds its chord tones.`,
    });
  }
  // two copies of the same note making the same journey get one line, not two
  const journeys = new Set<string>();
  const distinct = misses.filter((m) => {
    const key = `${m.fromBar}:${m.fromMidi}:${m.bar}:${m.chord}`;
    if (journeys.has(key)) return false;
    journeys.add(key);
    return true;
  });
  for (const m of distinct.slice(0, 2)) {
    const from = byId.get(m.id)!;
    const better = from.locked ? undefined : agreeablePitch(ctx, spec, from);
    const fix = better !== undefined && better !== from.midi
      ? `Try ${noteName(ctx, better)} in bar ${m.fromBar + 1} — it works both ways.`
      : from.locked ? `It’s locked, so the crab will have to live with it.`
        : `No single pitch is a chord tone both ways there — keep it short and off the beat, and it passes.`;
    const journey = mode === 'crab'
      ? `read backwards, the ${noteName(ctx, m.fromMidi)} from bar ${m.fromBar + 1} lands over ${m.chord} and ${m.why}`
      : `upside-down and backwards, the ${noteName(ctx, m.fromMidi)} from bar ${m.fromBar + 1} becomes ${noteName(ctx, m.midi)} over ${m.chord}, which ${m.why}`;
    observations.push({ kind: 'fix', bar: m.fromBar, text: `Bar ${m.bar + 1}: ${journey}. ${fix}` });
  }
  if (clashes.length) {
    const c = clashes[0];
    const beatInBar = Math.floor(c.beat - c.bar * ctx.beatsPerBar + 1e-6) + 1;
    observations.push({
      kind: 'fix', bar: c.bar,
      text: `Bar ${c.bar + 1}, beat ${beatInBar}: the voices meet ${c.interval} apart — ${noteName(ctx, c.forward)} against ${noteName(ctx, c.mirror)}${c.strong ? ', on a strong beat' : ''}. Move either one a step and the grind turns into a third.`,
    });
  }
  if (together < 0.25) {
    const lastEnd = Math.max(...sorted.map((n) => n.beat + n.dur));
    const where = lastEnd <= ctx.totalBeats / 2 + 1e-6 ? 'the second half' : 'the empty bars';
    observations.push({
      kind: 'idea',
      text: together === 0
        ? `The two voices never overlap — the crab answers you instead of walking beside you. Write into ${where} and they’ll meet.`
        : `The voices only meet for ${Math.round(together * 100)}% of the loop, so this is mostly the crab answering you. Write into ${where} and the verdict starts to mean something.`,
    });
  }
  else if (!misses.length && !clashes.length) {
    observations.push({ kind: 'good', text: `Every note works in both directions and the voices agree wherever they meet. Take the backing away and the line still carries the chords — twice.` });
  }
  report.observations = observations.slice(0, 4);
  return report;
}

// --- the solver ----------------------------------------------------------------------

/**
 * Make the line agree with itself: each unlocked note moves to the nearest
 * pitch that works over its own chord and over the chord its mirror lands on
 * (a strong or held note wants a chord tone both ways; a passing note just
 * has to avoid rubbing), then strong notes that grind against the other
 * voice step to a consonance. Deterministic, and never hands back a worse
 * score than it was given.
 */
export function crabProof(notes: MelNote[], ctx: MelodyContext, mode: CrabMode): MelNote[] {
  const sorted = sortNotes(notes);
  const spec = mirrorSpec(ctx, sorted, mode);
  const work = sorted.map((n) => ({ ...n }));

  // pass 1: friendly notes in both directions
  work.forEach((n, i) => {
    if (n.locked) return;
    const strict = isStrong(ctx, n.beat) || n.dur >= 1;
    const cands = around(n.midi, strict ? 5 : 2, ctx.lo, ctx.hi);
    const best = strict
      ? cands.find((m) => bothWays(ctx, spec, n, m, 'chord')) ?? cands.find((m) => bothWays(ctx, spec, n, m, 'stable'))
      : bothWays(ctx, spec, n, n.midi, 'stable') ? n.midi : cands.find((m) => bothWays(ctx, spec, n, m, 'stable'));
    if (best !== undefined) work[i] = { ...n, midi: best };
  });

  // pass 2: strong notes that grind against the mirror voice step to a consonance that still fits both chords
  work.forEach((n, i) => {
    if (n.locked || !isStrong(ctx, n.beat)) return;
    const partner = soundingAt(mirrorLead(work, spec), n.beat);
    if (!partner || partner.id === n.id) return;
    if (!HARSH.has(mod12(Math.abs(n.midi - partner.midi)))) return;
    const cands = around(n.midi, 5, ctx.lo, ctx.hi).filter((m) => !HARSH.has(mod12(Math.abs(m - partner.midi))));
    const best = cands.find((m) => bothWays(ctx, spec, n, m, 'chord')) ?? cands.find((m) => bothWays(ctx, spec, n, m, 'stable'));
    if (best !== undefined) work[i] = { ...n, midi: best };
  });

  return analyzeCanon(work, ctx, mode).score >= analyzeCanon(sorted, ctx, mode).score ? work : notes;
}

/** How many notes the solver moved — for the log line. */
export const movedNotes = (before: MelNote[], after: MelNote[]): number => {
  const was = new Map(before.map((n) => [n.id, n.midi] as const));
  return after.filter((n) => was.get(n.id) !== n.midi).length;
};
