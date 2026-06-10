// SVG fretboards: a compact chord grid for cards, and a full-neck scale map.

import { PitchClass } from '../theory/notes';
import { Fret, STRING_NAMES } from '../guitar/shapes';
import { FretboardNote, MAX_FRET } from '../guitar/voicing';

export function FretboardChord({ voicing }: { voicing: { frets: Fret[] } }) {
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
  const rootString = voicing.frets.findIndex((f) => f !== 'x');

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
  labelOf: (pc: PitchClass) => string;
  /** string names, low to high — defaults to 6-string guitar */
  names?: string[];
  maxFret?: number;
}

const MARKERS = [3, 5, 7, 9, 12, 15];

export function FretboardScale({ notes, box, labelOf, names = STRING_NAMES, maxFret = MAX_FRET }: ScaleMapProps) {
  const strings = names.length;
  const fw = 44;
  const openW = 30;
  const left = 22;
  const rowH = 21;
  const top = 12;
  const width = left + openW + maxFret * fw + 14;
  const height = top + (strings - 1) * rowH + 34;
  const xOf = (fret: number) => (fret === 0 ? left + openW / 2 : left + openW + (fret - 0.5) * fw);
  const yOf = (string: number) => top + (strings - 1 - string) * rowH;

  return (
    <svg className="fb-scale" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      {Array.from({ length: strings }, (_, s) => (
        <g key={s}>
          <text x={left - 10} y={yOf(s) + 3.5} className="fb-string-name" textAnchor="middle">{names[s]}</text>
          <line x1={left + openW} y1={yOf(s)} x2={left + openW + maxFret * fw} y2={yOf(s)}
            stroke="currentColor" strokeWidth={s < strings / 2 ? 1.4 : 1} opacity={0.3} />
        </g>
      ))}
      {Array.from({ length: maxFret + 1 }, (_, f) => (
        <line key={f} x1={left + openW + f * fw} y1={top} x2={left + openW + f * fw} y2={top + (strings - 1) * rowH}
          stroke="currentColor" strokeWidth={f === 0 ? 3 : 1} opacity={f === 0 ? 0.7 : 0.18} />
      ))}
      {MARKERS.filter((f) => f <= maxFret).map((f) => (
        <text key={f} x={xOf(f)} y={top + (strings - 1) * rowH + 18} className="fb-marker" textAnchor="middle">
          {f === 12 ? '12 ··' : f}
        </text>
      ))}
      {notes.map((n) => {
        const inBox = box.has(`${n.string}:${n.fret}`);
        const cls = n.isRoot ? 'fb-dot-root' : inBox ? 'fb-dot-box' : 'fb-dot-faint';
        return (
          <g key={`${n.string}:${n.fret}`}>
            <circle cx={xOf(n.fret)} cy={yOf(n.string)} r={8.4} className={cls} />
            <text x={xOf(n.fret)} y={yOf(n.string) + 2.8} className="fb-dot-text" textAnchor="middle">
              {labelOf(n.pc)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
