// A written melody as something you can put on a music stand: ASCII tab for
// strings (fingered inside the chosen neck position) and a key chart for the
// OP-1 / piano, bar by bar.

import { midiLabel } from '../theory/notes';
import { MelNote, sortNotes } from '../theory/melody';

export interface Fingering {
  string: number;
  fret: number;
}

/** Where to play a pitch: inside the position window when possible, else as close to it as the neck allows. */
export function fingerNote(midi: number, openMidi: number[], window: { lo: number; hi: number }, maxFret: number, hint?: number): Fingering | undefined {
  // played exactly there? then that's where it goes
  if (hint !== undefined && openMidi[hint] !== undefined && midi - openMidi[hint] >= 0 && midi - openMidi[hint] <= maxFret) {
    return { string: hint, fret: midi - openMidi[hint] };
  }
  let best: Fingering | undefined;
  let bestCost = Infinity;
  openMidi.forEach((open, string) => {
    const fret = midi - open;
    if (fret < 0 || fret > maxFret) return;
    const cost = fret < window.lo ? window.lo - fret : fret > window.hi ? fret - window.hi : 0;
    // ties go to the lower fret on the higher string — the easier reach inside a box
    if (cost < bestCost || (cost === bestCost && best && fret < best.fret)) {
      best = { string, fret };
      bestCost = cost;
    }
  });
  return best;
}

export function melodyTabText(
  title: string, notes: MelNote[], totalBeats: number, beatsPerBar: number,
  openMidi: number[], names: string[], window: { lo: number; hi: number }, maxFret: number, grid = 0.5,
  /** what to print under each note — its degree against the chord, for tab that explains itself */
  degreeOf?: (note: MelNote) => string,
  /** true = finger it where it was entered; false = re-finger everything inside the window */
  asPlayed = true,
): string {
  const cells = Math.round(totalBeats / grid);
  const perBar = Math.round(beatsPerBar / grid);
  const rows: string[][] = names.map(() => Array.from({ length: cells }, () => '--'));
  for (const n of sortNotes(notes)) {
    const at = Math.min(cells - 1, Math.max(0, Math.round(n.beat / grid)));
    const f = fingerNote(n.midi, openMidi, window, maxFret, asPlayed ? n.string : undefined);
    if (f) rows[f.string][at] = String(f.fret).padEnd(2, '-');
  }
  const lines = [title];
  for (let s = names.length - 1; s >= 0; s--) {
    let line = `${names[s].padEnd(1)}|`;
    rows[s].forEach((cell, i) => { line += `-${cell}${(i + 1) % perBar === 0 ? '-|' : ''}`; });
    lines.push(line.endsWith('|') ? line : `${line}-|`);
  }
  if (degreeOf) {
    const under: string[] = Array.from({ length: cells }, () => '  ');
    for (const n of sortNotes(notes)) under[Math.min(cells - 1, Math.max(0, Math.round(n.beat / grid)))] = degreeOf(n).padEnd(2).slice(0, 2);
    let line = '  ';
    under.forEach((cell, i) => { line += ` ${cell}${(i + 1) % perBar === 0 ? '  ' : ''}`; });
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}

/** Bar-by-bar note names with key numbers (1 = the leftmost key of the window). */
export function melodyKeysText(
  title: string, notes: MelNote[], totalBeats: number, beatsPerBar: number, baseMidi: number, keyCount: number, prefer: 'sharp' | 'flat',
): string {
  const lines = [title];
  const bars = Math.ceil(totalBeats / beatsPerBar - 1e-6);
  for (let b = 0; b < bars; b++) {
    const inBar = sortNotes(notes).filter((n) => n.beat >= b * beatsPerBar - 1e-6 && n.beat < (b + 1) * beatsPerBar - 1e-6);
    const cells = inBar.map((n) => {
      const key = n.midi - baseMidi + 1;
      const where = key >= 1 && key <= keyCount ? `k${key}` : key < 1 ? 'oct↓' : 'oct↑';
      return `${midiLabel(n.midi, prefer)}(${where})@${(n.beat - b * beatsPerBar + 1).toFixed(2).replace(/\.?0+$/, '')}`;
    });
    lines.push(`bar ${String(b + 1).padStart(2)}: ${cells.join('  ') || '—'}`);
  }
  lines.push('(kN = Nth key from the left · @ = beat in the bar)');
  return lines.join('\n');
}
