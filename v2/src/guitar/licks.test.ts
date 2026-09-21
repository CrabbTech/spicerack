import { describe, expect, it } from 'vitest';
import { NoteName, mod12 } from '../theory/notes';
import { Key, SCALES, scalePcs } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { lensView, loopContext, soloMap } from '../theory/solo';
import { MelNote, MelodyContext, notesInBar, transposeToChord } from '../theory/melody';
import { simpleInterval } from '../theory/solo';
import { STARTER_LICKS, lickFromBar, lickNumbers, parseTab, placeLick, tabToNotes } from './licks';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const SCALE = { root: N('A'), def: SCALES.minorPent };
const PCS = scalePcs(SCALE.root, SCALE.def);
const GUITAR = [40, 45, 50, 55, 59, 64];

function context(numerals: string[]): MelodyContext {
  const chords = numerals.map((n) => resolveNumeral(n, AMAJ));
  const loop = loopContext(SCALE, chords);
  const segments = chords.map((c, i) => {
    const map = soloMap(SCALE, c, chords[(i + 1) % chords.length]);
    return { start: i * 4, beats: 4, map, ...lensView('map', map, PCS, loop) };
  });
  return { segments, scalePcs: PCS, lo: 52, hi: 76, beatsPerBar: 4, totalBeats: numerals.length * 4 };
}
const CTX = context(['I7', 'IV7', 'vi', 'V7']);
/** each note as a number against the root of the chord in its bar */
const numbers = (notes: MelNote[], bar: number) => {
  const rootPc = CTX.segments[bar].map.notes.find((n) => n.role === 'root')!.pc;
  return notes.map((n) => simpleInterval(n.midi - rootPc)).join(' ');
};

const TAB = `
e|-----------5-8-5--------|
B|---------5-------8-5----|
G|-----5h7-------------7--|
D|---7--------------------|
A|------------------------|
E|------------------------|
`;

describe('pasted tab', () => {
  it('reads strings, frets and order — ignoring the hammer-on', () => {
    const events = parseTab(TAB, 6);
    expect(events.map((e) => `${e.string}:${e.fret}`)).toEqual(['2:7', '3:5', '3:7', '4:5', '5:5', '5:8', '5:5', '4:8', '4:5', '3:7']);
  });
  it('reads two-digit frets, double-stops and a second system', () => {
    const events = parseTab('e|--12-10--|\nB|--12-----|\nG|---------|\nD|---------|\nA|---------|\nE|-0-------|\n\ne|-3-|\nB|---|\nG|---|\nD|---|\nA|---|\nE|---|', 6);
    expect(events.map((e) => `${e.string}:${e.fret}`)).toEqual(['0:0', '4:12', '5:12', '5:10', '5:3']);
    expect(events[1].col).toBe(events[2].col);
    expect(events[4].col).toBeGreaterThan(events[3].col);
  });
  it('turns columns into grid steps and remembers the strings', () => {
    const { notes, dropped } = tabToNotes(parseTab(TAB, 6), GUITAR, 0.5, 0, 4);
    expect(notes.map((n) => n.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(notes[0]).toMatchObject({ midi: 57, string: 2 });
    expect(dropped).toBe(2);
  });
  it('ignores prose around the tab', () => {
    expect(parseTab(`Intro lick (play twice)\n${TAB}\nthen the verse…`, 6)).toHaveLength(10);
  });
});

describe('licks as numbers', () => {
  it('says a lick the way a guitarist would', () => {
    expect(lickNumbers(STARTER_LICKS[0])).toBe('♭7 5 4 ♭3 R');
  });
  it('lands the same numbers on any chord', () => {
    for (const bar of [0, 1, 3]) {
      const placed = placeLick(STARTER_LICKS[0], CTX, bar);
      expect(numbers(placed, bar)).toBe('♭7 5 4 ♭3 R'); // the blue ♭3 survives over dominant chords
      for (const n of placed) {
        expect(n.midi).toBeGreaterThanOrEqual(CTX.lo);
        expect(n.midi).toBeLessThanOrEqual(CTX.hi);
      }
    }
  });
  it('bends the 3rd to the chord it lands on', () => {
    const arp = STARTER_LICKS.find((l) => l.name === 'Spell the chord')!;
    const overMinor = placeLick(arp, CTX, 2); // F♯m
    expect(mod12(overMinor[1].midi - overMinor[0].midi)).toBe(3);
    const overDom = placeLick(arp, CTX, 0); // A7
    expect(mod12(overDom[1].midi - overDom[0].midi)).toBe(4);
  });
  it('round-trips a bar through the library', () => {
    const placed = placeLick(STARTER_LICKS[2], CTX, 1);
    const lick = lickFromBar(placed, CTX, 1, 'mine')!;
    expect(lickNumbers(lick)).toBe(lickNumbers(STARTER_LICKS[2]));
    expect(placeLick(lick, CTX, 1).map((n) => n.midi)).toEqual(placed.map((n) => n.midi));
  });
});

describe('same numbers, next chord', () => {
  it('moves a lick from A7 to D7 without changing a single degree', () => {
    const lick = placeLick(STARTER_LICKS[0], CTX, 0);
    const out = transposeToChord(lick, CTX, 0, 1);
    const moved = notesInBar(out, CTX, 1);
    expect(numbers(moved, 1)).toBe('♭7 5 4 ♭3 R');
    expect(new Set(moved.map((n, i) => n.midi - lick[i].midi)).size).toBe(1);
    expect(notesInBar(out, CTX, 0)).toHaveLength(5);
  });
});
