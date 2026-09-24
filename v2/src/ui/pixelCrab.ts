// The crab, as pixels. One sprite, hand-placed on a 32×24 grid, drawn as
// SVG rects so it stays crisp at any size and takes its colours from the
// page. Every glyph the app needs — the wordmark's mascot, the canon's cursor,
// the verdict's rating — is this same sprite.

export const CRAB_W = 32;
export const CRAB_H = 24;

/** '.' empty · k outline · o shell · h sheen · w eye · i pupil. Left half; the right half is its mirror. */
const HALF = [
  '...........kkk..',
  '..........kwwwk.',
  '...kk.....kwiwk.',
  '..kook....kwwwk.',
  '.koook.kk..kkk..',
  '.koook.kok..ko..',
  '.koooooook..ko..',
  '.koooooook..ko..',
  '..kooooookkkkkkk',
  '...koooooooooooo',
  '....kkkooooooooo',
  '.....kohhooooooo',
  '...ookohoooooooo',
  '.oookkoooooooooo',
  'ookk.koooooooooo',
  'kk.ookoooooooooo',
  '.oookkoooooooooo',
  'ookk..kooooooooo',
  'kk..oookkooooooo',
  '..oookk..kkkkkkk',
  '.ookk...........',
  '.kk.............',
  '................',
  '................',
];

export const CRAB_ROWS: string[] = HALF.map((row) => {
  const left = row.slice(0, 16);
  return left + [...left].reverse().join('');
});

export type CrabPixel = 'k' | 'o' | 'h' | 'w' | 'i';

/** Every filled pixel, in draw order — the renderer only needs this once. */
export const CRAB_PIXELS: { x: number; y: number; kind: CrabPixel }[] = CRAB_ROWS.flatMap((row, y) =>
  [...row].flatMap((ch, x) => (ch === '.' ? [] : [{ x, y, kind: ch as CrabPixel }])),
);
