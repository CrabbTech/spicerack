// The OP-1 Field keyboard, drawn the way the hardware looks: 14 flat bottom
// keys, 10 raised top keys in 3-2-3-2 groups. Lit keys = what you press.

import { OP1_LAYOUT } from '../op1/op1';
import { NotePaint, paintKind } from './paint';

export interface LitKey {
  label: string;
  isRoot: boolean;
  /** solo-map styling; absent on plain chord diagrams */
  paint?: NotePaint;
}

export interface Op1KeyboardProps {
  /** key index (0..23) -> label/root info */
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

/** Shared by both keyboards: fill class plus ring overlays for a key. */
export function keyLook(hit: LitKey | undefined, base: string, prefix: string): string {
  if (!hit) return base;
  if (!hit.paint) return hit.isRoot ? `${prefix}-key-root` : `${prefix}-key-lit`;
  // a note the current drill has switched off keeps its label but goes back to a bare key
  return hit.paint.off || hit.paint.role === 'ghost' ? base : `${base} kb-r kb-r-${paintKind(hit.paint)}`;
}

export function Op1Keyboard({ lit, compact = false, large = false, cursor, pinned, onKey, held, caps }: Op1KeyboardProps) {
  const u = compact ? 22 : large ? 50 : 34;
  const pad = compact ? 5 : 8;
  const topH = u * 1.05;
  const botH = u * 1.5;
  const gap = 4;
  const width = 14 * u + pad * 2;
  const height = topH + botH + gap + pad * 2;
  const r = compact ? 3.5 : 5;

  return (
    <svg className="op1-kb" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={r + 3} className="op1-body" />
      {OP1_LAYOUT.map((k) => {
        const hit = lit.get(k.index);
        const bottom = k.row === 'bottom';
        const w = bottom ? u - 3 : u * 0.66;
        const h = bottom ? botH : topH;
        const x = bottom ? pad + k.x * u + 1.5 : pad + (k.x + 0.5) * u - w / 2;
        const y = bottom ? pad + topH + gap : pad;
        const paint = hit?.paint;
        return (
          <g key={k.index} className={onKey ? 'kb-key' : undefined} onClick={onKey ? () => onKey(k.index) : undefined}>
            <rect x={x} y={y} width={w} height={h} rx={r}
              className={keyLook(hit, bottom ? 'op1-key-bottom' : 'op1-key-top', 'op1')} />
            {paint?.landing && !paint.off && <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={r - 1} className="kb-ring-landing" />}
            {paint?.target && !paint.off && <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={r - 1} className="kb-ring-target" />}
            {pinned?.has(k.index) && <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx={r} className="kb-ring-pinned" />}
            {cursor === k.index && <rect x={x} y={y} width={w} height={h} rx={r} className="kb-cursor" />}
            {held?.has(k.index) && <rect x={x} y={y} width={w} height={h} rx={r} className="kb-held" />}
            {caps?.has(k.index) && <text x={x + w / 2} y={y + 11} textAnchor="middle" className="kb-cap">{caps.get(k.index)}</text>}
            {hit && (
              <text x={x + w / 2} y={y + h - (compact ? 4 : bottom ? 7 : 6)} textAnchor="middle"
                className={`${compact ? 'op1-label op1-label-sm' : large ? 'op1-label kb-label-lg' : 'op1-label'}${paint ? ` kb-t-${paintKind(paint)}${paint.off ? ' kb-t-off' : ''}` : ''}`}>
                {hit.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
