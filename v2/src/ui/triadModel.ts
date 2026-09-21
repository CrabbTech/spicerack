// The Triad Lab's data for one progression on one instrument: every chord's
// playable triad shapes, the chosen path through them, and how far that path
// travels compared with playing everything in root position.

import { RealizedSlot } from '../theory/progression';
import { LeadNote } from '../theory/lick';
import {
  PathMode, TriadSpec, TriadVoicing, keyboardTriads, pathTravel, stringSets, stringTriads, triadPath, triadSpec,
} from '../theory/triads';
import { OPEN_MIDI, STRING_NAMES } from '../guitar/shapes';
import { MAX_FRET } from '../guitar/voicing';
import { BASS_MAX_FRET, BASS_OPEN_MIDI, BASS_STRING_NAMES } from '../bass/bass';
import { OP1_BASE_MIDI, OP1_KEY_COUNT } from '../op1/op1';
import { PIANO_BASE_MIDI, PIANO_KEY_COUNT } from '../piano/piano';
import { InstrumentId } from '../audio/engine';

export interface TriadModel {
  /** string instrument: the three-string sets on offer and the neck they live on */
  neck?: { sets: number[][]; setNames: string[]; setIdx: number; openMidi: number[]; names: string[]; maxFret: number };
  /** keyboard instrument: the window the inversions have to fit inside */
  keys?: { base: number; count: number; piano: boolean };
  specs: TriadSpec[];
  candidates: TriadVoicing[][];
  /** index into each chord's candidates; -1 = nothing playable */
  picks: number[];
  chosen: (TriadVoicing | undefined)[];
  /** semitones (frets) the voices travel around one loop of this path… */
  travel: number;
  /** …and what root position everywhere would cost */
  rootTravel: number;
}

export interface TriadModelArgs {
  realized: RealizedSlot[];
  instrument: InstrumentId;
  octaveShift: number;
  /** which three-string set; undefined = the top one, where triads sing */
  setIdx?: number;
  mode: PathMode;
  upper: boolean;
  /** slot id → pinned candidate index */
  pins: Record<number, number>;
  /** fret window of the neck position the player is parked in */
  window?: { lo: number; hi: number };
}

export function buildTriadModel(a: TriadModelArgs): TriadModel {
  const specs = a.realized.map((r) => triadSpec(r.chord, a.upper ? 'upper' : 'base'));
  const pins = a.realized.map((r) => a.pins[r.slot.id]);
  const finish = (candidates: TriadVoicing[][], anchor: number, extra: Pick<TriadModel, 'neck' | 'keys'>): TriadModel => {
    const picks = triadPath(candidates, a.mode, anchor, pins);
    const chosen = picks.map((k, i) => (k >= 0 ? candidates[i][k] : undefined));
    const rootPicks = triadPath(candidates, 'root', anchor);
    return {
      ...extra, specs, candidates, picks, chosen,
      travel: pathTravel(chosen),
      rootTravel: pathTravel(rootPicks.map((k, i) => (k >= 0 ? candidates[i][k] : undefined))),
    };
  };

  if (a.instrument === 'guitar' || a.instrument === 'bass') {
    const bass = a.instrument === 'bass';
    const openMidi = bass ? BASS_OPEN_MIDI : OPEN_MIDI;
    const names = bass ? BASS_STRING_NAMES : STRING_NAMES;
    const maxFret = bass ? BASS_MAX_FRET : MAX_FRET;
    const sets = stringSets(openMidi.length);
    const setIdx = Math.min(sets.length - 1, Math.max(0, a.setIdx ?? sets.length - 1));
    const set = sets[setIdx];
    const w = a.window ?? { lo: 4, hi: 8 };
    const anchor = openMidi[set[1]] + (w.lo + w.hi) / 2;
    return finish(specs.map((spec) => stringTriads(spec, set, openMidi, maxFret)), anchor, {
      neck: { sets, setIdx, openMidi, names, maxFret, setNames: sets.map((s) => s.map((i) => names[i]).join('-')) },
    });
  }
  const piano = a.instrument === 'piano';
  const base = (piano ? PIANO_BASE_MIDI : OP1_BASE_MIDI) + 12 * a.octaveShift;
  const count = piano ? PIANO_KEY_COUNT : OP1_KEY_COUNT;
  return finish(specs.map((spec) => keyboardTriads(spec, base, count)), base + count / 2, { keys: { base, count, piano } });
}

/** The path as a demo line: each triad rolled low–mid–high–mid in eighths for as long as its chord lasts. */
export function triadArp(chosen: (TriadVoicing | undefined)[], realized: RealizedSlot[], beatsPerBar: number): LeadNote[] {
  const out: LeadNote[] = [];
  let at = 0;
  realized.forEach((r, i) => {
    const beats = r.slot.bars * beatsPerBar;
    const v = chosen[i];
    if (v) {
      for (let step = 0; step * 0.5 < beats - 1e-6; step++) {
        out.push({ beat: at + step * 0.5, dur: 0.46, midi: v.midis[[0, 1, 2, 1][step % 4]], vel: step % 4 === 0 ? 0.92 : 0.74 });
      }
    }
    at += beats;
  });
  return out;
}
