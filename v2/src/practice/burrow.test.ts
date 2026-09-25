import { describe, expect, it } from 'vitest';
import { GENRES, GENRE_LIST, Genre } from '../data/genres';
import { Slot, newSlot } from '../theory/progression';
import { SpiceContext, SpiceId } from '../theory/spices';
import { Key, ModeId } from '../theory/scales';
import { mulberry32 } from '../theory/lick';
import {
  BurrowFloor, BurrowRun, BurrowStep, MAX_SLOTS, PAIR_FLOOR, MEMORY_FLOOR, changedRegion, closingLine, descentNote, digFloor, judgeFloor, keyUp,
  pickSurface, rulesFor, startRun, strataName, unheardSpices, validPicks,
} from './burrow';

const slots = (...numerals: string[]): Slot[] => numerals.map((n) => newSlot(n));
const A: Key = { tonic: { letter: 'A', alter: 0 }, mode: 'major' };
const ctxFor = (genre: Genre, mode: ModeId): SpiceContext => ({ key: { ...A, mode }, flavor: genre.flavor });
const allowedOf = (genre: Genre): SpiceId[] => genre.spices.filter((s) => s !== 'truck-driver');

/** Dig until bedrock (or a cap), the way the controller does, with a fixed seed. */
function descend(genre: Genre, mode: ModeId, seed: number, cap = 14, unheard: SpiceId[] = []): BurrowRun {
  const rand = mulberry32(seed);
  const tpl = pickSurface(genre.templates.filter((t) => t.mode === mode), rand);
  if (!tpl) throw new Error(`nothing to dig under in ${genre.name}`);
  let run = startRun(genre.id, mode, 0, tpl);
  const hasGear = genre.spices.includes('truck-driver');
  while (run.floors.length < cap) {
    const ctx = ctxFor(genre, mode);
    const floor = digFloor(run, run.transpose ? { ...ctx, key: keyUp(ctx.key, run.transpose) } : ctx, allowedOf(genre), {
      hasGear, unheard: new Set(unheard), lastSpiceId: run.floors[run.floors.length - 1]?.steps.slice(-1)[0]?.spiceId, rand,
    });
    if (!floor) {
      run = { ...run, ended: 'bedrock' };
      break;
    }
    run = { ...run, floors: [...run.floors, floor], transpose: floor.gear ?? run.transpose };
  }
  return run;
}

/** Apply a floor's patches the way apply-batch does: the last patch with slots wins. */
const landed = (floor: BurrowFloor): Slot[] => floor.steps.reduce((acc, s) => s.patch.slots ?? acc, floor.before);

