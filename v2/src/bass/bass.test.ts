import { describe, expect, it } from 'vitest';
import { NoteName, notePc } from '../theory/notes';
import { Key } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { BASS_OPEN_MIDI, bassScaleBox, bassShape } from './bass';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const EMIN: Key = { tonic: N('E'), mode: 'minor' };

describe('bass shapes', () => {
  it('builds the classic A-string C: root 3fr, fifth and octave 5fr', () => {
    const s = bassShape(resolveNumeral('I', CMAJ));
    expect(s.frets).toEqual(['x', 3, 5, 5]);
    expect(s.midis).toEqual([36, 43, 48]); // C2 G2 C3
  });

  it('uses the open E string for E chords', () => {
    const s = bassShape(resolveNumeral('i', EMIN));
    expect(s.rootString).toBe(0);
    expect(s.frets).toEqual([0, 2, 2, 'x']);
    expect(s.midis).toEqual([28, 35, 40]); // E1 B1 E2
  });

  it('always stacks root, fifth, octave (intervals from the chord quality)', () => {
    for (const numeral of ['I', 'ii', 'V7', 'bVII', 'IV', 'vi7']) {
      const s = bassShape(resolveNumeral(numeral, CMAJ));
      expect(s.midis[1] - s.midis[0]).toBe(7);
      expect(s.midis[2] - s.midis[0]).toBe(12);
    }
  });

  it('flattens the fifth for half-diminished chords', () => {
    const s = bassShape(resolveNumeral('iiø7', EMIN));
    expect(s.midis[1] - s.midis[0]).toBe(6);
    expect(s.midis[2] - s.midis[0]).toBe(12);
  });

  it('keeps every root chromatic-pitch reachable below the 12th fret', () => {
    for (const numeral of ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII']) {
      const chord = resolveNumeral(numeral, CMAJ);
      const s = bassShape(chord);
      const fretted = s.frets.filter((f): f is number => f !== 'x');
      expect(Math.min(...fretted)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...fretted)).toBeLessThanOrEqual(13);
      expect(s.midis[0] % 12).toBe(notePc(chord.root));
    }
  });
});

describe('bass scale box', () => {
  it('stays on 4 strings around the low-E root fret', () => {
    const box = bassScaleBox(0, [0, 2, 4, 5, 7, 9, 11]); // C major
    expect(box.length).toBeGreaterThan(0);
    for (const n of box) {
      expect(n.string).toBeGreaterThanOrEqual(0);
      expect(n.string).toBeLessThanOrEqual(3);
      expect(BASS_OPEN_MIDI[n.string] + n.fret).toBeLessThanOrEqual(43 + 15);
    }
    expect(box.some((n) => n.isRoot)).toBe(true);
  });
});
