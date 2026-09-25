// The burrow: transformational ear training as a descent. The crab digs
// under one of the genre's loops a floor at a time. Every floor changes one
// chord — the spice rack's own moves, applied to the loop as it now stands —
// and asks which. Near the surface both loops play; deeper, only the new one,
// and the old one has to be held in the ear. Where the genre carries the
// truck driver, the burrow turns a whole step up on the way down. Deep
// floors change two chords. When the rack has nothing left that would change
// a chord, that is bedrock. Whatever the burrow dug lands on the bench, and
// every floor is a line in the journal, in the rack's own words.
//
// Data in, data out: nothing here touches React or the audio engine.

import { Slot, newSlot } from '../theory/progression';
import { Key, ModeId, flatLeaning } from '../theory/scales';
import { mod12, notePc, spellPcSimple } from '../theory/notes';
import { BOLD_SPICES, GENTLE_SPICES, ProgressionPatch, SPICES, SpiceApplication, SpiceContext, SpiceId, findAllApplications } from '../theory/spices';
import { ProgressionTemplate } from '../data/genres';

/** A loop never grows past this: eight chords is as much as an ear can hold, and as much as a bench row shows well. */
export const MAX_SLOTS = 8;

/** What the crab is digging through, floor by floor. */
export const STRATA = ['sand', 'grit', 'wet sand', 'clay', 'peat', 'silt', 'gravel', 'marl', 'chalk', 'flint', 'slate', 'granite'];

export const strataName = (depth: number): string => (depth <= 0 ? 'surface' : STRATA[Math.min(depth, STRATA.length) - 1]);

/** From this floor down only the new loop plays. */
export const MEMORY_FLOOR = 4;
/** The floor where a genre with the truck driver turns a whole step up. */
export const GEAR_FLOOR = 4;
/** From this floor down two chords change at once. */
export const PAIR_FLOOR = 8;

/** One move of the rack, with its own explanation — the same shape the bench applies (SpiceStep). */
export interface BurrowStep {
  spiceId: SpiceId;
  spiceName: string;
  explanation: string;
  patch: ProgressionPatch;
  /** the positions in the floor's `after` this move accounts for; none for the turn */
  at: number[];
}

export interface FloorRules {
  hearBoth: boolean;
  wanted: 1 | 2;
  gear: boolean;
}

export function rulesFor(depth: number, hasGear: boolean, gearDone: boolean): FloorRules {
  return {
    hearBoth: depth < MEMORY_FLOOR,
    wanted: depth >= PAIR_FLOOR ? 2 : 1,
    gear: hasGear && !gearDone && depth === GEAR_FLOOR,
  };
}

export interface BurrowFloor {
  depth: number;
  strata: string;
  before: Slot[];
  after: Slot[];
  /** positions in `after` that are new or changed; empty on a gear floor */
  changed: number[];
  steps: BurrowStep[];
  hearBoth: boolean;
  wanted: 1 | 2;
  /** semitones the burrow turned by on this floor */
  gear?: number;
}

export interface BurrowRun {
  genreId: string;
  mode: ModeId;
  tonicIdx: number;
  templateName: string;
  surface: Slot[];
  floors: BurrowFloor[];
  /** 0, then 2 once the burrow has turned */
  transpose: number;
  ended?: 'miss' | 'bedrock' | 'quit';
  /** the picks that ended it, on a miss */
  missed?: number[];
}

const sameChord = (a: Slot, b: Slot): boolean => a.numeral === b.numeral && !!a.pedalBass === !!b.pedalBass;

/**
 * Where two loops differ: the positions in `after` outside their longest
 * common prefix and suffix. A replacement gives one index, an insertion of k
 * chords gives k, a pedal bass under an unchanged numeral counts as a change,
 * and two identical loops give none.
 */
export function changedRegion(before: Slot[], after: Slot[]): number[] {
  const shorter = Math.min(before.length, after.length);
  let p = 0;
  while (p < shorter && sameChord(before[p], after[p])) p++;
  let s = 0;
  while (s < shorter - p && sameChord(before[before.length - 1 - s], after[after.length - 1 - s])) s++;
  const out: number[] = [];
  for (let i = p; i < after.length - s; i++) out.push(i);
  return out;
}