describe('where two loops differ', () => {
  it('finds a replacement, an insertion, a double insertion, and nothing for a pedal bass', () => {
    expect(changedRegion(slots('I', 'vi', 'IV', 'V'), slots('I', 'vi', 'iv', 'V'))).toEqual([2]);
    expect(changedRegion(slots('I', 'vi', 'IV', 'V'), slots('I', 'vi', 'IV', 'bVII7', 'V'))).toEqual([3]);
    expect(changedRegion(slots('I', 'IV', 'V', 'I'), slots('I', 'IV', 'bVI', 'bVII', 'V', 'I'))).toEqual([2, 3]);
    const before = slots('I', 'IV', 'V', 'I');
    const after = before.map((s, i) => (i === 1 ? { ...s, pedalBass: true } : s));
    expect(changedRegion(before, after)).toEqual([1]);
    expect(changedRegion(before, before.map((s) => ({ ...s })))).toEqual([]);
    expect(changedRegion(slots('i', 'iv', 'V', 'i'), slots('i', 'bVII', 'bVI', 'V', 'i'))).toEqual([1, 2]);
  });

  it('lists every way a floor can be heard, so the burrow asks only when there is one', () => {
    // a replacement and a single insertion read one way
    expect(validPicks(slots('I', 'vi', 'IV', 'V'), slots('I', 'vi', 'iv', 'V'), 1)).toEqual([[2]]);
    expect(validPicks(slots('I', 'vi', 'IV', 'V'), slots('I', 'vi', 'IV', 'bVII7', 'V'), 1)).toEqual([[3]]);
    expect(validPicks(slots('I', 'IV', 'V', 'I'), slots('I', 'IV', 'bVI', 'bVII', 'V', 'I'), 2)).toEqual([[2, 3]]);
    // a change and an insertion together
    expect(validPicks(slots('I', 'IV', 'V'), slots('I', 'ii', 'V7/V', 'V'), 2)).toEqual([[1, 2]]);
    // an inserted pair beside an identical chord reads two ways: V7/V Vsus4 before the V, or after the Vsus4
    const before = slots('I', 'vi7', 'iv7', 'bVII', 'Vsus4', 'V');
    const after = slots('I', 'vi7', 'iv7', 'bVII', 'Vsus4', 'V7/V', 'Vsus4', 'V');
    expect(validPicks(before, after, 2)).toEqual([[4, 5], [5, 6]]);
    // the wrong count reads no way, and pointing at an unchanged chord is never a reading
    expect(validPicks(before, after, 1)).toEqual([]);
    expect(validPicks(slots('I', 'IV', 'V'), slots('I', 'IV', 'V'), 1)).toEqual([]);
  });
});

describe('the rules of the descent', () => {
  it('plays both loops near the surface, one loop below, two changes deep down, and turns once', () => {
    expect(rulesFor(1, true, false)).toEqual({ hearBoth: true, wanted: 1, gear: false });
    expect(rulesFor(MEMORY_FLOOR, false, false).hearBoth).toBe(false);
    expect(rulesFor(4, true, false).gear).toBe(true);
    expect(rulesFor(4, true, true).gear).toBe(false);
    expect(rulesFor(4, false, false).gear).toBe(false);
    expect(rulesFor(PAIR_FLOOR, false, false).wanted).toBe(2);
    expect(strataName(0)).toBe('surface');
    expect(strataName(1)).toBe('sand');
    expect(strataName(40)).toBe('granite');
  });

  it('spells the key a whole step up the way the truck driver does', () => {
    expect(keyUp(A, 2).tonic).toEqual({ letter: 'B', alter: 0 });
    expect(keyUp({ ...A, tonic: { letter: 'F', alter: 0 } }, 2).tonic).toEqual({ letter: 'G', alter: 0 });
    expect(keyUp({ ...A, tonic: { letter: 'B', alter: -1 } }, 2).tonic).toEqual({ letter: 'C', alter: 0 });
    expect(keyUp(A, 0)).toBe(A);
  });

  it('judges picks as a set', () => {
    const floor = { changed: [1, 3] } as BurrowFloor;
    expect(judgeFloor(floor, [3, 1])).toBe(true);
    expect(judgeFloor(floor, [1])).toBe(false);
    expect(judgeFloor(floor, [1, 1])).toBe(false);
    expect(judgeFloor(floor, [1, 3, 0])).toBe(false);
  });
});

