import { describe, expect, it } from 'vitest';
import { NoteName, mod12 } from './notes';
import { Key, SCALES, scalePcs } from './scales';
import { resolveNumeral } from './roman';
import { lensView, loopContext, soloMap } from './solo';
import { buildLick } from './lick';
import { MelNote, MelodyContext, fromLick, newNoteId, roleAt } from './melody';
import { newSlot } from './progression';
import {
  agreeablePitch, analyzeCanon, crabProof, harmonyIsPalindrome, mirrorLead, mirrorPitch, mirrorSlots, mirrorSpec, movedNotes,
  slotsArePalindrome, verdictFor,
} from './crab';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const SCALE = { root: N('A'), def: SCALES.major };
const PCS = scalePcs(SCALE.root, SCALE.def);

function context(numerals: string[]): MelodyContext {
  const chords = numerals.map((n) => resolveNumeral(n, AMAJ));
  const loop = loopContext(SCALE, chords);
  const segments = chords.map((c, i) => {
    const map = soloMap(SCALE, c, chords[(i + 1) % chords.length]);
    return { start: i * 4, beats: 4, map, ...lensView('map', map, PCS, loop) };
  });
  return { segments, scalePcs: PCS, lo: 57, hi: 81, beatsPerBar: 4, totalBeats: numerals.length * 4 };
}

// I — iv — V7 — IV: backwards, bar 1 lands over the IV and bar 3 over the borrowed iv
const CTX = context(['I', 'iv', 'V7', 'IV']);
// I — vi — IV — vi — I reads the same from either end
const MIRROR = context(['I', 'vi', 'IV', 'vi', 'I']);
const note = (beat: number, midi: number, dur = 0.5, locked = false): MelNote => ({ id: newNoteId(), beat, dur, midi, vel: 0.8, locked });

describe('the mirror', () => {
  it('reads the line from the end: the last note first, and reading it twice gives the line back', () => {
    const line = [note(0, 69, 1), note(1, 71, 0.5), note(14, 73, 2)];
    const spec = mirrorSpec(CTX, line, 'crab');
    const back = mirrorLead(line, spec);
    expect(back.map((n) => `${n.beat}:${n.midi}:${n.dur}`)).toEqual(['0:73:2', '14.5:71:0.5', '15:69:1']);
    expect(mirrorLead(back, spec).map((n) => `${n.beat}:${n.midi}`)).toEqual(line.map((n) => `${n.beat}:${n.midi}`));
  });

  it('keeps what is left of a note that ran past the loop point', () => {
    const [m] = mirrorLead([note(15, 69, 2)], mirrorSpec(CTX, [], 'crab'));
    expect(m.beat).toBe(0);
    expect(m.dur).toBe(1);
  });

  it('turns the table canon upside down along the scale, inside the range', () => {
    const line = [note(0, 69), note(1, 73), note(2, 76)]; // A C♯ E going up
    const spec = mirrorSpec(CTX, line, 'table');
    const flipped = line.map((n) => mirrorPitch(n.midi, spec));
    expect(flipped[0]).toBeGreaterThan(flipped[1]);
    expect(flipped[1]).toBeGreaterThan(flipped[2]);
    for (const m of flipped) {
      expect(PCS).toContain(mod12(m));
      expect(m).toBeGreaterThanOrEqual(CTX.lo);
      expect(m).toBeLessThanOrEqual(CTX.hi);
    }
    // the plain crab leaves pitches alone
    expect(mirrorPitch(73, mirrorSpec(CTX, line, 'crab'))).toBe(73);
  });
});

describe('palindromes', () => {
  it('knows which harmony reads the same backwards', () => {
    expect(harmonyIsPalindrome(MIRROR)).toBe(true);
    expect(harmonyIsPalindrome(CTX)).toBe(false);
    expect(slotsArePalindrome([newSlot('I'), newSlot('IV', 2), newSlot('I')])).toBe(true);
    expect(slotsArePalindrome([newSlot('I'), newSlot('IV', 2), newSlot('I', 2)])).toBe(false);
  });

  it('mirrors a progression around its last chord, with fresh slots', () => {
    const slots = [newSlot('I'), newSlot('IV', 2), newSlot('V')];
    const out = mirrorSlots(slots);
    expect(out.map((s) => `${s.numeral}/${s.bars}`)).toEqual(['I/1', 'IV/2', 'V/1', 'IV/2', 'I/1']);
    expect(new Set(out.map((s) => s.id)).size).toBe(5);
    expect(mirrorSlots(out)).toBe(out);
  });
});