/**
 * Every set of `k` positions in `after` that reads as "these are the new or
 * changed chords" against `before`: the chords left over must be the old loop
 * in order, and each picked chord is either an insertion or a replacement of
 * a chord it differs from. A floor is only asked when exactly one such set
 * exists, so a listener who parsed the loop correctly cannot be marked wrong
 * (an inserted pair next to an identical chord can be heard two ways).
 */
export function validPicks(before: Slot[], after: Slot[], k: number): number[][] {
  const inserted = after.length - before.length;
  if (inserted < 0 || inserted > k) return [];
  const fits = (picked: Set<number>): boolean => {
    const walk = (i: number, j: number, left: number): boolean => {
      if (i === after.length) return j === before.length && left === 0;
      if (picked.has(i)) {
        if (left > 0 && walk(i + 1, j, left - 1)) return true;
        return j < before.length && !sameChord(before[j], after[i]) && walk(i + 1, j + 1, left);
      }
      return j < before.length && sameChord(before[j], after[i]) && walk(i + 1, j + 1, left);
    };
    return walk(0, 0, inserted);
  };
  const out: number[][] = [];
  const pick = (from: number, chosen: number[]) => {
    if (chosen.length === k) {
      if (fits(new Set(chosen))) out.push([...chosen]);
      return;
    }
    for (let i = from; i <= after.length - (k - chosen.length); i++) pick(i + 1, [...chosen, i]);
  };
  pick(0, []);
  return out;
}

/** True when the only way to hear `after` against `before` is that exactly `changed` is new. */
const unambiguous = (before: Slot[], after: Slot[], changed: number[]): boolean => {
  const sets = validPicks(before, after, changed.length);
  return sets.length === 1 && sets[0].every((i, n) => i === changed[n]);
};

/** The loop as the burrow plays it: one bar a chord, so a floor is over quickly. */
export const surfaceFrom = (t: ProgressionTemplate): Slot[] =>
  t.numerals.map((n, i) => newSlot(n, Math.min(1, t.bars?.[i] ?? 1)));

/** A loop to dig under: short enough to leave room for insertions, long enough to be a loop. */
export function pickSurface(templates: ProgressionTemplate[], rand: () => number): ProgressionTemplate | undefined {
  const tiers = [[3, 5], [3, 6], [2, MAX_SLOTS]];
  for (const [lo, hi] of tiers) {
    const pool = templates.filter((t) => t.numerals.length >= lo && t.numerals.length <= hi);
    if (pool.length) return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  }
  return undefined;
}

export function startRun(genreId: string, mode: ModeId, tonicIdx: number, tpl: ProgressionTemplate): BurrowRun {
  return { genreId, mode, tonicIdx, templateName: tpl.name, surface: surfaceFrom(tpl), floors: [], transpose: 0 };
}

/** The key a whole step (or any distance) up, spelled the way the truck driver spells it. */
export function keyUp(key: Key, semis: number): Key {
  if (!semis) return key;
  return { ...key, tonic: spellPcSimple(mod12(notePc(key.tonic) + semis), flatLeaning(key) ? 'flat' : 'sharp') };
}

/** Spices whose name has never been written into the journal — the burrow leans toward them. */
export function unheardSpices(journal: { kind: string; title: string }[], allowed: SpiceId[]): Set<SpiceId> {
  const heard = new Set(journal.filter((e) => e.kind === 'spice').map((e) => e.title));
  return new Set(allowed.filter((id) => !heard.has(SPICES[id].name)));
}

export interface DigOptions {
  hasGear: boolean;
  unheard: ReadonlySet<SpiceId>;
  lastSpiceId?: SpiceId;
  rand: () => number;
}

const toStep = (app: SpiceApplication, patch: ProgressionPatch, at: number[]): BurrowStep =>
  ({ spiceId: app.spiceId, spiceName: app.spiceName, explanation: app.explanation, patch, at });

interface Candidate {
  spiceId: SpiceId;
  steps: BurrowStep[];
  after: Slot[];
  changed: number[];
}

