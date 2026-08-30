// The QWERTY piano: play the OP-1 layout on a computer keyboard when no
// hardware is plugged in. Bottom-row whites on Z/Q rows, raised keys on the
// rows above them, mirroring the 3-2-3-2 hardware groups.
//
//   lower octave: z x c v b n m   raised: s d f / h j
//   upper octave: q w e r t y u   raised: 2 3 4 / 6 7

/** event.key (lowercase) -> physical key index 0..23 */
export const QWERTY_TO_INDEX: Record<string, number> = {
  // F4..E5
  z: 0, s: 1, x: 2, d: 3, c: 4, f: 5, v: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
  // F5..E6
  q: 12, '2': 13, w: 14, '3': 15, e: 16, '4': 17, r: 18, t: 19, '6': 20, y: 21, '7': 22, u: 23,
};

export const qwertyIndex = (key: string): number | undefined =>
  QWERTY_TO_INDEX[key.toLowerCase()];

/** key-cap label for a physical key index, for the on-screen hint */
export const INDEX_TO_QWERTY: string[] = (() => {
  const out = new Array<string>(24).fill('');
  for (const [k, i] of Object.entries(QWERTY_TO_INDEX)) out[i] = k.toUpperCase();
  return out;
})();
