// The crab, as pixels. One sprite, hand-placed on a 32×24 grid, drawn as
// SVG rects so it stays crisp at any size and takes its colours from the
// page. Every glyph the app needs — the wordmark's mascot, the canon's cursor,
// the verdict's rating, the stamp on a practice day — is this same sprite.
//
// It has two frames. Standing, the legs on both sides match. Mid-step, the
// legs on one side have lifted a row while the other side's have reached a
// row lower — shown in turn with a steps() animation, it scuttles.

export const CRAB_W = 32;
export const CRAB_H = 24;

/** '.' empty · k outline · o shell · h sheen · w eye · i pupil. Left half of the standing crab; the right half is its mirror. */
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

/** The same half with every leg lifted a row (the body does not move). */
const HALF_UP = [
  ...HALF.slice(0, 11),
  '...ookohhooooooo',
  '.oookkohoooooooo',
  'ookk.koooooooooo',
  'kk.ookoooooooooo',
  '.oookkoooooooooo',
  'ookk.koooooooooo',
  'kk.oookooooooooo',
  '..oookkkkooooooo',
  '.ookk....kkkkkkk',
  '.kk.............',
  '................',
  '................',
  '................',
];

/** The same half with every leg reaching a row lower. */
const HALF_DOWN = [
  ...HALF.slice(0, 11),
  '.....kohhooooooo',
  '.....kohoooooooo',
  '...ookoooooooooo',
  '.oookkoooooooooo',
  'ookk.koooooooooo',
  'kk.ookoooooooooo',
  '.ooookkooooooooo',
  'oookk..kkooooooo',
  '.kk.ooo..kkkkkkk',
  '..oookk.........',
  '.ookk...........',
  '.kk.............',
  '................',
];

const mirror = (row: string): string => [...row].reverse().join('');
const join = (left: string[], right: string[]): string[] => left.map((row, y) => row + right[y]);

/** Frame 0: standing. Frame 1: mid-step, left legs up and right legs down. */
export const CRAB_FRAME_ROWS: string[][] = [
  join(HALF, HALF.map(mirror)),
  join(HALF_UP, HALF_DOWN.map(mirror)),
];

export const CRAB_ROWS: string[] = CRAB_FRAME_ROWS[0];

export type CrabPixel = 'k' | 'o' | 'h' | 'w' | 'i';

const pixels = (rows: string[]): { x: number; y: number; kind: CrabPixel }[] => rows.flatMap((row, y) =>
  [...row].flatMap((ch, x) => (ch === '.' ? [] : [{ x, y, kind: ch as CrabPixel }])),
);

/** Every filled pixel of each frame, in draw order — the renderer only needs this once. */
export const CRAB_FRAMES = CRAB_FRAME_ROWS.map(pixels);
export const CRAB_PIXELS = CRAB_FRAMES[0];
