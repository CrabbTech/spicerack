// Accompaniment figures: stand-ins for a written part you can hear on the page
// but can't read note-for-note from a screenshot. Each figure is a sequence of
// steps indexing a ladder of the bar's own chord tones, so it is always in
// harmony and always inside the 24-key window.
//
// Adding one = add an entry to FIGURES. Nothing else changes.

import { OP1_TOP_MIDI } from '../op1/op1';
import { FigureId } from './types';

export interface FigureStep {
  /** beat inside a 4-beat bar */
  beat: number;
  dur: number;
  /** index into the chord-tone ladder, 0 = lowest voiced tone */
  idx: number;
}

export interface Figure {
  id: FigureId;
  label: string;
  blurb: string;
  /** one 4-beat bar's worth; shorter bars take the steps that fit */
  steps: FigureStep[];
}

const eighths = (idxs: number[]): FigureStep[] =>
  idxs.map((idx, i) => ({ beat: i / 2, dur: 0.5, idx }));

export const FIGURES: Record<FigureId, Figure> = {
  'up-down-8ths': {
    id: 'up-down-8ths',
    label: 'up-down eighths',
    blurb: 'Broken chord that climbs through the tones and falls back — the standard laid-back left hand.',
    steps: eighths([0, 1, 2, 3, 2, 1, 0, 1]),
  },
  'arp-up-8ths': {
    id: 'arp-up-8ths',
    label: 'arpeggio up',
    blurb: 'Straight climb through the chord tones, eighth notes.',
    steps: eighths([0, 1, 2, 3, 4, 5, 6, 7]),
  },
  'arp-down-8ths': {
    id: 'arp-down-8ths',
    label: 'arpeggio down',
    blurb: 'Straight fall from the top of the voicing, eighth notes.',
    steps: eighths([4, 3, 2, 1, 4, 3, 2, 1]),
  },
  'root-fifth-quarters': {
    id: 'root-fifth-quarters',
    label: 'root–fifth quarters',
    blurb: 'Two-note pump: bass note on 1 and 3, the tone above it on 2 and 4.',
    steps: [0, 1, 2, 3].map((b, i) => ({ beat: b, dur: 1, idx: i % 2 === 0 ? 0 : 2 })),
  },
  'root-8ths': {
    id: 'root-8ths',
    label: 'root eighths',
    blurb: 'Driving eighths on the bass note alone.',
    steps: eighths([0, 0, 0, 0, 0, 0, 0, 0]),
  },
  held: {
    id: 'held',
    label: 'held bass',
    blurb: 'One bass note, rung for the whole bar.',
    steps: [{ beat: 0, dur: 4, idx: 0 }],
  },
};

export const FIGURE_IDS = Object.keys(FIGURES) as FigureId[];

/**
 * Stack the voiced chord tones into an ascending ladder, repeating them an
 * octave up as needed, never above the top of the window.
 */
export function chordLadder(midis: number[], length: number): number[] {
  const base = [...midis].sort((a, b) => a - b);
  if (!base.length) return [];
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const m = base[i % base.length] + 12 * Math.floor(i / base.length);
    if (m > OP1_TOP_MIDI) break;
    out.push(m);
  }
  return out;
}

export interface FigureNote {
  beat: number;
  dur: number;
  midi: number;
}

/** Fold an out-of-range ladder index back down instead of piling on the top. */
export function reflectIndex(idx: number, length: number): number {
  if (length <= 1) return 0;
  const period = 2 * (length - 1);
  const m = ((idx % period) + period) % period;
  return m < length ? m : period - m;
}

/** Render a figure over one bar of `beats` beats against a voicing. */
export function renderFigure(figureId: FigureId, midis: number[], beats: number): FigureNote[] {
  const figure = FIGURES[figureId];
  if (!figure || !midis.length) return [];
  const maxIdx = Math.max(...figure.steps.map((s) => s.idx));
  const ladder = chordLadder(midis, maxIdx + 1);
  if (!ladder.length) return [];
  return figure.steps
    .filter((step) => step.beat < beats - 1e-6)
    .map((step) => ({
      beat: step.beat,
      dur: Math.min(step.dur, beats - step.beat),
      midi: ladder[reflectIndex(step.idx, ladder.length)],
    }));
}
