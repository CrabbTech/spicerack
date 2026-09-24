// Melodies as data, and the handful of moves that turn a few notes into a
// tune: sequence a motif through the changes, answer it, change its ending,
// stretch it, flip it. Every move is chord-aware — it uses the same solo maps
// the diagrams use, so a motif moved onto Dm lands on F♮, not F♯.
//
// The analyser at the bottom is the "coach": it reads a melody (written, or
// captured from someone playing) against the chords and says something
// specific — which bar, which note, what to try instead.

import { PitchClass, midiLabel, mod12 } from './notes';
import { chordSymbol } from './chords';
import { SoloNote } from './solo';
import { LeadNote, LickSegment, mulberry32 } from './lick';

export interface MelNote {
  id: number;
  /** beats from the top of the section */
  beat: number;
  dur: number;
  midi: number;
  vel: number;
  /** locked notes survive every transform */
  locked?: boolean;
  /** string it was entered on (fretboard click / pasted tab) — a fingering hint, not part of the pitch */
  string?: number;
}

export interface MelodyContext {
  /** one per chord, in play order, with its solo map and exercise view */
  segments: LickSegment[];
  scalePcs: PitchClass[];
  /** playable range on the instrument, inclusive */
  lo: number;
  hi: number;
  beatsPerBar: number;
  totalBeats: number;
  preferFlat?: boolean;
}

let noteCounter = 1;
export const newNoteId = (): number => noteCounter++;
/** Keep fresh ids clear of ids that came back from storage. */
export const reserveNoteIds = (notes: MelNote[]): void => {
  for (const n of notes) noteCounter = Math.max(noteCounter, n.id + 1);
};

export const sortNotes = (notes: MelNote[]): MelNote[] => [...notes].sort((a, b) => a.beat - b.beat || a.midi - b.midi);

export const fromLick = (lick: LeadNote[]): MelNote[] =>
  lick.map((n) => ({ id: newNoteId(), beat: n.beat, dur: n.dur, midi: n.midi, vel: n.vel }));

export const toLead = (notes: MelNote[]): LeadNote[] =>
  sortNotes(notes).map((n) => ({ beat: n.beat, dur: n.dur, midi: n.midi, vel: n.vel }));

export function segmentAt(ctx: MelodyContext, beat: number): LickSegment | undefined {
  return ctx.segments.find((s) => beat >= s.start - 1e-6 && beat < s.start + s.beats - 1e-6);
}

/** What a pitch means over the chord sounding at `beat`; undefined = outside both chord and scale. */
export function roleAt(ctx: MelodyContext, beat: number, midi: number): SoloNote | undefined {
  return segmentAt(ctx, beat)?.map.byPc.get(mod12(midi));
}

export const barCount = (ctx: MelodyContext): number => Math.ceil(ctx.totalBeats / ctx.beatsPerBar - 1e-6);

const barSpan = (ctx: MelodyContext, bar: number): [number, number] =>
  [bar * ctx.beatsPerBar, Math.min(ctx.totalBeats, (bar + 1) * ctx.beatsPerBar)];

const inBar = (ctx: MelodyContext, bar: number) => {
  const [a, b] = barSpan(ctx, bar);
  return (n: MelNote) => n.beat >= a - 1e-6 && n.beat < b - 1e-6;
};

export const notesInBar = (notes: MelNote[], ctx: MelodyContext, bar: number): MelNote[] =>
  sortNotes(notes.filter(inBar(ctx, bar)));

// --- pitch helpers -----------------------------------------------------------

/** Every scale pitch around the playable range, low to high — the ladder diatonic moves climb. */
function ladder(ctx: MelodyContext): number[] {
  const out: number[] = [];
  for (let m = ctx.lo - 12; m <= ctx.hi + 12; m++) if (ctx.scalePcs.includes(mod12(m))) out.push(m);
  return out;
}

const nearestIn = (pool: number[], to: number): number | undefined =>
  pool.reduce<number | undefined>((best, m) => (best === undefined || Math.abs(m - to) < Math.abs(best - to) ? m : best), undefined);

const rung = (steps: number[], midi: number): number => {
  const hit = nearestIn(steps, midi);
  return hit === undefined ? 0 : steps.indexOf(hit);
};

/** Fold a pitch back into the playable range by octaves. */
function fold(ctx: MelodyContext, midi: number): number {
  let m = midi;
  while (m > ctx.hi) m -= 12;
  while (m < ctx.lo) m += 12;
  return Math.min(ctx.hi, Math.max(ctx.lo, m));
}

