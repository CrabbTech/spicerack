import { describe, expect, it } from 'vitest';
import { NoteName } from '../theory/notes';
import { Key } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import {
  OP1_BASE_MIDI, OP1_KEY_COUNT, OP1_LAYOUT,
  op1ChordVoicing, op1KeyPc, op1RangeLabel, op1ScaleKeys,
} from './op1';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const CMAJ: Key = { tonic: N('C'), mode: 'major' };

describe('OP-1 layout', () => {
  it('has 24 keys: 14 bottom, 10 top in 3-2-3-2 groups', () => {
    expect(OP1_LAYOUT).toHaveLength(24);
    const top = OP1_LAYOUT.filter((k) => k.row === 'top');
    const bottom = OP1_LAYOUT.filter((k) => k.row === 'bottom');
    expect(bottom).toHaveLength(14);
    expect(top).toHaveLength(10);
    // group sizes: gaps in top-row x positions split groups
    const xs = top.map((k) => k.x);
    const groups: number[] = [1];
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > 1.01) groups.push(1);
      else groups[groups.length - 1]++;
    }
    expect(groups).toEqual([3, 2, 3, 2]);
  });

  it('leftmost key is F4 (midi 65) and the window is two octaves', () => {
    expect(OP1_BASE_MIDI).toBe(65);
    expect(op1KeyPc(0)).toBe(5);  // F
    expect(op1KeyPc(23)).toBe(4); // E
    expect(OP1_KEY_COUNT).toBe(24);
    expect(op1RangeLabel(0)).toBe('F4 – E6');
    expect(op1RangeLabel(-1)).toBe('F3 – E5');
  });
});

describe('OP-1 chord fitting', () => {
  it('puts simple triads in root position near the center', () => {
    const v = op1ChordVoicing(resolveNumeral('I', CMAJ));
    expect(v.midis).toEqual([72, 76, 79]); // C5 E5 G5
    expect(v.inversion).toBe(0);
    expect(v.omitted).toEqual([]);
  });

  it('keeps everything inside the 24-key window', () => {
    for (const numeral of ['I', 'ii7', 'V7', 'Imaj9', 'V13', 'ii9', 'iiø7', 'bII7', 'V7/vi', 'i6', 'm?'.replace('m?', 'vi9')]) {
      const v = op1ChordVoicing(resolveNumeral(numeral, CMAJ));
      for (const m of v.midis) {
        expect(m).toBeGreaterThanOrEqual(OP1_BASE_MIDI);
        expect(m).toBeLessThanOrEqual(OP1_BASE_MIDI + 23);
      }
      expect(v.midis.length).toBeLessThanOrEqual(5);
      expect(v.midis.length).toBeGreaterThanOrEqual(2);
      // ascending
      for (let i = 1; i < v.midis.length; i++) expect(v.midis[i]).toBeGreaterThan(v.midis[i - 1]);
    }
  });

  it('drops the 5th (never the color tones) when a big chord will not fit', () => {
    const v13 = op1ChordVoicing(resolveNumeral('V13', CMAJ));
    const pcs = v13.midis.map((m) => m % 12);
    expect(pcs).toContain(11); // 3rd of G13 (B)
    expect(pcs).toContain(5);  // 7th (F)
    expect(pcs).toContain(4);  // 13th (E)
  });
});

describe('OP-1 scale keys', () => {
  it('lights up both octaves with roots flagged', () => {
    const keys = op1ScaleKeys(0, [0, 2, 4, 5, 7, 9, 11]); // C major
    expect(keys).toHaveLength(14);
    const roots = keys.filter((k) => k.isRoot);
    expect(roots.map((r) => r.index)).toEqual([7, 19]); // C5 and C6 from F4
  });
});
