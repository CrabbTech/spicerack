// A lick library that stores licks the way they actually work: as numbers
// against a chord, not as fret positions. "♭7 5 4 ♭3 R" over A7 is the same
// lick over D7 five frets up, and over Dm with nothing changed at all — once
// it's written as numbers, a player's existing vocabulary fits every chord.
//
// Also here: reading pasted ASCII tab, because tab is the script this player
// already reads and writes.

import { mod12 } from '../theory/notes';
import { simpleInterval } from '../theory/solo';
import { LickSegment } from '../theory/lick';
import { storageKey } from '../state/storage';
import { MelNote, MelodyContext, fitQuality, newNoteId, notesInBar, segmentAt } from '../theory/melody';

// --- pasted tab ------------------------------------------------------------------

export interface TabEvent {
  string: number;
  fret: number;
  /** column in the tab — notes that share one sound together */
  col: number;
}

const TAB_LINE = /^\s*[A-Ga-g]?[#b♯♭]?\s*\|?[-–—\d|hHpPbBrRsS/\\~()xX^<>.*=\s]*-[-–—\d|hHpPbBrRsS/\\~()xX^<>.*=\s]*$/;

/**
 * Notes from ASCII tab. Lines are read in systems of `stringCount` (top line =
 * highest string); adjacent digits are one fret number when that makes a fret
 * that exists (10–24), and everything that isn't a digit is ignored.
 */
export function parseTab(text: string, stringCount: number): TabEvent[] {
  const lines = text.split(/\r?\n/).filter((l) => TAB_LINE.test(l) && /\d/.test(l.replace(/^[^|]*\|/, '')) || /^\s*[A-Ga-g]?\s*\|[-–—|\s]+$/.test(l));
  const out: TabEvent[] = [];
  let offset = 0;
  for (let at = 0; at + stringCount <= lines.length; at += stringCount) {
    const system = lines.slice(at, at + stringCount).map((l) => l.replace(/^\s*[A-Ga-g]?[#b♯♭]?\s*(?=\|)/, ''));
    let width = 0;
    system.forEach((line, row) => {
      width = Math.max(width, line.length);
      for (let c = 0; c < line.length; c++) {
        if (!/\d/.test(line[c])) continue;
        let fret = Number(line[c]);
        if (/\d/.test(line[c + 1] ?? '') && Number(line.slice(c, c + 2)) <= 24) {
          fret = Number(line.slice(c, c + 2));
          out.push({ string: stringCount - 1 - row, fret, col: offset + c });
          c++;
          continue;
        }
        out.push({ string: stringCount - 1 - row, fret, col: offset + c });
      }
    });
    offset += width + 1;
  }
  return out.sort((a, b) => a.col - b.col || a.string - b.string);
}

/**
 * Tab carries order, not rhythm — so each column becomes one grid step, from
 * `startBeat`. Returns the notes that fit and how many ran off the end.
 */
export function tabToNotes(
  events: TabEvent[], openMidi: number[], grid: number, startBeat: number, totalBeats: number,
): { notes: MelNote[]; dropped: number } {
  const cols = [...new Set(events.map((e) => e.col))].sort((a, b) => a - b);
  const notes: MelNote[] = [];
  let dropped = 0;
  for (const e of events) {
    const beat = startBeat + cols.indexOf(e.col) * grid;
    if (beat >= totalBeats - 1e-6 || openMidi[e.string] === undefined) { dropped++; continue; }
    notes.push({ id: newNoteId(), beat, dur: grid, midi: openMidi[e.string] + e.fret, vel: 0.85, string: e.string });
  }
  return { notes, dropped };
}

// --- licks as numbers --------------------------------------------------------------

export interface LickNote {
  /** beats from the start of the lick */
  beat: number;
  dur: number;
  /** semitones above the chord root the lick was written over (can run below 0 or past 12) */
  semis: number;
}

export interface Lick {
  id: string;
  name: string;
  notes: LickNote[];
  /** where it came from, e.g. "over A7" */
  from?: string;
  starter?: boolean;
}

/** "♭7 5 4 ♭3 R" — the lick as a guitarist would say it. */
export const lickNumbers = (lick: Lick): string => lick.notes.map((n) => simpleInterval(n.semis)).join(' ');

const rootPcOf = (seg: LickSegment): number => seg.map.notes.find((n) => n.role === 'root')?.pc ?? 0;

/** Lift one bar out of the melody as numbers against the chord it sits on. */
export function lickFromBar(notes: MelNote[], ctx: MelodyContext, bar: number, name: string): Lick | undefined {
  const motif = notesInBar(notes, ctx, bar);
  const seg = motif.length ? segmentAt(ctx, motif[0].beat) : undefined;
  if (!seg) return undefined;
  const start = bar * ctx.beatsPerBar;
  // measure from the root at or below the lick's lowest note, so the numbers read upward
  const lowest = Math.min(...motif.map((n) => n.midi));
  const rootMidi = lowest - mod12(lowest - rootPcOf(seg));
  return {
    id: `lick-${Date.now().toString(36)}`, name,
    notes: motif.map((n) => ({ beat: n.beat - start, dur: n.dur, semis: n.midi - rootMidi })),
  };
}

/** Drop a lick onto a bar: same numbers against that bar's chord, in whichever octave sits best on the instrument. */
export function placeLick(lick: Lick, ctx: MelodyContext, bar: number): MelNote[] {
  const start = bar * ctx.beatsPerBar;
  const seg = segmentAt(ctx, start);
  if (!seg || !lick.notes.length) return [];
  const rootPc = rootPcOf(seg);
  const center = (ctx.lo + ctx.hi) / 2;
  const mid = lick.notes.reduce((a, n) => a + n.semis, 0) / lick.notes.length;
  let best: { root: number; out: number; off: number } | undefined;
  for (let root = ctx.lo - 24; root <= ctx.hi; root++) {
    if (mod12(root) !== rootPc) continue;
    const out = lick.notes.filter((n) => root + n.semis < ctx.lo || root + n.semis > ctx.hi).length;
    const off = Math.abs(root + mid - center);
    if (!best || out < best.out || (out === best.out && off < best.off)) best = { root, out, off };
  }
  if (!best) return [];
  return lick.notes
    .filter((n) => start + n.beat < ctx.totalBeats - 1e-6)
    .map((n) => {
      const at = segmentAt(ctx, start + n.beat) ?? seg;
      // if the chord changes mid-lick the numbers follow the first chord — it's one phrase
      return { id: newNoteId(), beat: start + n.beat, dur: n.dur, vel: 0.85, midi: at === seg ? fitQuality(best!.root + n.semis, seg) : best!.root + n.semis };
    });
}

const L = (name: string, from: string, ...notes: [number, number, number][]): Lick =>
  ({ id: `starter-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`, name, from, starter: true, notes: notes.map(([beat, dur, semis]) => ({ beat, dur, semis })) });

/** A few you almost certainly already play — here so you can see them as numbers. */
export const STARTER_LICKS: Lick[] = [
  L('Box-one descent', 'the first lick everyone learns in the pentatonic box', [0, 0.5, 10], [0.5, 0.5, 7], [1, 0.5, 5], [1.5, 0.5, 3], [2, 1.5, 0]),
  L('The ♭3 → 3 slide', 'country, blues, Allmans: the minor 3rd sliding into the major', [0, 0.5, 2], [0.5, 0.25, 3], [0.75, 0.75, 4], [1.5, 0.5, 7], [2, 0.5, 9], [2.5, 1.5, 12]),
  L('Blues scale fall', 'the ♭5 on the way down, never parked on', [0, 0.5, 12], [0.5, 0.5, 10], [1, 0.5, 7], [1.5, 0.5, 6], [2, 0.5, 5], [2.5, 0.5, 3], [3, 1, 0]),
  L('Spell the chord', 'root, 3rd, 5th, octave and back to the 5th — the arpeggio as a lick', [0, 0.5, 0], [0.5, 0.5, 4], [1, 0.5, 7], [1.5, 1, 12], [2.5, 1.5, 7]),
  L('6th-to-root pickup', 'the BB King turn: 5, 6, up to the root', [0, 0.5, 7], [0.5, 0.5, 9], [1, 1.5, 12], [3, 0.5, 9], [3.5, 0.5, 7]),
];

const KEY = storageKey('licks');

export function loadLicks(): Lick[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Lick[]) : [];
    return list.filter((l) => l && typeof l.name === 'string' && Array.isArray(l.notes));
  }
  catch {
    return [];
  }
}

export const saveLicks = (licks: Lick[]): void => localStorage.setItem(KEY, JSON.stringify(licks));
