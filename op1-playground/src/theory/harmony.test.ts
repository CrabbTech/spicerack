import { describe, expect, it } from 'vitest';
import {
  KeySig, diatonicPalette, parseSymbol, parseToken, prettyNumeral, resolveRoman,
} from './harmony';

const C: KeySig = { tonic: 'C', mode: 'major' };
const Am: KeySig = { tonic: 'A', mode: 'minor' };
const A: KeySig = { tonic: 'A', mode: 'major' };

describe('roman numeral conventions', () => {
  it('reads case as quality: ii7 in C is Dm7', () => {
    const chord = resolveRoman('ii7', C);
    expect(chord.notes).toEqual(['D', 'F', 'A', 'C']);
    expect(chord.symbol).toBe('Dm7');
    expect(chord.func).toBe('subdominant');
  });

  it('reads numerals against the tonic major scale: bVII in A is G', () => {
    expect(resolveRoman('bVII', A).root).toBe('G');
    expect(resolveRoman('bVII', Am).root).toBe('G');
  });

  it('V7 in a minor key is a real dominant', () => {
    const chord = resolveRoman('V7', Am);
    expect(chord.symbol).toBe('E7');
    expect(chord.notes).toEqual(['E', 'G#', 'B', 'D']);
    expect(chord.func).toBe('dominant');
  });

  it('resolves secondary dominants: V7/vi in C is E7', () => {
    const chord = resolveRoman('V7/vi', C);
    expect(chord.symbol).toBe('E7');
    expect(chord.func).toBe('secondary');
    expect(chord.secondaryOf).toBe('vi');
  });

  it('handles diminished markings', () => {
    const chord = resolveRoman('viio7', Am);
    expect(chord.root).toBe('G#');
    expect(chord.func).toBe('dominant');
    expect(chord.notes.length).toBe(4);
  });

  it('flags borrowed chords: iv in C major', () => {
    const chord = resolveRoman('iv', C);
    expect(chord.notes).toEqual(['F', 'Ab', 'C']);
    expect(chord.func).toBe('borrowed');
  });

  it('supports the power/sus/extended vocabulary', () => {
    expect(resolveRoman('I5', C).notes).toEqual(['C', 'G']);
    expect(resolveRoman('V7sus4', C).notes).toEqual(['G', 'C', 'D', 'F']);
    expect(resolveRoman('Imaj9', C).notes.length).toBe(5);
    expect(resolveRoman('i6', Am).notes).toEqual(['A', 'C', 'E', 'F#']);
  });
});

describe('chord symbol parsing', () => {
  it('parses absolute symbols and infers the numeral', () => {
    const chord = parseSymbol('Am7', C)!;
    expect(chord.numeral).toBe('vi7');
    expect(chord.func).toBe('tonic');
  });

  it('keeps slash bass notes', () => {
    const chord = parseSymbol('C/E', C)!;
    expect(chord.root).toBe('C');
    expect(chord.bass).toBe('E');
  });

  it('falls back with a warning on nonsense', () => {
    const parsed = parseToken('xyz123', C);
    expect(parsed.warning).toBeTruthy();
  });

  it('roundtrips borrowed symbols: Bb in C is bVII', () => {
    expect(parseSymbol('Bb', C)!.numeral).toBe('bVII');
  });
});

describe('palettes and pretty-printing', () => {
  it('spells the major diatonic palette', () => {
    const numerals = diatonicPalette(C, false).map((p) => p.numeral);
    expect(numerals).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio']);
  });

  it('spells idiomatic sevenths', () => {
    const numerals = diatonicPalette(C, true).map((p) => p.numeral);
    expect(numerals).toContain('Imaj7');
    expect(numerals).toContain('V7');
    expect(numerals).toContain('viiø7');
  });

  it('prettifies numerals', () => {
    expect(prettyNumeral('bVII7')).toBe('♭VII7');
    expect(prettyNumeral('viio7/i')).toBe('vii°7/i');
    expect(prettyNumeral('7b9') === '7♭9').toBe(true);
  });
});
