import { describe, expect, it } from 'vitest';
import { NoteName, notePc } from './notes';
import { Key, ModeId } from './scales';
import { resolveNumeral } from './roman';
import { borrowShelf, diatonicPalette } from './progression';
import {
  HarmonyFlavor, INTENTS, Intent, NextOption, WeightedPc, harmonizeOptions, nextChordOptions,
} from './suggest';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const MODES: ModeId[] = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian'];
const TONICS: NoteName[] = [N('C'), N('A'), N('E', -1), N('F', 1)];
const KEYS: Key[] = TONICS.flatMap((tonic) => MODES.map((mode) => ({ tonic, mode })));

const CMAJ: Key = { tonic: N('C'), mode: 'major' };
const AMIN: Key = { tonic: N('A'), mode: 'minor' };
const DDOR: Key = { tonic: N('D'), mode: 'dorian' };

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, Ab: 8, A: 9, B: 11 };

/** the empty start, every diatonic triad and seventh, the borrow shelf, and a few chords from well outside the key */
const prevsFor = (key: Key): (string | undefined)[] => [
  undefined,
  ...diatonicPalette(key).flatMap((e) => [e.numeral, e.seventhNumeral]),
  ...borrowShelf(key).map((s) => s.numeral),
  'bII7', 'V7sus4', 'V7/vi', 'III', 'bvi', '#ivo7', 'I5',
];

const of = (options: NextOption[], intent: Intent): NextOption[] => options.filter((o) => o.intent === intent);
const numerals = (options: NextOption[], intent: Intent): string[] => of(options, intent).map((o) => o.numeral);
const triad = (key: Key, numeral: string): string => {
  const chord = resolveNumeral(numeral, key);
  return `${notePc(chord.root)}|${chord.quality.tones.filter((t) => t.degree <= 5).map((t) => t.semitones).join(',')}`;
};

