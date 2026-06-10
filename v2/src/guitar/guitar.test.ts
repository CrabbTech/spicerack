import { describe, expect, it } from 'vitest';
import { mod12, spellPcSimple } from '../theory/notes';
import { Chord, QUALITIES, QualityId } from '../theory/chords';
import { MOVABLE_SHAPES, OPEN_GRIPS, OPEN_PC } from './shapes';
import { chooseVoicingIndices, chordVoicings, scaleBox, chordTabText } from './voicing';
import { SCALES, scalePcs } from '../theory/scales';

const chordOf = (rootPc: number, quality: QualityId): Chord => ({
  root: spellPcSimple(rootPc),
  quality: QUALITIES[quality],
  numeral: 'I',
  func: 'tonic',
});

const soundedPcs = (frets: (number | 'x')[]): number[] =>
  frets.flatMap((f, s) => (f === 'x' ? [] : [mod12(OPEN_PC[s] + f)]));

describe('guitar shape library', () => {
  const allQualities = new Set<QualityId>([
    ...MOVABLE_SHAPES.map((s) => s.quality),
    ...OPEN_GRIPS.map((g) => g.quality),
  ]);

  it('every voicing of every quality at every root is spelled correctly', () => {
    for (const quality of allQualities) {
      const formula = QUALITIES[quality].tones;
      for (let rootPc = 0; rootPc < 12; rootPc++) {
        const voicings = chordVoicings(chordOf(rootPc, quality));
        expect(voicings.length, `${quality} @ ${rootPc} has voicings`).toBeGreaterThan(0);
        for (const v of voicings) {
          const pcs = soundedPcs(v.frets);
          const formulaPcs = new Set(formula.map((t) => mod12(rootPc + t.semitones)));
          for (const pc of pcs) {
            expect(formulaPcs.has(pc), `${quality}@${rootPc} ${v.label} [${v.frets}] plays stray pc ${pc}`).toBe(true);
          }
          const required = formula.filter((t) => quality === 'pow' || !(t.degree === 5 && t.semitones === 7));
          for (const t of required) {
            const pc = mod12(rootPc + t.semitones);
            expect(pcs.includes(pc), `${quality}@${rootPc} ${v.label} [${v.frets}] missing degree ${t.degree}`).toBe(true);
          }
          expect(pcs[0], `${quality}@${rootPc} ${v.label} bass note is the root`).toBe(rootPc);
          for (const f of v.frets) {
            if (f !== 'x') { expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThanOrEqual(15); }
          }
        }
      }
    }
  });

  it('movable shapes produce a voicing for every root', () => {
    for (const shape of MOVABLE_SHAPES) {
      for (let rootPc = 0; rootPc < 12; rootPc++) {
        const hits = chordVoicings(chordOf(rootPc, shape.quality));
        expect(hits.length, `${shape.label} @ ${rootPc}`).toBeGreaterThan(0);
      }
    }
  });

  it('open C major comes out as the cowboy grip', () => {
    const v = chordVoicings(chordOf(0, 'maj'))[0];
    expect(v.frets).toEqual(['x', 3, 2, 0, 1, 0]);
    expect(v.midis).toEqual([48, 52, 55, 60, 64]); // C3 E3 G3 C4 E4
  });

  it('proximity chooser keeps consecutive grips near each other', () => {
    const chords = [chordOf(0, 'maj'), chordOf(9, 'min'), chordOf(5, 'maj'), chordOf(7, 'maj')];
    const candidates = chords.map((c) => chordVoicings(c));
    const idx = chooseVoicingIndices(candidates, { position: 'mid' });
    const avgs = idx.map((i, k) => candidates[k][i].avg);
    for (let i = 1; i < avgs.length; i++) {
      expect(Math.abs(avgs[i] - avgs[i - 1]), `step ${i} jumps the neck`).toBeLessThanOrEqual(4);
    }
  });
});

describe('scale rendering', () => {
  it('A minor pentatonic box sits at the 5th fret', () => {
    const box = scaleBox(9, scalePcs({ letter: 'A', alter: 0 }, SCALES.minorPent));
    expect(box.length).toBeGreaterThanOrEqual(12);
    for (const n of box) {
      expect(n.fret).toBeGreaterThanOrEqual(4);
      expect(n.fret).toBeLessThanOrEqual(8);
    }
    expect(box.some((n) => n.string === 0 && n.fret === 5 && n.isRoot)).toBe(true);
  });

  it('tab text renders frets on the right strings', () => {
    const v = chordVoicings(chordOf(0, 'maj'))[0];
    const tab = chordTabText([{ symbol: 'C', voicing: v }]);
    const lines = tab.split('\n');
    expect(lines).toHaveLength(7);
    expect(lines[1]).toMatch(/^e\|.*0.*\|$/);
    expect(lines[6]).toMatch(/^E\|.*x.*\|$/);
  });
});
