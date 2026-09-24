// The crab sprite as an SVG: one rect per pixel, crisp edges, colours from
// the stylesheet. `size` is the rendered width; the grid never blurs.
// `walking` draws both frames and lets a steps() animation show them in turn.

import { CRAB_FRAMES, CRAB_H, CRAB_W } from './pixelCrab';

function Frames({ walking }: { walking: boolean }) {
  return (
    <>
      {CRAB_FRAMES.slice(0, walking ? 2 : 1).map((frame, f) => (
        <g key={f} className={`px-frame px-f${f}`}>
          {frame.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1} height={1} className={`px-${p.kind}`} />)}
        </g>
      ))}
    </>
  );
}

export function PixelCrab({ size = 32, className = '', title, walking = false }: { size?: number; className?: string; title?: string; walking?: boolean }) {
  return (
    <svg className={`px-crab ${walking ? 'px-walking' : ''} ${className}`} width={size} height={(size * CRAB_H) / CRAB_W} viewBox={`0 0 ${CRAB_W} ${CRAB_H}`}
      shapeRendering="crispEdges" aria-label={title ?? 'crab'} role="img">
      <Frames walking={walking} />
    </svg>
  );
}

/** The same sprite inside another SVG, placed by its centre — for cursors on diagrams. */
export function PixelCrabGlyph({ x, y, width, className = '', walking = false }: { x: number; y: number; width: number; className?: string; walking?: boolean }) {
  const s = width / CRAB_W;
  return (
    <g className={`px-crab ${walking ? 'px-walking' : ''} ${className}`} transform={`translate(${x - width / 2} ${y - (CRAB_H * s) / 2}) scale(${s})`} shapeRendering="crispEdges">
      <Frames walking={walking} />
    </g>
  );
}
