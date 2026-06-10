import { describe, expect, it } from 'vitest';
import { NoteName } from './notes';
import { Key } from './scales';
import { parseNumeralParts, resolveNumeral } from './roman';
import { composeProgression } from './compose';
import { GENRES } from '../data/genres';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });

const KEYS: Key[] = [
  { tonic: N('C'), mode: 'major' },
  { tonic: N('A'), mode: 'minor' },
  { tonic: N('D'), mode: 'dorian' },
  { tonic: N('E', -1), mode: 'major' },
];

describe('compose engine', () => {
  it('always produces parseable, plan-consistent progressions', () => {
    const genres = [GENRES['classic-rock'], GENRES.lofi, GENRES.synthwave, GENRES['neo-soul'], GENRES.pop];
    for (let run = 0; run < 40; run++) {
      const genre = genres[run % genres.length];
      const key = KEYS[run % KEYS.length];
      const mode = genre.modes.includes(key.mode) ? key.mode : genre.modes[0];
      const realKey = { ...key, mode };
      const length = ([4, 6, 8] as const)[run % 3];
      const heat = ([1, 2, 3] as const)[run % 3];
      const r = composeProgression({ genre, key: realKey, length, heat, cadence: 'auto', startOnTonic: true });
      expect(r.numerals.length).toBeGreaterThanOrEqual(length);
      expect(r.numerals.length).toBeLessThanOrEqual(length + 2);
      expect(r.bars).toHaveLength(r.numerals.length);
      for (const n of r.numerals) {
        expect(() => resolveNumeral(n, realKey), `${genre.id} ${mode} "${n}"`).not.toThrow();
      }
      expect(parseNumeralParts(r.numerals[0]).degree).toBe(1); // startOnTonic
      expect(r.planText.length).toBeGreaterThan(20);
      expect(r.name).toMatch(/\w+ \w+/);
    }
  });

  it('honors each cadence type', () => {
    const key: Key = { tonic: N('C'), mode: 'major' };
    const genre = GENRES.pop;
    for (let run = 0; run < 12; run++) {
      const auth = composeProgression({ genre, key, length: 4, heat: 2, cadence: 'authentic', startOnTonic: true });
      const lastA = parseNumeralParts(auth.numerals[auth.numerals.length - 1]);
      expect(lastA.degree, auth.numerals.join(' ')).toBe(1);
      expect(resolveNumeral(auth.numerals[auth.numerals.length - 2], key).func).toMatch(/dominant|secondary/);

      const plagal = composeProgression({ genre, key, length: 4, heat: 1, cadence: 'plagal', startOnTonic: true });
      expect(parseNumeralParts(plagal.numerals[plagal.numerals.length - 1]).degree).toBe(1);
      expect(parseNumeralParts(plagal.numerals[plagal.numerals.length - 2]).degree).toBe(4);

      const decep = composeProgression({ genre, key, length: 4, heat: 2, cadence: 'deceptive', startOnTonic: true });
      const lastD = parseNumeralParts(decep.numerals[decep.numerals.length - 1]);
      expect(lastD.degree === 6, decep.numerals.join(' ')).toBe(true);

      const half = composeProgression({ genre, key, length: 4, heat: 1, cadence: 'half', startOnTonic: true });
      const lastH = parseNumeralParts(half.numerals[half.numerals.length - 1]);
      expect(lastH.degree).toBe(5);
      expect(lastH.lower).toBe(false);

      const loop = composeProgression({ genre, key, length: 4, heat: 2, cadence: 'loop', startOnTonic: true });
      expect(parseNumeralParts(loop.numerals[loop.numerals.length - 1]).degree).not.toBe(1);
    }
  });

  it('heat 1 stays diatonic in major', () => {
    const key: Key = { tonic: N('C'), mode: 'major' };
    for (let run = 0; run < 15; run++) {
      const r = composeProgression({ genre: GENRES.pop, key, length: 6, heat: 1, cadence: 'authentic', startOnTonic: true });
      for (const n of r.numerals) {
        const c = resolveNumeral(n, key);
        expect(c.func, `${n} should be diatonic at heat 1`).not.toBe('borrowed');
        expect(c.func).not.toBe('secondary');
      }
    }
  });

  it('8-bar form is a period (question ends on V)', () => {
    const key: Key = { tonic: N('G'), mode: 'major' };
    for (let run = 0; run < 8; run++) {
      const r = composeProgression({ genre: GENRES.indie, key, length: 8, heat: 1, cadence: 'authentic', startOnTonic: true });
      const firstPhraseEnd = parseNumeralParts(r.numerals[3]);
      expect(firstPhraseEnd.degree, r.numerals.join(' ')).toBe(5);
      expect(r.planText).toContain('Question');
    }
  });

  it('minor keys get a real dominant even at heat 1', () => {
    const key: Key = { tonic: N('A'), mode: 'minor' };
    let sawMajorV = false;
    for (let run = 0; run < 20; run++) {
      const r = composeProgression({ genre: GENRES.synthwave, key, length: 4, heat: 1, cadence: 'authentic', startOnTonic: true });
      const pen = parseNumeralParts(r.numerals[r.numerals.length - 2]);
      if (pen.degree === 5 && !pen.lower) sawMajorV = true;
    }
    expect(sawMajorV).toBe(true);
  });
});
