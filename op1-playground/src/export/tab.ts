// The OP-1 tab chart: a copy-pastable text chart that names the physical keys
// (B1..B14 bottom row, T1..T10 raised row) for every chord and melody note.

import { ChordInfo, KeySig, keyLabel, midiName, prettyNumeral } from '../theory/harmony';
import { MelodyNote, Segment, segmentsOf } from '../theory/melody';
import { Voicing, keyTag, midiToKeyIndex, rangeLabel } from '../op1/op1';

export interface ChartSlot {
  chord: ChordInfo;
  bars: number;
  voicing: Voicing;
}

export interface ChartOptions {
  key: KeySig;
  bpm: number;
  swing: number;
  octaveShift: number;
  smooth: boolean;
}

const pad = (s: string, n: number): string => (s.length >= n ? s + ' ' : s.padEnd(n, ' '));

export function chordChart(slots: ChartSlot[], opts: ChartOptions): string[] {
  const lines = ['CHORDS', 'No  Chord       Numeral    OP-1 keys        Notes                    Voicing'];
  slots.forEach((slot, i) => {
    const keys = slot.voicing.midis.map((m) => keyTag(midiToKeyIndex(m))).join(' ');
    const notes = slot.voicing.midis.map((m) => midiName(m + 12 * opts.octaveShift, opts.key)).join(' ');
    const barLabel = slot.bars === 0.5 ? '½ bar' : `${slot.bars} bar${slot.bars === 1 ? '' : 's'}`;
    const omitted = slot.voicing.omitted.length ? ` (omit ${slot.voicing.omitted.map((o) => o.replace(/[A-Za-z]+$/, '')).join('/')})` : '';
    lines.push(
      `${String(i + 1).padStart(2, '0')}  ` +
      pad(slot.chord.symbol, 12) +
      pad(slot.chord.numeral ? prettyNumeral(slot.chord.numeral) : '—', 11) +
      pad(keys, 17) +
      pad(notes, 25) +
      `${slot.voicing.label}${omitted}  ${barLabel}`,
    );
  });
  return lines;
}

/** One melody line per bar segment: eighth grid of key tags, · rest, — hold. */
export function melodyChart(
  slots: ChartSlot[], melody: MelodyNote[], opts: ChartOptions,
): string[] {
  if (!melody.length) return [];
  const segments = segmentsOf(slots.map((s) => ({ chord: s.chord, bars: s.bars })));
  const lines = ['MELODY  (eighth-note grid · = rest, — = hold)'];
  segments.forEach((seg: Segment, segIdx: number) => {
    const cellCount = seg.beats * 2;
    const cells: string[] = Array.from({ length: cellCount }, () => '·');
    const inSeg = melody.filter((n) => n.start >= seg.startBeat - 1e-6 && n.start < seg.startBeat + seg.beats - 1e-6);
    for (const note of inSeg) {
      const cell = Math.round((note.start - seg.startBeat) * 2);
      if (cell < 0 || cell >= cellCount) continue;
      cells[cell] = keyTag(midiToKeyIndex(note.midi));
      const held = Math.min(cellCount, cell + Math.round(note.dur * 2));
      for (let c = cell + 1; c < held; c++) if (cells[c] === '·') cells[c] = '—';
    }
    const names = inSeg.map((n) => midiName(n.midi + 12 * opts.octaveShift, opts.key)).join(' ');
    const label = slots[seg.slotIdx] ? slots[seg.slotIdx].chord.symbol : '';
    lines.push(
      `${String(segIdx + 1).padStart(2, '0')}  ` +
      pad(label, 12) +
      '|' + cells.map((c) => pad(c, 4)).join('').trimEnd() + '|  ' +
      names,
    );
  });
  return lines;
}

export function buildChart(slots: ChartSlot[], melody: MelodyNote[], opts: ChartOptions): string {
  const header =
    `OP-1 FIELD PLAYGROUND — ${keyLabel(opts.key)} — keys ${rangeLabel(opts.octaveShift)}` +
    ` — ${opts.bpm} BPM${opts.swing > 0 ? ` — swing ${Math.round(opts.swing * 100)}%` : ''}` +
    `${opts.smooth ? ' — smooth voice-leading' : ''}`;
  return [header, '', ...chordChart(slots, opts), '', ...melodyChart(slots, melody, opts)].join('\n');
}
