import { describe, expect, it } from 'vitest';
import { neckPositions } from './positions';
import { boxWindow } from './voicing';
import { OPEN_PC } from './shapes';
import { BASS_OPEN_PC } from '../bass/bass';

const A_MINOR_PENT = [9, 0, 2, 4, 7];
const A_MAJOR = [9, 11, 1, 2, 4, 6, 8];

describe('neck positions', () => {
  it('starts at the home box the app has always drawn', () => {
    for (const tonic of [0, 4, 9, 10]) {
      const home = neckPositions(tonic, A_MINOR_PENT.map((pc) => (pc - 9 + tonic + 12) % 12))[0];
      expect({ lo: home.lo, hi: home.hi }).toEqual(boxWindow(tonic));
    }
  });
  it('gives the five pentatonic boxes for A minor pentatonic', () => {
    expect(neckPositions(9, A_MINOR_PENT).map((p) => p.lo + 1)).toEqual([5, 8, 10, 12, 3]);
  });
  it('gives five CAGED-style windows for a seven-note scale', () => {
    const pos = neckPositions(9, A_MAJOR);
    expect(pos).toHaveLength(5);
    for (const p of pos) {
      expect(p.hi - p.lo).toBe(4);
      expect(p.lo).toBeGreaterThanOrEqual(0);
      expect(p.hi).toBeLessThanOrEqual(15);
      expect(A_MAJOR).toContain((OPEN_PC[0] + p.lo + 1) % 12);
    }
  });
  it('works on four strings too', () => {
    expect(neckPositions(4, [4, 7, 9, 11, 2], BASS_OPEN_PC).length).toBe(5);
  });
});
