// Everything the Solo Lab needs for one scale choice over one progression:
// a map per chord, the active exercise's view of each map, and the demo lick.
// Built in one place so the diagrams and the audio engine can't disagree.

import { PitchClass, noteLabel, notePc, simplify } from '../theory/notes';
import { Key, SCALES, ScaleDef, scalePcs, spellScale } from '../theory/scales';
import { resolveNumeral } from '../theory/roman';
import { RealizedSlot } from '../theory/progression';
import { LensId, LensView, LoopContext, SoloMap, SoloScale, lensView, loopContext, soloMap } from '../theory/solo';
import { LeadNote, LickSegment, buildLick } from '../theory/lick';
import { ScaleRec } from '../data/genres';
import { OPEN_MIDI, OPEN_PC } from '../guitar/shapes';
import { boxWindow } from '../guitar/voicing';
import { neckPositions } from '../guitar/positions';
import { BASS_OPEN_MIDI, BASS_OPEN_PC } from '../bass/bass';
import { OP1_BASE_MIDI, OP1_KEY_COUNT } from '../op1/op1';
import { PIANO_BASE_MIDI, PIANO_KEY_COUNT } from '../piano/piano';
import { InstrumentId } from '../audio/engine';

export interface SoloModel {
  scale: SoloScale;
  def: ScaleDef;
  name: string;
  noteNames: string[];
  rootPc: PitchClass;
  pcs: PitchClass[];
  labelOf: (pc: PitchClass) => string;
  /** one per slot */
  maps: SoloMap[];
  views: LensView[];
  loop: LoopContext;
  lick: LeadNote[];
  /** the looped chords in play order, on the beat grid — what melodies and takes are read against */
  segments: LickSegment[];
  totalBeats: number;
  /** where a lead line sits on the instrument */
  range: { lo: number; hi: number };
  /** fret window of the chosen neck position (string instruments) */
  window?: { lo: number; hi: number };
}

/** Fret window for a string instrument's chosen neck position (0 = the home box). */
export function positionWindow(instrument: InstrumentId, rootPc: PitchClass, pcs: PitchClass[], position: number): { lo: number; hi: number } | undefined {
  if (instrument !== 'guitar' && instrument !== 'bass') return undefined;
  const openPcs = instrument === 'bass' ? BASS_OPEN_PC : OPEN_PC;
  const all = neckPositions(rootPc, pcs, openPcs);
  return all[position % Math.max(1, all.length)] ?? boxWindow(rootPc, openPcs);
}

/** Where a lead line sits on each instrument's diagram (inclusive midi range). */
export function leadRange(instrument: InstrumentId, octaveShift: number, window?: { lo: number; hi: number }): { lo: number; hi: number } {
  const w = window ?? { lo: 0, hi: 4 };
  switch (instrument) {
    case 'guitar':
      // the position box, top four strings — where leads actually get played
      return { lo: OPEN_MIDI[2] + w.lo, hi: OPEN_MIDI[5] + w.hi };
    case 'bass':
      return { lo: BASS_OPEN_MIDI[0] + w.lo, hi: BASS_OPEN_MIDI[3] + w.hi };
    case 'piano':
      return { lo: PIANO_BASE_MIDI + 12 * octaveShift, hi: PIANO_BASE_MIDI + PIANO_KEY_COUNT - 1 + 12 * octaveShift };
    case 'op1':
      return { lo: OP1_BASE_MIDI + 12 * octaveShift, hi: OP1_BASE_MIDI + OP1_KEY_COUNT - 1 + 12 * octaveShift };
  }
}

export interface SoloModelArgs {
  rec: ScaleRec;
  key: Key;
  realized: RealizedSlot[];
  instrument: InstrumentId;
  octaveShift: number;
  lens: LensId;
  seed: number;
  beatsPerBar: number;
  /** which connected neck position the lab is parked in (string instruments) */
  position?: number;
  /** when set, only these slot indices loop, in this order — landings and the lick wrap inside them */
  order?: number[] | null;
}

export function buildSoloModel(a: SoloModelArgs): SoloModel {
  const def = SCALES[a.rec.scale];
  const root = resolveNumeral(a.rec.root, a.key).root;
  const scale: SoloScale = { root, def };
  const rootPc = notePc(root);
  const pcs = scalePcs(root, def);
  const spelled = spellScale(root, def);
  const labels = new Map<PitchClass, string>();
  spelled.forEach((n) => labels.set(notePc(n), noteLabel(simplify(n))));

  const n = a.realized.length;
  const order = a.order?.length ? a.order : a.realized.map((_, i) => i);
  const nextOf = (i: number) => {
    const at = order.indexOf(i);
    return at >= 0 ? order[(at + 1) % order.length] : (i + 1) % n;
  };
  const loop = loopContext(scale, order.map((i) => a.realized[i].chord));

  const maps = a.realized.map((r, i) => soloMap(scale, r.chord, nextOf(i) !== i ? a.realized[nextOf(i)].chord : undefined));
  const views = maps.map((m) => lensView(a.lens, m, pcs, loop));

  let start = 0;
  const segments: LickSegment[] = order.map((i) => {
    const beats = a.realized[i].slot.bars * a.beatsPerBar;
    const seg = { start, beats, map: maps[i], ...views[i] };
    start += beats;
    return seg;
  });
  const window = positionWindow(a.instrument, rootPc, pcs, a.position ?? 0);
  const range = leadRange(a.instrument, a.octaveShift, window);
  const lick = segments.length ? buildLick(segments, { lens: a.lens, seed: a.seed, beatsPerBar: a.beatsPerBar, ...range }) : [];

  return {
    scale, def, rootPc, pcs, maps, views, loop, lick, segments, totalBeats: start, range, window,
    name: `${noteLabel(simplify(root))} ${def.name}`,
    noteNames: spelled.map((x) => noteLabel(simplify(x))),
    labelOf: (pc) => labels.get(pc) ?? '',
  };
}
