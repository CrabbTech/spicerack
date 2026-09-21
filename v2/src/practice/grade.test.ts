import { describe, expect, it } from 'vitest';
import { NoteName } from '../theory/notes';
import { Key, SCALES, scalePcs } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { LensId, lensView, loopContext, soloMap } from '../theory/solo';
import { buildLick } from '../theory/lick';
import { MelNote, MelodyContext, fromLick, newNoteId } from '../theory/melody';
import { gradeTake } from './grade';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const SCALE = { root: N('A'), def: SCALES.major };
const PCS = scalePcs(SCALE.root, SCALE.def);

function context(lens: LensId): MelodyContext {
  const chords = ['I', 'iv', 'V7', 'IV'].map((n) => resolveNumeral(n, AMAJ));
  const loop = loopContext(SCALE, chords);
  const segments = chords.map((c, i) => {
    const map = soloMap(SCALE, c, chords[(i + 1) % chords.length]);
    return { start: i * 4, beats: 4, map, ...lensView(lens, map, PCS, loop) };
  });
  return { segments, scalePcs: PCS, lo: 57, hi: 81, beatsPerBar: 4, totalBeats: 16 };
}
const note = (beat: number, midi: number, dur = 0.5): MelNote => ({ id: newNoteId(), beat, dur, midi, vel: 0.8 });

describe('grading a take', () => {
  it('gives the demo lick full marks on its own drill', () => {
    for (const lens of ['roots', 'thirds', 'arps', 'guide', 'map'] as LensId[]) {
      const ctx = context(lens);
      const take = fromLick(buildLick(ctx.segments, { lens, lo: ctx.lo, hi: ctx.hi, seed: 3, beatsPerBar: 4 }));
      const grade = gradeTake(take, ctx, lens);
      expect(grade.landings).toEqual({ hit: 4, total: 4 });
      expect(grade.score).toBe(100);
    }
  });

  it('forgives human timing: a little early, a little late', () => {
    const ctx = context('roots');
    const grade = gradeTake([note(15.8, 69), note(4.3, 74), note(7.75, 76), note(12.4, 74)], ctx, 'roots');
    expect(grade.landings.hit).toBe(4);
  });

  it('says exactly which change missed and what to aim for', () => {
    const ctx = context('thirds');
    const grade = gradeTake([note(0, 73), note(4, 78), note(8, 80), note(12, 78)], ctx, 'thirds'); // F♯ over Dm
    expect(grade.landings.hit).toBe(3);
    expect(grade.segments[1].landed).toBe(false);
    expect(grade.lines.join(' ')).toContain('Dm: you arrived on F♯ — aim for F');
  });

  it('counts silence at a chord change as a miss, and strays against the drill', () => {
    const ctx = context('roots');
    const grade = gradeTake([note(0, 69), note(1, 71), note(4, 74)], ctx, 'roots');
    expect(grade.landings).toEqual({ hit: 2, total: 4 });
    expect(grade.inside).toBeCloseTo(2 / 3);
    expect(grade.score).toBe(Math.round(100 * (0.6 * 0.5 + 0.4 * (2 / 3))));
  });

  it('grades the free-rhythm drills on staying inside only', () => {
    const ctx = context('rhythm');
    const grade = gradeTake([note(0, 69), note(1.5, 69), note(5, 69), note(9, 71)], ctx, 'rhythm');
    expect(grade.landings.total).toBe(0);
    expect(grade.score).toBe(75);
  });

  it('handles an empty pass', () => {
    const grade = gradeTake([], context('map'), 'map');
    expect(grade.score).toBe(0);
    expect(grade.lines[0]).toContain('Nothing heard');
  });
});
