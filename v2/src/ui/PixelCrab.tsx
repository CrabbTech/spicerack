// The crab sprite as an SVG: one rect per pixel, crisp edges, colours from
// the stylesheet. `size` is the rendered width; the grid never blurs.

import { CRAB_H, CRAB_PIXELS, CRAB_W } from './pixelCrab';

export function PixelCrab({ size = 32, className = '', title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg className={`px-crab ${className}`} width={size} height={(size * CRAB_H) / CRAB_W} viewBox={`0 0 ${CRAB_W} ${CRAB_H}`}
      shapeRendering="crispEdges" aria-label={title ?? 'crab'} role="img">
      {CRAB_PIXELS.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1} height={1} className={`px-${p.kind}`} />)}
    </svg>
  );
}

/** The same sprite inside another SVG, placed by its centre — for cursors on diagrams. */
export function PixelCrabGlyph({ x, y, width, className = '' }: { x: number; y: number; width: number; className?: string }) {
  const s = width / CRAB_W;
  return (
    <g className={`px-crab ${className}`} transform={`translate(${x - width / 2} ${y - (CRAB_H * s) / 2}) scale(${s})`} shapeRendering="crispEdges">
      {CRAB_PIXELS.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1} height={1} className={`px-${p.kind}`} />)}
    </g>
  );
}
