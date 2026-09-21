// Connected positions: the scale's boxes laid end to end up the neck, so the
// one familiar box becomes five that join into a whole fretboard. Each box is
// a five-fret window hung on a note of the scale's pentatonic skeleton on the
// lowest string — for pentatonics these are the classic five shapes, and for
// seven-note scales they line up with the CAGED positions.

import { PitchClass, mod12 } from '../theory/notes';
import { OPEN_PC } from './shapes';
import { MAX_FRET } from './voicing';

export interface NeckPosition {
  /** 0 = the home box on the low-string root */
  index: number;
  lo: number;
  hi: number;
  label: string;
}

export function neckPositions(
  tonicPc: PitchClass, pcs: PitchClass[], openPcs: number[] = OPEN_PC, maxFret = MAX_FRET,
): NeckPosition[] {
  const tonic = mod12(tonicPc);
  const scale = pcs.map(mod12);
  const major = scale.includes(mod12(tonic + 4));
  const skeleton = (major ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10]).map((s) => mod12(tonic + s)).filter((pc) => scale.includes(pc));
  const anchors = skeleton.length >= 4 ? skeleton : scale;

  let rootFret = mod12(tonic - openPcs[0]);
  if (rootFret === 0) rootFret = 12;
  const out: NeckPosition[] = [];
  // walk upward from the home box, wrapping below it once the neck runs out
  for (let step = 0; step < 12; step++) {
    let fret = rootFret + step;
    if (fret + 3 > maxFret) fret -= 12;
    if (fret < 1 || !anchors.includes(mod12(openPcs[0] + fret))) continue;
    out.push({ index: out.length, lo: fret - 1, hi: fret + 3, label: `${fret}fr` });
  }
  return out;
}