describe('the verdict', () => {
  it('gives a chord-tone line over a palindrome full marks', () => {
    // roots, one per bar: A F♯ D F♯ A — its mirror is the same line, so the voices sing in unison
    const line = [note(0, 69, 2), note(4, 66, 2), note(8, 62, 2), note(12, 66, 2), note(16, 69, 2)];
    const report = analyzeCanon(line, MIRROR, 'crab');
    expect(report.palindrome).toBe(true);
    expect(report.misses).toEqual([]);
    expect(report.clashes).toEqual([]);
    expect(report.score).toBe(100);
    expect(report.verdict.name).toBe('Cancrizans');
    expect(report.observations[0].kind).toBe('good');
  });

  it('names the bar, the note and the chord when the backwards voice rubs', () => {
    // F♯ held on the downbeat of the V7 bar: backwards it lands in bar 2, over Dm, where F♯ is the rub
    const line = [note(0, 69, 1), note(8, 78, 1), note(12, 69, 1)];
    const report = analyzeCanon(line, CTX, 'crab');
    expect(report.palindrome).toBe(false);
    const miss = report.misses[0];
    expect(miss.bar).toBe(1);
    expect(miss.fromBar).toBe(2);
    expect(miss.chord).toBe('Dm');
    const fix = report.observations.find((o) => o.kind === 'fix')!;
    expect(fix.text).toContain('Bar 2: read backwards, the F♯ from bar 3 lands over Dm');
    expect(fix.text).toMatch(/Try (F|A|D|E|G♯) in bar 3/);
    expect(report.observations[0].text).toContain('isn’t a palindrome');
  });

  it('hears the two voices grind where they meet', () => {
    // bar 1 holds C♯ (A's 3rd) and the last bar holds D: read backwards, the D arrives under the C♯, a half step apart
    const line = [note(0, 73, 4), note(16, 74, 4)];
    const report = analyzeCanon(line, MIRROR, 'crab');
    expect(report.together).toBeGreaterThan(0);
    expect(report.clashes.length).toBeGreaterThan(0);
    expect(report.clashes[0].interval).toBe('a half step');
    expect(report.observations.some((o) => o.text.includes('a half step apart'))).toBe(true);
  });

  it('notices when the voices never meet, or barely do', () => {
    const line = [note(0, 69, 1), note(2, 73, 1)];
    const report = analyzeCanon(line, MIRROR, 'crab');
    expect(report.together).toBe(0);
    expect(report.observations.some((o) => o.text.includes('never overlap'))).toBe(true);
    const brief = analyzeCanon([note(0, 69, 1), note(2, 73, 1), note(9, 62, 2)], MIRROR, 'crab');
    expect(brief.together).toBeGreaterThan(0);
    expect(brief.observations.some((o) => o.text.includes('only meet for'))).toBe(true);
  });

  it('says the same journey once, however many notes make it', () => {
    // three F♯s in the last bar: colour over the I, but read backwards all three land in bar 1 over Dm, where F♯ rubs
    const line = [note(12, 78, 0.5), note(13, 78, 0.5), note(14, 78, 0.5)];
    const report = analyzeCanon(line, context(['iv', 'I', 'I', 'I']), 'crab');
    expect(report.misses.length).toBe(3);
    expect(report.observations.filter((o) => o.kind === 'fix')).toHaveLength(1);
  });

  it('has a rung for every score and nothing to say about an empty page', () => {
    expect(['Cancrizans', 'Walks nicely', 'Pinchy', 'Lost at sea']).toEqual([95, 80, 60, 20].map((s) => verdictFor(s).name));
    const empty = analyzeCanon([], CTX, 'crab');
    expect(empty.score).toBe(0);
    expect(empty.observations).toEqual([]);
  });
});

describe('the solver', () => {
  it('moves a rubbing note to a pitch that works in both directions, and leaves locked notes alone', () => {
    // the locked D over the IV is sour backwards (a half step over A's 3rd) — and stays exactly where it was put
    const line = [note(0, 69, 1), note(8, 78, 1), note(12, 74, 1, true)];
    const fixed = crabProof(line, CTX, 'crab');
    const moved = fixed.find((n) => n.beat === 8)!;
    expect(moved.midi).not.toBe(78);
    expect(roleAt(CTX, 8, moved.midi)?.chordDegree).toBeDefined(); // still a chord tone over E7
    expect(roleAt(CTX, 16 - 8 - 1, moved.midi)?.chordDegree).toBeDefined(); // and over Dm, where it lands backwards
    expect(fixed.find((n) => n.beat === 12)!.midi).toBe(74);
    expect(movedNotes(line, fixed)).toBe(1);
    const left = analyzeCanon(fixed, CTX, 'crab').misses;
    expect(left.map((m) => m.fromMidi)).toEqual([74]);
    expect(analyzeCanon(fixed, CTX, 'crab').observations.some((o) => o.text.includes('locked'))).toBe(true);
  });

  it('suggests the same pitch the solver would pick', () => {
    const spec = mirrorSpec(CTX, [], 'crab');
    const pick = agreeablePitch(CTX, spec, { beat: 8, dur: 1, midi: 78 })!;
    expect(roleAt(CTX, 8, pick)?.chordDegree).toBeDefined();
    expect(roleAt(CTX, 7, pick)?.chordDegree).toBeDefined();
  });

  it('never hands back a worse score, whatever the line', () => {
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      for (const mode of ['crab', 'table'] as const) {
        const line = fromLick(buildLick(CTX.segments, { lens: 'map', lo: CTX.lo, hi: CTX.hi, seed, beatsPerBar: 4 }));
        const before = analyzeCanon(line, CTX, mode).score;
        const after = analyzeCanon(crabProof(line, CTX, mode), CTX, mode).score;
        expect(after).toBeGreaterThanOrEqual(before);
      }
    }
  });

  it('is deterministic and keeps the rhythm', () => {
    const line = fromLick(buildLick(CTX.segments, { lens: 'map', lo: CTX.lo, hi: CTX.hi, seed: 4, beatsPerBar: 4 }));
    const a = crabProof(line, CTX, 'crab');
    expect(a).toEqual(crabProof(line, CTX, 'crab'));
    expect(a.map((n) => `${n.beat}:${n.dur}`)).toEqual(line.map((n) => `${n.beat}:${n.dur}`));
  });
});
