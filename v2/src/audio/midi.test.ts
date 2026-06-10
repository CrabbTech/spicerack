import { describe, expect, it } from 'vitest';
import { buildMidiFile, midiFilename } from './midi';

const ascii = (bytes: Uint8Array, from: number, len: number): string =>
  String.fromCharCode(...bytes.slice(from, from + len));

const u16 = (b: Uint8Array, at: number): number => (b[at] << 8) | b[at + 1];
const u32 = (b: Uint8Array, at: number): number =>
  (b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3];

const SLOTS = [
  { midis: [48, 52, 55, 60, 64], bars: 1, rootPc: 0 },
  { midis: [45, 52, 57, 60, 64], bars: 2, rootPc: 9 },
];

const OPTS = {
  name: 'Test — C major',
  bpm: 120,
  swing: 0.5,
  pattern: [
    { beat: 0, durBeats: 1, vel: 0.9 },
    { beat: 2.5, durBeats: 0.5, vel: 0.6 },
  ],
  drums: { kick: [0, 2], snare: [1, 3], hat: [0, 0.5, 1, 1.5] },
  includeDrums: true,
  arp: false,
  instrument: 'guitar' as const,
};

describe('midi writer', () => {
  it('produces a structurally valid type-1 SMF', () => {
    const bytes = buildMidiFile(SLOTS, OPTS);
    expect(ascii(bytes, 0, 4)).toBe('MThd');
    expect(u32(bytes, 4)).toBe(6);
    expect(u16(bytes, 8)).toBe(1);   // format 1
    expect(u16(bytes, 10)).toBe(4);  // meta + chords + bass + drums
    expect(u16(bytes, 12)).toBe(480);
    // walk the chunks: every MTrk length must line up exactly
    let at = 14;
    let tracks = 0;
    while (at < bytes.length) {
      expect(ascii(bytes, at, 4)).toBe('MTrk');
      const len = u32(bytes, at + 4);
      at += 8 + len;
      tracks++;
      // each track ends with end-of-track meta FF 2F 00
      expect(bytes[at - 3]).toBe(0xff);
      expect(bytes[at - 2]).toBe(0x2f);
      expect(bytes[at - 1]).toBe(0x00);
    }
    expect(at).toBe(bytes.length);
    expect(tracks).toBe(4);
  });

  it('drops the drum track when drums are off', () => {
    const bytes = buildMidiFile(SLOTS, { ...OPTS, includeDrums: false });
    expect(u16(bytes, 10)).toBe(3);
  });

  it('arp mode emits single notes instead of block chords', () => {
    const block = buildMidiFile(SLOTS, OPTS);
    const arp = buildMidiFile(SLOTS, { ...OPTS, arp: true });
    expect(arp.length).not.toBe(block.length);
    expect(ascii(arp, 0, 4)).toBe('MThd');
  });

  it('builds sane filenames', () => {
    expect(midiFilename('Night drive', 'A minor')).toBe('spicerack-night-drive-a-minor.mid');
  });
});
