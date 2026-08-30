// Score -> OP-1. Everything hardware-specific lives here: which physical keys
// a bar asks for, which octave-shift setting the section wants, what falls
// outside the 24-key window, and how repeats/voltas expand for playback.

import { Note } from 'tonal';
import { ChordInfo, KeySig, midiName, parseToken, prettyNote } from '../theory/harmony';
import {
  OP1_BASE_MIDI, OP1_KEY_COUNT, OP1_TOP_MIDI, Voicing, fitChord, keyTag,
} from '../op1/op1';
import { FigureId } from './types';
import { renderFigure } from './figures';
import { DEFAULT_METER, NoteEvent, Score, Section, barBeats, sectionPasses } from './types';

export const MIN_OCTAVE_SHIFT = -2;
export const MAX_OCTAVE_SHIFT = 2;

export type PartId = 'melody' | 'left';

export interface CompiledNote {
  part: PartId;
  /** beats from the top of the section (single pass) */
  start: number;
  dur: number;
  /** midi inside the shift-0 window, 65..88 */
  midi: number;
  /** 0..23 physical key index */
  index: number;
  keyTag: string;
  /** what it sounds like at the section's octave shift */
  name: string;
  /** true when the written pitch had to be folded by octaves to fit */
  folded: boolean;
  /** true when generated from a figure rather than read off the page */
  derived: boolean;
  ghost: boolean;
  barIdx: number;
}

export interface CompiledBar {
  /** 1-based bar number inside the section, as printed */
  number: number;
  index: number;
  token: string;
  chord: ChordInfo;
  beats: number;
  startBeat: number;
  ending?: number;
  mark?: string;
  voicing: Voicing;
  keyTags: string[];
  /** chord tones as they sound at the section's octave shift */
  sounding: string[];
  figure?: FigureId;
  notes: CompiledNote[];
  warning?: string;
}

export interface CompiledSection {
  id: string;
  name: string;
  passes: number;
  octaveShift: number;
  note?: string;
  bars: CompiledBar[];
  notes: CompiledNote[];
  /** beats in one pass */
  beats: number;
}

export interface CompiledSong {
  score: Score;
  key: KeySig;
  meter: [number, number];
  sections: CompiledSection[];
  warnings: string[];
  totalBars: number;
}

const clampShift = (s: number): number =>
  Math.max(MIN_OCTAVE_SHIFT, Math.min(MAX_OCTAVE_SHIFT, Math.round(s)));

/** Window bounds in real midi for a hardware octave shift. */
export const windowFor = (shift: number): [number, number] =>
  [OP1_BASE_MIDI + 12 * shift, OP1_TOP_MIDI + 12 * shift];

/**
 * Pick the hardware octave shift that catches the most written pitches, then
 * the one that centres them. Songs with no written notes stay at 0.
 */
export function chooseOctaveShift(midis: number[]): number {
  if (!midis.length) return 0;
  let best = 0;
  let bestScore = -Infinity;
  for (let shift = MIN_OCTAVE_SHIFT; shift <= MAX_OCTAVE_SHIFT; shift++) {
    const [lo, hi] = windowFor(shift);
    const inside = midis.filter((m) => m >= lo && m <= hi).length;
    const centre = (lo + hi) / 2;
    const spread = midis.reduce((sum, m) => sum + Math.abs(m - centre), 0) / midis.length;
    const score = inside * 100 - spread;
    if (score > bestScore) { bestScore = score; best = shift; }
  }
  return best;
}

/** Fold a written pitch into the 24 keys available at this shift. */
export function foldIntoWindow(midi: number, shift: number): { index: number; folded: boolean } {
  const [lo, hi] = windowFor(shift);
  let m = midi;
  let folded = false;
  while (m < lo) { m += 12; folded = true; }
  while (m > hi) { m -= 12; folded = true; }
  return { index: Math.max(0, Math.min(OP1_KEY_COUNT - 1, m - lo)), folded };
}

/** Spell a sounding pitch with the chord's own note names when it is a tone of it. */
export function soundingName(midi: number, chord: ChordInfo | undefined, key: KeySig): string {
  const chroma = ((midi % 12) + 12) % 12;
  const match = chord?.notes.find((n) => Note.chroma(n) === chroma);
  if (match) {
    const octave = Math.floor(midi / 12) - 1;
    const ref = Note.midi(`${match}${octave}`);
    const oct = ref === midi ? octave : octave + Math.sign(midi - (ref ?? midi));
    return prettyNote(match) + oct;
  }
  return midiName(midi, key);
}

