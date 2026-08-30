// The OP-1 Field keyboard, drawn the way the hardware looks: 14 flat bottom
// keys, 10 raised top keys in 3-2-3-2 groups. Lit keys = what you press;
// `flashIndex` pulses the melody note during playback.

import { OP1_LAYOUT } from '../op1/op1';

export interface LitKey {
  label: string;
  isRoot: boolean;
}

export interface Op1KeyboardProps {
  /** key index (0..23) -> label/root info */
  lit: Map<number, LitKey>;
  flashIndex?: number | null;
  compact?: boolean;
  /** scale to the container's width (viewBox keeps the proportions) */
  fluid?: boolean;
  /** play-along feedback: key index -> hit (green) or miss (red) */
  judge?: Map<number, 'hit' | 'miss'>;
}

export function Op1Keyboard({ lit, flashIndex = null, compact = false, fluid = false, judge }: Op1KeyboardProps) {
  const u = compact ? 22 : 34;
  const pad = compact ? 5 : 8;
  const topH = u * 1.05;
  const botH = u * 1.5;
  const gap = 4;
  const width = 14 * u + pad * 2;
  const height = topH + botH + gap + pad * 2;
  const r = compact ? 3.5 : 5;

  const keyClass = (index: number, base: string): string => {
    const verdict = judge?.get(index);
    if (verdict) return verdict === 'hit' ? 'op1-key-hit' : 'op1-key-miss';
    if (index === flashIndex) return 'op1-key-flash';
    const hit = lit.get(index);
    if (hit) return hit.isRoot ? 'op1-key-root' : 'op1-key-lit';
    return base;
  };

  return (
    <svg className="op1-kb" viewBox={`0 0 ${width} ${height}`}
      {...(fluid ? { style: { width: '100%', height: 'auto', display: 'block' } } : { width, height })}>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={r + 3} className="op1-body" />
      {OP1_LAYOUT.map((k) => {
        const hit = lit.get(k.index);
        if (k.row === 'bottom') {
          const x = pad + k.x * u + 1.5;
          const y = pad + topH + gap;
          return (
            <g key={k.index}>
              <rect x={x} y={y} width={u - 3} height={botH} rx={r} className={keyClass(k.index, 'op1-key-bottom')} />
              {hit && (
                <text x={x + (u - 3) / 2} y={y + botH - (compact ? 4 : 7)} textAnchor="middle"
                  className={compact ? 'op1-label op1-label-sm' : 'op1-label'}>{hit.label}</text>
              )}
            </g>
          );
        }
        const w = u * 0.66;
        const cx = pad + (k.x + 0.5) * u;
        const y = pad;
        return (
          <g key={k.index}>
            <rect x={cx - w / 2} y={y} width={w} height={topH} rx={r} className={keyClass(k.index, 'op1-key-top')} />
            {hit && (
              <text x={cx} y={y + topH - (compact ? 4 : 6)} textAnchor="middle"
                className={compact ? 'op1-label op1-label-sm' : 'op1-label'}>{hit.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