export const isStrong = (ctx: MelodyContext, beat: number): boolean => {
  const inBarBeat = beat % ctx.beatsPerBar;
  return Math.abs(inBarBeat - Math.round(inBarBeat)) < 1e-6 && Math.round(inBarBeat) % 2 === 0;
};

/** Chord tones of the chord sounding at `beat`, across the playable range. */
function chordTonesAt(ctx: MelodyContext, beat: number): number[] {
  const seg = segmentAt(ctx, beat);
  const out: number[] = [];
  if (!seg) return out;
  for (let m = ctx.lo; m <= ctx.hi; m++) if (seg.map.byPc.get(mod12(m))?.chordDegree !== undefined) out.push(m);
  return out;
}

const clashes = (role: SoloNote | undefined): boolean => !role || role.role === 'avoid' || role.role === 'rub';

/** Strong-beat and held notes that fight their chord move to the nearest chord tone. */
function settle(ctx: MelodyContext, n: MelNote): MelNote {
  if (n.locked || !(isStrong(ctx, n.beat) || n.dur >= 1)) return n;
  if (!clashes(roleAt(ctx, n.beat, n.midi))) return n;
  const home = nearestIn(chordTonesAt(ctx, n.beat), n.midi);
  return home === undefined ? n : { ...n, midi: home };
}

/** Replace the unlocked notes of `bar` with `incoming`, keeping locked ones (and skipping arrivals that land on them). */
function replaceBar(notes: MelNote[], ctx: MelodyContext, bar: number, incoming: MelNote[]): MelNote[] {
  const within = inBar(ctx, bar);
  const kept = notes.filter((n) => !within(n) || n.locked);
  const lockedBeats = kept.filter(within).map((n) => n.beat);
  const fresh = incoming.filter((n) => !lockedBeats.some((b) => Math.abs(b - n.beat) < 1e-6) && n.beat < ctx.totalBeats - 1e-6);
  return sortNotes([...kept, ...fresh]);
}

// --- motif moves -------------------------------------------------------------

/**
 * Sequence: the motif in `srcBar` played again in `dstBar`, shifted along the
 * scale so its first note lands on the new chord's target.
 */
export function sequenceBar(notes: MelNote[], ctx: MelodyContext, srcBar: number, dstBar: number): MelNote[] {
  const motif = notesInBar(notes, ctx, srcBar);
  if (!motif.length || srcBar === dstBar) return notes;
  const steps = ladder(ctx);
  const offset = (dstBar - srcBar) * ctx.beatsPerBar;
  const dstSeg = segmentAt(ctx, motif[0].beat + offset);
  const landing: number[] = [];
  for (let m = ctx.lo; m <= ctx.hi; m++) {
    const role = dstSeg?.map.byPc.get(mod12(m));
    if (dstSeg?.targets.has(mod12(m)) && role?.chordDegree !== undefined) landing.push(m);
  }
  const first = nearestIn(landing.length ? landing : chordTonesAt(ctx, motif[0].beat + offset), motif[0].midi) ?? motif[0].midi;
  const shift = rung(steps, first) - rung(steps, motif[0].midi);
  const moved = motif.map((n, i) => settle(ctx, {
    ...n, id: newNoteId(), locked: false, beat: n.beat + offset,
    midi: i === 0 ? first : fold(ctx, steps[Math.max(0, Math.min(steps.length - 1, rung(steps, n.midi) + shift))]),
  }));
  return replaceBar(notes, ctx, dstBar, moved);
}

/**
 * Same numbers, next chord: the bar moved by exactly the distance between the
 * two chord roots, so every note keeps its degree (R stays R, ♭7 stays ♭7).
 * A major 3rd over a minor chord (or the wrong 7th) bends to fit — the one
 * change a player would make by ear. This is how a lick someone already owns becomes a lick
 * they can play over any chord.
 */
