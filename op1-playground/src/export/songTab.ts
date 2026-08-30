// The song tab: a copy-pastable chart of a transcribed score, written in OP-1
// physical keys (B1..B14 bottom row, T1..T10 raised row) with the hardware
// octave shift each section wants.

import { keyLabel, prettyNumeral } from '../theory/harmony';
import { rangeLabel } from '../op1/op1';
import { CompiledSection, CompiledSong, PartId, gridFor } from '../songs/compile';
import { FIGURES } from '../songs/figures';

const pad = (s: string, n: number): string => (s.length >= n ? s + ' ' : s.padEnd(n, ' '));

const PART_TITLE: Record<PartId, string> = { melody: 'MELODY', left: 'LEFT HAND' };

export function sectionHeading(section: CompiledSection): string {
  const passes = section.passes > 1 ? ` — play ${section.passes}×` : '';
  const shift = section.octaveShift === 0
    ? 'OCT 0'
    : `OCT ${section.octaveShift > 0 ? '+' : ''}${section.octaveShift}`;
  return `${section.name}${passes}  ·  ${shift} (keys ${rangeLabel(section.octaveShift)})`;
}

export function chordRows(section: CompiledSection): string[] {
  const lines = ['Bar  Chord        Numeral    OP-1 keys        Sounding                 Voicing'];
  for (const bar of section.bars) {
    const omitted = bar.voicing.omitted.length
      ? ` (omit ${bar.voicing.omitted.map((o) => o.replace(/[A-Za-z]+$/, '')).join('/')})`
      : '';
    const marks = [bar.ending ? `${bar.ending}.` : '', bar.mark ?? ''].filter(Boolean).join(' ');
    lines.push(
      `${String(bar.number).padStart(2, '0')}   ` +
      pad(bar.chord.symbol, 13) +
      pad(bar.chord.numeral ? prettyNumeral(bar.chord.numeral) : '—', 11) +
      pad(bar.keyTags.join(' '), 17) +
      pad(bar.sounding.join(' '), 25) +
      `${bar.voicing.label}${omitted}${marks ? `  [${marks}]` : ''}`,
    );
  }
  return lines;
}

/** One row per bar: a grid of key tags at the part's own resolution. */
export function partRows(section: CompiledSection, part: PartId): string[] {
  const notes = section.notes.filter((n) => n.part === part);
  if (!notes.length) return [];
  const grid = gridFor(notes, section.bars);
  const derived = notes.some((n) => n.derived);
  const figures = [...new Set(section.bars.map((b) => b.figure).filter(Boolean))]
    .map((f) => FIGURES[f!].label).join(', ');
  const head = `${PART_TITLE[part]}  (${grid.label} grid · = rest, — = hold` +
    `${derived ? `; figure: ${figures}` : ''})`;
  const lines = [head];

  for (const bar of section.bars) {
    const inBar = notes.filter((n) => n.barIdx === bar.index);
    if (!inBar.length) continue;
    const cellCount = Math.max(1, Math.round(bar.beats * grid.cells));
    const cells: string[] = Array.from({ length: cellCount }, () => '·');
    for (const note of inBar) {
      const cell = Math.round((note.start - bar.startBeat) * grid.cells);
      if (cell < 0 || cell >= cellCount) continue;
      cells[cell] = note.keyTag + (note.folded ? '*' : '');
      const held = Math.min(cellCount, cell + Math.round(note.dur * grid.cells));
      for (let c = cell + 1; c < held; c++) if (cells[c] === '·') cells[c] = '—';
    }
    lines.push(
      `${String(bar.number).padStart(2, '0')}   ` +
      pad(bar.chord.symbol, 13) +
      '|' + cells.map((c) => pad(c, 4)).join('').trimEnd() + '|  ' +
      [...new Set(inBar.map((n) => n.name))].join(' '),
    );
  }
  if (notes.some((n) => n.folded)) lines.push('     * folded by an octave to fit the 24 keys');
  return lines;
}

export function sectionChart(section: CompiledSection): string[] {
  const lines = [sectionHeading(section)];
  if (section.note) lines.push(`  ${section.note}`);
  lines.push('', ...chordRows(section));
  for (const part of ['melody', 'left'] as PartId[]) {
    const rows = partRows(section, part);
    if (rows.length) lines.push('', ...rows);
  }
  return lines;
}

export function buildSongChart(song: CompiledSong): string {
  const { score } = song;
  const meta = [
    keyLabel(song.key),
    `${song.meter[0]}/${song.meter[1]}`,
    `♩=${score.bpm}`,
    score.feel ? score.feel.toLowerCase() : '',
    score.artist ? `by ${score.artist}` : '',
  ].filter(Boolean).join(' · ');

  const lines = [
    `OP-1 FIELD TAB — ${score.title.toUpperCase()}`,
    meta,
    `B1–B14 = bottom row · T1–T10 = raised row · set the octave switch per section`,
  ];
  if (score.source) lines.push(`source: ${score.source}`);
  if (score.caveats?.length) {
    lines.push('', 'TRANSCRIPTION NOTES');
    for (const c of score.caveats) lines.push(`  · ${c}`);
  }
  for (const section of song.sections) lines.push('', '', ...sectionChart(section));
  if (song.warnings.length) {
    lines.push('', 'WARNINGS');
    for (const w of song.warnings) lines.push(`  · ${w}`);
  }
  return lines.join('\n');
}

export const songSlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const songMidiFilename = (title: string): string => `op1-${songSlug(title)}.mid`;
