import { describe, expect, it } from 'vitest';
import { barEvents, beatsPerBar, groupStarts, timeSignature } from './groove';
import { buildMidiFile } from './midi';

const SLOT = { midis: [48, 52, 55], rootPc: 0 };
const BASE = {
  pattern: [{ beat: 0, durBeats: 1, vel: 0.9 }, { beat: 2.5, durBeats: 0.5, vel: 0.6 }],
  drums: { kick: [0, 2], snare: [1, 3], hat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  swing: 0, arp: false, instrument: 'guitar' as const,
};
const SEVEN_EIGHT = { groups: [2, 2, 3] };

describe('meters', () => {
  it('measures bars in quarter-note beats', () => {
    expect(beatsPerBar()).toBe(4);
    expect(beatsPerBar({ groups: [2, 2, 2] })).toBe(3);
    expect(beatsPerBar(SEVEN_EIGHT)).toBe(3.5);
    expect(beatsPerBar({ groups: [4, 4, 6] })).toBe(7);
    expect(groupStarts(SEVEN_EIGHT)).toEqual([0, 1, 2]);
  });
  it('writes honest time signatures', () => {
    expect(timeSignature()).toEqual({ numerator: 4, denomPow: 2 });
    expect(timeSignature({ groups: [2, 2, 2] })).toEqual({ numerator: 3, denomPow: 2 });
    expect(timeSignature(SEVEN_EIGHT)).toEqual({ numerator: 7, denomPow: 3 });
    expect(timeSignature({ groups: [3, 2, 2, 2, 3] })).toEqual({ numerator: 6, denomPow: 2 });
  });
});

describe('bar events', () => {
  it('plays the genre pattern in 4/4 with a backing bass under it', () => {
    const ev = barEvents(SLOT, 4, BASE);
    expect(ev.chords.map((h) => h.beat)).toEqual([0, 2.5]);
    expect(ev.bass.map((h) => h.beat)).toEqual([0, 2]);
    expect(ev.bass[0].midi).toBe(36); // C2 — inside E1..D♯2
    expect(ev.drums.filter((d) => d.drum === 'snare').map((d) => d.beat)).toEqual([1, 3]);
  });
  it('trims half-bar chords instead of spilling over', () => {
    const ev = barEvents(SLOT, 2, BASE);
    expect(ev.chords.map((h) => h.beat)).toEqual([0]);
    expect(ev.drums.every((d) => d.beat < 2)).toBe(true);
  });
  it('builds an odd-meter groove from the accent groups', () => {
    const ev = barEvents(SLOT, 3.5, { ...BASE, meter: SEVEN_EIGHT });
    expect(ev.chords.map((h) => h.beat)).toEqual([0, 1, 2]);
    expect(ev.drums.filter((d) => d.drum !== 'hat').map((d) => `${d.drum}@${d.beat}`)).toEqual(['kick@0', 'snare@1', 'snare@2']);
    expect(ev.drums.filter((d) => d.drum === 'hat')).toHaveLength(7);
    for (const list of [ev.chords, ev.bass]) {
      for (const h of list) expect(h.beat + h.dur).toBeLessThanOrEqual(3.5);
    }
  });
  it('lets the bass instrument carry the line and drops the backing bassist', () => {
    const ev = barEvents({ midis: [28, 35, 40], rootPc: 4 }, 4, { ...BASE, instrument: 'bass' });
    expect(ev.bass).toEqual([]);
    expect(ev.chords.map((h) => h.midis)).toEqual([[28], [35]]);
  });
  it('swings the upbeats', () => {
    const ev = barEvents(SLOT, 4, { ...BASE, swing: 0.6 });
    expect(ev.chords[1].beat).toBeCloseTo(2.6);
  });
});

describe('midi export stays faithful', () => {
  const SLOTS = [{ midis: [48, 52, 55], bars: 1, rootPc: 0 }, { midis: [53, 57, 60], bars: 1, rootPc: 5 }];
  const OPTS = { ...BASE, name: 'Test', bpm: 120, includeDrums: true };
  const noteOns = (bytes: Uint8Array, channel: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === (0x90 | channel) && bytes[i + 1] < 128 && bytes[i + 2] > 0 && bytes[i + 2] < 128) out.push(bytes[i + 1]);
    }
    return out;
  };
  it('stamps the meter into the file', () => {
    const bytes = buildMidiFile(SLOTS, { ...OPTS, meter: SEVEN_EIGHT });
    const at = bytes.findIndex((b, i) => b === 0xff && bytes[i + 1] === 0x58);
    expect([...bytes.slice(at + 3, at + 5)]).toEqual([7, 3]);
  });
  it('writes the gear-change repeat a whole step up', () => {
    const plain = buildMidiFile(SLOTS, OPTS);
    const lifted = buildMidiFile(SLOTS, { ...OPTS, modulate: 2 });
    expect(lifted.length).toBeGreaterThan(plain.length * 1.7);
    expect(noteOns(lifted, 0)).toContain(50); // C3 → D3 on the repeat
    expect(noteOns(plain, 0)).not.toContain(50);
  });
  it('adds the demo lick as its own track', () => {
    const bytes = buildMidiFile(SLOTS, { ...OPTS, lead: [{ beat: 0, dur: 1, midi: 76, vel: 0.9 }] });
    expect((bytes[10] << 8) | bytes[11]).toBe(5);
    expect(noteOns(bytes, 2)).toContain(76);
  });
});