describe('digging', () => {
  it('finds a first floor under most genres, and every floor changes only what it says', () => {
    let dug = 0;
    for (const genre of GENRE_LIST) {
      const run = descend(genre, genre.modes[0], 3);
      if (!run.floors.length) continue;
      dug++;
      for (const floor of run.floors) {
        expect(floor.after.length).toBeLessThanOrEqual(MAX_SLOTS);
        if (floor.gear) {
          expect(floor.changed).toEqual([]);
          expect(floor.after).toBe(floor.before);
          continue;
        }
        expect(floor.changed.length).toBeGreaterThan(0);
        expect(floor.changed.length).toBeLessThanOrEqual(floor.wanted);
        // one move: the region is the answer; two moves: the answer sits inside the span between them
        const span = changedRegion(floor.before, floor.after);
        if (floor.steps.length === 1) expect(span).toEqual(floor.changed);
        else for (const i of floor.changed) expect(span).toContain(i);
        // the question has exactly one right answer, and each move knows the chord it made
        expect(validPicks(floor.before, floor.after, floor.changed.length)).toEqual([floor.changed]);
        expect(floor.steps.flatMap((s) => s.at).sort((a, b) => a - b)).toEqual(floor.changed);
        for (const s of floor.steps) expect(s.explanation.length).toBeGreaterThan(20);
        // the journal and the bench agree: applying the steps lands where the ear went
        expect(landed(floor)).toBe(floor.after);
      }
    }
    expect(dug).toBeGreaterThan(GENRE_LIST.length * 0.7);
  });

  it('descends floor by floor, each floor starting where the last one ended, and turns exactly once where the rack allows', () => {
    for (const genre of GENRE_LIST) {
      const run = descend(genre, genre.modes[0], 11);
      let prev = run.surface;
      let turns = 0;
      for (const floor of run.floors) {
        expect(floor.before).toBe(prev);
        expect(floor.hearBoth).toBe(floor.depth < MEMORY_FLOOR);
        if (floor.gear) {
          turns++;
          expect(floor.depth).toBe(4);
          // the burrow never turns onto nothing: a floor always follows the gear
          expect(run.floors[floor.depth]).toBeDefined();
          expect(run.floors[floor.depth].gear).toBeUndefined();
        }
        prev = floor.after;
      }
      expect(turns).toBe(genre.spices.includes('truck-driver') && run.floors.length >= 4 ? 1 : 0);
      expect(run.transpose).toBe(turns ? 2 : 0);
      expect(run.floors.length <= 14 || run.ended === 'bedrock').toBe(true);
    }
  });

  it('is the same descent for the same seed', () => {
    const a = descend(GENRES.pop, 'major', 5);
    const b = descend(GENRES.pop, 'major', 5);
    expect(a.floors.map((f) => f.steps.map((s) => s.spiceName))).toEqual(b.floors.map((f) => f.steps.map((s) => s.spiceName)));
    expect(a.floors.map((f) => f.after.map((s) => s.numeral))).toEqual(b.floors.map((f) => f.after.map((s) => s.numeral)));
  });

  it('reaches bedrock in shallow ground and says so by name', () => {
    const run = descend(GENRES.thrash, GENRES.thrash.modes[0], 2, 30);
    expect(run.ended).toBe('bedrock');
    const line = closingLine(run, GENRES.thrash.name, GENRES.thrash.spices.length);
    expect(line.title).toBe('The burrow');
    expect(line.text).toMatch(/^Floor \d+, [a-z ]+\. Bedrock: /);
    expect(line.text).toContain('Everything the crab dug is on the bench.');
  });

  it('leans toward spices the journal has never heard', () => {
    const genre = GENRES['neo-soul'];
    const tpl = genre.templates.find((t) => t.mode === 'major' && t.numerals.length <= 5)!;
    const run = startRun(genre.id, 'major', 0, tpl);
    const allowed = allowedOf(genre);
    // every allowed spice heard but one: with a middling roll the unheard one, weighted x3, is the pick
    const journal = allowed.filter((id) => id !== 'tritone-sub').map((id) => ({ kind: 'spice', title: (GENRES['neo-soul'].spices.includes(id) ? id : id) }));
    const unheard = unheardSpices(journal.map((e) => ({ kind: e.kind, title: e.title })), allowed);
    expect(unheard.size).toBeGreaterThanOrEqual(1);
    const picks = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      // floor 3: the whole rack is in play
      const three: BurrowRun = { ...run, floors: [] };
      const f1 = digFloor(three, ctxFor(genre, 'major'), allowed, { hasGear: false, unheard: new Set(), rand: mulberry32(seed) })!;
      const f2 = digFloor({ ...three, floors: [f1] }, ctxFor(genre, 'major'), allowed, { hasGear: false, unheard: new Set(), rand: mulberry32(seed + 100) })!;
      const f3 = digFloor({ ...three, floors: [f1, f2] }, ctxFor(genre, 'major'), allowed, { hasGear: false, unheard: new Set(['tritone-sub']), rand: mulberry32(seed + 200) });
      if (f3) picks.add(f3.steps[0].spiceId);
    }
    expect(picks.has('tritone-sub')).toBe(true);
  });

  it('writes the descent onto the bench and into the last line', () => {
    const run = descend(GENRES.pop, 'major', 7, 6);
    const bench = descentNote(run, 'Pop');
    expect(bench).toMatch(/^Dug from .+ to floor \d+ \([a-z ]+\) in Pop/);
    if (run.floors.some((f) => f.gear)) expect(bench).toContain('climbs a whole step every other pass');
    const quit = closingLine({ ...run, ended: 'quit' }, 'Pop', GENRES.pop.spices.length);
    expect(quit.text).toMatch(/^Came up at floor \d+ \([a-z ]+\)\. The loop as it stood is on the bench\.$/);
    const last = run.floors[run.floors.length - 1];
    if (last && !last.gear) {
      const miss = closingLine({ ...run, ended: 'miss', missed: [0] }, 'Pop', 9);
      expect(miss.text).toMatch(new RegExp(`^Floor ${last.depth}, ${last.strata}\\. It was chords? ${last.changed[0] + 1}`));
      expect(miss.text).toContain(`the ${last.steps[0].spiceName}`);
      expect(miss.text).toContain('The crab stops digging; what it dug is on the bench.');
    }
  });

  it('names each move at the chord it made, in the rack\'s own case', () => {
    const base = descend(GENRES.pop, 'major', 7, 2);
    const step = (spiceName: string, at: number[]): BurrowStep => ({ spiceId: 'flat-seven' as SpiceId, spiceName, explanation: '', patch: {}, at });
    const floor = (steps: BurrowStep[], changed: number[]): BurrowFloor =>
      ({ depth: 8, strata: 'marl', before: [], after: [], changed, steps, hearBoth: false, wanted: 2 });
    const one = closingLine({ ...base, floors: [floor([step('♭VII stomp', [2])], [2])], ended: 'miss' }, 'Pop', 9);
    expect(one.text).toContain('It was chord 3, the ♭VII stomp.');
    // two moves are named in loop order, whichever was applied first
    const two = closingLine({ ...base, floors: [floor([step('Tritone sub', [3]), step('Half-step slide', [0])], [0, 3])], ended: 'miss' }, 'Pop', 9);
    expect(two.text).toContain('It was chord 1, the Half-step slide, and chord 4, the Tritone sub.');
    const pair = closingLine({ ...base, floors: [floor([step('Sus & release', [1, 2])], [1, 2])], ended: 'miss' }, 'Pop', 9);
    expect(pair.text).toContain('It was chords 2 and 3, the Sus & release.');
  });

  it('has a line for a descent that never left the surface', () => {
    const run = startRun('pop', 'major', 0, GENRES.pop.templates[0]);
    expect(closingLine({ ...run, ended: 'bedrock' }, 'Pop', 1).text)
      .toBe('At the surface. Bedrock: Pop is shallow ground, 1 spice on its rack and none of them fits this loop. Nothing to land; try another loop or genre.');
    expect(closingLine({ ...run, ended: 'quit' }, 'Pop', 9).text).toBe('Came up at the surface. Nothing dug, nothing landed.');
  });

  it('has nothing to dig under when every loop is too long', () => {
    expect(pickSurface([{ name: 'Twelve', mode: 'major', numerals: Array(12).fill('I7') }], mulberry32(1))).toBeUndefined();
    expect(pickSurface(GENRES.blues.templates, mulberry32(1))).toBeDefined();
  });
});
