// The melody roll: a piano roll whose background is the harmony. Under every
// chord, each row is tinted by what that pitch means there — bright rows are
// chord tones, dashed rows rub — so a note's colour tells you why it sounds
// the way it does before you've even played it.
//
// Click to add (drag to set the length), drag a note to move it, drag its
// right edge to resize, double-click to delete.

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { midiLabel, mod12 } from '../theory/notes';
import { chordSymbol } from '../theory/chords';
import { MelNote, MelodyContext, barCount, newNoteId, roleAt } from '../theory/melody';
import { audio } from '../audio/engine';

export interface MelodyRollProps {
  ctx: MelodyContext;
  notes: MelNote[];
  grid: number;
  selectedBar: number | null;
  selectedId: number | null;
  /** draw the playhead (only meaningful when the whole section is looping) */
  followTransport: boolean;
  onChange: (notes: MelNote[]) => void;
  onSelectBar: (bar: number | null) => void;
  onSelectNote: (id: number | null) => void;
  onAudition: (midi: number) => void;
  /** where the next step-entered note will land */
  stepBeat?: number | null;
}

const ROW = 14;
const GUTTER = 40;
const HEAD = 36;

type Drag =
  | { kind: 'move'; id: number; dBeat: number; startMidi: number }
  | { kind: 'size'; id: number };

const kindOf = (ctx: MelodyContext, beat: number, midi: number): string => {
  const role = roleAt(ctx, beat, midi);
  return !role ? 'out' : !role.inScale ? 'outside' : role.role;
};

