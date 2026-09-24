import { describe, expect, it } from 'vitest';
import { Chord } from 'tonal';
import { OP1_BASE_MIDI, OP1_TOP_MIDI, fitChord, handDistance, keyTag, scaleKeyIndices } from './op1';

const fit = (type: string, root: string, opts = {}) => {
  const ch = Chord.getChord(type, root);
  return fitChord(ch.notes, ch.intervals, opts);
};

describe('window fitter', () => {
  it('keeps every voicing inside the 24-key window', () => {
    for (const [type, root] of [['maj7', 'C'], ['m7', 'F#'], ['13', 'G'], ['dim7', 'B'], ['9', 'Eb'], ['m11', 'D']] as const) {
      const v = fit(type, root);
      expect(v.midis.length).toBeGreaterThanOrEqual(2);
      expect(v.midis.length).toBeLessThanOrEqual(5);
      for (const m of v.midis) {
        expect(m).toBeGreaterThanOrEqual(OP1_BASE_MIDI);
        expect(m).toBeLessThanOrEqual(OP1_TOP_MIDI);
      }
    }
  });

  it('drops the fifth from six-note chords', () => {
    const v = fit('13', 'G');
    expect(v.omitted).toContain('5P');
    expect(v.midis.length).toBeLessThanOrEqual(5);
  });

  it('smooth mode moves the hand less than restarting at root position', () => {
    const cMaj = fit('M', 'C');
    const gRoot = fit('M', 'G');
    const gSmooth = fit('M', 'G', { prev: cMaj.midis, smooth: true });
    expect(handDistance(cMaj.midis, gSmooth.midis)).toBeLessThanOrEqual(handDistance(cMaj.midis, gRoot.midis));
  });
});

describe('geometry', () => {
  it('tags the physical keys', () => {
    expect(keyTag(0)).toBe('B1'); // F, leftmost
    expect(keyTag(1)).toBe('T1'); // F#
    expect(keyTag(7)).toBe('B5'); // C
    expect(keyTag(23)).toBe('B14'); // E, rightmost
  });

  it('lights scale keys with roots flagged', () => {
    const keys = scaleKeyIndices([0, 2, 4, 5, 7, 9, 11], 0); // C major
    const roots = keys.filter((k) => k.isRoot);
    expect(roots.length).toBe(2); // two C's in the window
    expect(keys.length).toBe(14); // 7 notes × 2 octaves
  });
});
