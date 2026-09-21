import { describe, expect, it } from 'vitest';
import { NoteName } from '../theory/notes';
import { Key } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { neckPositions } from './positions';
import { cagedForm, cagedText, gripInPosition } from './caged';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };

describe('caged', () => {
  it('walks C-A-G-E-D order up the neck for one chord', () => {
    const boxes = neckPositions(9, [9, 11, 1, 4, 6]); // A major pentatonic: 5fr 7fr 9fr 12fr 2fr
    expect(boxes.map((w) => cagedForm(9, w)?.form)).toEqual(['E', 'D', 'C', 'A', 'G']);
  });
  it('gives each chord of a progression its own form inside one box', () => {
    const fifth = { lo: 4, hi: 8 };
    expect(cagedForm(9, fifth)?.form).toBe('E');  // A
    expect(cagedForm(2, fifth)?.form).toBe('A');  // D
    expect(cagedForm(4, fifth)?.form).toBe('C');  // E
  });
  it('finds the grip the player already knows and names every finger', () => {
    const grip = gripInPosition(resolveNumeral('I', AMAJ), { lo: 4, hi: 8 })!;
    expect(grip.voicing.frets).toEqual([5, 7, 7, 6, 5, 5]);
    expect(grip.tones.map((t) => t.interval).join(' ')).toBe('R 5 R 3 5 R');
    const minor = gripInPosition(resolveNumeral('vi', { tonic: N('C'), mode: 'major' }), { lo: 4, hi: 8 })!;
    expect(minor.tones.map((t) => t.interval)).toContain('♭3');
  });
  it('says it in a sentence', () => {
    const chord = resolveNumeral('IV', AMAJ);
    const text = cagedText(chord, cagedForm(2, { lo: 4, hi: 8 }), gripInPosition(chord, { lo: 4, hi: 8 }));
    expect(text).toContain('Here D is the A-shape you already play');
    expect(text).toContain('root on the A string, fret 5');
  });
});
