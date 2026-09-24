import { describe, expect, it } from 'vitest';
import { NoteName, mod12 } from './notes';
import { Key, SCALES, scalePcs } from './scales';
import { resolveNumeral } from './roman';
import { lensView, loopContext, soloMap } from './solo';
import { buildLick } from './lick';
import {
  MelNote, MelodyContext, analyzeMelody, answerBar, changeEnding, fixClashes, fromLick, invertBar,
  newNoteId, notesInBar, quantize, rerollPitches, roleAt, sequenceBar, stretchBar,
} from './melody';

const N = (letter: NoteName['letter'], alter = 0): NoteName => ({ letter, alter });
const AMAJ: Key = { tonic: N('A'), mode: 'major' };
const SCALE = { root: N('A'), def: SCALES.major };
const PCS = scalePcs(SCALE.root, SCALE.def);

function context(numerals: string[]): MelodyContext {
  const chords = numerals.map((n) => resolveNumeral(n, AMAJ));
  const loop = loopContext(SCALE, chords);
  const segments = chords.map((c, i) => {
    const map = soloMap(SCALE, c, chords[(i + 1) % chords.length]);
    return { start: i * 4, beats: 4, map, ...lensView('map', map, PCS, loop) };
  });
  return { segments, scalePcs: PCS, lo: 57, hi: 81, beatsPerBar: 4, totalBeats: numerals.length * 4 };
}

const CTX = context(['I', 'iv', 'V7', 'IV']);
const note = (beat: number, midi: number, dur = 0.5, locked = false): MelNote => ({ id: newNoteId(), beat, dur, midi, vel: 0.8, locked });
// bar 1 over A: C♯5 E5 F♯5 E5
const MOTIF = [note(0, 73), note(1, 76), note(1.5, 78), note(2.5, 76)];

describe('motif moves', () => {
  it('sequences a motif onto the next chord, landing on its target', () => {
    const out = sequenceBar(MOTIF, CTX, 0, 1);
    const moved = notesInBar(out, CTX, 1);
    expect(moved.map((n) => n.beat)).toEqual([4, 5, 5.5, 6.5]);
    expect(mod12(moved[0].midi)).toBe(5); // Dm's F♮ — not the F♯ the scale would have given
    expect(notesInBar(out, CTX, 0)).toHaveLength(4); // the original stays put
    const contour = (ns: MelNote[]) => ns.slice(1).map((n, i) => Math.sign(n.midi - ns[i].midi));
    expect(contour(moved)).toEqual(contour(MOTIF));
  });

  it('never moves a locked note and never lands on top of one', () => {
    const locked = note(4, 69, 1, true);
    const out = sequenceBar([...MOTIF, locked], CTX, 0, 1);
    const bar = notesInBar(out, CTX, 1);
    expect(bar.filter((n) => n.beat === 4)).toHaveLength(1);
    expect(bar.find((n) => n.beat === 4)!.midi).toBe(69);
  });

  it('rerolls pitches but keeps the rhythm, deterministically', () => {
    const a = rerollPitches(MOTIF, CTX, 0, 3);
    expect(a.map((n) => n.beat)).toEqual(MOTIF.map((n) => n.beat));
    expect(a).toEqual(rerollPitches(MOTIF, CTX, 0, 3));
    expect(a.map((n) => n.midi)).not.toEqual(rerollPitches(MOTIF, CTX, 0, 4).map((n) => n.midi));
    expect(roleAt(CTX, 0, a[0].midi)?.chordDegree).toBeDefined();
    for (const n of a) expect(n.midi).toBeGreaterThanOrEqual(CTX.lo);
  });

  it('changes only the ending', () => {
    const out = changeEnding(MOTIF, CTX, 0, 0);
    expect(out.slice(0, 2).map((n) => n.midi)).toEqual([73, 76]);
    expect(out[3].midi).not.toBe(76);
    // even seeds lean into the next chord: within a whole step of Dm's F
    expect([1, 2]).toContain(Math.min(...[65, 77].map((f) => Math.abs(out[3].midi - f))));
  });

  it('stretches into the next bar and squeezes into half of this one', () => {
    const wide = stretchBar(MOTIF, CTX, 0, 2);
    expect(wide.map((n) => n.beat)).toEqual([0, 2, 3, 5]);
    expect(wide[0].dur).toBe(1);
    const tight = stretchBar(MOTIF, CTX, 0, 0.5);
    expect(tight.map((n) => n.beat)).toEqual([0, 0.5, 0.75, 1.25, 2, 2.5, 2.75, 3.25]);
  });

  it('inverts the contour around the first note', () => {
    const out = invertBar(MOTIF, CTX, 0);
    expect(out[0].midi).toBe(73);
    expect(out[1].midi).toBeLessThan(73);
  });

  it('answers a question by coming to rest on the root', () => {
    const out = answerBar(MOTIF, CTX, 0, 3);
    const reply = notesInBar(out, CTX, 3);
    expect(reply).toHaveLength(4);
    const last = reply[reply.length - 1];
    expect(mod12(last.midi)).toBe(2); // D, root of the IV
    expect(last.dur).toBeGreaterThanOrEqual(1);
  });

  it('fixes strong-beat clashes and leaves passing notes alone', () => {
    const sour = [note(4, 78, 1), note(5.5, 78, 0.25)]; // F♯ over Dm: on the downbeat, then in passing
    const out = fixClashes(sour, CTX);
    expect([77, 76, 81, 74]).toContain(out[0].midi);
    expect(roleAt(CTX, 4, out[0].midi)?.chordDegree).toBeDefined();
    expect(out[1].midi).toBe(78);
  });

  it('quantizes captured notes and folds a late pickup onto the downbeat', () => {
    const out = quantize([note(0.04, 69, 0.4), note(0.06, 69, 0.4), note(15.9, 73, 0.3)], 0.5, 16);
    expect(out.map((n) => `${n.beat}:${n.midi}`)).toEqual(['0:69', '0:73']);
  });
});

