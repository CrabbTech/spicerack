import { describe, expect, it } from 'vitest';
import { KeySig, parseToken, resolveRoman } from './harmony';
import { autoFinish, nextCandidates, rollDice, spiceOptions, MOODS } from './suggest';
import { mulberry32 } from '../lib/rng';

const C: KeySig = { tonic: 'C', mode: 'major' };
const Am: KeySig = { tonic: 'A', mode: 'minor' };

describe('next-chord autocomplete', () => {
  it('offers a tonic resolution after the dominant', () => {
    const cands = nextCandidates(resolveRoman('V7', C), C);
    expect(cands.some((c) => c.token === 'I')).toBe(true);
    expect(cands.length).toBeGreaterThanOrEqual(4);
  });

  it('resolves a secondary dominant to its target first', () => {
    const cands = nextCandidates(resolveRoman('V7/vi', C), C);
    expect(cands[0].token).toBe('vi');
  });

  it('every candidate actually resolves in the key', () => {
    for (const key of [C, Am]) {
      for (const start of [undefined, resolveRoman('IV', key), resolveRoman('i6', Am)]) {
        for (const c of nextCandidates(start, key)) {
          expect(() => resolveRoman(c.token, key)).not.toThrow();
        }
      }
    }
  });
});

describe('auto-finish', () => {
  it('extends to a cadence with parseable tokens', () => {
    const added = autoFinish(['I', 'vi'], C, mulberry32(1));
    expect(added.length).toBeGreaterThanOrEqual(2);
    for (const token of added) expect(parseToken(token, C).warning).toBeUndefined();
    expect(['I', 'Imaj7', 'vi'].some((t) => added[added.length - 1] === t)).toBe(true);
  });

  it('works from a minor vamp', () => {
    const added = autoFinish(['i', 'bVII'], Am, mulberry32(2));
    for (const token of added) expect(parseToken(token, Am).warning).toBeUndefined();
  });
});

describe('dice', () => {
  it('is deterministic per seed and parseable in its mode', () => {
    for (const mood of MOODS.map((m) => m.id)) {
      const a = rollDice(mood, mulberry32(42));
      const b = rollDice(mood, mulberry32(42));
      expect(a).toEqual(b);
      const key: KeySig = { tonic: 'C', mode: a.mode };
      for (const token of a.tokens) expect(parseToken(token, key).warning).toBeUndefined();
    }
  });

  it('can roll eight chords', () => {
    expect(rollDice('bright', mulberry32(7), true).tokens.length).toBe(8);
  });
});

describe('spice', () => {
  it('offers a tritone sub for a dominant', () => {
    const tokens = ['ii7', 'V7', 'Imaj7'];
    const parsed = tokens.map((t) => resolveRoman(t, C));
    const subs = spiceOptions(1, parsed, C);
    expect(subs.some((s) => s.token.startsWith('bII7'))).toBe(true);
    for (const s of subs) expect(() => resolveRoman(s.token, C)).not.toThrow();
  });

  it('suggests the parallel borrow', () => {
    const tokens = ['I', 'IV', 'I'];
    const parsed = tokens.map((t) => resolveRoman(t, C));
    const subs = spiceOptions(1, parsed, C);
    expect(subs.some((s) => s.token === 'iv')).toBe(true);
  });
});
