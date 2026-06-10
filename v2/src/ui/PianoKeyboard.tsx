// A two-octave slice of a standard piano (C4–C6): 15 white keys, black keys
// in the usual 2-3 groups. Lit keys = what you press.

import { PIANO_LAYOUT, PIANO_WHITE_COUNT } from '../piano/piano';
import { LitKey } from './Op1Keyboard';

export interface PianoKeyboardProps {
  /** key index (0..24) -> label/root info */
  lit: Map<number, LitKey>;
  compact?: boolean;
}

export function PianoKeyboard({ lit, compact = false }: PianoKeyboardProps) {
  const u = compact ? 19 : 30; // white-key width
  const pad = compact ? 4 : 6;
  const whiteH = u * (compact ? 3.0 : 3.3);
  const blackH = whiteH * 0.6;
  const width = PIANO_WHITE_COUNT * u + pad * 2;
  const height = whiteH + pad * 2;
  const r = compact ? 2 : 3;
  const whites = PIANO_LAYOUT.filter((k) => k.color === 'white');
  const blacks = PIANO_LAYOUT.filter((k) => k.color === 'black');

  return (
    <svg className="pn-kb" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={r + 2} className="pn-body" />
      {whites.map((k) => {
        const hit = lit.get(k.index);
        const x = pad + k.x * u + 0.75;
        return (
          <g key={k.index}>
            <rect x={x} y={pad} width={u - 1.5} height={whiteH} rx={r}
              className={hit ? (hit.isRoot ? 'pn-key-root' : 'pn-key-lit') : 'pn-white'} />
            {hit && (
              <text x={x + (u - 1.5) / 2} y={pad + whiteH - (compact ? 4 : 7)} textAnchor="middle"
                className={compact ? 'pn-label pn-label-sm' : 'pn-label'}>{hit.label}</text>
            )}
          </g>
        );
      })}
      {blacks.map((k) => {
        const hit = lit.get(k.index);
        const w = u * 0.62;
        const cx = pad + (k.x + 0.5) * u;
        return (
          <g key={k.index}>
            <rect x={cx - w / 2} y={pad} width={w} height={blackH} rx={r}
              className={hit ? (hit.isRoot ? 'pn-key-root' : 'pn-key-lit') : 'pn-black'} />
            {hit && (
              <text x={cx} y={pad + blackH - (compact ? 4 : 6)} textAnchor="middle"
                className={compact ? 'pn-label pn-label-sm' : 'pn-label'}>{hit.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
