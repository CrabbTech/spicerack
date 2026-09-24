// SVG fretboards: a compact chord grid for cards, and a full-neck scale map.

import { PitchClass } from '../theory/notes';
import { Fret, STRING_NAMES } from '../guitar/shapes';
import { FretboardNote, MAX_FRET } from '../guitar/voicing';
import { NotePaint, paintKind } from './paint';

export function FretboardChord({ voicing, rootIndex }: { voicing: { frets: Fret[] }; /** string carrying the root, when it isn't the lowest one (inversions) */ rootIndex?: number }) {
  const strings = voicing.frets.length;
  const fretted = voicing.frets.filter((f): f is number => f !== 'x' && f > 0);
  const hi = fretted.length ? Math.max(...fretted) : 4;
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const windowStart = hi <= 4 ? 1 : lo;
  const rows = Math.max(4, hi - windowStart + 1);
  const sp = 17;
  const fretH = 20;
  const top = 24;
  const left = 26;
  const width = left + (strings - 1) * sp + 12;
  const height = top + rows * fretH + 10;
  const rootString = rootIndex ?? voicing.frets.findIndex((f) => f !== 'x');

  return (
    <svg className="fb-chord" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {windowStart > 1 && (
        <text x={left - 8} y={top + fretH * 0.65} className="fb-fret-label" textAnchor="end">{windowStart}</text>
      )}
      {/* nut or top fret line */}
      <line x1={left} y1={top} x2={left + (strings - 1) * sp} y2={top}
        stroke="currentColor" strokeWidth={windowStart === 1 ? 4 : 1.2} opacity={windowStart === 1 ? 0.9 : 0.5} />
      {Array.from({ length: rows }, (_, r) => (
        <line key={r} x1={left} y1={top + (r + 1) * fretH} x2={left + (strings - 1) * sp} y2={top + (r + 1) * fretH}
          stroke="currentColor" strokeWidth={1} opacity={0.35} />
      ))}
      {Array.from({ length: strings }, (_, s) => (
        <line key={s} x1={left + s * sp} y1={top} x2={left + s * sp} y2={top + rows * fretH}
          stroke="currentColor" strokeWidth={1} opacity={0.5} />
      ))}
      {voicing.frets.map((f, s) => {
        const x = left + s * sp;
        if (f === 'x') {
          return <text key={s} x={x} y={top - 7} className="fb-mark" textAnchor="middle">×</text>;
        }
        if (f === 0) {
          return <circle key={s} cx={x} cy={top - 10} r={4} fill="none" stroke="currentColor" strokeWidth={1.4} />;
        }
        const y = top + (f - windowStart + 0.5) * fretH;
        const isRoot = s === rootString;
        return (
          <g key={s}>
            <circle cx={x} cy={y} r={6.5} className={isRoot ? 'fb-dot-root' : 'fb-dot'} />
          </g>
        );
      })}
    </svg>
  );
}

export interface ScaleMapProps {
  notes: FretboardNote[];
  /** "string:fret" keys belonging to the highlighted position box */
  box: Set<string>;
  /** how to draw each pitch class — label, role, rings */
  paintOf: (pc: PitchClass) => NotePaint | undefined;
  /** string names, low to high — defaults to 6-string guitar */
  names?: string[];
  maxFret?: number;
  /** open-string midis, low to high: makes dots clickable and lets the demo cursor find them */
  openMidi?: number[];
  /** midi the demo lick is sounding right now */
  cursorMidi?: number | null;
  /** pitch class pinned by a click — every copy of it on the neck gets a ring */
  pinnedPc?: PitchClass | null;
  onNote?: (midi: number, string: number) => void;
  /** notes being played into the app right now (mic / MIDI / keyboard) */
  heldMidis?: number[];
  /** mirror the neck for left-handed players: nut on the right */
  lefty?: boolean;
  /** positions of a chord grip the player already knows — drawn as squares so it reads as "your shape" */
  grip?: { string: number; fret: number }[];
}

const MARKERS = [3, 5, 7, 9, 12, 15];
const DOT_R: Record<string, number> = { root: 8.6, chord: 8.6, outside: 8.6, plain: 8.4, color: 7.6, avoid: 7, rub: 7, ghost: 6.4 };