describe('next chord by intention', () => {
  it('describes all five intents, in order', () => {
    expect(INTENTS.map((i) => i.id)).toEqual(['settle', 'tension', 'brighten', 'darken', 'surprise']);
    for (const i of INTENTS) expect(i.blurb.length).toBeGreaterThan(20);
  });

  it('gives 2–3 resolvable, distinct options per intent in every mode, for every prev', () => {
    for (const key of KEYS) {
      for (const sevenths of [false, true]) {
        for (const prev of prevsFor(key)) {
          const options = nextChordOptions(prev, key, { sevenths });
          const where = `${key.tonic.letter}${key.tonic.alter} ${key.mode} after ${prev} (sevenths ${sevenths})`;
          for (const { id } of INTENTS) {
            const n = of(options, id).length;
            expect(n, `${where}: ${id}`).toBeGreaterThanOrEqual(2);
            expect(n, `${where}: ${id}`).toBeLessThanOrEqual(3);
          }
          for (const o of options) {
            const chord = resolveNumeral(o.numeral, key);
            expect(chord.numeral).toBe(o.chord.numeral);
            expect(notePc(chord.root)).toBe(notePc(o.chord.root));
            expect(o.numeral, where).not.toBe(prev);
            if (prev !== undefined) expect(triad(key, o.numeral), `${where}: ${o.numeral}`).not.toBe(triad(key, prev));
            expect(o.why.length, `${where}: ${o.numeral}`).toBeGreaterThan(40);
            expect(o.why, `${where}: ${o.numeral}`).not.toMatch(/undefined|NaN/);
          }
          expect(new Set(options.map((o) => o.numeral)).size, where).toBe(options.length);
          // C and Cmaj7 never both appear; only a pointing ♭7 (D vs D7) earns a second seat
          const plain = options.filter((o) => !o.chord.quality.tones.some((t) => t.degree === 7 && t.semitones === 10));
          expect(new Set(plain.map((o) => triad(key, o.numeral))).size, where).toBe(plain.length);
        }
      }
    }
  });

  it('keeps intents in their fixed order', () => {
    const order = INTENTS.map((i) => i.id);
    const seen = nextChordOptions('I', CMAJ).map((o) => order.indexOf(o.intent));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('resolves the dominant home, and saves vi for the deceptive surprise', () => {
    const options = nextChordOptions('V7', CMAJ);
    expect(numerals(options, 'settle')).toContain('I');
    expect(numerals(options, 'settle')).not.toContain('vi');
    expect(numerals(options, 'surprise')).toContain('vi');
    const homeWhy = of(options, 'settle').find((o) => o.numeral === 'I')!.why;
    expect(homeWhy).toContain('B→C');
    expect(homeWhy).toContain('F→E');
    expect(of(options, 'surprise').find((o) => o.numeral === 'vi')!.why).toContain('deceptive');
  });

  it('hears IV → I as the plagal settle', () => {
    const why = of(nextChordOptions('IV', CMAJ), 'settle').find((o) => o.numeral === 'I')!.why;
    expect(why).toContain('Amen');
    expect(why).toContain('F→E');
  });

  it('darkens C major with the borrowed iv and names the A♭', () => {
    const iv = of(nextChordOptions('I', CMAJ), 'darken').find((o) => o.numeral === 'iv');
    expect(iv).toBeDefined();
    expect(iv!.why).toContain('A♭');
    expect(iv!.why).toContain('♭6');
    expect(iv!.why).toContain('G');
  });

  it('builds tension in A minor with the borrowed leading tone', () => {
    for (const prev of [undefined, 'i', 'iv', 'bVI']) {
      const v7 = of(nextChordOptions(prev, AMIN), 'tension').find((o) => o.numeral === 'V7');
      expect(v7, `after ${prev}`).toBeDefined();
      expect(v7!.why).toContain('G♯');
    }
  });

  it('brightens D dorian with its own IV and the natural 6th', () => {
    for (const prev of [undefined, 'i', 'i7', 'bVII', 'v']) {
      const iv = of(nextChordOptions(prev, DDOR), 'brighten').find((o) => o.numeral === 'IV');
      expect(iv, `after ${prev}`).toBeDefined();
      expect(iv!.why).toContain('B');
      expect(iv!.why).toContain('natural 6th');
    }
  });

  it('aims a secondary dominant at where prev was heading', () => {
    const options = nextChordOptions('vi', CMAJ);
    const d7 = of(options, 'tension').find((o) => o.numeral === 'V7/V');
    expect(d7).toBeDefined();
    expect(d7!.why).toContain('F♯');
    expect(d7!.why).toContain('climbs a 4th');
  });

  it('offers chromatic mediants and the Neapolitan as surprises', () => {
    const options = of(nextChordOptions('I', CMAJ), 'surprise');
    expect(options.map((o) => o.numeral)).toEqual(['III', 'bII', 'VI']);
    expect(options[0].why).toContain('chromatic mediant');
    expect(options[0].why).toContain('G♯');
    expect(options[1].why).toContain('D♭→C');
  });

  it('prefers seventh forms for diatonic options when asked', () => {
    const options = nextChordOptions('V7', CMAJ, { sevenths: true });
    expect(numerals(options, 'settle')).toContain('Imaj7');
    expect(numerals(nextChordOptions('I', CMAJ, { sevenths: true }), 'tension')).toContain('V7');
    expect(numerals(nextChordOptions('i', DDOR, { sevenths: true }), 'brighten')).toContain('IV7');
  });

  it('throws on a numeral it cannot read', () => {
    expect(() => nextChordOptions('H9', CMAJ)).toThrow();
  });
});

describe('chords under a melody', () => {
  const top = (melody: WeightedPc[], key: Key, limit?: number) => harmonizeOptions(melody, key, { limit });

  it('returns only resolvable numerals, fits in 0..1 and clean copy, in every key', () => {
    const melodies: WeightedPc[][] = [
      [{ pc: 4, weight: 4 }, { pc: 7, weight: 2 }],
      [{ pc: 5, weight: 4 }],
      [{ pc: 8, weight: 4 }, { pc: 0, weight: 2 }],
      [{ pc: 1, weight: 1 }, { pc: 6, weight: 3 }, { pc: 10, weight: 2 }, { pc: 3, weight: 0.5 }, { pc: 11, weight: 1 }],
    ];
    for (const key of KEYS) {
      for (const melody of [...melodies, []]) {
        const options = harmonizeOptions(melody, key);
        expect(options.length).toBeGreaterThan(0);
        expect(options.length).toBeLessThanOrEqual(8);
        for (const o of options) {
          expect(resolveNumeral(o.numeral, key).numeral).toBe(o.chord.numeral);
          expect(o.fit).toBeGreaterThanOrEqual(0);
          expect(o.fit).toBeLessThanOrEqual(1);
          expect(o.why).not.toMatch(/undefined|NaN/);
        }
        expect(new Set(options.map((o) => o.numeral)).size).toBe(options.length);
        const fits = options.map((o) => o.fit);
        expect(fits).toEqual([...fits].sort((a, b) => b - a));
      }
    }
  });

  it('puts the tonic family under E and G in C major', () => {
    const options = top([{ pc: PC.E, weight: 4 }, { pc: PC.G, weight: 2 }], CMAJ, 40);
    expect(options[0].numeral).toBe('I');
    expect(options[0].fit).toBeGreaterThan(0.8);
    expect(options[0].why).toBe('E is the 3rd, G the 5th.');
    const rank = (n: string) => options.findIndex((o) => o.numeral === n);
    expect(rank('V')).toBeGreaterThan(rank('I'));
    expect(options[rank('V')].why).toContain('E floats above as the 13th');
  });

  it('keeps the tonic away from its avoid note', () => {
    const options = top([{ pc: PC.F, weight: 4 }], CMAJ, 40);
    expect(['IV', 'ii']).toContain(options[0].numeral);
    expect(options.slice(0, 5).map((o) => o.numeral)).not.toContain('I');
    const tonic = options.find((o) => o.numeral === 'I')!;
    expect(tonic.fit).toBe(0);
    expect(tonic.why).toContain('F grinds a half step above E, the 3rd');
    expect(harmonizeOptions([{ pc: PC.F, weight: 4 }], CMAJ).map((o) => o.numeral)).not.toContain('I');
  });

  it('reaches for borrowed chords when the melody leaves the key', () => {
    const options = harmonizeOptions([{ pc: PC.Ab, weight: 4 }, { pc: PC.C, weight: 2 }], CMAJ);
    expect(options[0].flavor).toBe('borrowed');
    const borrowed = options.filter((o) => o.numeral === 'iv' || o.numeral === 'bVI');
    expect(borrowed.length).toBeGreaterThan(0);
    for (const o of borrowed) expect(o.fit).toBeGreaterThan(0.8);
    expect(options.find((o) => o.numeral === 'iv')!.why).toContain('A♭ is the 3rd, C the 5th');
  });

  it('shows every flavor that has a viable chord', () => {
    const melodies: WeightedPc[][] = [
      [{ pc: PC.E, weight: 4 }, { pc: PC.G, weight: 2 }],
      [{ pc: PC.C, weight: 4 }, { pc: PC.G, weight: 2 }],
      [{ pc: PC.D, weight: 3 }, { pc: PC.F, weight: 3 }, { pc: PC.A, weight: 1 }],
      [{ pc: PC.Ab, weight: 4 }, { pc: PC.C, weight: 2 }],
    ];
    const flavors: HarmonyFlavor[] = ['simple', 'sus', 'rich', 'borrowed'];
    let sawAllFour = false;
    for (const key of [CMAJ, AMIN, DDOR]) {
      for (const melody of melodies) {
        const everything = harmonizeOptions(melody, key, { limit: 200 });
        const shown = harmonizeOptions(melody, key);
        for (const flavor of flavors) {
          const viable = everything.some((o) => o.flavor === flavor && o.fit >= 0.4);
          if (viable) expect(shown.map((o) => o.flavor), `${key.mode} ${flavor}`).toContain(flavor);
        }
        if (flavors.every((f) => shown.some((o) => o.flavor === f))) sawAllFour = true;
      }
    }
    expect(sawAllFour).toBe(true);
  });

  it('merges repeated notes and ignores weightless ones', () => {
    const a = harmonizeOptions([{ pc: PC.E, weight: 2 }, { pc: PC.E + 12, weight: 2 }, { pc: PC.G, weight: 2 }, { pc: PC.F, weight: 0 }], CMAJ);
    const b = harmonizeOptions([{ pc: PC.E, weight: 4 }, { pc: PC.G, weight: 2 }], CMAJ);
    expect(a.map((o) => [o.numeral, o.fit])).toEqual(b.map((o) => [o.numeral, o.fit]));
  });

  it('falls back to the diatonic triads when there is no melody', () => {
    const options = harmonizeOptions([], CMAJ);
    expect(options.map((o) => o.numeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viio']);
    for (const o of options) {
      expect(o.fit).toBe(0.5);
      expect(o.flavor).toBe('simple');
      expect(o.why).toContain('no melody here yet');
    }
    expect(options[0].why).toContain('C–E–G');
  });
});
