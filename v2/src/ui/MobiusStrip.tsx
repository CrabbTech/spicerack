// The crab canon's picture: the written line laid along a Möbius strip, with
// two readers on it while the loop runs — the playhead going round, and the
// crab going the other way, reading the same notes from the end. In the table
// canon the crab also reads them upside down, so its copy is ghosted in.

import { useEffect, useState } from 'react';
import { LeadNote } from '../theory/lick';
import { CrabMode, MirrorSpec, mirrorPitch } from '../theory/crab';
import { audio } from '../audio/engine';
import { StripView, stripFacets, stripPoint } from './mobius';

export interface MobiusStripProps {
  /** the written line, in loop beats */
  notes: LeadNote[];
  total: number;
  perBar: number;
  lo: number;
  hi: number;
  mode: CrabMode;
  spec: MirrorSpec;
  /** follow the transport: cursors walk, the strip turns */
  playing: boolean;
  crabOn: boolean;
}

const W = 560;
const H = 300;
const FACETS = 112;
const BASE: Omit<StripView, 'spin'> = { R: 134, w: 46, tilt: 1.05, cx: W / 2, cy: H / 2, eye: 900 };

type Drawable =
  | { kind: 'facet'; z: number; points: string; front: boolean; shade: number }
  | { kind: 'tick'; z: number; x1: number; y1: number; x2: number; y2: number; seam: boolean }
  | { kind: 'dot'; z: number; x: number; y: number; r: number; cls: string }
  | { kind: 'cursor'; z: number; x: number; y: number; scale: number; crab: boolean };

export function MobiusStrip(p: MobiusStripProps) {
  const [spin, setSpin] = useState(0.6);
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    if (!p.playing) {
      setAt(null);
      return undefined;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const pos = audio.position();
      setAt(pos && p.total > 0 ? pos.beat % p.total : null);
      setSpin((s) => s + (now - last) * 0.00022);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [p.playing, p.total]);

  const view: StripView = { ...BASE, spin };
  const mid = (p.lo + p.hi) / 2;
  const half = Math.max(6, (p.hi - p.lo) / 2);
  const uOf = (beat: number) => (2 * Math.PI * beat) / Math.max(1e-6, p.total);
  const vOf = (midi: number) => Math.max(-0.85, Math.min(0.85, (midi - mid) / half));
  const sounding = (t: number): LeadNote | undefined => {
    let hit: LeadNote | undefined;
    for (const n of p.notes) if (n.beat <= t + 1e-6 && n.beat + n.dur > t + 1e-6) hit = n;
    return hit;
  };

  const items: Drawable[] = stripFacets(FACETS, view).map((f) => ({ kind: 'facet', ...f }));

  // bar lines; the seam is where the loop comes round
  const bars = Math.max(1, Math.round(p.total / p.perBar));
  for (let b = 0; b < bars; b++) {
    const a = stripPoint(uOf(b * p.perBar), -1, view);
    const c = stripPoint(uOf(b * p.perBar), 1, view);
    items.push({ kind: 'tick', z: (a.z + c.z) / 2 + 0.5, x1: a.x, y1: a.y, x2: c.x, y2: c.y, seam: b === 0 });
  }

  // one set of notes, two readers: what the playhead is on, and what the crab is reading from the other end
  const fwd = at === null ? undefined : sounding(at);
  const read = at === null ? undefined : sounding(p.total - at);
  for (const n of p.notes) {
    const pt = stripPoint(uOf(n.beat + n.dur / 2), vOf(n.midi), view);
    const hot = n === fwd ? ' mobius-dot-hot' : n === read ? ' mobius-dot-read' : '';
    items.push({ kind: 'dot', z: pt.z + 1, x: pt.x, y: pt.y, r: (hot ? 4.6 : 3.4) * pt.scale, cls: `mobius-dot${hot}` });
    if (p.mode === 'table') {
      const g = stripPoint(uOf(n.beat + n.dur / 2), vOf(mirrorPitch(n.midi, p.spec)), view);
      items.push({ kind: 'dot', z: g.z + 0.9, x: g.x, y: g.y, r: 2.6 * g.scale, cls: 'mobius-dot mobius-dot-ghost' });
    }
  }

  if (at !== null) {
    const f = stripPoint(uOf(at), fwd ? vOf(fwd.midi) : 0, view);
    items.push({ kind: 'cursor', z: f.z + 2, x: f.x, y: f.y, scale: f.scale, crab: false });
    if (p.crabOn) {
      const v = read ? vOf(p.mode === 'table' ? mirrorPitch(read.midi, p.spec) : read.midi) : 0;
      const c = stripPoint(uOf(p.total - at), v, view);
      items.push({ kind: 'cursor', z: c.z + 2, x: c.x, y: c.y, scale: c.scale, crab: true });
    }
  }
  items.sort((a, b) => a.z - b.z);

  return (
    <svg className="mobius" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="the melody on a Möbius strip">
      {items.map((it, i) => {
        switch (it.kind) {
          case 'facet':
            return <polygon key={i} points={it.points} className={`mobius-face ${it.front ? 'mobius-front' : 'mobius-back'}`} style={{ opacity: 0.3 + 0.6 * it.shade }} />;
          case 'tick':
            return <line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} className={`mobius-tick${it.seam ? ' mobius-seam' : ''}`} />;
          case 'dot':
            return <circle key={i} cx={it.x} cy={it.y} r={it.r} className={it.cls} />;
          case 'cursor':
            return it.crab
              ? <text key={i} x={it.x} y={it.y} className="mobius-crab" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 18 * it.scale }}>🦀</text>
              : <circle key={i} cx={it.x} cy={it.y} r={7 * it.scale} className="mobius-play" />;
        }
      })}
    </svg>
  );
}
