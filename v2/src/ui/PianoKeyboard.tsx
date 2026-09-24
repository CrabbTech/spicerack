// A two-octave slice of a standard piano (C4–C6): 15 white keys, black keys
// in the usual 2-3 groups. Lit keys = what you press.

import { PIANO_LAYOUT, PIANO_WHITE_COUNT } from '../piano/piano';
import { LitKey, keyLook } from './Op1Keyboard';
import { paintKind } from './paint';

export interface PianoKeyboardProps {
  /** key index (0..24) -> label/root info */
  lit: Map<number, LitKey>;
  compact?: boolean;
  /** solo-lab size: readable from behind an instrument */
  large?: boolean;
  /** key the demo lick is sounding right now */
  cursor?: number | null;
  /** keys pinned by a click (same note, everywhere) */
  pinned?: Set<number>;
  onKey?: (index: number) => void;
  /** keys being played into the app right now (mic / MIDI / keyboard) */
  held?: Set<number>;
  /** computer-keyboard legend per key, while the keyboard is the input */
  caps?: Map<number, string>;
}

export function PianoKeyboard({ lit, compact = false, large = false, cursor, pinned, onKey, held, caps }: PianoKeyboardProps) {
  const u = compact ? 19 : large ? 46 : 30; // white-key width
  const pad = compact ? 4 : 6;
  const whiteH = u * (compact ? 3.0 : 3.3);
  const blackH = whiteH * 0.6;
  const width = PIANO_WHITE_COUNT * u + pad * 2;
  const height = whiteH + pad * 2;
  const r = compact ? 2 : 3;
  // whites first so the black keys paint on top of them
  const ordered = [...PIANO_LAYOUT.filter((k) => k.color === 'white'), ...PIANO_LAYOUT.filter((k) => k.color === 'black')];

  return (
    <svg className="pn-kb" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={r + 2} className="pn-body" />
      {ordered.map((k) => {
        const hit = lit.get(k.index);
        const white = k.color === 'white';
        const w = white ? u - 1.5 : u * 0.62;
        const h = white ? whiteH : blackH;
        const x = white ? pad + k.x * u + 0.75 : pad + (k.x + 0.5) * u - w / 2;
        const paint = hit?.paint;
        return (
          <g key={k.index} className={onKey ? 'kb-key' : undefined} onClick={onKey ? () => onKey(k.index) : undefined}>
            <rect x={x} y={pad} width={w} height={h} rx={r} className={keyLook(hit, white ? 'pn-white' : 'pn-black', 'pn')} />
            {paint?.landing && !paint.off && <rect x={x + 2} y={pad + 2} width={w - 4} height={h - 4} rx={r} className="kb-ring-landing" />}
            {paint?.target && !paint.off && <rect x={x + 2} y={pad + 2} width={w - 4} height={h - 4} rx={r} className="kb-ring-target" />}
            {pinned?.has(k.index) && <rect x={x + 1} y={pad + 1} width={w - 2} height={h - 2} rx={r} className="kb-ring-pinned" />}
            {cursor === k.index && <rect x={x} y={pad} width={w} height={h} rx={r} className="kb-cursor" />}
            {held?.has(k.index) && <rect x={x} y={pad} width={w} height={h} rx={r} className="kb-held" />}
            {caps?.has(k.index) && <text x={x + w / 2} y={pad + 11} textAnchor="middle" className="kb-cap">{caps.get(k.index)}</text>}
            {hit && (
              <text x={x + w / 2} y={pad + h - (compact ? 4 : white ? 7 : 6)} textAnchor="middle"
                className={`${compact ? 'pn-label pn-label-sm' : large ? 'pn-label kb-label-lg' : 'pn-label'}${paint ? ` kb-t-${paintKind(paint)}${paint.off ? ' kb-t-off' : ''}` : ''}`}>
                {hit.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