export function transposeToChord(notes: MelNote[], ctx: MelodyContext, srcBar: number, dstBar: number): MelNote[] {
  const motif = notesInBar(notes, ctx, srcBar);
  if (!motif.length || srcBar === dstBar) return notes;
  const offset = (dstBar - srcBar) * ctx.beatsPerBar;
  const src = segmentAt(ctx, motif[0].beat);
  const dst = segmentAt(ctx, motif[0].beat + offset);
  if (!src || !dst) return notes;
  const up = mod12(rootPcOf(dst) - rootPcOf(src));
  // up or down, whichever keeps more of the lick on the instrument
  const outside = (shift: number) => motif.filter((n) => n.midi + shift < ctx.lo || n.midi + shift > ctx.hi).length;
  const shift = [up, up - 12].sort((a, b) => outside(a) - outside(b) || Math.abs(a) - Math.abs(b))[0];
  const moved = motif.map((n) => ({
    ...n, id: newNoteId(), locked: false, beat: n.beat + offset,
    midi: fitQuality(n.midi + shift, dst),
    // the same strings still work when the move is a few frets; otherwise let the tab re-finger it
    string: Math.abs(shift) <= 5 ? n.string : undefined,
  }));
  return replaceBar(notes, ctx, dstBar, moved);
}

const rootPcOf = (seg: LickSegment): PitchClass => seg.map.notes.find((n) => n.role === 'root')?.pc ?? 0;

/**
 * A major 3rd over a minor chord, or a 7th of the wrong kind, moves a half step
 * to the chord's own. The ♭3 over a major chord is left alone on purpose:
 * that rub is the blues, and it's in half the licks anyone knows.
 */
export function fitQuality(midi: number, seg: LickSegment): number {
  const semis = mod12(midi - rootPcOf(seg));
  const has = (degree: number, s: number) => seg.map.notes.some((n) => n.chordDegree === degree && mod12(n.pc - rootPcOf(seg)) === s);
  if (semis === 4 && has(3, 3)) return midi - 1;
  if (semis === 10 && has(7, 11)) return midi + 1;
  if (semis === 11 && has(7, 10)) return midi - 1;
  return midi;
}

/** Same rhythm, new pitches: lands on the target, walks by step, ends somewhere stable. */
export function rerollPitches(notes: MelNote[], ctx: MelodyContext, bar: number, seed: number): MelNote[] {
  const rand = mulberry32(seed * 7919 + bar);
  const motif = notesInBar(notes, ctx, bar);
  let prev: number | undefined = sortNotes(notes).filter((n) => n.beat < barSpan(ctx, bar)[0]).pop()?.midi;
  const center = ctx.lo + (ctx.hi - ctx.lo) * 0.6;
  const next = motif.map((n, i) => {
    if (n.locked) { prev = n.midi; return n; }
    const seg = segmentAt(ctx, n.beat);
    const pool: number[] = [];
    const tones: number[] = [];
    const targets: number[] = [];
    for (let m = ctx.lo; m <= ctx.hi; m++) {
      const role = seg?.map.byPc.get(mod12(m));
      if (!role) continue;
      pool.push(m);
      if (role.chordDegree !== undefined) tones.push(m);
      if (seg?.targets.has(mod12(m)) && role.chordDegree !== undefined) targets.push(m);
    }
    const from = prev ?? center;
    let midi: number;
    if (i === 0 || (seg && Math.abs(n.beat - seg.start) < 1e-6)) midi = nearestIn(targets.length ? targets : tones, from) ?? n.midi;
    else {
      const last = i === motif.length - 1;
      const stable = pool.filter((m) => !clashes(seg?.map.byPc.get(mod12(m))));
      const use = isStrong(ctx, n.beat) && tones.length ? tones : last && stable.length ? stable : pool;
      const pull = from > center + 5 ? -1 : from < center - 5 ? 1 : 0;
      const dir = rand() < 0.5 + 0.3 * pull ? 1 : -1;
      const ahead = use.filter((m) => (dir === 1 ? m > from : m < from));
      const ordered = dir === 1 ? ahead : [...ahead].reverse();
      midi = ordered[Math.min(rand() < 0.25 ? 1 : 0, ordered.length - 1)] ?? nearestIn(use, from) ?? n.midi;
    }
    prev = midi;
    return { ...n, midi };
  });
  const within = inBar(ctx, bar);
  return sortNotes([...notes.filter((n) => !within(n)), ...next]);
}

