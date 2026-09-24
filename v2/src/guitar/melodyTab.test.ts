import { describe, expect, it } from 'vitest';
import { fingerNote, melodyKeysText, melodyTabText } from './melodyTab';
import { OPEN_MIDI, STRING_NAMES } from './shapes';

const note = (beat: number, midi: number) => ({ id: beat * 100 + midi, beat, dur: 0.5, midi, vel: 0.8 });

describe('melody tab', () => {
  it('fingers notes inside the position window', () => {
    // A4 (69) in the 5th-position box: B string, 10th fret is out; e string 5th fret is in
    expect(fingerNote(69, OPEN_MIDI, { lo: 4, hi: 8 }, 15)).toEqual({ string: 5, fret: 5 });
    // C♯4 (61): G string fret 6
    expect(fingerNote(61, OPEN_MIDI, { lo: 4, hi: 8 }, 15)).toEqual({ string: 3, fret: 6 });
    // below the window: falls back to the nearest reachable fret
    expect(fingerNote(40, OPEN_MIDI, { lo: 4, hi: 8 }, 15)).toEqual({ string: 0, fret: 0 });
    expect(fingerNote(20, OPEN_MIDI, { lo: 4, hi: 8 }, 15)).toBeUndefined();
  });
  it('lays a melody out in bars, high string on top', () => {
    const text = melodyTabText('Test', [note(0, 69), note(1, 61), note(4, 64)], 8, 4, OPEN_MIDI, STRING_NAMES, { lo: 4, hi: 8 }, 15);
    const lines = text.split('\n');
    expect(lines).toHaveLength(7);
    expect(lines[1].startsWith('e|-5-')).toBe(true);
    expect(lines[1].match(/\|/g)).toHaveLength(3);
    expect(lines[3]).toContain('6-'); // C♯ on the G string
    expect(new Set(lines.slice(1).map((l) => l.length)).size).toBe(1);
  });
  it('writes a key chart with key numbers', () => {
    const text = melodyKeysText('Keys', [note(0, 69), note(2.5, 73)], 8, 4, 65, 24, 'sharp');
    expect(text).toContain('bar  1: A4(k5)@1  C♯5(k9)@3.5');
    expect(text).toContain('bar  2: —');
  });
});