function compileEvents(
  events: NoteEvent[] | undefined, part: PartId, shift: number, barStart: number,
  barIdx: number, chord: ChordInfo, key: KeySig, warnings: string[],
): CompiledNote[] {
  if (!events?.length) return [];
  return events.flatMap((ev) => {
    const midi = Note.midi(ev.note);
    if (midi === null) {
      warnings.push(`bar ${barIdx + 1}: cannot read the pitch "${ev.note}"`);
      return [];
    }
    const { index, folded } = foldIntoWindow(midi, shift);
    const sounding = OP1_BASE_MIDI + index + 12 * shift;
    return [{
      part,
      start: barStart + ev.beat,
      dur: ev.dur,
      midi: OP1_BASE_MIDI + index,
      index,
      keyTag: keyTag(index),
      name: soundingName(sounding, chord, key),
      folded,
      derived: false,
      ghost: ev.ghost === true,
      barIdx,
    }];
  });
}

function compileFigure(
  figureId: FigureId, voicing: Voicing, beats: number, shift: number, barStart: number,
  barIdx: number, chord: ChordInfo, key: KeySig,
): CompiledNote[] {
  return renderFigure(figureId, voicing.midis, beats).map((n) => {
    const index = n.midi - OP1_BASE_MIDI;
    return {
      part: 'left' as PartId,
      start: barStart + n.beat,
      dur: n.dur,
      midi: n.midi,
      index,
      keyTag: keyTag(index),
      name: soundingName(n.midi + 12 * shift, chord, key),
      folded: false,
      derived: true,
      ghost: false,
      barIdx,
    };
  });
}

export interface CompileOptions {
  /** pick inversions that keep the hand still, where the page leaves a choice */
  smooth?: boolean;
}

function compileSection(
  section: Section, score: Score, key: KeySig, warnings: string[], opts: CompileOptions,
): CompiledSection {
  const parsed = section.bars.map((bar) => parseToken(bar.chord, key));
  const written = section.bars.flatMap((bar) =>
    [...(bar.melody ?? []), ...(bar.left ?? [])]
      .map((ev) => Note.midi(ev.note))
      .filter((m): m is number => m !== null));
  const shift = clampShift(section.octaveShift ?? score.octaveShift ?? chooseOctaveShift(written));

  const bars: CompiledBar[] = [];
  const notes: CompiledNote[] = [];
  let cursor = 0;
  section.bars.forEach((bar, i) => {
    const chord = parsed[i].chord;
    const beats = barBeats(bar, score);
    const voicing = fitChord(chord.notes, chord.intervals, {
      prev: bars[i - 1]?.voicing.midis,
      smooth: opts.smooth !== false,
      bass: bar.bass ?? chord.bass,
    });
    const figure = bar.left?.length ? undefined : bar.figure ?? section.figure;
    const barNotes = [
      ...compileEvents(bar.melody, 'melody', shift, cursor, i, chord, key, warnings),
      ...compileEvents(bar.left, 'left', shift, cursor, i, chord, key, warnings),
      ...(figure ? compileFigure(figure, voicing, beats, shift, cursor, i, chord, key) : []),
    ].sort((a, b) => a.start - b.start || a.midi - b.midi);

    bars.push({
      number: i + 1,
      index: i,
      token: bar.chord,
      chord,
      beats,
      startBeat: cursor,
      ending: bar.ending,
      mark: bar.mark,
      voicing,
      keyTags: voicing.midis.map((m) => keyTag(m - OP1_BASE_MIDI)),
      sounding: voicing.midis.map((m) => soundingName(m + 12 * shift, chord, key)),
      figure,
      notes: barNotes,
      warning: parsed[i].warning,
    });
    if (parsed[i].warning) warnings.push(`${section.name} bar ${i + 1}: ${parsed[i].warning}`);
    notes.push(...barNotes);
    cursor += beats;
  });

  return {
    id: section.id,
    name: section.name,
    passes: sectionPasses(section),
    octaveShift: shift,
    note: section.note,
    bars,
    notes,
    beats: cursor,
  };
}

export function compileScore(score: Score, opts: CompileOptions = {}): CompiledSong {
  const warnings: string[] = [];
  const key = score.key;
  const sections = score.sections.map((s) => compileSection(s, score, key, warnings, opts));
  return {
    score,
    key,
    meter: score.meter ?? DEFAULT_METER,
    sections,
    warnings,
    totalBars: sections.reduce((sum, s) => sum + s.bars.length, 0),
  };
}

// ---------------------------------------------------------------------------
// Grid resolution: how finely a written part has to be ruled to show its notes.

export interface Grid {
  /** cells per beat */
  cells: number;
  /** what to call it on the chart, e.g. 'sixteenth' */
  label: string;
}

