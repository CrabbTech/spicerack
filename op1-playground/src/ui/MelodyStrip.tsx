// The melody as an OP-1 tab: one row per bar, eighth-note cells naming the
// physical key to press (B7, T3...). Chord tones glow; passing tones stay cool.

import { MelodyNote, Segment } from '../theory/melody';
import { keyTag, midiToKeyIndex } from '../op1/op1';

export interface MelodyStripProps {
  segments: Segment[];
  melody: MelodyNote[];
  /** bar label, e.g. the chord symbol sounding in that bar */
  labels: string[];
  playingMidi: number | null;
  noteNames: (midi: number) => string;
  onRerollBar: (barIdx: number) => void;
  onAudition: (midi: number) => void;
}

export function MelodyStrip(p: MelodyStripProps) {
  return (
    <div className="melody-strip">
      {p.segments.map((seg, segIdx) => {
        const cellCount = seg.beats * 2;
        const inSeg = p.melody.filter((n) => n.start >= seg.startBeat - 1e-6 && n.start < seg.startBeat + seg.beats - 1e-6);
        const cells: (MelodyNote | 'hold' | null)[] = Array.from({ length: cellCount }, () => null);
        for (const note of inSeg) {
          const cell = Math.round((note.start - seg.startBeat) * 2);
          if (cell < 0 || cell >= cellCount) continue;
          cells[cell] = note;
          const held = Math.min(cellCount, cell + Math.round(note.dur * 2));
          for (let c = cell + 1; c < held; c++) if (cells[c] === null) cells[c] = 'hold';
        }
        return (
          <div key={segIdx} className="melody-bar">
            <div className="melody-bar-label">
              <span>{String(segIdx + 1).padStart(2, '0')}</span>
              <strong>{p.labels[segIdx] ?? ''}</strong>
            </div>
            <div className="melody-cells" style={{ gridTemplateColumns: `repeat(${cellCount}, 1fr)` }}>
              {cells.map((cell, i) => {
                if (cell === null) return <div key={i} className="melody-cell melody-rest">·</div>;
                if (cell === 'hold') return <div key={i} className="melody-cell melody-hold">—</div>;
                const active = p.playingMidi === cell.midi;
                return (
                  <button
                    key={i}
                    className={`melody-cell melody-note melody-${cell.kind}${active ? ' melody-active' : ''}`}
                    title={p.noteNames(cell.midi)}
                    onClick={() => p.onAudition(cell.midi)}
                  >
                    <span>{keyTag(midiToKeyIndex(cell.midi))}</span>
                    <small>{p.noteNames(cell.midi)}</small>
                  </button>
                );
              })}
            </div>
            <button className="melody-reroll" title="reroll this bar" onClick={() => p.onRerollBar(segIdx)}>⟳</button>
          </div>
        );
      })}
    </div>
  );
}