describe('the coach', () => {
  it('praises a line that lands every change', () => {
    const lick = buildLick(CTX.segments, { lens: 'thirds', lo: CTX.lo, hi: CTX.hi, seed: 5, beatsPerBar: 4 });
    const report = analyzeMelody(fromLick(lick), CTX);
    expect(report.landings.every((l) => l.hit)).toBe(true);
    expect(report.observations[0].kind).toBe('good');
  });

  it('names the bar, the note and the fix when a change misses', () => {
    const melody = [note(0, 73, 1), note(2, 76, 1), note(4, 78, 2), note(8, 80, 1), note(12, 74, 1)];
    const report = analyzeMelody(melody, CTX);
    const miss = report.landings[1];
    expect(miss.hit).toBe(false);
    const fix = report.observations.find((o) => o.kind === 'fix')!;
    expect(fix.bar).toBe(1);
    expect(fix.text).toContain('Dm arrives on F♯');
    expect(fix.text).toMatch(/Try (F|A)/);
  });

  it('counts a note held across the barline as the landing', () => {
    const report = analyzeMelody([note(0, 69, 1), note(3, 69, 2.5)], CTX); // A held into Dm — its 5th
    expect(report.landings[1].hit).toBe(true);
  });

  it('notices when nothing repeats and when everything does', () => {
    const scattered = [note(0, 69), note(1, 71), note(4.5, 74), note(6, 77), note(8.25, 76), note(11, 80), note(12, 74), note(13.5, 78)];
    expect(analyzeMelody(scattered, CTX).observations.some((o) => o.text.includes('Sequence'))).toBe(true);
    const same = [0, 4, 8, 12].flatMap((b) => [note(b, 69), note(b + 1, 69)]);
    expect(analyzeMelody(same, CTX).observations.some((o) => o.text.includes('Change ending'))).toBe(true);
  });

  it('has nothing to say about an empty page', () => {
    expect(analyzeMelody([], CTX).observations).toEqual([]);
    expect(analyzeMelody([], CTX).space).toBe(1);
  });
});
