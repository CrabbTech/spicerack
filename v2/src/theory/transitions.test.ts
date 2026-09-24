import { describe, expect, it } from 'vitest';
import { NoteName } from './notes';
import { Key } from './scales';
import { resolveNumeral } from './roman';
import { explainTransition, voiceMoves } from './transitions';
import { GENRE_LIST } from '../data/genres';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const DDOR: Key = { tonic: N('D'), mode: 'dorian' };

const explain = (a: string, b: string, key: Key, distinctChords = 4) =>
  explainTransition(resolveNumeral(a, key), resolveNumeral(b, key), { key, distinctChords });

const moveText = (a: string, b: string, key: Key) =>
  voiceMoves(resolveNumeral(a, key), resolveNumeral(b, key)).map((m) => `${m.from}${m.kind === 'hold' ? '=' : '→'}${m.to}`);

describe('voice moves', () => {
  it('isolates B→C and F→E in G7 → C', () => {
    const moves = moveText('V7', 'I', CMAJ);
    expect(moves).toContain('B→C');
    expect(moves).toContain('F→E');
    expect(moves).toContain('G=G');
  });
  it('finds the ♭6 → 5 sigh in the borrowed iv', () => {
    expect(moveText('iv', 'I', AMAJ)).toContain('F→E');
  });
  it('gives every stepwise voice exactly one whole-step destination', () => {
    const moves = voiceMoves(resolveNumeral('V7', CMAJ), resolveNumeral('I', CMAJ));
    expect(moves.filter((m) => m.from === 'D')).toHaveLength(1);
  });
});

describe('transition stories', () => {
  it('names the cadences', () => {
    expect(explain('V7', 'I', CMAJ).story).toContain('authentic cadence');
    expect(explain('V7', 'I', CMAJ).story).toContain('B→C and F→E');
    expect(explain('IV', 'I', CMAJ).story).toContain('Amen');
    expect(explain('iv', 'I', AMAJ).story).toContain('minor plagal');
    expect(explain('V', 'vi', CMAJ).story).toContain('deceptive');
    expect(explain('bVII', 'I', AMAJ).story).toContain('rock cadence');
    expect(explain('bVII7', 'I', AMAJ).story).toContain('backdoor');
  });
  it('explains secondary dominants by their target', () => {
    const t = explain('V7/vi', 'vi', CMAJ);
    expect(t.title).toBe('E7 → Am');
    expect(t.story).toContain('private dominant');
    expect(t.story).toContain('G♯');
  });
  it('treats modal vamps as vamps, with the characteristic note', () => {
    const t = explain('i7', 'IV7', DDOR, 2);
    expect(t.story).toContain('Dorian vamp');
    expect(t.story).toContain('B');
  });
  it('hears blues changes as color, not tension', () => {
    expect(explain('I7', 'IV7', AMAJ, 3).story).toContain('Blues logic');
  });
  it('describes the bass and offers something to play', () => {
    const t = explain('V7', 'I', CMAJ);
    expect(t.bass).toContain('rises a 4th');
    expect(t.tryThis).toContain('land on');
  });
  it('marks the loop seam', () => {
    const t = explainTransition(resolveNumeral('V', CMAJ), resolveNumeral('I', CMAJ), { key: CMAJ, distinctChords: 4, wrap: true });
    expect(t.story.startsWith('The loop seam')).toBe(true);
  });
  it('has something to say about every change in the genre book', () => {
    for (const genre of GENRE_LIST) {
      for (const tpl of genre.templates) {
        const key: Key = { tonic: N('A'), mode: tpl.mode };
        const chords = tpl.numerals.map((n) => resolveNumeral(n, key));
        const distinctChords = new Set(tpl.numerals).size;
        chords.forEach((c, i) => {
          const t = explainTransition(c, chords[(i + 1) % chords.length], { key, distinctChords, wrap: i === chords.length - 1 });
          expect(t.story.length).toBeGreaterThan(40);
          expect(t.story).not.toContain('undefined');
          expect(t.bass).not.toContain('undefined');
        });
      }
    }
  });
});
