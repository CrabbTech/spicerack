// Turns abstract chords into concrete guitar grips, picks voicings that sit
// near each other on the neck, and renders ASCII tab.

import { mod12, notePc, PitchClass } from '../theory/notes';
import { Chord } from '../theory/chords';
import { Fret, MOVABLE_SHAPES, OPEN_GRIPS, OPEN_MIDI, OPEN_PC, STRING_NAMES } from './shapes';

export const MAX_FRET = 15;

export interface GuitarVoicing {
  frets: Fret[];
  baseFret: number;
  label: string;
  midis: number[];
  avg: number;
}

function build(frets: Fret[], baseFret: number, label: string): GuitarVoicing {
  const fretted = frets.filter((f): f is number => f !== 'x');
  const midis = frets.flatMap((f, s) => (f === 'x' ? [] : [OPEN_MIDI[s] + f]));
  const avg = fretted.reduce((a, b) => a + b, 0) / Math.max(1, fretted.length);
  return { frets, baseFret, label, midis, avg };
}

/** Every known grip for a chord, sorted low neck → high neck. */
export function chordVoicings(chord: Chord): GuitarVoicing[] {
  const rootPc = notePc(chord.root);
  const out: GuitarVoicing[] = [];
  for (const grip of OPEN_GRIPS) {
    if (grip.rootPc === rootPc && grip.quality === chord.quality.id) {
      out.push(build(grip.frets, 0, 'open'));
    }
  }
  for (const shape of MOVABLE_SHAPES) {
    if (shape.quality !== chord.quality.id) continue;
    const minOffset = Math.min(...shape.offsets.filter((o): o is number => o !== 'x'));
    const maxOffset = Math.max(...shape.offsets.filter((o): o is number => o !== 'x'));
    const minBase = Math.max(0, -minOffset);
    for (let b = mod12(rootPc - OPEN_PC[shape.rootString]); b + maxOffset <= MAX_FRET; b += 12) {
      if (b < minBase) continue;
      const frets = shape.offsets.map((o) => (o === 'x' ? o : o + b));
      out.push(build(frets, b, b === 0 ? `${shape.label} · open` : `${shape.label} · ${b}fr`));
    }
  }
  const seen = new Set<string>();
  return out
    .filter((v) => {
      const k = v.frets.join(',');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.avg - b.avg);
}

export interface VoicingPrefs {
  preferOpen?: boolean;
  position: 'low' | 'mid';
}

/**
 * Choose a default voicing per chord so consecutive grips sit near each other
 * (cheap voice leading). Returns an index into each chord's candidate list.
 */
export function chooseVoicingIndices(candidates: GuitarVoicing[][], prefs: VoicingPrefs): number[] {
  const anchor = prefs.position === 'mid' ? 6.5 : 2;
  let prevAvg: number | undefined;
  return candidates.map((list) => {
    if (!list.length) return 0;
    let bestIdx = 0;
    let bestScore = Infinity;
    list.forEach((v, i) => {
      let score = prevAvg === undefined ? Math.abs(v.avg - anchor) : Math.abs(v.avg - prevAvg!) + 0.2 * Math.abs(v.avg - anchor);
      if (prefs.preferOpen && v.baseFret === 0) score -= 1.5;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    });
    prevAvg = list[bestIdx].avg;
    return bestIdx;
  });
}

// ---------------------------------------------------------------------------
// Scale rendering: full-neck map + a classic position box.

export interface FretboardNote {
  string: number; // 0 = low E
  fret: number;
  pc: PitchClass;
  isRoot: boolean;
}

export function scaleFretboard(tonicPc: PitchClass, pcs: PitchClass[], maxFret = MAX_FRET, openPcs: number[] = OPEN_PC): FretboardNote[] {
  const set = new Set(pcs.map(mod12));
  const out: FretboardNote[] = [];
  for (let s = 0; s < openPcs.length; s++) {
    for (let f = 0; f <= maxFret; f++) {
      const pc = mod12(openPcs[s] + f);
      if (set.has(pc)) out.push({ string: s, fret: f, pc, isRoot: pc === mod12(tonicPc) });
    }
  }
  return out;
}

/** Fret window of the "position 1" box: five frets anchored on the lowest string's root. */
export function boxWindow(tonicPc: PitchClass, openPcs: number[] = OPEN_PC): { lo: number; hi: number } {
  let rootFret = mod12(tonicPc - openPcs[0]);
  if (rootFret === 0) rootFret = 12;
  return { lo: rootFret - 1, hi: rootFret + 3 };
}

/** The "position 1" box: a 5-fret window anchored on the lowest string's root fret. */
export function scaleBox(tonicPc: PitchClass, pcs: PitchClass[], openPcs: number[] = OPEN_PC): FretboardNote[] {
  const { lo, hi } = boxWindow(tonicPc, openPcs);
  return scaleFretboard(tonicPc, pcs, MAX_FRET, openPcs).filter((n) => n.fret >= lo && n.fret <= hi);
}

// ---------------------------------------------------------------------------
// ASCII tab.

export function chordTabText(entries: { symbol: string; voicing: { frets: Fret[] } }[], names: string[] = STRING_NAMES): string {
  const tokens = entries.map((e) => e.voicing.frets.map((f) => String(f)));
  const widths = entries.map((e, i) => Math.max(e.symbol.length, ...tokens[i].map((t) => t.length)) + 3);
  let header = '   ';
  for (let i = 0; i < entries.length; i++) {
    header += ' ' + entries[i].symbol.padEnd(widths[i] - 1, ' ');
  }
  const lines: string[] = [header.trimEnd()];
  for (let s = names.length - 1; s >= 0; s--) {
    let line = `${names[s]}|-`;
    for (let i = 0; i < entries.length; i++) {
      line += '-' + tokens[i][s].padEnd(widths[i] - 1, '-');
    }
    lines.push(line + '|');
  }
  return lines.join('\n');
}

export function scaleTabText(name: string, box: FretboardNote[], names: string[] = STRING_NAMES): string {
  const ordered = [...box].sort((a, b) => a.string - b.string || a.fret - b.fret);
  const lines = [name];
  for (let s = names.length - 1; s >= 0; s--) {
    let line = `${names[s]}|-`;
    for (const n of ordered) {
      const token = n.string === s ? String(n.fret) : '';
      line += token.padEnd(String(n.fret).length + 1, '-');
    }
    lines.push(line + '-|');
  }
  return lines.join('\n');
}