/** Keep the motif, rewrite where it goes: the last note sets up the next chord (or comes to rest at the end). */
export function changeEnding(notes: MelNote[], ctx: MelodyContext, bar: number, seed: number): MelNote[] {
  const motif = notesInBar(notes, ctx, bar).filter((n) => !n.locked);
  if (!motif.length) return notes;
  const last = motif[motif.length - 1];
  const [, barEnd] = barSpan(ctx, bar);
  const nextSeg = segmentAt(ctx, barEnd % ctx.totalBeats);
  const here = segmentAt(ctx, last.beat);
  const stable: number[] = [];
  for (let m = ctx.lo; m <= ctx.hi; m++) if (!clashes(here?.map.byPc.get(mod12(m)))) stable.push(m);
  // alternate between the two classic endings: lean into the next chord, or come to rest on this one
  const lean = seed % 2 === 0 && nextSeg && nextSeg !== here;
  let goal: number | undefined;
  if (lean && nextSeg) {
    const targets: number[] = [];
    for (let m = ctx.lo; m <= ctx.hi; m++) if (nextSeg.targets.has(mod12(m))) targets.push(m);
    const aim = nearestIn(targets, last.midi);
    const approach = stable.filter((m) => aim !== undefined && m !== aim && Math.abs(m - aim) <= 2 && m !== last.midi);
    goal = nearestIn(approach, last.midi);
  }
  goal ??= nearestIn(chordTonesAt(ctx, last.beat).filter((m) => m !== last.midi), last.midi + (seed % 4 < 2 ? 3 : -3));
  if (goal === undefined) return notes;
  const swap = new Map<number, number>([[last.id, goal]]);
  const before = motif[motif.length - 2];
  if (before) {
    // the note before it becomes a step on the way there
    const between = stable.filter((m) => m !== goal && Math.abs(m - goal!) <= 4 && (m - goal!) * (before.midi - goal! || 1) > 0);
    const step = nearestIn(between, goal + Math.sign(before.midi - goal || 1) * 2);
    if (step !== undefined) swap.set(before.id, step);
  }
  return notes.map((n) => (swap.has(n.id) ? { ...n, midi: swap.get(n.id)! } : n));
}

/** Augment (×2, spilling into the next bar) or diminish (×½, played twice so the bar stays full). */
export function stretchBar(notes: MelNote[], ctx: MelodyContext, bar: number, factor: 2 | 0.5): MelNote[] {
  const motif = notesInBar(notes, ctx, bar).filter((n) => !n.locked);
  if (!motif.length) return notes;
  const [start] = barSpan(ctx, bar);
  const scaled = (at: number) => motif.map((n) => ({
    ...n, id: newNoteId(), beat: at + (n.beat - start) * factor, dur: Math.max(0.25, n.dur * factor),
  }));
  if (factor === 2) {
    const wide = scaled(start).map((n) => settle(ctx, n));
    const cleared = replaceBar(replaceBar(notes, ctx, bar, []), ctx, bar + 1, []);
    return sortNotes([...cleared, ...wide.filter((n) => n.beat < ctx.totalBeats - 1e-6)]);
  }
  const half = ctx.beatsPerBar / 2;
  const twice = [...scaled(start), ...scaled(start + half)].map((n) => settle(ctx, n));
  return replaceBar(notes, ctx, bar, twice);
}

/** Mirror the motif's contour around its first note, along the scale. */
export function invertBar(notes: MelNote[], ctx: MelodyContext, bar: number): MelNote[] {
  const motif = notesInBar(notes, ctx, bar);
  if (motif.length < 2) return notes;
  const steps = ladder(ctx);
  const pivot = rung(steps, motif[0].midi);
  const flipped = motif.map((n) => (n.locked ? n : settle(ctx, {
    ...n, midi: fold(ctx, steps[Math.max(0, Math.min(steps.length - 1, 2 * pivot - rung(steps, n.midi)))]),
  })));
  const within = inBar(ctx, bar);
  return sortNotes([...notes.filter((n) => !within(n)), ...flipped]);
}

/**
 * Answer: the question's rhythm, its contour turned over, and an ending that
 * comes to rest on the chord's root instead of hanging in the air.
 */
export function answerBar(notes: MelNote[], ctx: MelodyContext, srcBar: number, dstBar: number): MelNote[] {
  const motif = notesInBar(notes, ctx, srcBar);
  if (!motif.length || srcBar === dstBar) return notes;
  const steps = ladder(ctx);
  const offset = (dstBar - srcBar) * ctx.beatsPerBar;
  const pivot = rung(steps, motif[0].midi);
  const [, dstEnd] = barSpan(ctx, dstBar);
  const reply = motif.map((n, i) => {
    const beat = n.beat + offset;
    const lastOne = i === motif.length - 1;
    const mirrored = fold(ctx, steps[Math.max(0, Math.min(steps.length - 1, 2 * pivot - rung(steps, n.midi)))]);
    let midi = i === 0 ? motif[0].midi : mirrored;
    let dur = n.dur;
    if (lastOne) {
      const seg = segmentAt(ctx, beat);
      const roots: number[] = [];
      for (let m = ctx.lo; m <= ctx.hi; m++) if (seg?.map.byPc.get(mod12(m))?.role === 'root') roots.push(m);
      midi = nearestIn(roots, midi) ?? midi;
      dur = Math.max(dur, Math.min(2, dstEnd - beat - 0.25));
    }
    return settle(ctx, { ...n, id: newNoteId(), locked: false, beat, midi, dur });
  });
  return replaceBar(notes, ctx, dstBar, reply);
}