const GRIDS: Grid[] = [
  { cells: 1, label: 'quarter' },
  { cells: 2, label: 'eighth' },
  { cells: 3, label: 'eighth triplet' },
  { cells: 4, label: 'sixteenth' },
  { cells: 6, label: 'sixteenth triplet' },
  { cells: 8, label: 'thirty-second' },
];

const FALLBACK_GRID = GRIDS[3];

/**
 * The coarsest grid that still lands every onset on a cell. An eighth-note
 * figure stays readable at eight cells a bar; a run of sixteenths gets the
 * finer ruling instead of losing half its notes to rounding.
 */
export function gridFor(notes: { start: number }[], bars: { startBeat: number }[]): Grid {
  if (!notes.length) return GRIDS[1];
  const offsets = notes.map((n) => {
    const bar = [...bars].reverse().find((b) => n.start >= b.startBeat - 1e-6);
    return n.start - (bar?.startBeat ?? 0);
  });
  return GRIDS.find((g) => offsets.every((o) => Math.abs(o * g.cells - Math.round(o * g.cells)) < 1e-6))
    ?? FALLBACK_GRID;
}

// ---------------------------------------------------------------------------
// Repeat / volta expansion.

export interface PassBar {
  bar: CompiledBar;
  /** 1-based pass this bar is played on */
  pass: number;
  /** beats from the top of the expanded section */
  startBeat: number;
}

/**
 * Expand a section's repeats into the bars you actually play, in order.
 * Bars with no volta bracket play every pass; a bar marked `ending: n` plays
 * on pass n. When a pass has no ending of its own (the page's later endings
 * weren't transcribed), it reuses the highest ending that exists.
 */
export function expandPasses(section: CompiledSection): PassBar[] {
  const endings = [...new Set(section.bars.map((b) => b.ending).filter((e): e is number => !!e))];
  const maxEnding = endings.length ? Math.max(...endings) : 0;
  const out: PassBar[] = [];
  let cursor = 0;
  for (let pass = 1; pass <= section.passes; pass++) {
    const want = endings.includes(pass) ? pass : Math.min(pass, maxEnding);
    for (const bar of section.bars) {
      if (bar.ending && bar.ending !== want) continue;
      out.push({ bar, pass, startBeat: cursor });
      cursor += bar.beats;
    }
  }
  return out;
}

/**
 * Practice slice: one pass over a contiguous run of a section's bars —
 * what the practice loop plays. `fromBar`/`toBar` are bar indices, inclusive.
 */
export function practicePlayback(
  section: CompiledSection, fromBar: number, toBar: number, octaveShift?: number,
): SongPlayback {
  const shift = octaveShift ?? section.octaveShift;
  const lo = Math.max(0, Math.min(fromBar, toBar));
  const hi = Math.min(section.bars.length - 1, Math.max(fromBar, toBar));
  const bars = section.bars.filter((b) => b.index >= lo && b.index <= hi);
  const offset = bars[0]?.startBeat ?? 0;
  const slots: SongPlayback['slots'] = [];
  const melody: SongPlayback['melody'] = [];
  for (const bar of bars) {
    slots.push({ bars: bar.beats / 4, midis: bar.voicing.midis.map((m) => m + 12 * shift) });
    for (const note of bar.notes) {
      melody.push({ start: note.start - offset, dur: note.dur, midi: note.midi + 12 * shift });
    }
  }
  return { slots, melody, beats: bars.reduce((sum, b) => sum + b.beats, 0) };
}

export interface SongPlayback {
  slots: { bars: number; midis: number[] }[];
  melody: { start: number; dur: number; midi: number }[];
  beats: number;
}

/**
 * Playback material for one or more sections at a hardware octave shift.
 * Written/figure notes ride the melody track; chord voicings ride the chords
 * track, so either can be muted independently.
 */
export function playbackFor(sections: CompiledSection[], octaveShift?: number): SongPlayback {
  const slots: SongPlayback['slots'] = [];
  const melody: SongPlayback['melody'] = [];
  let cursor = 0;
  for (const section of sections) {
    const shift = octaveShift ?? section.octaveShift;
    for (const { bar, startBeat } of expandPasses(section)) {
      slots.push({
        bars: bar.beats / 4,
        midis: bar.voicing.midis.map((m) => m + 12 * shift),
      });
      for (const note of bar.notes) {
        melody.push({
          start: cursor + startBeat + (note.start - bar.startBeat),
          dur: note.dur,
          midi: note.midi + 12 * shift,
        });
      }
    }
    cursor += expandPasses(section).reduce((sum, p) => sum + p.bar.beats, 0);
  }
  return { slots, melody, beats: cursor };
}