export function FretboardScale({
  notes, box, paintOf, names = STRING_NAMES, maxFret = MAX_FRET, openMidi, cursorMidi, pinnedPc, onNote, heldMidis, lefty = false, grip,
}: ScaleMapProps) {
  const strings = names.length;
  const fw = 44;
  const openW = 30;
  const left = 22;
  const rowH = 21;
  const top = 12;
  const width = left + openW + maxFret * fw + 14;
  const height = top + (strings - 1) * rowH + 34;
  const flip = (x: number) => (lefty ? width - x : x);
  const xOf = (fret: number) => flip(fret === 0 ? left + openW / 2 : left + openW + (fret - 0.5) * fw);
  // a held pitch lights inside the box when it lives there, anywhere on the neck when it doesn't
  const heldInBox = new Set((heldMidis ?? []).filter((m) => openMidi && notes.some((n) => box.has(`${n.string}:${n.fret}`) && openMidi[n.string] + n.fret === m)));
  const yOf = (string: number) => top + (strings - 1 - string) * rowH;

  return (
    <svg className="fb-scale" width="100%" style={{ maxWidth: width * 1.5 }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      {Array.from({ length: strings }, (_, s) => (
        <g key={s}>
          <text x={flip(left - 10)} y={yOf(s) + 3.5} className="fb-string-name" textAnchor="middle">{names[s]}</text>
          <line x1={flip(left + openW)} y1={yOf(s)} x2={flip(left + openW + maxFret * fw)} y2={yOf(s)}
            stroke="currentColor" strokeWidth={s < strings / 2 ? 1.4 : 1} opacity={0.3} />
        </g>
      ))}
      {Array.from({ length: maxFret + 1 }, (_, f) => (
        <line key={f} x1={flip(left + openW + f * fw)} y1={top} x2={flip(left + openW + f * fw)} y2={top + (strings - 1) * rowH}
          stroke="currentColor" strokeWidth={f === 0 ? 3 : 1} opacity={f === 0 ? 0.7 : 0.18} />
      ))}
      {MARKERS.filter((f) => f <= maxFret).map((f) => (
        <text key={f} x={xOf(f)} y={top + (strings - 1) * rowH + 18} className="fb-marker" textAnchor="middle">
          {f === 12 ? '12 ··' : f}
        </text>
      ))}
      {grip?.map((g) => (
        <rect key={`grip${g.string}:${g.fret}`} x={xOf(g.fret) - 12.5} y={yOf(g.string) - 10} width={25} height={20} rx={5} className="fb-grip" />
      ))}
      {notes.map((n) => {
        const paint = paintOf(n.pc);
        if (!paint) return null;
        const inBox = box.has(`${n.string}:${n.fret}`);
        const kind = paintKind(paint);
        const live = inBox && !paint.off;
        const midi = openMidi ? openMidi[n.string] + n.fret : undefined;
        const cx = xOf(n.fret);
        const cy = yOf(n.string);
        const r = DOT_R[kind] ?? 8.4;
        return (
          <g key={`${n.string}:${n.fret}`} className={`fb-note${onNote ? ' fb-note-click' : ''}${live ? '' : paint.off ? ' fb-off' : ' fb-out'}`}
            onClick={onNote && midi !== undefined ? () => onNote(midi, n.string) : undefined}>
            <circle cx={cx} cy={cy} r={r} className={`fb-r-${kind}`} />
            {live && paint.landing && <circle cx={cx} cy={cy} r={r + 2.6} className="fb-ring-landing" />}
            {live && paint.target && <circle cx={cx} cy={cy} r={r + 2.6} className="fb-ring-target" />}
            {pinnedPc === n.pc && <circle cx={cx} cy={cy} r={r + 2.6} className="fb-ring-pinned" />}
            {inBox && cursorMidi != null && midi === cursorMidi && <circle cx={cx} cy={cy} r={r + 3.4} className="fb-cursor" />}
            {midi !== undefined && heldMidis?.includes(midi) && (inBox || !heldInBox.has(midi)) && <circle cx={cx} cy={cy} r={r + 3.4} className="fb-held" />}
            <text x={cx} y={cy + 2.8} className={`fb-dot-text fb-t-${kind}`} textAnchor="middle">{paint.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
