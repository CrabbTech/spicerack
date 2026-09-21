import { describe, expect, it } from 'vitest';
import { NoteName, mod12 } from './notes';
import { Key } from './scales';
import { resolveNumeral } from './roman';
import {
  describeMove, inversionLabel, keyboardTriads, pathTravel, stringSets, stringTriads, triadPath, triadSpec,
} from './triads';
import { GENRE_LIST } from '../data/genres';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const GUITAR = [40, 45, 50, 55, 59, 64];
const TOP = [3, 4, 5];

describe('triad specs', () => {
  it('reduces any chord to root, 3rd and 5th', () => {
    expect(triadSpec(resolveNumeral('I', AMAJ)).tones.map((t) => t.label)).toEqual(['A', 'C♯', 'E']);
    expect(triadSpec(resolveNumeral('V7', AMAJ)).tones.map((t) => t.degree)).toEqual([1, 3, 5]);
    expect(triadSpec(resolveNumeral('viio', CMAJ)).name).toBe('B°');
    expect(triadSpec(resolveNumeral('Isus4', CMAJ)).name).toBe('Csus4');
  });
  it('finds the simpler triad hiding in a seventh chord', () => {
    const upper = triadSpec(resolveNumeral('vi7', CMAJ), 'upper');
    expect(upper.tones.map((t) => t.label)).toEqual(['C', 'E', 'G']);
    expect(upper.tones.map((t) => t.degree)).toEqual([3, 5, 7]);
    expect(upper.name).toBe('C');
    expect(triadSpec(resolveNumeral('V7', CMAJ), 'upper').name).toBe('B°');
    // no seventh, no upper structure: quietly stays the plain triad
    expect(triadSpec(resolveNumeral('IV', CMAJ), 'upper').source).toBe('base');
  });
  it('fills out power chords and fifth-less voicings', () => {
    expect(triadSpec(resolveNumeral('I5', AMAJ)).tones.map((t) => t.label)).toEqual(['A', 'E', 'A']);
    expect(triadSpec(resolveNumeral('V13', CMAJ)).tones.map((t) => t.label)).toEqual(['G', 'B', 'D']);
  });
});

describe('triads on a string set', () => {
  const shapes = stringTriads(triadSpec(resolveNumeral('I', AMAJ)), TOP, GUITAR, 15);
  it('finds the three inversions climbing the neck on G-B-e', () => {
    expect(shapes.map((v) => v.frets!.join(','))).toEqual(['2,2,0', '6,5,5', '9,10,9', '14,14,12']);
    expect(shapes.map((v) => v.inversion)).toEqual([0, 1, 2, 0]);
    expect(inversionLabel(shapes[1])).toBe('1st inversion · root on top');
  });
  it('only ever spells the triad, low to high, within reach', () => {
    for (const genre of GENRE_LIST) {
      for (const tpl of genre.templates) {
        for (const numeral of tpl.numerals) {
          const chord = resolveNumeral(numeral, { tonic: N('E', -1), mode: tpl.mode });
          const spec = triadSpec(chord);
          const pcs = new Set(spec.tones.map((t) => t.pc));
          for (const set of stringSets(6)) {
            for (const v of stringTriads(spec, set, GUITAR, 15)) {
              expect(v.midis[0]).toBeLessThan(v.midis[1]);
              expect(v.midis[1]).toBeLessThan(v.midis[2]);
              expect(v.midis[2] - v.midis[0]).toBeLessThanOrEqual(12);
              for (const m of v.midis) expect(pcs.has(mod12(m))).toBe(true);
              const fretted = v.frets!.filter((f) => f > 0);
              if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4);
            }
          }
        }
      }
    }
  });
  it('knows the string sets of a guitar and a bass', () => {
    expect(stringSets(6)).toHaveLength(4);
    expect(stringSets(4)).toEqual([[0, 1, 2], [1, 2, 3]]);
  });
});

describe('triads on keys', () => {
  it('fits every inversion inside the OP-1 window', () => {
    const list = keyboardTriads(triadSpec(resolveNumeral('I', CMAJ)), 65, 24);
    expect(list.map((v) => v.midis.join(','))).toEqual(['67,72,76', '72,76,79', '76,79,84', '79,84,88']);
  });
});

describe('the path', () => {
  const cands = ['I', 'IV', 'V', 'IV'].map((n) => stringTriads(triadSpec(resolveNumeral(n, AMAJ)), TOP, GUITAR, 15));
  const chosen = (picks: number[]) => picks.map((k, i) => cands[i][k]);

  it('moves far less than root position does', () => {
    const close = pathTravel(chosen(triadPath(cands, 'close', 66)));
    const root = pathTravel(chosen(triadPath(cands, 'root', 66)));
    expect(chosen(triadPath(cands, 'root', 66)).every((v) => v.inversion === 0)).toBe(true);
    expect(close).toBeLessThan(root * 0.6);
    expect(close).toBe(18);  // I–IV–V–IV around the loop: eighteen frets in total…
    expect(root).toBe(42);   // …against forty-two for the same chords in root position
  });
  it('climbs and descends by the top voice', () => {
    const up = chosen(triadPath(cands, 'climb', 66)).map((v) => v.midis[2]);
    expect(up[1]).toBeGreaterThan(up[0]);
    expect(up[2]).toBeGreaterThan(up[1]);
    const down = chosen(triadPath(cands, 'descend', 66)).map((v) => v.midis[2]);
    expect(down[1]).toBeLessThan(down[0]);
    expect(down[2]).toBeLessThan(down[1]);
  });
  it('re-routes around a pinned shape', () => {
    const free = triadPath(cands, 'close', 66);
    const pin = (free[1] + 1) % cands[1].length;
    const pinned = triadPath(cands, 'close', 66, [undefined, pin]);
    expect(pinned[1]).toBe(pin);
    expect(pathTravel(chosen(pinned))).toBeGreaterThanOrEqual(pathTravel(chosen(free)));
  });
  it('survives a chord with no playable shape', () => {
    expect(triadPath([cands[0], [], cands[2]], 'close', 66)[1]).toBe(-1);
  });
  it('puts the change into words', () => {
    const a = cands[0].find((v) => v.frets!.join() === '6,5,5')!; // A, 1st inversion
    const d = cands[1].find((v) => v.frets!.join() === '7,7,5')!; // D, root position
    expect(describeMove(a, d, 'fret')).toBe('C♯ → D (1 fret up), E → F♯ (2 frets up). A stays exactly where it is. That is the whole chord change.');
  });
});