/** Every move on `prev` that changes exactly one chord (and keeps the loop within the cap). */
function singles(prev: Slot[], ctx: SpiceContext, pool: SpiceId[]): Candidate[] {
  const out: Candidate[] = [];
  for (const app of findAllApplications(prev, ctx, pool)) {
    const patch = app.apply();
    const after = patch.slots;
    if (!after || after.length > MAX_SLOTS || patch.modulate !== undefined) continue;
    const changed = changedRegion(prev, after);
    if (changed.length !== 1 || !unambiguous(prev, after, changed)) continue;
    out.push({ spiceId: app.spiceId, steps: [toStep(app, patch, changed)], after, changed });
  }
  return out;
}

/** Two chords change: one move that inserts two, or two moves in a row that each change one. */
function pairs(prev: Slot[], ctx: SpiceContext, pool: SpiceId[]): Candidate[] {
  const out: Candidate[] = [];
  let examined = 0;
  for (const app of findAllApplications(prev, ctx, pool)) {
    if (examined++ >= 24) break;
    const patch = app.apply();
    const after = patch.slots;
    if (!after || after.length > MAX_SLOTS || patch.modulate !== undefined) continue;
    const region = changedRegion(prev, after);
    if (region.length === 2) {
      if (unambiguous(prev, after, region)) out.push({ spiceId: app.spiceId, steps: [toStep(app, patch, region)], after, changed: region });
      continue;
    }
    if (region.length !== 1) continue;
    const first = region[0];
    // every second move that fits is a candidate of its own, so the dice (not rack order) pick it
    for (const second of findAllApplications(after, ctx, pool.filter((id) => id !== app.spiceId))) {
      const patch2 = second.apply();
      const after2 = patch2.slots;
      if (!after2 || after2.length > MAX_SLOTS || patch2.modulate !== undefined) continue;
      const r2 = changedRegion(after, after2);
      if (r2.length !== 1) continue;
      const grew = after2.length - after.length;
      // the first change moves along if the second inserted ahead of it; it is lost if the second overwrote it
      if (grew === 0 && r2[0] === first) continue;
      const moved = grew > 0 && r2[0] <= first ? first + grew : first;
      const changed = [moved, r2[0]].sort((a, b) => a - b);
      if (!unambiguous(prev, after2, changed)) continue;
      out.push({ spiceId: app.spiceId, steps: [toStep(app, patch, [moved]), toStep(second, patch2, [r2[0]])], after: after2, changed });
    }
  }
  return out;
}