/** Every strong or held note that fights its chord moves to the nearest chord tone. */
export const fixClashes = (notes: MelNote[], ctx: MelodyContext): MelNote[] => notes.map((n) => settle(ctx, n));

export const shiftOctave = (notes: MelNote[], ctx: MelodyContext, dir: 1 | -1): MelNote[] => {
  const moved = notes.map((n) => (n.locked ? n : { ...n, midi: n.midi + 12 * dir }));
  return moved.every((n) => n.midi >= ctx.lo && n.midi <= ctx.hi) ? moved : notes;
};

/** Snap captured notes to a grid, merging duplicates that land on the same cell. */
export function quantize(notes: MelNote[], grid: number, totalBeats: number): MelNote[] {
  const seen = new Set<string>();
  const out: MelNote[] = [];
  for (const n of sortNotes(notes)) {
    let beat = Math.round(n.beat / grid) * grid;
    if (beat >= totalBeats - 1e-6) beat = 0; // a hair before the loop point belongs to the downbeat
    const key = `${beat}:${n.midi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...n, beat, dur: Math.max(grid, Math.round(n.dur / grid) * grid) });
  }
  return out;
}

// --- the coach -----------------------------------------------------------------

export interface Observation {
  kind: 'good' | 'fix' | 'idea';
  text: string;
  /** zero-based bar the remark points at, when it points anywhere */
  bar?: number;
}

export interface LandingCheck {
  segment: number;
  chord: string;
  bar: number;
  /** what was sounding when the chord arrived; undefined = nothing */
  midi?: number;
  hit: boolean;
}

export interface MelodyReport {
  noteCount: number;
  landings: LandingCheck[];
  /** fraction of the loop with nothing sounding */
  space: number;
  observations: Observation[];
}

/** The note a listener hears "at" a chord change: struck just around it, or held across it. */
export function noteAtChange(notes: MelNote[], start: number, total: number): MelNote | undefined {
  const near = (n: MelNote) => {
    let d = n.beat - start;
    if (d > total / 2) d -= total; // a pickup before the loop point belongs to beat 0
    return d;
  };
  const struck = notes.filter((n) => near(n) >= -0.3 && near(n) <= 0.55).sort((a, b) => Math.abs(near(a)) - Math.abs(near(b)))[0];
  return struck ?? notes.find((n) => n.beat < start && n.beat + n.dur > start + 0.25);
}

export function analyzeMelody(notes: MelNote[], ctx: MelodyContext): MelodyReport {
  const sorted = sortNotes(notes);
  const name = (midi: number) => midiLabel(midi, ctx.preferFlat ? 'flat' : 'sharp').replace(/-?\d+$/, '');
  const barOf = (beat: number) => Math.floor(beat / ctx.beatsPerBar + 1e-6);
  const observations: Observation[] = [];

  const landings: LandingCheck[] = ctx.segments.map((seg, i) => {
    const n = noteAtChange(sorted, seg.start, ctx.totalBeats);
    const role = n ? seg.map.byPc.get(mod12(n.midi)) : undefined;
    return { segment: i, chord: chordSymbol(seg.map.chord), bar: barOf(seg.start), midi: n?.midi, hit: !!n && role?.chordDegree !== undefined };
  });

  let sounding = 0;
  for (let b = 0; b < ctx.totalBeats; b += 0.25) {
    if (sorted.some((n) => n.beat <= b + 1e-6 && n.beat + n.dur > b + 1e-6)) sounding += 0.25;
  }
  const space = ctx.totalBeats ? 1 - sounding / ctx.totalBeats : 1;
  const report: MelodyReport = { noteCount: sorted.length, landings, space, observations };
  if (sorted.length < 2) return report;

  // 1 — do the chord changes land?
  const attempted = landings.filter((l) => l.midi !== undefined);
  const missed = attempted.filter((l) => !l.hit);
  if (attempted.length >= 2 && !missed.length) {
    observations.push({ kind: 'good', text: `Every chord change lands on a chord tone — the line spells the harmony by itself. You could turn the backing off and still hear the chords.` });
  }
  for (const miss of missed.slice(0, 2)) {
    const seg = ctx.segments[miss.segment];
    const role = seg.map.byPc.get(mod12(miss.midi!));
    const better = seg.map.notes.filter((x) => x.chordDegree !== undefined)
      .sort((a, b) => Math.min(mod12(a.pc - miss.midi!), mod12(miss.midi! - a.pc)) - Math.min(mod12(b.pc - miss.midi!), mod12(miss.midi! - b.pc)))
      .slice(0, 2).map((x) => x.label);
    const why = !role ? `isn't in the chord or the scale`
      : role.role === 'avoid' ? `sits a half step above a chord tone`
        : role.role === 'rub' ? `is the note ${miss.chord} bends out of shape`
          : `is a color note, so the chord doesn't quite "arrive"`;
    observations.push({ kind: 'fix', bar: miss.bar, text: `Bar ${miss.bar + 1}: ${miss.chord} arrives on ${name(miss.midi!)}, which ${why}. Try ${better.join(' or ')} there.` });
  }

  // 2 — parked on something sour?
  const parked = sorted.find((n) => n.dur >= 1 && clashes(roleAt(ctx, n.beat, n.midi)) && !missed.some((m) => m.midi === n.midi && m.bar === barOf(n.beat)));
  if (parked) {
    const seg = segmentAt(ctx, parked.beat);
    const home = nearestIn(chordTonesAt(ctx, parked.beat), parked.midi);
    observations.push({
      kind: 'fix', bar: barOf(parked.beat),
      text: `Bar ${barOf(parked.beat) + 1}: ${name(parked.midi)} is held over ${seg ? chordSymbol(seg.map.chord) : 'the chord'} and it rubs. Passing through it is fine — parking isn't.${home !== undefined ? ` ${name(home)} is right next door.` : ''}`,
    });
  }

  // 3 — does it breathe?
  if (space < 0.12) observations.push({ kind: 'idea', text: `There's almost no silence in this. Delete the last note or two of a bar — a phrase needs an end before the next one can begin.` });
  else if (space > 0.3 && space < 0.75) observations.push({ kind: 'good', text: `About ${Math.round(space * 100)}% of the loop is silence — the phrases have room to mean something.` });

  // 4 — is there an idea, or just notes?
  const bars = barCount(ctx);
  const rhythms = Array.from({ length: bars }, (_, b) => notesInBar(sorted, ctx, b).map((n) => (n.beat - b * ctx.beatsPerBar).toFixed(2)).join(','));
  const filled = rhythms.filter((r) => r);
  if (filled.length >= 3) {
    const distinct = new Set(filled).size;
    if (distinct === filled.length) {
      observations.push({ kind: 'idea', text: `Every bar has a brand-new rhythm. Repetition is what turns notes into a motif — pick your favourite bar and Sequence it into the next one.` });
    }
    else if (distinct === 1) {
      const lastBar = rhythms.map((r, i) => (r ? i : -1)).filter((i) => i >= 0).pop()!;
      observations.push({ kind: 'idea', bar: lastBar, text: `Same rhythm in every bar — solid, but predictable by bar ${Math.min(4, filled.length)}. Break the pattern once: Change ending on bar ${lastBar + 1}.` });
    }
    else observations.push({ kind: 'good', text: `The rhythm repeats and then changes — that's a motif being developed, not just notes.` });
  }

  // 5 — shape
  const pitches = sorted.map((n) => n.midi);
  const range = Math.max(...pitches) - Math.min(...pitches);
  let leap = 0;
  let leapAt = 0;
  sorted.forEach((n, i) => {
    if (i && Math.abs(n.midi - sorted[i - 1].midi) > leap) { leap = Math.abs(n.midi - sorted[i - 1].midi); leapAt = barOf(n.beat); }
  });
  if (range <= 4 && sorted.length >= 6) observations.push({ kind: 'idea', text: `The whole line lives inside ${range} semitones. Great for a hook — but give it one reach upward somewhere so it has a peak.` });
  else if (leap >= 10) observations.push({ kind: 'idea', bar: leapAt, text: `Bar ${leapAt + 1} has a leap of ${leap} semitones. Big leaps are memorable once; step back the other way right after so it sounds intended.` });

  report.observations = observations.slice(0, 4);
  return report;
}
