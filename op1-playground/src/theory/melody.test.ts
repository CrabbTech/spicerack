import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { KeySig, resolveRoman } from './harmony';
import { DEFAULT_MELODY_PARAMS, generateMelody } from './melody';
import { OP1_BASE_MIDI, OP1_TOP_MIDI } from '../op1/op1';

const C: KeySig = { tonic: 'C', mode: 'major' };
const slots = ['I', 'vi', 'IV', 'V'].map((t) => ({ chord: resolveRoman(t, C), bars: 1 }));
const params = { ...DEFAULT_MELODY_PARAMS, seed: 7 };

describe('melody generator', () => {
  it('is deterministic for a given seed', () => {
    const a = generateMelody(slots, C, params);
    const b = generateMelody(slots, C, params);
    expect(a).toEqual(b);
    const c = generateMelody(slots, C, { ...params, seed: 8 });
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('stays inside the OP-1 window', () => {
    for (const register of ['high', 'mid', 'wide'] as const) {
      for (const note of generateMelody(slots, C, { ...params, register })) {
        expect(note.midi).toBeGreaterThanOrEqual(OP1_BASE_MIDI);
        expect(note.midi).toBeLessThanOrEqual(OP1_TOP_MIDI);
      }
    }
  });

  it('puts chord tones on the downbeats', () => {
    const melody = generateMelody(slots, C, params);
    for (const note of melody.filter((n) => n.start % 2 === 0)) {
      const chromas = slots[note.slotIdx].chord.notes.map((n) => Note.chroma(n));
      expect(chromas).toContain(note.midi % 12);
    }
  });

  it('rerolling one bar leaves earlier bars alone', () => {
    const before = generateMelody(slots, C, params);
    const after = generateMelody(slots, C, { ...params, barSeeds: [0, 500] });
    const bar0 = (notes: typeof before) => notes.filter((n) => n.start < 4);
    expect(bar0(after)).toEqual(bar0(before));
  });

  it('handles half-bar and multi-bar slots', () => {
    const mixed = [
      { chord: resolveRoman('I', C), bars: 0.5 },
      { chord: resolveRoman('IV', C), bars: 2 },
    ];
    const melody = generateMelody(mixed, C, params);
    expect(melody.length).toBeGreaterThan(0);
    const total = 0.5 * 4 + 2 * 4;
    for (const note of melody) expect(note.start).toBeLessThan(total);
  });
});