export function MelodyRoll(p: MelodyRollProps) {
  // the roll shows the instrument's lead range — stretched to hold any note that was entered outside it
  const ctx = useMemo(() => {
    const pitches = p.notes.map((n) => n.midi);
    return { ...p.ctx, lo: Math.min(p.ctx.lo, ...pitches), hi: Math.max(p.ctx.hi, ...pitches) };
  }, [p.ctx, p.notes]);
  const svgRef = useRef<SVGSVGElement>(null);
  // the in-progress edit lives in a ref as well as state, so a pointer-up that beats the re-render still commits it
  const [draft, setDraftState] = useState<MelNote[] | null>(null);
  const draftRef = useRef<MelNote[] | null>(null);
  const setDraft = (next: MelNote[] | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const [playhead, setPlayhead] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const notes = draft ?? p.notes;

  const beatW = Math.max(26, Math.min(58, 1060 / Math.max(1, ctx.totalBeats)));
  const rows = ctx.hi - ctx.lo + 1;
  const width = GUTTER + ctx.totalBeats * beatW + 2;
  const height = HEAD + rows * ROW + 2;
  const xOf = (beat: number) => GUTTER + beat * beatW;
  const yOf = (midi: number) => HEAD + (ctx.hi - midi) * ROW;
  const bars = barCount(ctx);

  useEffect(() => {
    if (!p.followTransport) {
      setPlayhead(null);
      return undefined;
    }
    let frame = 0;
    const tick = () => {
      const pos = audio.position();
      setPlayhead(pos && pos.beat < ctx.totalBeats ? pos.beat : null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [p.followTransport, ctx.totalBeats]);

  const locate = (e: ReactPointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    const beat = (e.clientX - box.left - GUTTER) / beatW;
    const midi = ctx.hi - Math.floor((e.clientY - box.top - HEAD) / ROW);
    return { beat, midi: Math.max(ctx.lo, Math.min(ctx.hi, midi)) };
  };
  // keep receiving the drag outside the svg; harmless to skip when the pointer can't be captured
  const capture = (e: ReactPointerEvent) => {
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
  };
  const snap = (beat: number) => Math.max(0, Math.min(ctx.totalBeats - p.grid, Math.floor(beat / p.grid + 1e-6) * p.grid));

  const downOnGrid = (e: ReactPointerEvent) => {
    const at = locate(e);
    if (at.beat < 0 || e.clientY - svgRef.current!.getBoundingClientRect().top < HEAD) return;
    const note: MelNote = { id: newNoteId(), beat: snap(at.beat), dur: p.grid, midi: at.midi, vel: 0.85 };
    // one voice: a new note replaces whatever already starts on that beat
    setDraft([...p.notes.filter((n) => Math.abs(n.beat - note.beat) > 1e-6 || n.locked), note]);
    drag.current = { kind: 'size', id: note.id };
    p.onSelectNote(note.id);
    p.onAudition(note.midi);
    capture(e);
  };

  const downOnNote = (e: ReactPointerEvent, n: MelNote) => {
    e.stopPropagation();
    p.onSelectNote(n.id);
    p.onAudition(n.midi);
    if (n.locked) return;
    const at = locate(e);
    const nearEnd = xOf(n.beat + n.dur) - e.clientX + svgRef.current!.getBoundingClientRect().left < 7;
    drag.current = nearEnd ? { kind: 'size', id: n.id } : { kind: 'move', id: n.id, dBeat: at.beat - n.beat, startMidi: n.midi };
    setDraft(p.notes);
    capture(e);
  };

  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    const current = draftRef.current;
    if (!d || !current) return;
    const at = locate(e);
    setDraft(current.map((n) => {
      if (n.id !== d.id) return n;
      if (d.kind === 'size') {
        const end = Math.max(n.beat + p.grid, Math.min(ctx.totalBeats, Math.ceil(at.beat / p.grid) * p.grid));
        return { ...n, dur: end - n.beat };
      }
      if (at.midi !== n.midi) p.onAudition(at.midi);
      return { ...n, beat: snap(at.beat - d.dBeat + p.grid / 2), midi: at.midi };
    }));
  };

  const up = () => {
    if (drag.current && draftRef.current) p.onChange(draftRef.current);
    drag.current = null;
    setDraft(null);
  };

  const name = (midi: number) => midiLabel(midi, ctx.preferFlat ? 'flat' : 'sharp');

  return (
    <div className="mroll-scroll">
      <svg ref={svgRef} className="mroll" width={width} height={height}
        onPointerDown={downOnGrid} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {/* harmony as background: one tinted cell per chord per row */}
        {ctx.segments.map((seg, s) => Array.from({ length: rows }, (_, r) => {
          const midi = ctx.hi - r;
          return (
            <rect key={`${s}:${r}`} x={xOf(seg.start)} y={HEAD + r * ROW} width={seg.beats * beatW} height={ROW}
              className={`mr-cell mr-${kindOf(ctx, seg.start, midi)}`} />
          );
        }))}
        {p.selectedBar !== null && (
          <rect x={xOf(p.selectedBar * ctx.beatsPerBar)} y={HEAD - 16} height={rows * ROW + 16} className="mr-barsel"
            width={Math.min(ctx.beatsPerBar, ctx.totalBeats - p.selectedBar * ctx.beatsPerBar) * beatW} />
        )}
        {/* grid */}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line key={`h${r}`} x1={GUTTER} x2={width} y1={HEAD + r * ROW} y2={HEAD + r * ROW} className="mr-line" />
        ))}
        {Array.from({ length: Math.round(ctx.totalBeats / p.grid) + 1 }, (_, i) => {
          const beat = i * p.grid;
          const inBar = beat % ctx.beatsPerBar;
          const cls = Math.abs(inBar) < 1e-6 ? 'mr-line mr-line-bar' : Math.abs(beat - Math.round(beat)) < 1e-6 ? 'mr-line mr-line-beat' : 'mr-line';
          return <line key={`v${i}`} x1={xOf(beat)} x2={xOf(beat)} y1={HEAD} y2={height} className={cls} />;
        })}
        {/* headers: bar numbers (click to pick the motif bar) and chords */}
        {Array.from({ length: bars }, (_, b) => (
          <g key={`b${b}`} className="mr-barhead" onPointerDown={(e) => { e.stopPropagation(); p.onSelectBar(p.selectedBar === b ? null : b); }}>
            <rect x={xOf(b * ctx.beatsPerBar)} y={HEAD - 16} width={Math.min(ctx.beatsPerBar, ctx.totalBeats - b * ctx.beatsPerBar) * beatW} height={16}
              className={p.selectedBar === b ? 'mr-barhead-on' : 'mr-barhead-bg'} />
            <text x={xOf(b * ctx.beatsPerBar) + 5} y={HEAD - 4.5} className="mr-barnum">bar {b + 1}</text>
          </g>
        ))}
        {ctx.segments.map((seg, s) => (
          <g key={`c${s}`}>
            <line x1={xOf(seg.start)} x2={xOf(seg.start)} y1={2} y2={height} className="mr-chordline" />
            <text x={xOf(seg.start) + 5} y={14} className={`mr-chord numeral-${seg.map.chord.func}`}>{chordSymbol(seg.map.chord)}</text>
          </g>
        ))}
        {/* pitch gutter */}
        {Array.from({ length: rows }, (_, r) => {
          const midi = ctx.hi - r;
          const inScale = ctx.scalePcs.includes(mod12(midi));
          return (
            <text key={`g${r}`} x={GUTTER - 5} y={HEAD + r * ROW + ROW - 3.5} textAnchor="end"
              className={inScale ? 'mr-pitch' : 'mr-pitch mr-pitch-off'}>{name(midi)}</text>
          );
        })}
        {/* the notes */}
        {notes.map((n) => (
          <g key={n.id} onPointerDown={(e) => downOnNote(e, n)}
            onDoubleClick={(e) => { e.stopPropagation(); if (!n.locked) p.onChange(p.notes.filter((x) => x.id !== n.id)); }}>
            <rect x={xOf(n.beat) + 0.5} y={yOf(n.midi) + 1} width={Math.max(4, n.dur * beatW - 1.5)} height={ROW - 2} rx={3}
              className={`mn mn-${kindOf(ctx, n.beat, n.midi)}${n.id === p.selectedId ? ' mn-sel' : ''}${n.locked ? ' mn-locked' : ''}`} />
            {n.locked && <text x={xOf(n.beat) + 3} y={yOf(n.midi) + ROW - 3.5} className="mn-lock">L</text>}
          </g>
        ))}
        {p.stepBeat != null && <line x1={xOf(p.stepBeat) + 1} x2={xOf(p.stepBeat) + 1} y1={HEAD - 16} y2={height} className="mr-stepcursor" />}
        {playhead !== null && <line x1={xOf(playhead)} x2={xOf(playhead)} y1={HEAD - 16} y2={height} className="mr-playhead" />}
      </svg>
    </div>
  );
}