function roll<T extends { weight: number }>(items: T[], rand: () => number): T {
  const total = items.reduce((n, it) => n + it.weight, 0);
  let r = rand() * total;
  for (const it of items) {
    r -= it.weight;
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

/**
 * Group by the first spice so a prolific spice never dominates the dice; weight
 * what has never been heard up, the last move down — and a second move of a
 * pair the same way, so the last spice heard is damped wherever it sits.
 */
function choose(cands: Candidate[], opts: DigOptions): Candidate {
  const factor = (id: SpiceId) => (opts.unheard.has(id) ? 3 : 1) * (id === opts.lastSpiceId ? 0.25 : 1);
  const bySpice = new Map<SpiceId, Candidate[]>();
  for (const c of cands) bySpice.set(c.spiceId, [...(bySpice.get(c.spiceId) ?? []), c]);
  const group = roll([...bySpice.entries()].map(([id, list]) => ({ list, weight: factor(id) })), opts.rand);
  return roll(group.list.map((c) => ({ c, weight: c.steps.slice(1).reduce((w, s) => w * factor(s.spiceId), 1) })), opts.rand).c;
}

/** The next floor down, or undefined when the rack has nothing left that would change a chord: bedrock. */
export function digFloor(run: BurrowRun, ctx: SpiceContext, allowed: SpiceId[], opts: DigOptions): BurrowFloor | undefined {
  const prev = run.floors.length ? run.floors[run.floors.length - 1].after : run.surface;
  const depth = run.floors.length + 1;
  const rules = rulesFor(depth, opts.hasGear, run.transpose !== 0);
  const strata = strataName(depth);

  const pool = allowed.filter((id) => id !== 'truck-driver');
  const narrow = depth <= 2 ? pool.filter((id) => GENTLE_SPICES.has(id))
    : depth >= PAIR_FLOOR ? pool.filter((id) => BOLD_SPICES.has(id))
    : pool;
  const tries: { pool: SpiceId[]; wanted: 1 | 2 }[] = [];
  if (narrow.length) tries.push({ pool: narrow, wanted: rules.wanted });
  tries.push({ pool, wanted: rules.wanted });
  // a false bedrock is worse than an off-rule floor: an easy one deep down, a double one higher up
  tries.push({ pool, wanted: rules.wanted === 2 ? 1 : 2 });

  let found: { wanted: 1 | 2; cands: Candidate[] } | undefined;
  for (const t of tries) {
    const cands = t.wanted === 2 ? pairs(prev, ctx, t.pool) : singles(prev, ctx, t.pool);
    if (cands.length) {
      found = { wanted: t.wanted, cands };
      break;
    }
  }
  if (!found) return undefined; // bedrock — the burrow does not turn onto nothing, so this is checked before the gear

  if (rules.gear) {
    const app = SPICES['truck-driver'].find(prev, ctx)[0];
    if (app) {
      const patch = app.apply();
      return { depth, strata, before: prev, after: prev, changed: [], steps: [toStep(app, patch, [])], hearBoth: false, wanted: 1, gear: patch.modulate ?? 2 };
    }
  }

  const c = choose(found.cands, opts);
  return { depth, strata, before: prev, after: c.after, changed: c.changed, steps: c.steps, hearBoth: rules.hearBoth, wanted: found.wanted };
}

/** Right when the picks are exactly the changed positions, in any order. */
export function judgeFloor(floor: BurrowFloor, picks: number[]): boolean {
  if (picks.length !== floor.changed.length) return false;
  const want = new Set(floor.changed);
  return picks.every((p) => want.has(p)) && new Set(picks).size === picks.length;
}

const floorWord = (run: BurrowRun): string => `floor ${run.floors.length} (${strataName(run.floors.length)})`;

/** The bench note: how the loop got here. */
export function descentNote(run: BurrowRun, genreName: string): string {
  const turned = run.floors.find((f) => f.gear);
  const base = `Dug from ${run.templateName} to ${floorWord(run)} in ${genreName}`;
  return turned ? `${base}; the burrow turned at floor ${turned.depth}, so it climbs a whole step every other pass.` : `${base}.`;
}

/** What lands on the bench: the surface, named for the descent, with the floors to be applied on top. */
export function benchTemplate(run: BurrowRun, genreName: string): ProgressionTemplate {
  return {
    name: `${run.templateName}, dug to floor ${run.floors.length}`,
    mode: run.mode,
    numerals: run.surface.map((s) => s.numeral),
    bars: run.surface.map((s) => s.bars),
    note: descentNote(run, genreName),
  };
}

const list = (words: string[]): string => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** The last line of a descent, in the journal's own present-tense register. */
export function closingLine(run: BurrowRun, genreName: string, rackSize: number): { title: string; text: string } {
  const title = 'The burrow';
  const last = run.floors[run.floors.length - 1];
  if (run.ended === 'miss' && last) {
    // each move named at the chord it made, in loop order; spice names keep their case (♭VII is not ♭vii)
    const chords = (at: number[]) => `chord${at.length > 1 ? 's' : ''} ${list(at.map((i) => `${i + 1}`))}`;
    const parts = [...last.steps].sort((a, b) => (a.at[0] ?? 0) - (b.at[0] ?? 0)).map((s) => `${chords(s.at)}, the ${s.spiceName}`);
    return { title, text: `Floor ${last.depth}, ${last.strata}. It was ${parts.join(', and ')}. The crab stops digging; what it dug is on the bench.` };
  }
  if (run.ended === 'bedrock') {
    const depth = run.floors.length;
    const full = last && last.after.length >= MAX_SLOTS;
    const ground = full
      ? `Bedrock: the loop is ${MAX_SLOTS} chords long and there is no room left to dig.`
      : `Bedrock: ${genreName} is shallow ground, ${rackSize} spice${rackSize === 1 ? '' : 's'} on its rack and ${depth ? 'the loop has used what fits' : 'none of them fits this loop'}.`;
    if (!depth) return { title, text: `At the surface. ${ground} Nothing to land; try another loop or genre.` };
    return { title, text: `Floor ${depth}, ${strataName(depth)}. ${ground} Everything the crab dug is on the bench.` };
  }
  if (!run.floors.length) return { title, text: 'Came up at the surface. Nothing dug, nothing landed.' };
  return { title, text: `Came up at ${floorWord(run)}. The loop as it stood is on the bench.` };
}
