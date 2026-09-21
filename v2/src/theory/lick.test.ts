import { describe, expect, it } from 'vitest';
import { NoteName, mod12, notePc } from './notes';
import { Key, SCALES, scalePcs } from './scales';
import { resolveNumeral } from './roman';
import { LENSES, LensId, lensView, loopContext, soloMap } from './solo';
import { LickSegment, buildLick } from './lick';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const SCALE = { root: N('A'), def: SCALES.major };
const PCS = scalePcs(SCALE.root, SCALE.def);

function segmentsFor(numerals: string[], lens: LensId, bars = 1): LickSegment[] {
  const chords = numerals.map((n) => resolveNumeral(n, AMAJ));
  const loop = loopContext(SCALE, chords);
  return chords.map((c, i) => {
    const map = soloMap(SCALE, c, chords[(i + 1) % chords.length]);
    return { start: i * bars * 4, beats: bars * 4, map, ...lensView(lens, map, PCS, loop) };
  });
}

const OPTS = { lo: 52, hi: 76, seed: 7, beatsPerBar: 4 };
const PROG = ['I', 'iv', 'V7', 'IV'];

describe('demo licks', () => {
  it('is deterministic for a seed and changes with it', () => {
    const segs = segmentsFor(PROG, 'map');
    expect(buildLick(segs, { ...OPTS, lens: 'map' })).toEqual(buildLick(segs, { ...OPTS, lens: 'map' }));
    expect(buildLick(segs, { ...OPTS, lens: 'map', seed: 8 })).not.toEqual(buildLick(segs, { ...OPTS, lens: 'map' }));
  });

  it('obeys every lens: only lit notes, in range, inside the right chord', () => {
    for (const lens of LENSES) {
      for (let seed = 1; seed <= 12; seed++) {
        const segs = segmentsFor(PROG, lens.id, 2);
        const lick = buildLick(segs, { ...OPTS, lens: lens.id, seed });
        expect(lick.length).toBeGreaterThan(0);
        for (const n of lick) {
          const seg = segs.find((s) => n.beat >= s.start && n.beat < s.start + s.beats)!;
          expect(seg.lit.has(mod12(n.midi))).toBe(true);
          expect(n.midi).toBeGreaterThanOrEqual(OPTS.lo);
          expect(n.midi).toBeLessThanOrEqual(OPTS.hi);
          expect(n.dur).toBeGreaterThan(0);
        }
      }
    }
  });

  it('lands on the target when each chord arrives', () => {
    for (const lens of ['map', 'thirds', 'arps', 'roots', 'guide'] as LensId[]) {
      const segs = segmentsFor(PROG, lens);
      const lick = buildLick(segs, { ...OPTS, lens });
      for (const seg of segs) {
        const first = lick.find((n) => n.beat === seg.start)!;
        expect(seg.targets.has(mod12(first.midi))).toBe(true);
      }
    }
  });

  it('plays F♮ — not F♯ — on the downbeat of the borrowed iv', () => {
    const segs = segmentsFor(PROG, 'thirds');
    const lick = buildLick(segs, { ...OPTS, lens: 'thirds' });
    expect(mod12(lick.find((n) => n.beat === 4)!.midi)).toBe(5);
  });

  it('never parks on an avoid or rub note at the end of a bar', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const segs = segmentsFor(PROG, 'map');
      const lick = buildLick(segs, { ...OPTS, lens: 'map', seed });
      for (const seg of segs) {
        const inSeg = lick.filter((n) => n.beat >= seg.start && n.beat < seg.start + seg.beats);
        const last = inSeg[inSeg.length - 1];
        expect(['avoid', 'rub']).not.toContain(seg.map.byPc.get(mod12(last.midi))!.role);
      }
    }
  });

  it('keeps the one-note exercise on one pitch class', () => {
    const lick = buildLick(segmentsFor(PROG, 'rhythm'), { ...OPTS, lens: 'rhythm' });
    expect(new Set(lick.map((n) => mod12(n.midi))).size).toBe(1);
    expect(mod12(lick[0].midi)).toBe(notePc(N('A')));
  });

  it('leaves every other bar silent for the three-note answer', () => {
    const lick = buildLick(segmentsFor(PROG, 'three'), { ...OPTS, lens: 'three' });
    expect(lick.every((n) => Math.floor(n.beat / 4) % 2 === 0)).toBe(true);
    expect(new Set(lick.map((n) => mod12(n.midi))).size).toBeLessThanOrEqual(3);
  });

  it('fits partial and odd-length bars', () => {
    const segs = segmentsFor(PROG, 'map').map((s, i) => ({ ...s, start: i * 3.5, beats: 3.5 }));
    const lick = buildLick(segs, { ...OPTS, lens: 'map', beatsPerBar: 3.5 });
    for (const n of lick) expect(n.beat).toBeLessThan(14);
  });
});
