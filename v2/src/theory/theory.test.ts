import { describe, expect, it } from 'vitest';
import { NoteName, noteLabelAscii, notePc, spellPcSimple } from './notes';
import { Key, SCALES, spellScale } from './scales';
import { chordSymbol, chordTones, chordPcs } from './chords';
import {
  chromaticNeighborNumeral, parseNumeralParts, partsToString, prettyNumeral,
  resolveNumeral, secondaryDominantOf, tritoneSubOf, withSuffix,
} from './roman';
import { diatonicPalette } from './progression';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });

const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const AMIN: Key = { tonic: N('A'), mode: 'minor' };
const FMAJ: Key = { tonic: N('F'), mode: 'major' };
const EMAJ: Key = { tonic: N('E'), mode: 'major' };

const ascii = (notes: NoteName[]) => notes.map(noteLabelAscii).join(' ');

describe('spelling', () => {
  it('spells major scales with correct accidentals', () => {
    expect(ascii(spellScale(N('F'), SCALES.major))).toBe('F G A Bb C D E');
    expect(ascii(spellScale(N('A'), SCALES.major))).toBe('A B C# D E F# G#');
    expect(ascii(spellScale(N('E', -1), SCALES.major))).toBe('Eb F G Ab Bb C D');
    expect(ascii(spellScale(N('F', 1), SCALES.major))).toBe('F# G# A# B C# D# E#');
  });
  it('spells minor and modal scales', () => {
    expect(ascii(spellScale(N('A'), SCALES.minor))).toBe('A B C D E F G');
    expect(ascii(spellScale(N('E'), SCALES.phrygian))).toBe('E F G A B C D');
    expect(ascii(spellScale(N('D'), SCALES.dorian))).toBe('D E F G A B C');
    expect(ascii(spellScale(N('F'), SCALES.lydian))).toBe('F G A B C D E');
    expect(ascii(spellScale(N('A'), SCALES.harmonicMinor))).toBe('A B C D E F G#');
    expect(ascii(spellScale(N('A'), SCALES.minorPent))).toBe('A C D E G');
    expect(ascii(spellScale(N('A'), SCALES.blues))).toBe('A C D Eb E G');
  });
  it('simple pc spelling honors flat preference', () => {
    expect(noteLabelAscii(spellPcSimple(10, 'flat'))).toBe('Bb');
    expect(noteLabelAscii(spellPcSimple(10, 'sharp'))).toBe('A#');
  });
});

describe('roman numerals', () => {
  it('resolves diatonic chords in C major', () => {
    expect(chordSymbol(resolveNumeral('I', CMAJ))).toBe('C');
    expect(chordSymbol(resolveNumeral('vi', CMAJ))).toBe('Am');
    expect(chordSymbol(resolveNumeral('V7', CMAJ))).toBe('G7');
    expect(chordSymbol(resolveNumeral('viio', CMAJ))).toBe('Bdim');
  });
  it('resolves borrowed chords against the tonic major grid', () => {
    expect(chordSymbol(resolveNumeral('bVII', EMAJ))).toBe('D');
    expect(chordSymbol(resolveNumeral('bVI', AMIN))).toBe('F');
    expect(chordSymbol(resolveNumeral('iv', CMAJ))).toBe('Fm');
    expect(noteLabelAscii(resolveNumeral('bVII', { tonic: N('A', -1), mode: 'major' }).root)).toBe('Gb');
  });
  it('handles minor-key dominants per convention', () => {
    expect(chordSymbol(resolveNumeral('V7', AMIN))).toBe('E7');
    expect(ascii(chordTones(resolveNumeral('V7', AMIN)))).toBe('E G# B D');
    expect(chordSymbol(resolveNumeral('v', AMIN))).toBe('Em');
  });
  it('resolves secondary dominants', () => {
    expect(chordSymbol(resolveNumeral('V7/vi', CMAJ))).toBe('E7');
    expect(chordSymbol(resolveNumeral('V7/IV', CMAJ))).toBe('C7');
    expect(chordSymbol(resolveNumeral('V7/V', CMAJ))).toBe('D7');
    expect(chordSymbol(resolveNumeral('V7/ii', FMAJ))).toBe('D7');
    expect(resolveNumeral('V7/vi', CMAJ).func).toBe('secondary');
    expect(chordSymbol(resolveNumeral('viio7/i', AMIN))).toBe('G♯dim7');
  });
  it('round-trips numerals through parse/print', () => {
    for (const s of ['I', 'bVII', 'V7/vi', 'iiø7', 'Imaj9', 'bII7', 'i', '#ivo7', 'V7sus4', 'I7#9']) {
      expect(partsToString(parseNumeralParts(s))).toBe(s.replace('°', 'o'));
    }
  });
  it('rejects garbage', () => {
    expect(() => parseNumeralParts('VIII')).toThrow();
    expect(() => parseNumeralParts('Ix9')).toThrow();
  });
  it('prettifies numerals', () => {
    expect(prettyNumeral('bVII')).toBe('♭VII');
    expect(prettyNumeral('#ivo7')).toBe('♯iv°7');
    expect(prettyNumeral('V7/vi')).toBe('V7/vi');
  });
  it('builds spice numerals', () => {
    expect(secondaryDominantOf('vi')).toBe('V7/vi');
    expect(secondaryDominantOf('IVmaj7')).toBe('V7/IV');
    expect(withSuffix('vi', '9')).toBe('vi9');
    expect(withSuffix('V7/ii', '13')).toBe('V13/ii');
    expect(tritoneSubOf('I')).toBe('bII7');
    expect(tritoneSubOf('vi')).toBe('bII7/vi');
    expect(chordSymbol(resolveNumeral(tritoneSubOf('I')!, CMAJ))).toBe('D♭7');
    // approach Dm7 from a half step above in C: Ebm7 = biii7
    expect(chromaticNeighborNumeral('ii7', 1)).toBe('biii7');
    expect(chordSymbol(resolveNumeral('biii7', CMAJ))).toBe('E♭m7');
    expect(chromaticNeighborNumeral('iii7', 1)).toBe('iv7');
  });
});

