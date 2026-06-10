import { describe, expect, it } from 'vitest';
import { NoteName } from '../theory/notes';
import { Key } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import {
  PIANO_BASE_MIDI, PIANO_KEY_COUNT, PIANO_LAYOUT, PIANO_WHITE_COUNT,
  pianoChordVoicing, pianoRangeLabel, pianoScaleKeys,
} from './piano';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const CMAJ: Key = { tonic: N('C'), mode: 'major' };

describe('piano layout', () => {
  it('spans C4–C6: 25 keys, 15 white, 10 black in 2-3 groups', () => {
    expect(PIANO_BASE_MIDI).toBe(60);
    expect(PIANO_KEY_COUNT).toBe(25);
    expect(PIANO_LAYOUT).toHaveLength(25);
    expect(PIANO_WHITE_COUNT).toBe(15);
    const blacks = PIANO_LAYOUT.filter((k) => k.color === 'black');
    expect(blacks).toHaveLength(10);
    const xs = blacks.map((k) => k.x);
    const groups: number[] = [1];
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > 1.01) groups.push(1);
      else groups[groups.length - 1]++;
    }
    expect(groups).toEqual([2, 3, 2, 3]);
    expect(pianoRangeLabel(0)).toBe('C4 – C6');
    expect(pianoRangeLabel(-1)).toBe('C3 – C5');
  });
});

describe('piano chord voicing', () => {
  it('keeps the right hand inside the window and adds an LH root in C2..B2', () => {
    for (const numeral of ['I', 'ii7', 'V7', 'Imaj9', 'V13', 'iiø7', 'bII7', 'V7/vi']) {
      const v = pianoChordVoicing(resolveNumeral(numeral, CMAJ));
      for (const m of v.midis) {
        expect(m).toBeGreaterThanOrEqual(PIANO_BASE_MIDI);
        expect(m).toBeLessThanOrEqual(PIANO_BASE_MIDI + PIANO_KEY_COUNT - 1);
      }
      expect(v.midis.length).toBeLessThanOrEqual(5);
      expect(v.lhMidi).toBeGreaterThanOrEqual(36);
      expect(v.lhMidi).toBeLessThanOrEqual(47);
    }
  });

  it('LH plays the chord root (C for I, G for V7)', () => {
    expect(pianoChordVoicing(resolveNumeral('I', CMAJ)).lhMidi % 12).toBe(0);
    expect(pianoChordVoicing(resolveNumeral('V7', CMAJ)).lhMidi % 12).toBe(7);
  });
});

describe('piano scale keys', () => {
  it('lights both octaves plus the top C, roots flagged', () => {
    const keys = pianoScaleKeys(0, [0, 2, 4, 5, 7, 9, 11]); // C major
    expect(keys).toHaveLength(15);
    expect(keys.filter((k) => k.isRoot).map((k) => k.index)).toEqual([0, 12, 24]);
  });
});
