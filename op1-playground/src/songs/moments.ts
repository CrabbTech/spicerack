// Moments: the step-through timeline of a section. One moment = one thing your
// fingers do — a chord grab where the bar has no written notes, or the note(s)
// striking at one onset of the written part. The performance view walks these
// with the arrow keys; playback highlights ride the same list, so both stay in
// lockstep with the tab. Derived entirely from compiled data — a new song gets
// this for free.

import { OP1_BASE_MIDI } from '../op1/op1';
import { CompiledBar, CompiledNote, CompiledSection } from './compile';

export interface Moment {
  /** bar index within the section */
  barIdx: number;
  /** beats from the top of the section (single pass) */
  startBeat: number;
  /** 'chord' = press the voicing; 'notes' = press these written keys */
  kind: 'chord' | 'notes';
  /** key indices (0..23) struck at this moment */
  keys: number[];
  /** sounding names, aligned with keys */
  names: string[];
  /** midis inside the shift-0 window, aligned with keys */
  midis: number[];
  /** e.g. 'bar 2 · beat 3&' */
  label: string;
}

/** '1', '1e', '1&', '1a' — the counting syllable for a beat offset. */
export function beatLabel(offset: number): string {
  const beat = Math.floor(offset + 1e-6) + 1;
  const frac = offset - (beat - 1);
  const syllable =
    Math.abs(frac) < 1e-3 ? '' :
    Math.abs(frac - 0.25) < 1e-3 ? 'e' :
    Math.abs(frac - 0.5) < 1e-3 ? '&' :
    Math.abs(frac - 0.75) < 1e-3 ? 'a' :
    `+${frac.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `${beat}${syllable}`;
}

function noteMoments(bar: CompiledBar): Moment[] {
  const byOnset = new Map<number, CompiledNote[]>();
  for (const note of bar.notes) {
    const key = Math.round((note.start - bar.startBeat) * 48); // 48 cells/beat: exact for 16ths and triplets
    byOnset.set(key, [...(byOnset.get(key) ?? []), note]);
  }
  return [...byOnset.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cell, notes]) => {
      const sorted = [...notes].sort((a, b) => a.midi - b.midi);
      return {
        barIdx: bar.index,
        startBeat: bar.startBeat + cell / 48,
        kind: 'notes' as const,
        keys: sorted.map((n) => n.index),
        names: sorted.map((n) => n.name),
        midis: sorted.map((n) => n.midi),
        label: `bar ${bar.number} · beat ${beatLabel(cell / 48)}`,
      };
    });
}

/** The section's moments in playing order (single pass, repeats not unrolled). */
export function momentsOf(section: CompiledSection): Moment[] {
  return section.bars.flatMap((bar) => {
    if (bar.notes.length) return noteMoments(bar);
    return [{
      barIdx: bar.index,
      startBeat: bar.startBeat,
      kind: 'chord' as const,
      keys: bar.voicing.midis.map((m) => m - OP1_BASE_MIDI),
      names: bar.sounding,
      midis: bar.voicing.midis,
      label: `bar ${bar.number} · hold the chord`,
    }];
  });
}

/** Index of the first moment in a bar, for jumping by bar. */
export const firstMomentOfBar = (moments: Moment[], barIdx: number): number => {
  const at = moments.findIndex((m) => m.barIdx === barIdx);
  return at < 0 ? 0 : at;
};