describe('chord tones', () => {
  it('spells extensions with correct letters', () => {
    expect(ascii(chordTones(resolveNumeral('Imaj9', CMAJ)))).toBe('C E G B D');
    expect(ascii(chordTones(resolveNumeral('ii9', CMAJ)))).toBe('D F A C E');
    expect(ascii(chordTones(resolveNumeral('V13', CMAJ)))).toBe('G B F A E');
    expect(ascii(chordTones(resolveNumeral('iiø7', CMAJ)))).toBe('D F Ab C');
  });
  it('dedupes pitch classes', () => {
    expect(chordPcs(resolveNumeral('I', CMAJ))).toEqual([0, 4, 7]);
  });
});

describe('diatonic palette', () => {
  const numerals = (key: Key) => diatonicPalette(key).map((p) => p.numeral).join(' ');
  const symbols = (key: Key) => diatonicPalette(key).map((p) => chordSymbol(p.chord)).join(' ');

  it('major palette', () => {
    expect(numerals(CMAJ)).toBe('I ii iii IV V vi viio');
    expect(symbols(CMAJ)).toBe('C Dm Em F G Am Bdim');
  });
  it('natural minor palette', () => {
    expect(numerals(AMIN)).toBe('i iio bIII iv v bVI bVII');
    expect(symbols(AMIN)).toBe('Am Bdim C Dm Em F G');
  });
  it('dorian palette', () => {
    expect(numerals({ tonic: N('D'), mode: 'dorian' })).toBe('i ii bIII IV v vio bVII');
  });
  it('mixolydian palette', () => {
    expect(numerals({ tonic: N('G'), mode: 'mixolydian' })).toBe('I ii iiio IV v vi bVII');
  });
  it('phrygian palette', () => {
    expect(numerals({ tonic: N('E'), mode: 'phrygian' })).toBe('i bII bIII iv vo bVI bvii');
  });
  it('palette sevenths are idiomatic', () => {
    const sevenths = diatonicPalette(CMAJ).map((p) => p.seventhNumeral).join(' ');
    expect(sevenths).toBe('Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7');
  });
});

describe('function tags', () => {
  it('tags functions by degree and mode membership', () => {
    expect(resolveNumeral('IV', CMAJ).func).toBe('subdominant');
    expect(resolveNumeral('V', CMAJ).func).toBe('dominant');
    expect(resolveNumeral('vi', CMAJ).func).toBe('tonic');
    expect(resolveNumeral('bVII', CMAJ).func).toBe('borrowed');
    expect(resolveNumeral('bVII', AMIN).func).toBe('dominant');
    expect(resolveNumeral('iv', CMAJ).func).toBe('borrowed');
    expect(resolveNumeral('iv', AMIN).func).toBe('subdominant');
  });
});

describe('pc sanity', () => {
  it('notePc handles alterations', () => {
    expect(notePc(N('B', 1))).toBe(0);
    expect(notePc(N('C', -1))).toBe(11);
    expect(notePc(N('F', 2))).toBe(7);
  });
});
