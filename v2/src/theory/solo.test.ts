import { describe, expect, it } from 'vitest';
import { NoteName, notePc } from './notes';
import { Key, SCALES } from './scales';
import { resolveNumeral } from './roman';
import { LENSES, lensView, loopContext, soloMap, targetPc } from './solo';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const AMIN: Key = { tonic: N('A'), mode: 'minor' };

const A_MAJOR = { root: N('A'), def: SCALES.major };
const C_MAJOR = { root: N('C'), def: SCALES.major };

const roles = (map: ReturnType<typeof soloMap>) =>
  Object.fromEntries(map.notes.map((n) => [n.label, n.role]));

describe('solo map', () => {
  it('surfaces the borrowed iv chord’s ♭3 even though the scale lacks it', () => {
    // the bug from the plan: Dm in A major — F♮ must show up, F♯ must stand down
    const map = soloMap(A_MAJOR, resolveNumeral('iv', AMAJ));
    const f = map.byPc.get(5)!;
    expect(f.label).toBe('F');
    expect(f.inScale).toBe(false);
    expect(f.role).toBe('chord');
    expect(f.interval).toBe('♭3');
    expect(map.byPc.get(6)!.role).toBe('rub');
    expect(map.headline).toContain('trade F♯ for F');
  });

  it('labels roots, chord tones, colors and avoid notes over a diatonic chord', () => {
    const r = roles(soloMap(C_MAJOR, resolveNumeral('I', CMAJ)));
    expect(r).toEqual({ C: 'root', D: 'color', E: 'chord', F: 'avoid', G: 'chord', A: 'color', B: 'color' });
  });

  it('flags both avoid notes over iii7 and none over IVmaj7', () => {
    const em7 = soloMap(C_MAJOR, resolveNumeral('iii7', CMAJ));
    expect(em7.notes.filter((n) => n.role === 'avoid').map((n) => n.label)).toEqual(['C', 'F']);
    const fmaj7 = soloMap(C_MAJOR, resolveNumeral('IVmaj7', CMAJ));
    expect(fmaj7.notes.some((n) => n.role === 'avoid')).toBe(false);
    expect(fmaj7.byPc.get(11)!.interval).toBe('♯4');
  });

  it('keeps the ♭9 of a dominant as color, not an avoid note', () => {
    const map = soloMap({ root: N('E'), def: SCALES.phrygianDominant }, resolveNumeral('V7', AMIN));
    expect(map.byPc.get(5)!.role).toBe('color'); // F over E7
    expect(map.byPc.get(9)!.role).toBe('avoid'); // A sits on top of G♯
  });

  it('swaps G for G♯ when harmonic-minor V7 lands in natural minor', () => {
    const map = soloMap({ root: N('A'), def: SCALES.minor }, resolveNumeral('V7', AMIN));
    expect(map.byPc.get(8)!.inScale).toBe(false);
    expect(map.byPc.get(7)!.role).toBe('rub');
    expect(map.headline).toContain('trade G for G♯');
  });

  it('teaches the blues rub: minor pentatonic over a major I', () => {
    const map = soloMap({ root: N('A'), def: SCALES.minorPent }, resolveNumeral('I7', AMAJ));
    expect(map.byPc.get(0)!.role).toBe('rub'); // C under C♯
    expect(map.headline).toContain('bend or slide C up into C♯');
  });

  it('adds a missing chord tone when the pentatonic has no twin for it', () => {
    // A major pentatonic has no G of any kind, so ♭VII's root is a pure addition
    const map = soloMap({ root: N('A'), def: SCALES.majorPent }, resolveNumeral('bVII', AMAJ));
    const g = map.byPc.get(7)!;
    expect(g.role).toBe('root');
    expect(g.inScale).toBe(false);
    expect(map.headline).toContain('add G');
  });

  it('points at the next chord’s 3rd and how to get there', () => {
    const map = soloMap(C_MAJOR, resolveNumeral('V7', CMAJ), resolveNumeral('I', CMAJ));
    expect(map.landing!.label).toBe('E');
    expect(map.landing!.text).toContain('half step down from F');
    const held = soloMap(C_MAJOR, resolveNumeral('I', CMAJ), resolveNumeral('vi', CMAJ));
    expect(held.landing!.text).toContain('belongs to both chords');
  });

  it('implies a 3rd for power chords from the scale', () => {
    const pow = resolveNumeral('i5', AMIN);
    expect(targetPc(pow, [9, 11, 0, 2, 4, 5, 7])).toBe(0);      // A minor → C
    expect(targetPc(pow, [9, 11, 1, 2, 4, 6, 8])).toBe(1);      // A major → C♯
  });
});

describe('exercise lenses', () => {
  const chords = ['I', 'IV', 'V', 'IV'].map((n) => resolveNumeral(n, AMAJ));
  const scalePcs = [9, 11, 1, 2, 4, 6, 8];
  const loop = loopContext(A_MAJOR, chords);

  it('climbs a ladder from one note to the whole map', () => {
    expect(LENSES.map((l) => l.level)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('anchors the one-note exercise on the loop’s most shared chord tone', () => {
    expect(loop.anchorPc).toBe(9); // A: in both A and D, and it's the tonic
    expect(loop.trio).toEqual([9, 11, 1]); // A B C♯ — do re mi
  });

  it('restricts each lens to the right notes', () => {
    const map = soloMap(A_MAJOR, chords[1]); // D
    expect([...lensView('roots', map, scalePcs, loop).lit]).toEqual([2]);
    expect([...lensView('arps', map, scalePcs, loop).lit].sort((a, b) => a - b)).toEqual([2, 6, 9]);
    expect([...lensView('thirds', map, scalePcs, loop).targets]).toEqual([6]);
    expect(lensView('map', map, scalePcs, loop).lit.size).toBe(7);
    expect([...lensView('rhythm', map, scalePcs, loop).lit]).toEqual([9]);
  });

  it('gives triads a 3rd + 5th guide pair and seventh chords a 3rd + 7th', () => {
    const triad = lensView('guide', soloMap(A_MAJOR, chords[0]), scalePcs, loop);
    expect([...triad.lit].sort((a, b) => a - b)).toEqual([1, 4]);
    const e7 = resolveNumeral('V7', AMAJ);
    const seventh = lensView('guide', soloMap(A_MAJOR, e7), scalePcs, loop);
    expect([...seventh.lit].sort((a, b) => a - b)).toEqual([2, 8]);
    expect(notePc(e7.root)).toBe(4);
  });
});

describe('interval names', () => {
  it('never says ♭1 or ♯7: the blues ♭5 over V7 is just its 7th', () => {
    // A blues spells the ♭5 as E♭; over E7 that letter would make it a "♭1"
    const map = soloMap({ root: N('A'), def: SCALES.blues }, resolveNumeral('V7', AMAJ));
    expect(map.byPc.get(3)!.interval).toBe('7');
    expect(map.notes.map((n) => n.interval).some((i) => /♭1|♯7|♯3|♭4/.test(i))).toBe(false);
  });
});
